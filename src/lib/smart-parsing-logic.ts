import { createServiceClient } from '@/lib/supabase-service'
import { v4 as uuidv4 } from 'uuid'
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'
import { GoogleAIFileManager } from "@google/generative-ai/server"
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import ExcelJS from 'exceljs'
import { ParsedPart, normalizePartData, retryWithBackoff } from './parsing-logic'

// Re-export type
export type { ParsedPart }

// ============================================================================
// Main Entry Point
// ============================================================================

export async function processSmartFileWithAI(
    storagePath: string,
    projectId: string,
    filename: string,
    fileType: 'PDF' | 'EXCEL' | 'DXF' | 'OTHER',
    instruction: string = 'IMPORT_PARTS'
): Promise<{ parts: ParsedPart[], raw: any }> {

    // 1. Download File
    const supabase = createServiceClient()
    const { data: fileData, error: downloadError } = await supabase.storage
        .from('Projects')
        .download(storagePath)

    if (downloadError || !fileData) throw new Error("Failed to download file from storage")
    const arrayBuffer = await fileData.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // 2. Route by Type
    if (fileType === 'DXF') {
        return processDxf(filename, storagePath)
    } else if (fileType === 'EXCEL') {
        return processExcelWithAI(buffer, filename, storagePath, instruction)
    } else if (fileType === 'PDF') {
        return processPdfWithAI(buffer, filename, storagePath, instruction)
    } else {
        return { parts: [], raw: { message: "Unsupported file type", type: fileType } }
    }
}

// ============================================================================
// DXF Handler
// ============================================================================

function processDxf(filename: string, storagePath: string): { parts: ParsedPart[], raw: any } {
    // DXF is an attachment, generally not a source of parts list itself in this flow (unless we parse geometry, which is too advanced for now)
    // We just return it as a "Part" so it shows up in the list, but marked as DXF type
    // Actually, user wants DXF to be associated. 
    // If we return it as a "Part", the frontend can treat it. 
    // But ideally, DXFs are just "Raw Files" that get linked.
    // For now, let's return it as a dummy part so it appears in the JSON log if needed

    return {
        parts: [],
        raw: { filename, type: 'DXF', action: 'Indexed for association' }
    }
}

// ============================================================================
// Excel Handler
// ============================================================================

