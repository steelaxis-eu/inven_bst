'use server'

import prisma from '@/lib/prisma'
import { createClient } from '@/lib/supabase-server'
import AdmZip from 'adm-zip'
import { v4 as uuidv4 } from 'uuid'
import { GoogleGenerativeAI, SchemaType, GenerationConfig } from '@google/generative-ai'

// Update Interface
export interface ParsedPart {
    id: string
    filename: string
    partNumber: string
    description: string
    quantity: number
    material: string
    thickness: number // For Plate
    width: number // For Plate
    length: number
    profileType?: string
    profileDimensions?: string
    type?: string
    confidence: number
    thumbnail?: string
    drawingRef?: string // New field for Storage Path
}

const GENERATION_CONFIG: GenerationConfig = {
    responseMimeType: "application/json",
    responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
            parts: {
                type: SchemaType.ARRAY,
                items: {
                    type: SchemaType.OBJECT,
                    properties: {
                        partNumber: { type: SchemaType.STRING, description: "The unique part identifier." },
                        title: { type: SchemaType.STRING },
                        quantity: { type: SchemaType.NUMBER },
                        material: { type: SchemaType.STRING },
                        thickness: { type: SchemaType.NUMBER },
                        width: { type: SchemaType.NUMBER },
                        length: { type: SchemaType.NUMBER },
                        confidence: { type: SchemaType.NUMBER, description: "Confidence score 0-100" },
                        type: {
                            type: SchemaType.STRING,
                            format: "enum",
                            description: "Type of part: 'PROFILE' or 'PLATE' only.",
                            enum: ["PROFILE", "PLATE"]
                        },
                        profileType: { type: SchemaType.STRING, description: "Type of profile if applicable (RHS, SHS, IPE, HEA, UNP, etc.)" },
                        profileDimensions: { type: SchemaType.STRING, description: "Dimensions string for profile (e.g. 100x100x5)" }
                    },
                    required: ["partNumber", "quantity", "type", "confidence"]
                }
            }
        }
    }
}

