'use server'

import AdmZip from 'adm-zip'
import { v4 as uuidv4 } from 'uuid'
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf'
import { createCanvas } from 'canvas'

// Initialize PDF.js worker logic
// Note: In a server action, simple imports often suffice for legacy build

export interface ParsedPart {
    id: string
    filename: string
    partNumber: string
    description: string
    quantity: number
    material: string
    thickness: number
    width: number
    length: number
    confidence: number
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
            confidence: { type: SchemaType.NUMBER, description: "Confidence score 0-100" }
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
            model: "gemini-2.5-flash",
            generationConfig: GENERATION_CONFIG
        })

        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const zip = new AdmZip(buffer)
        const zipEntries = zip.getEntries()

        const pdfEntries = zipEntries.filter(entry => entry.name.toLowerCase().endsWith('.pdf') && !entry.name.startsWith('__MACOSX'))

        if (pdfEntries.length === 0) {
            return { success: false, error: "No PDF files found in ZIP" }
        }

        const parsedParts: ParsedPart[] = []

        for (const entry of pdfEntries) {
            try {
                const pdfBuffer = entry.getData()

                // 1. Render PDF Page 1 to Image
                const loadingTask = pdfjsLib.getDocument({
                    data: new Uint8Array(pdfBuffer),
                    standardFontDataUrl: 'node_modules/pdfjs-dist/standard_fonts/',
                    disableFontFace: true,
                })

                const pdfDocument = await loadingTask.promise
                const page = await pdfDocument.getPage(1)

                // Lower scale is often fine for Gemini types, but 2.0 ensures clarity
                const viewport = page.getViewport({ scale: 2.0 })
                const canvas = createCanvas(viewport.width, viewport.height)
                const context = canvas.getContext('2d')

                await page.render({
                    canvasContext: context as any,
                    viewport: viewport
                }).promise

                const imageBuffer = canvas.toBuffer('image/png')
                const imageBase64 = imageBuffer.toString('base64')

                // 2. Send to Gemini
                const prompt = `
          Analyze this technical drawing. Extract the following details into JSON:
          - partNumber: The main part number (often in the title block).
          - title: The part description or title.
          - quantity: The required quantity (QTY). If not found, default to 1.
          - material: The material grade (e.g., S355, 304, AlMg3). Standardize if possible.
          - thickness: The thickness of the plate/sheet in mm.
          - width: The width in mm.
          - length: The length in mm.
          - confidence: Your confidence (0-100) in the extraction, especially Part Number and Qty.
        `

                const result = await model.generateContent([
                    prompt,
                    {
                        inlineData: {
                            data: imageBase64,
                            mimeType: "image/png"
                        }
                    }
                ])

                const response = result.response
                const text = response.text()

                let data: any = {}
                try {
                    data = JSON.parse(text)
                } catch (e) {
                    console.error("Failed to parse Gemini JSON", text)
                    // fallback rudimentary
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
                    confidence: data.confidence || 0
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
