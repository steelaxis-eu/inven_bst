'use server'

import AdmZip from 'adm-zip'
import { v4 as uuidv4 } from 'uuid'
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'

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
    profileType?: string // e.g. RHS, SHS, IPE
    profileDimensions?: string // e.g. 100x100x5
    confidence: number
    thumbnail?: string
}

const GENERATION_CONFIG = {
    responseMimeType: "application/json",
    responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
            partNumber: { type: SchemaType.STRING },
            title: { type: SchemaType.STRING },
            quantity: { type: SchemaType.NUMBER },
            material: { type: SchemaType.STRING },
            thickness: { type: SchemaType.NUMBER },
            width: { type: SchemaType.NUMBER },
            length: { type: SchemaType.NUMBER },
            confidence: { type: SchemaType.NUMBER, description: "Confidence score 0-100" },
            profileType: { type: SchemaType.STRING, description: "Type of profile if applicable (RHS, SHS, IPE, etc.)" },
            profileDimensions: { type: SchemaType.STRING, description: "Dimensions string for profile (e.g. 100x100x5)" }
        }
    } as const
}

export async function parseDrawingsZip(formData: FormData): Promise<{ success: boolean, parts?: ParsedPart[], error?: string }> {
    try {
        const file = formData.get('file') as File
        if (!file) return { success: false, error: "No file uploaded" }

        const apiKey = process.env.GEMINI_API_KEY
        if (!apiKey) {
            return { success: false, error: "GEMINI_API_KEY is missing in server environment" }
        }

        const genAI = new GoogleGenerativeAI(apiKey)
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash-exp", // Using latest Flash model which handles PDFs well
            generationConfig: GENERATION_CONFIG
        })

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

                // Send PDF directly to Gemini
                const prompt = `
          Analyze this technical drawing (PDF). Extract the following details into JSON:
          - partNumber: The main part number (often in the title block).
          - title: The part description or title.
          - quantity: The required quantity (QTY). If not found, default to 1.
          - material: The material grade (e.g., S355, 304, AlMg3). Standardize if possible.
          - type: "PLATE" or "PROFILE" (if it looks like a beam, tube, or section).
          - profileType: If it is a profile, specify the type (e.g., RHS, SHS, CHS, IPE, HEA, HEB, UNP, L-Profile, Flat Bar).
          - profileDimensions: If it is a profile, specify the dimensions string (e.g., "100x100x5", "IPE200").
          - thickness: The thickness of the plate in mm (if Plate).
          - width: The width in mm (if Plate).
          - length: The length in mm.
          - confidence: Your confidence (0-100) in the extraction, especially Part Number and Qty.
        `

                const result = await model.generateContent([
                    {
                        inlineData: {
                            data: base64Pdf,
                            mimeType: "application/pdf"
                        }
                    },
                    prompt
                ])

                const response = result.response
                const text = response.text()
                console.log(`[AI] Response for ${entry.name}:`, text)

                let data: any = {}
                try {
                    data = JSON.parse(text)
                } catch (e) {
                    console.error("Failed to parse Gemini JSON", text)
                    data = { partNumber: "PARSE_ERROR" }
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
                    thumbnail: undefined // Thumbnail generation disabled to remove canvas dependency
                })

            } catch (e) {
                console.error(`Failed to process ${entry.name} with Gemini:`, e)
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
    }[]
    confidence: number
    thumbnail?: string
}

const ASSEMBLY_GENERATION_CONFIG = {
    responseMimeType: "application/json",
    responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
            assemblyNumber: { type: SchemaType.STRING },
            title: { type: SchemaType.STRING },
            quantity: { type: SchemaType.NUMBER, description: "Quantity of this assembly required (default 1)" },
            bom: {
                type: SchemaType.ARRAY,
                items: {
                    type: SchemaType.OBJECT,
                    properties: {
                        partNumber: { type: SchemaType.STRING },
                        quantity: { type: SchemaType.NUMBER },
                        description: { type: SchemaType.STRING },
                        material: { type: SchemaType.STRING }
                    }
                }
            },
            confidence: { type: SchemaType.NUMBER, description: "Confidence score 0-100" }
        }
    } as const
}

export async function parseAssemblyZip(formData: FormData): Promise<{ success: boolean, assemblies?: ParsedAssembly[], error?: string }> {
    try {
        const file = formData.get('file') as File
        if (!file) return { success: false, error: "No file uploaded" }

        const apiKey = process.env.GEMINI_API_KEY
        if (!apiKey) {
            return { success: false, error: "GEMINI_API_KEY is missing in server environment" }
        }

        const genAI = new GoogleGenerativeAI(apiKey)
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash-exp",
            generationConfig: ASSEMBLY_GENERATION_CONFIG
        })

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

                // Gemini Call with PDF
                const prompt = `
                    Analyze this technical drawing (PDF). It is an Assembly Drawing.
                    Extract:
                    1. The Assembly Number and Title (from title block).
                    2. The overall Quantity of this assembly required (if specified, e.g. "MAKE 2", otherwise 1).
                    3. The Bill of Materials (BOM) table. Extract each row: Part Number, Quantity, Description, Material.
                `

                const result = await model.generateContent([
                    { inlineData: { data: base64Pdf, mimeType: "application/pdf" } },
                    prompt
                ])

                const text = result.response.text()
                console.log(`[AI] Response for Assembly ${entry.name}:`, text)
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
                    thumbnail: undefined
                })

            } catch (e) {
                console.error(`Failed to process Assembly ${entry.name}:`, e)
                parsedAssemblies.push({
                    id: uuidv4(),
                    filename: entry.name,
                    assemblyNumber: entry.name.replace('.pdf', ''),
                    name: "PROCESSING_FAILED",
                    quantity: 1,
                    bom: [],
                    confidence: 0
                })
            }
        }

        return { success: true, assemblies: parsedAssemblies }

    } catch (error: any) {
        console.error("Assembly Parse Error:", error)
        return { success: false, error: error.message || "Failed to process ZIP file" }
    }
}