async function processExcelWithAI(buffer: Buffer, filename: string, drawingRef: string, instruction: string): Promise<{ parts: ParsedPart[], raw: any }> {
    // 1. Convert Excel to Text/CSV representation for AI
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer as any)

    const worksheet = workbook.worksheets[0] // Assume first sheet
    if (!worksheet) throw new Error("Excel file is empty")

    // Simple CSV-like dump
    const rows: string[] = []
    worksheet.eachRow((row, rowNumber) => {
        const values = (row.values as any[]).slice(1).map(v => String(v ?? '').trim()) // slice(1) because ExcelJS is 1-indexed and array includes [empty, val1, val2...]
        if (values.some(v => v.length > 0)) {
            rows.push(values.join(' | '))
        }
    })

    const csvContent = rows.join('\n')

    // 2. Call Gemini
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error("GEMINI_API_KEY missing")
    const genAI = new GoogleGenerativeAI(apiKey)

    // Schema
    const schema = {
        type: SchemaType.OBJECT,
        properties: {
            summary: { type: SchemaType.STRING, description: "A detailed summary of the document structure and content." },
            parts: {
                type: SchemaType.ARRAY,
                items: {
                    type: SchemaType.OBJECT,
                    properties: {
                        partNumber: { type: SchemaType.STRING },
                        description: { type: SchemaType.STRING },
                        quantity: { type: SchemaType.NUMBER },
                        material: { type: SchemaType.STRING },
                        thickness: { type: SchemaType.NUMBER },
                        width: { type: SchemaType.NUMBER },
                        length: { type: SchemaType.NUMBER },
                        profileType: { type: SchemaType.STRING },
                        profileDimensions: { type: SchemaType.STRING },
                        type: { type: SchemaType.STRING, enum: ["PROFILE", "PLATE"] },
                        // Assembly Fields
                        assemblyMark: { type: SchemaType.STRING },
                        parentMark: { type: SchemaType.STRING },
                        level: { type: SchemaType.NUMBER }
                    },
                    required: ["partNumber", "quantity"]
                }
            }
        }
    } as any

    let prompt = `
    Analyze this Excel/CSV extracted content (BOM) and extract ALL distinct parts.
    Current File: ${filename}
    
    DATA:
    ${csvContent.substring(0, 30000)}
    
    RULES:
    - Identify columns for Part Number, Qty, Material, Dimensions.
    - Profiles: e.g. HEA, IPE, RHS.
    - Plates: Thickness x Width x Length.
    - If dimensions are in separate columns, combine them.
    - IGNORE Header rows.
    - Provide a 'summary' string describing the table structure.
    `

    if (instruction === 'IMPORT_ASSEMBLY') {
        prompt += `\nSPECIAL: This is an ASSEMBLY LIST. Look for parent/child relationships if present (e.g. Assembly Mark vs Part Mark).`
    } else if (instruction === 'EXTRACT_CUTS') {
        prompt += `\nSPECIAL: This is a SAW LIST. Ensure you capture cut angles if provided.`
    }

    const model = genAI.getGenerativeModel({
        model: "gemini-3-flash-preview",
        generationConfig: { responseMimeType: "application/json", responseSchema: schema }
    })

    const result = await retryWithBackoff(() => model.generateContent(prompt))
    const resultText = result.response.text()
    console.log("----------------------------------------------------------------")
    console.log("🤖 AI RAW RESPONSE:", resultText)
    console.log("----------------------------------------------------------------")

    let rootData: any = {}
    try {
        rootData = JSON.parse(resultText)
    } catch (e) {
        throw new Error("Invalid JSON from AI")
    }

    // 3. Normalize
    const partsList = rootData.parts || []
    const processedParts = partsList.map((data: any) => {
        // Normalization
        const warnings: string[] = []
        const { profileType, profileDimensions } = normalizePartData(
            data.profileType || (data.type === 'PROFILE' ? 'PROFILE' : ''),
            data.profileDimensions || '',
            warnings
        )

        const isProfile = (data.type === 'PROFILE' || !!profileType)

        return {
            id: uuidv4(),
            filename,
            partNumber: String(data.partNumber || "UNKNOWN"),
            description: data.description || filename,
            quantity: Number(data.quantity) || 1,
            material: data.material || "S355",
            thickness: Number(data.thickness) || 0,
            width: Number(data.width) || 0,
            length: Number(data.length) || 0,
            profileType: profileType,
            profileDimensions: profileDimensions,
            type: isProfile ? 'PROFILE' : 'PLATE',
            confidence: 90,
            drawingRef,
            warnings,
            source: 'EXCEL',
            // Assembly Fields
            assemblyMark: data.assemblyMark,
            parentMark: data.parentMark,
            level: Number(data.level) || 0
        } as ParsedPart
    })

    return { parts: processedParts, raw: rootData }
}

// ============================================================================
// PDF Handler (Enhanced)
// ============================================================================

