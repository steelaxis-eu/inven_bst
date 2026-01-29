import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'
import { GoogleAIFileManager } from "@google/generative-ai/server"
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { v4 as uuidv4 } from 'uuid'
import { retryWithBackoff } from './parsing-logic'

export interface ScanResult {
    filename: string
    description: string
    classification: 'PART_LIST' | 'ASSEMBLY_LIST' | 'SAW_LIST' | 'DRAWING' | 'OTHER'
    suggestedAction: 'IMPORT_PARTS' | 'IMPORT_ASSEMBLY' | 'EXTRACT_CUTS' | 'IGNORE' | 'ASSOCIATE'
    confidence: number
}

export async function scanFileWithAI(buffer: Buffer, filename: string): Promise<ScanResult> {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error("GEMINI_API_KEY missing")

    const genAI = new GoogleGenerativeAI(apiKey)
    const fileManager = new GoogleAIFileManager(apiKey)

    // Schema for Scanning
    const schema = {
        type: SchemaType.OBJECT,
        properties: {
            description: { type: SchemaType.STRING, description: "A concise description of the file content in less than 50 words." },
            classification: {
                type: SchemaType.STRING,
                enum: ['PART_LIST', 'ASSEMBLY_LIST', 'SAW_LIST', 'DRAWING', 'OTHER'],
                description: "The type of document."
            },
            suggestedAction: {
                type: SchemaType.STRING,
                enum: ['IMPORT_PARTS', 'IMPORT_ASSEMBLY', 'EXTRACT_CUTS', 'IGNORE', 'ASSOCIATE'],
                description: "The recommended action to take."
            },
            confidence: { type: SchemaType.NUMBER, description: "Confidence score between 0 and 100." }
        },
        required: ["description", "classification", "suggestedAction", "confidence"]
    } as any

    const model = genAI.getGenerativeModel({
        model: "gemini-3-flash-preview", // Fast/Cheap model
        generationConfig: { responseMimeType: "application/json", responseSchema: schema }
    })

    // Temp file handling
    const tempFilePath = path.join(os.tmpdir(), `scan-${uuidv4()}.pdf`) // Assume PDF for now, or handle extensions
    // Note: If buffer is Excel, we might want to convert to CSV first or just assume Excel = PART_LIST?
    // For now, let's assume this is primarily for PDF scanning as Excel is usually Parts.
    // However, the caller should handle file types ideally. 
    // If it's Excel, we can skip AI scan or do a quick text dump scan. 
    // Let's implement generic buffer handling for PDF.

    // Check extension
    const ext = path.extname(filename).toLowerCase()

    if (ext === '.xlsx' || ext === '.xls') {
        // Optimization: Skip AI for Excel, it's almost always a Part List
        return {
            filename,
            description: "Excel Spreadsheet detected. Likely a Parts List.",
            classification: 'PART_LIST',
            suggestedAction: 'IMPORT_PARTS',
            confidence: 95
        }
    }

    if (ext === '.dxf' || ext === '.dwg') {
        return {
            filename,
            description: "CAD Drawing File.",
            classification: 'DRAWING',
            suggestedAction: 'ASSOCIATE',
            confidence: 100
        }
    }

    // For PDFs:
    await fs.writeFile(tempFilePath, buffer)

    try {
        const uploadResult = await fileManager.uploadFile(tempFilePath, {
            mimeType: "application/pdf",
            displayName: filename,
        })

        const prompt = `
        Scan this document. 
        Describe it briefly (max 50 words).
        Classify it:
        - PART_LIST: A table of parts to manufacture.
        - ASSEMBLY_LIST: A hierarchical list of assemblies and sub-parts.
        - SAW_LIST: A list of profiles with cut lengths and angles.
        - DRAWING: A visual technical drawing of a part.
        - OTHER: Invoice, receipt, or unrelated text.
        
        Suggest Action:
        - IMPORT_PARTS: For Part Lists.
        - IMPORT_ASSEMBLY: For Assembly Lists.
        - EXTRACT_CUTS: For Saw Lists.
        - IGNORE: For Other.
        - ASSOCIATE: For Drawings (we associate them to parts).
        `

        const result = await retryWithBackoff(() => model.generateContent([
            { fileData: { mimeType: uploadResult.file.mimeType, fileUri: uploadResult.file.uri } },
            prompt
        ]))

        const resultText = result.response.text()
        const data = JSON.parse(resultText) as ScanResult

        // Ensure filename is passed through
        data.filename = filename

        return data

    } finally {
        // Cleanup
        await fs.unlink(tempFilePath).catch(() => { })
    }
}
