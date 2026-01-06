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
    type?: string // 'PROFILE' | 'PLATE'
    confidence: number
    thumbnail?: string
}

const GENERATION_CONFIG = {
    responseMimeType: "application/json",
    responseSchema: {
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
                description: "Type of part: 'PROFILE' or 'PLATE' only.",
                enum: ["PROFILE", "PLATE"]
            },
            profileType: { type: SchemaType.STRING, description: "Type of profile if applicable (RHS, SHS, IPE, HEA, UNP, etc.)" },
            profileDimensions: { type: SchemaType.STRING, description: "Dimensions string for profile (e.g. 100x100x5)" }
        },
        required: ["partNumber", "quantity", "type", "confidence"]
    }
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
            model: "gemini-3-flash-preview", // Using latest Flash model which handles PDFs well
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
          Analyze this technical drawing (PDF) and extract the Part Information into the specified JSON structure.

          CRITICAL CLASSIFICATION RULES:
          1. **PROFILE**: Any part that is a standard section beam, tube, or angle.
             - Keywords to look for: RHS, SHS, IPE, HEA, HEB, UNP, UPE, L-Profile, Angle, Tube, Pipe, Beam.
             - Example Descriptions: "HEA 200", "RHS 100x100x5", "L 50x50x5".
             - If the part is defined by a Profile Name (e.g. "IPE200") it is a PROFILE.
          
          2. **PLATE**: Any part that is a flat sheet of material defined by Thickness x Width x Length.
             - Typically designated as "PL", "FL", "Flat Bar" (sometimes), or just dimensions like "10x200x500".
             - If the part has a 'Thickness' and 'Width' that define its cross-section, and it is NOT a standard profile, it is a PLATE.

          EXTRACTION INSTRUCTIONS:
          - **type**: MUST be "PROFILE" or "PLATE" based on the rules above.
          - **profileType**: If type is PROFILE, extract the designation (e.g. "RHS").
          - **profileDimensions**: If type is PROFILE, extract the dimensions string (e.g. "100x100x5").
          - **thickness**: Critical for PLATE. Extract in mm.
          - **width**: Critical for PLATE. Extract in mm.
          - **length**: Extract in mm for all parts.
          - **quantity**: Default to 1 if not explicitly stated.
          
          Return JSON strictly adhering to the schema.`
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
                console.log(`[AI] Response for ${ entry.name }: `, text)

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
                console.error(`Failed to process ${ entry.name } with Gemini: `, e)
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
            model: "gemini-2.5-flash",
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
                    Analyze this technical drawing(PDF).It is an Assembly Drawing.
                    Extract:
                1. The Assembly Number and Title(from title block).
                    2. The overall Quantity of this assembly required(if specified, e.g. "MAKE 2", otherwise 1).
                3. The Bill of Materials(BOM) table.Extract each row: Part Number, Quantity, Description, Material.
                `

                const result = await model.generateContent([
                    { inlineData: { data: base64Pdf, mimeType: "application/pdf" } },
                    prompt
                ])

                const text = result.response.text()
                console.log(`[AI] Response for Assembly ${ entry.name }: `, text)
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
                console.error(`Failed to process Assembly ${ entry.name }: `, e)
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