async function processPdfWithAI(buffer: Buffer, filename: string, drawingRef: string, instruction: string): Promise<{ parts: ParsedPart[], raw: any }> {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error("GEMINI_API_KEY missing")

    const genAI = new GoogleGenerativeAI(apiKey)
    const fileManager = new GoogleAIFileManager(apiKey)

    const schema = {
        type: SchemaType.OBJECT,
        properties: {
            fileType: { type: SchemaType.STRING, enum: ["DRAWING", "BOM", "OTHER"], description: "Classify the PDF document type" },
            summary: { type: SchemaType.STRING, description: "A detailed summary of the document structure and content." },
            parts: {
                type: SchemaType.ARRAY,
                items: {
                    type: SchemaType.OBJECT,
                    properties: {
                        partNumber: { type: SchemaType.STRING },
                        title: { type: SchemaType.STRING },
                        quantity: { type: SchemaType.NUMBER },
                        material: { type: SchemaType.STRING },
                        thickness: { type: SchemaType.NUMBER },
                        width: { type: SchemaType.NUMBER },
                        length: { type: SchemaType.NUMBER },
                        confidence: { type: SchemaType.NUMBER },
                        type: { type: SchemaType.STRING, enum: ["PROFILE", "PLATE"] },
                        profileType: { type: SchemaType.STRING },
                        profileDimensions: { type: SchemaType.STRING },
                        isSplit: { type: SchemaType.BOOLEAN },
                        cutAngles: { type: SchemaType.STRING },
                        // Assembly Fields
                        assemblyMark: { type: SchemaType.STRING },
                        parentMark: { type: SchemaType.STRING },
                        level: { type: SchemaType.NUMBER }
                    },
                    required: ["partNumber", "quantity"]
                }
            }
        }
    } as any

    const model = genAI.getGenerativeModel({
        model: "gemini-3-flash-preview",
        generationConfig: { responseMimeType: "application/json", responseSchema: schema }
    })

    // Temp file handling same as parsing-logic.ts
    const tempFilePath = path.join(os.tmpdir(), `upload-smart-${uuidv4()}.pdf`)
    await fs.writeFile(tempFilePath, buffer as any)

    const uploadResult = await fileManager.uploadFile(tempFilePath, {
        mimeType: "application/pdf",
        displayName: filename,
    })
    await fs.unlink(tempFilePath)

    let prompt = `
    Analyze this PDF. 
    1. Classify if it's a "DRAWING" (Visual representation of a part) or a "BOM" (List of parts/Table).
    2. Extract ALL parts found.
    
    CRITICAL:
    - If it's a Drawing, extract the single main part described.
    - If it's a BOM, extract ALL rows.
    - Look for Quantity, Material, Dimensions.
    - "RO" or "Round" -> Profile Type "CHS-EN10219" (unless clearly Round Bar "R").
    - Provide a 'summary' string describing the content.
    `

    if (instruction === 'IMPORT_ASSEMBLY') {
        prompt += `\nSPECIAL: This is an ASSEMBLY LIST. Pay attention to header info that might apply to all rows (e.g. Assembly Mark).`
    } else if (instruction === 'EXTRACT_CUTS') {
        prompt += `\nSPECIAL: This is a SAW LIST. Look closely for cut angles or mitre cuts (M1, M2).`
    }

    const result = await retryWithBackoff(() => model.generateContent([
        { fileData: { mimeType: uploadResult.file.mimeType, fileUri: uploadResult.file.uri } },
        prompt
    ]))

    const resultText = result.response.text()
    let rootData: any = {}
    try {
        rootData = JSON.parse(resultText)
    } catch (e) {
        throw new Error("Invalid JSON from AI")
    }

    // Normalization
    const partsList = rootData.parts || []

    // If it's a drawing but no parts returned, maybe fallback to filename? 
    // But usually AI finds it.

    const processedParts = partsList.map((data: any) => {
        const warnings: string[] = []
        const { profileType, profileDimensions } = normalizePartData(
            data.profileType || (data.type === 'PROFILE' ? 'PROFILE' : ''),
            data.profileDimensions || '',
            warnings
        )

        // Detect Split (same as before)
        let isSplit = !!data.isSplit
        let pDims = profileDimensions
        let pType = profileType

        if (pDims.includes('1/2') || pType.includes('1/2') || pType.includes('HALF') || pDims.includes('SPLIT')) {
            isSplit = true;
            pDims = pDims.replace('1/2', '').replace('HALF', '').trim();
            pType = pType.replace('1/2', '').replace('HALF', '').trim();
        }

        return {
            id: uuidv4(),
            filename,
            partNumber: String(data.partNumber || "UNKNOWN"),
            description: data.title || filename,
            quantity: Number(data.quantity) || 1,
            material: data.material || "S355",
            thickness: Number(data.thickness) || 0,
            width: Number(data.width) || 0,
            length: Number(data.length) || 0,
            profileType: pType,
            profileDimensions: pDims,
            type: (data.type === 'PROFILE' || !!pType) ? 'PROFILE' : 'PLATE',
            confidence: Number(data.confidence) || 85,
            drawingRef: drawingRef,
            warnings,
            isSplit,
            cutAngles: data.cutAngles || null,
            source: 'PDF',
            // Assembly Fields
            assemblyMark: data.assemblyMark,
            parentMark: data.parentMark,
            level: Number(data.level) || 0
        } as ParsedPart
    })

    return { parts: processedParts, raw: rootData }
}
