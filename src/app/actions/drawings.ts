'use server'

import AdmZip from 'adm-zip'
import { v4 as uuidv4 } from 'uuid'
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'
import '@/lib/pdf-polyfill'
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf'
// @ts-ignore
import 'pdfjs-dist/legacy/build/pdf.worker.mjs'

pdfjsLib.GlobalWorkerOptions.workerSrc = ''
import { createCanvas } from 'canvas'

// Initialize PDF.js worker logic
// Note: In a server action, simple imports often suffice for legacy build

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
                const loadingTask = pdfjsLib.getDocument({
                    data: new Uint8Array(pdfBuffer),
                    standardFontDataUrl: 'node_modules/pdfjs-dist/standard_fonts/',
                    disableFontFace: true,
                })

                const pdfDocument = await loadingTask.promise
                const page = await pdfDocument.getPage(1)

                // Render for Gemini (High Res)
                const viewport = page.getViewport({ scale: 2.0 })
                const canvas = createCanvas(viewport.width, viewport.height)
                const context = canvas.getContext('2d')

                // Patch context to support Polyfill Path2D
                const patchContext = (ctx: any) => {
                    const originalFill = ctx.fill;
                    const originalStroke = ctx.stroke;
                    const originalClip = ctx.clip;

                    ctx.fill = function (pathOrRule: any, rule?: any) {
                        if (typeof pathOrRule === 'object' && pathOrRule && pathOrRule.ops) {
                            ctx.beginPath();
                            pathOrRule.ops.forEach((op: any) => ctx[op.type](...op.args));
                            originalFill.call(this, rule || 'nonzero');
                        } else {
                            originalFill.apply(this, arguments);
                        }
                    };

                    ctx.stroke = function (path: any) {
                        if (typeof path === 'object' && path && path.ops) {
                            ctx.beginPath();
                            path.ops.forEach((op: any) => ctx[op.type](...op.args));
                            originalStroke.call(this);
                        } else {
                            originalStroke.apply(this, arguments);
                        }
                    };

                    ctx.clip = function (pathOrRule: any, rule?: any) {
                        if (typeof pathOrRule === 'object' && pathOrRule && pathOrRule.ops) {
                            ctx.beginPath();
                            pathOrRule.ops.forEach((op: any) => ctx[op.type](...op.args));
                            originalClip.call(this, rule || 'nonzero');
                        } else {
                            originalClip.apply(this, arguments);
                        }
                    };
                };

                patchContext(context);

                await page.render({
                    canvasContext: context as any,
                    viewport: viewport
                }).promise

                const imageBuffer = canvas.toBuffer('image/png')
                const imageBase64 = imageBuffer.toString('base64')

                // Render Thumbnail (Low Res)
                const thumbViewport = page.getViewport({ scale: 0.3 })
                const thumbCanvas = createCanvas(thumbViewport.width, thumbViewport.height)
                const thumbContext = thumbCanvas.getContext('2d')

                // Patch thumbnail context too just in case
                patchContext(thumbContext);

                await page.render({
                    canvasContext: thumbContext as any,
                    viewport: thumbViewport
                }).promise
                const thumbBase64 = 'data:image/png;base64,' + thumbCanvas.toBuffer('image/png').toString('base64')

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
                console.log(`[AI] Response for ${entry.name}:`, text)

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
                    confidence: data.confidence || 0,
                    thumbnail: thumbBase64
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
                const loadingTask = pdfjsLib.getDocument({
                    data: new Uint8Array(pdfBuffer),
                    standardFontDataUrl: 'node_modules/pdfjs-dist/standard_fonts/',
                    disableFontFace: true,
                })

                const pdfDocument = await loadingTask.promise
                const page = await pdfDocument.getPage(1)

                // Render High Res for Gemini
                const viewport = page.getViewport({ scale: 2.0 })
                const canvas = createCanvas(viewport.width, viewport.height)
                const context = canvas.getContext('2d')

                // Render High Res for Gemini
                const viewport = page.getViewport({ scale: 2.0 })
                const canvas = createCanvas(viewport.width, viewport.height)
                const context = canvas.getContext('2d')

                // Patch context to support Polyfill Path2D
                const patchContext = (ctx: any) => {
                    const originalFill = ctx.fill;
                    const originalStroke = ctx.stroke;
                    const originalClip = ctx.clip;

                    ctx.fill = function (pathOrRule: any, rule?: any) {
                        if (typeof pathOrRule === 'object' && pathOrRule && pathOrRule.ops) {
                            ctx.beginPath();
                            pathOrRule.ops.forEach((op: any) => ctx[op.type](...op.args));
                            originalFill.call(this, rule || 'nonzero');
                        } else {
                            originalFill.apply(this, arguments);
                        }
                    };

                    ctx.stroke = function (path: any) {
                        if (typeof path === 'object' && path && path.ops) {
                            ctx.beginPath();
                            path.ops.forEach((op: any) => ctx[op.type](...op.args));
                            originalStroke.call(this);
                        } else {
                            originalStroke.apply(this, arguments);
                        }
                    };

                    ctx.clip = function (pathOrRule: any, rule?: any) {
                        if (typeof pathOrRule === 'object' && pathOrRule && pathOrRule.ops) {
                            ctx.beginPath();
                            pathOrRule.ops.forEach((op: any) => ctx[op.type](...op.args));
                            originalClip.call(this, rule || 'nonzero');
                        } else {
                            originalClip.apply(this, arguments);
                        }
                    };
                };

                patchContext(context);

                await page.render({
                    canvasContext: context as any,
                    viewport: viewport
                }).promise

                const imageBase64 = canvas.toBuffer('image/png').toString('base64')

                // Render Thumbnail
                const thumbViewport = page.getViewport({ scale: 0.3 })
                const thumbCanvas = createCanvas(thumbViewport.width, thumbViewport.height)
                const thumbContext = thumbCanvas.getContext('2d')

                patchContext(thumbContext);

                await page.render({
                    canvasContext: thumbContext as any,
                    viewport: thumbViewport
                }).promise
                const thumbBase64 = 'data:image/png;base64,' + thumbCanvas.toBuffer('image/png').toString('base64')

                // Gemini Call
                const prompt = `
                    Analyze this technical drawing. It is an Assembly Drawing.
                    Extract:
                    1. The Assembly Number and Title (from title block).
                    2. The overall Quantity of this assembly required (if specified, e.g. "MAKE 2", otherwise 1).
                    3. The Bill of Materials (BOM) table. Extract each row: Part Number, Quantity, Description, Material.
                `

                const result = await model.generateContent([
                    prompt,
                    { inlineData: { data: imageBase64, mimeType: "image/png" } }
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
                    thumbnail: thumbBase64
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
        return { success: false, error: error.message }
    }
}