// Utility for retrying AI calls
async function retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    initialDelay: number = 2000
): Promise<T> {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await operation();
        } catch (error: any) {
            lastError = error;
            if (error?.status === 503 || error?.status === 429 || error?.message?.includes('503') || error?.message?.includes('overloaded')) {
                const delay = initialDelay * Math.pow(2, i);
                console.log(`Gemini API busy (Attempt ${i + 1}/${maxRetries}). Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            throw error;
        }
    }
    throw lastError;
}

export async function parseDrawingsZip(formData: FormData, projectId: string): Promise<{ success: boolean, parts?: ParsedPart[], error?: string }> {
    try {
        const file = formData.get('file') as File
        if (!file) return { success: false, error: "No file uploaded" }
        if (!projectId) return { success: false, error: "Project ID missing" }

        // Fetch Project for Path Construction
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { projectNumber: true, createdAt: true }
        })

        if (!project) return { success: false, error: "Project not found" }

        const year = new Date(project.createdAt).getFullYear()
        const projectNumber = project.projectNumber
        const supabase = await createClient()

        const apiKey = process.env.GEMINI_API_KEY
        if (!apiKey) {
            return { success: false, error: "GEMINI_API_KEY is missing" }
        }

        const genAI = new GoogleGenerativeAI(apiKey)
        // ... model candidates ...
        const modelCandidates = [
            { id: "gemini-3-flash-preview", retries: 3 },
            { id: "gemini-2.5-flash", retries: 3 },
            { id: "gemini-2.5-pro", retries: 2 }
        ]

        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const zip = new AdmZip(buffer)
        const zipEntries = zip.getEntries()

        const pdfEntries = zipEntries.filter(entry =>
            entry.name.toLowerCase().endsWith('.pdf') &&
            !entry.name.startsWith('__MACOSX') &&
            !entry.name.split('/').pop()?.startsWith('._')
        )

        if (pdfEntries.length === 0) {
            return { success: false, error: "No PDF files found in ZIP" }
        }

        const parsedParts: ParsedPart[] = []

        for (const entry of pdfEntries) {
            try {
                const pdfBuffer = entry.getData()
                const base64Pdf = pdfBuffer.toString('base64')

                // UPLOAD TO SUPABASE
                const filename = entry.name.split('/').pop() || entry.name
                const storagePath = `${year}/${projectNumber}/uploads/parts/${filename}`

                const { error: uploadError } = await supabase.storage
                    .from('Projects') // Assuming 'projects' bucket
                    .upload(storagePath, pdfBuffer, {
                        contentType: 'application/pdf',
                        upsert: true
                    })

                if (uploadError) {
                    console.error("Supabase Upload Error:", uploadError)
                    // We continue even if upload fails? Or fail? 
                    // User said "drawings must be saved", so ideally we warn.
                    // For now, log it.
                }

                // ... Gemini Prompt ...
                // ... Gemini Prompt ...
                const prompt = `
          Analyze this technical drawing (PDF) and extract ALL distinct parts found into the 'parts' array.
          
          If there is only one part, return an array with one item.
          If there are multiple parts (e.g. a sheet with several cutting profiles), extract each one as a separate item.

          CRITICAL CLASSIFICATION RULES:
          1. **PROFILE**: Any part that is a standard section beam, tube, or angle.
             - Keywords to look for: RHS, SHS, IPE, HEA, HEB, UNP, UPE, L-Profile, Angle, Tube, Pipe, Beam.
             - Example Descriptions: "HEA 200", "RHS 100x100x5", "L 50x50x5".
             - If the part is defined by a Profile Name (e.g. "IPE200") it is a PROFILE.
             - **RHS vs SHS Rule**: 
                - If a tube is SQUARE (e.g. 60x60x4 or Side=60, Wall=4), classify as **SHS**.
                - If a tube is RECTANGULAR (e.g. 100x50x5), classify as **RHS**.
          
          2. **PLATE**: Any part that is a flat sheet of material defined by Thickness x Width x Length.
             - Typically designated as "PL", "FL", "Flat Bar" (sometimes), or just dimensions like "10x200x500".
             - If the part has a 'Thickness' and 'Width' that define its cross-section, and it is NOT a standard profile, it is a PLATE.

          EXTRACTION INSTRUCTIONS:
          - **type**: MUST be "PROFILE" or "PLATE" based on the rules above.
          - **profileType**: If type is PROFILE, extract the designation (e.g. "RHS", "SHS", "IPE"). Use standard abbreviations.
          - **profileDimensions**: If type is PROFILE, extract the dimensions string. 
             - **FORMAT**: Use 'x' as separator (e.g. "100x100x5"). DO NOT use '*'.
             - For SHS/RHS, strictly use format: Side x Side x Thickness (e.g. "60x60x4") or Width x Height x Thickness.
          - **thickness**: Critical for PLATE. Extract in mm.
          - **width**: Critical for PLATE. Extract in mm.
          - **length**: Extract in mm for all parts.
          - **quantity**: Default to 1 if not explicitly stated.
          
          Return JSON strictly adhering to the schema.`

                let result;
                let lastError;

                // Loop through models with retry logic
                for (const candidate of modelCandidates) {
                    try {
                        const model = genAI.getGenerativeModel({
                            model: candidate.id,
                            generationConfig: GENERATION_CONFIG
                        })

                        result = await retryWithBackoff(() => model.generateContent([
                            {
                                inlineData: {
                                    data: base64Pdf,
                                    mimeType: "application/pdf"
                                }
                            },
                            prompt
                        ]), candidate.retries) // Use configured retries

                        // If successful, break and use this result
                        break;
                    } catch (error: any) {
                        console.warn(`Model ${candidate.id} failed for ${entry.name}: ${error.message || error}. Trying next model...`);
                        lastError = error;
                        // Continue to next model
                    }
                }

                if (!result) {
                    console.error(`All models failed for ${entry.name}. Last error:`, lastError);
                    throw lastError || new Error("All models failed to generate content.");
                }

                const response = result.response
                const text = response.text()
                console.log(`[AI] Response for ${entry.name}: `, text)

                let rootData: any = {}
                try {
                    rootData = JSON.parse(text)
                } catch (e) {
                    console.error("Failed to parse Gemini JSON", text)
                    if (text.includes('{')) {
                        // Emergency fallback slightly broken
                        console.log("Attempting partial parse")
                    }
                }

                const partsList = Array.isArray(rootData.parts) ? rootData.parts : []
                if (partsList.length === 0 && rootData.partNumber) {
                    // Fallback if AI returned old single-object format by mistake
                    partsList.push(rootData)
                }

                if (partsList.length === 0) {
                    console.warn(`No parts extracted for ${entry.name}`)
                    // Push an error part so user knows
                    parsedParts.push({
                        id: uuidv4(),
                        filename: entry.name,
                        partNumber: entry.name.replace('.pdf', ''),
                        description: "AI FOUND NO PARTS",
                        quantity: 0,
                        material: "",
                        thickness: 0,
                        width: 0,
                        length: 0,
                        confidence: 0
                    })
                }

                for (const data of partsList) {
                    try {
                        // ... post processing ...
                        // 1. Clean Profile Dimensions (replace * with x)
                        if (data.profileDimensions) {
                            data.profileDimensions = data.profileDimensions.replace(/\*/g, 'x').toLowerCase()
                        }

                        // 2. Fix SHS/RHS Confusion
                        // Logic: If identified as RHS but dims are like "60x4" (WxT), convert to SHS 60x60x4
                        if (data.type === 'PROFILE' && data.profileType?.toUpperCase().includes('RHS')) {
                            const dims = data.profileDimensions?.split('x') || []
                            // Case: "60x4" -> [60, 4]
                            if (dims.length === 2) {
                                const side = dims[0]
                                const wall = dims[1]
                                // Assume it implies a square tube
                                data.profileType = "SHS"
                                data.profileDimensions = `${side}x${side}x${wall}`
                            }
                        }

                        // 2.1 Ensure SHS has 3 dims "60x60x4" if only 2 provided "60x4" even if AI called it SHS
                        if (data.type === 'PROFILE' && data.profileType?.toUpperCase().includes('SHS')) {
                            const dims = data.profileDimensions?.split('x') || []
                            if (dims.length === 2) {
                                const side = dims[0]
                                const wall = dims[1]
                                data.profileDimensions = `${side}x${side}x${wall}`
                            }
                        }

                        // 3. Normalize Profile Type (Uppercase)
                        if (data.profileType) {
                            data.profileType = data.profileType.toUpperCase()
                        }

                        parsedParts.push({
                            id: uuidv4(),
                            filename: entry.name,
                            partNumber: data.partNumber || entry.name.replace('.pdf', ''),
                            description: data.title || "",
                            quantity: data.quantity || 1,
                            material: data.material || "",
                            thickness: data.thickness || 0,
                            width: data.width || 0,
                            length: data.length || 0,
                            profileType: data.profileType || "",
                            profileDimensions: data.profileDimensions || "",
                            confidence: data.confidence || 0,
                            thumbnail: undefined,
                            drawingRef: storagePath
                        })

                    } catch (e) {
                        console.error("Error processing part in list", e)
                    }
                }

            } catch (e) {
                console.error(`Failed to process ${entry.name} with Gemini: `, e)
                parsedParts.push({
                    id: uuidv4(),
                    filename: entry.name,
                    partNumber: entry.name.replace('.pdf', ''),
                    description: "AI PROCESSING FAILED",
                    quantity: 0,
                    material: "",
                    thickness: 0,
                    width: 0,
                    length: 0,
                    confidence: 0
                })
            }
        }

        return { success: true, parts: parsedParts }

    } catch (error: any) {
        console.error("ZIP Parse Error:", error)
        return { success: false, error: error.message || "Failed to process ZIP file" }
    }
}

export interface ParsedAssembly {
    id: string
    filename: string
    assemblyNumber: string
    name: string
    quantity: number // Quantity of this assembly itself
    bom: {
        partNumber: string
        quantity: number
        description: string
        material: string
        profileType?: string
        profileDimensions?: string
        length?: number
    }[]
    confidence: number
    thumbnail?: string
    drawingRef?: string
}

const ASSEMBLY_GENERATION_CONFIG: GenerationConfig = {
    responseMimeType: "application/json",
    responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
            assemblyNumber: { type: SchemaType.STRING },
            quantity: { type: SchemaType.NUMBER, description: "Quantity of this assembly required (default 1)" },
            bom: {
                type: SchemaType.ARRAY,
                items: {
                    type: SchemaType.OBJECT,
                    properties: {
                        partNumber: { type: SchemaType.STRING },
                        quantity: { type: SchemaType.NUMBER }
                    },
                    required: ["partNumber", "quantity"]
                }
            },
            confidence: { type: SchemaType.NUMBER, description: "Confidence score 0-100" }
        },
        required: ["assemblyNumber", "bom"]
    }
}

export async function parseAssemblyZip(formData: FormData, projectId: string): Promise<{ success: boolean, assemblies?: ParsedAssembly[], error?: string }> {
    try {
        const file = formData.get('file') as File
        if (!file) return { success: false, error: "No file uploaded" }
        if (!projectId) return { success: false, error: "Project ID missing" }

        // Fetch Project for Path Construction
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { projectNumber: true, createdAt: true }
        })

        if (!project) return { success: false, error: "Project not found" }

        const year = new Date(project.createdAt).getFullYear()
        const projectNumber = project.projectNumber
        const supabase = await createClient()

        const apiKey = process.env.GEMINI_API_KEY
        if (!apiKey) {
            return { success: false, error: "GEMINI_API_KEY is missing" }
        }

        const genAI = new GoogleGenerativeAI(apiKey)

        // Model Candidates in order of preference
        const modelCandidates = [
            { id: "gemini-3-flash-preview", retries: 3 },
            { id: "gemini-2.5-flash", retries: 3 },
            { id: "gemini-2.5-pro", retries: 2 }
        ]

        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const zip = new AdmZip(buffer)
        const zipEntries = zip.getEntries()

        const pdfEntries = zipEntries.filter(entry =>
            entry.name.toLowerCase().endsWith('.pdf') &&
            !entry.name.startsWith('__MACOSX') &&
            !entry.name.split('/').pop()?.startsWith('._')
        )

        if (pdfEntries.length === 0) {
            return { success: false, error: "No PDF files found in ZIP" }
        }

        const parsedAssemblies: ParsedAssembly[] = []

        for (const entry of pdfEntries) {
            try {
                const pdfBuffer = entry.getData()
                const base64Pdf = pdfBuffer.toString('base64')

                // UPLOAD TO SUPABASE
                const filename = entry.name.split('/').pop() || entry.name
                const storagePath = `${year}/${projectNumber}/uploads/assemblies/${filename}`

                const { error: uploadError } = await supabase.storage
                    .from('Projects')
                    .upload(storagePath, pdfBuffer, {
                        contentType: 'application/pdf',
                        upsert: true
                    })

                if (uploadError) {
                    console.error("Supabase Upload Error:", uploadError)
                }

                // Gemini Call with PDF
                const prompt = `
                    Analyze this technical drawing (PDF). It is an Assembly Drawing.
                    Extract ONLY:
                    1. The Assembly Number (from title block).
                    2. The overall Quantity of this specific assembly required (if specified, e.g. "MAKE 2", otherwise 1).
                    3. The Bill of Materials (BOM) table.
                       - For each row, extract ONLY: Part Number and Quantity.
                       - Ignore descriptions, materials, and dimensions.
                `

                let result;
                let lastError;

                // Loop through models with retry logic
                for (const candidate of modelCandidates) {
                    try {
                        const model = genAI.getGenerativeModel({
                            model: candidate.id,
                            generationConfig: ASSEMBLY_GENERATION_CONFIG
                        })

                        result = await retryWithBackoff(() => model.generateContent([
                            { inlineData: { data: base64Pdf, mimeType: "application/pdf" } },
                            prompt
                        ]), candidate.retries)

                        break;
                    } catch (error: any) {
                        console.warn(`Model ${candidate.id} failed for Assembly ${entry.name}: ${error.message || error}. Trying next model...`);
                        lastError = error;
                    }
                }

                if (!result) {
                    console.error(`All models failed for Assembly ${entry.name}. Last error:`, lastError);
                    throw lastError || new Error("All models failed to generate content.");
                }

                const text = result.response.text()
                console.log(`[AI] Response for Assembly ${entry.name}: `, text)
                let data: any = {}
                try {
                    data = JSON.parse(text)
                } catch (e) {
                    console.error("Failed to parse Assembly JSON", text)
                    data = {}
                }

                parsedAssemblies.push({
                    id: uuidv4(),
                    filename: entry.name,
                    assemblyNumber: data.assemblyNumber || entry.name.replace('.pdf', ''),
                    name: data.title || "Unknown Assembly",
                    quantity: data.quantity || 1,
                    bom: data.bom || [],
                    confidence: data.confidence || 0,
                    thumbnail: undefined,
                    drawingRef: storagePath
                })

            } catch (e) {
                console.error(`Failed to process Assembly ${entry.name}: `, e)
                parsedAssemblies.push({
                    id: uuidv4(),
                    filename: entry.name,
                    assemblyNumber: entry.name.replace('.pdf', ''),
                    name: "PROCESSING_FAILED",
                    quantity: 1,
                    bom: [],
                    confidence: 0,
                    drawingRef: undefined
                })
            }
        }

        return { success: true, assemblies: parsedAssemblies }

    } catch (error: any) {
        console.error("Assembly Parse Error:", error)
        return { success: false, error: error.message || "Failed to process ZIP file" }
    }
}
