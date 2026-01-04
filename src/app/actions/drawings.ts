'use server'

import AdmZip from 'adm-zip'
import { v4 as uuidv4 } from 'uuid'
import { createWorker } from 'tesseract.js'
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf'
import { createCanvas } from 'canvas'

// Initialize PDF.js worker
// We use the legacy build for Node.js support
// pdfjsLib.GlobalWorkerOptions.workerSrc is not needed in Node usually if using legacy but good practice or might need mock
// For pure node with pdfjs-dist@legacy, we often just need to mock typical browser APIs or use custom setup.
// Let's try standard import first.

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

export async function parseDrawingsZip(formData: FormData): Promise<{ success: boolean, parts?: ParsedPart[], error?: string }> {
    try {
        const file = formData.get('file') as File
        if (!file) return { success: false, error: "No file uploaded" }

        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const zip = new AdmZip(buffer)
        const zipEntries = zip.getEntries()

        const pdfEntries = zipEntries.filter(entry => entry.name.toLowerCase().endsWith('.pdf') && !entry.name.startsWith('__MACOSX'))

        if (pdfEntries.length === 0) {
            return { success: false, error: "No PDF files found in ZIP" }
        }

        const parsedParts: ParsedPart[] = []

        // Initialize Tesseract worker once if possible, or per request
        const worker = await createWorker('eng')

        for (const entry of pdfEntries) {
            try {
                const pdfBuffer = entry.getData() // Uint8Array in adm-zip? Node buffer.

                // Convert PDF to Image (First Page)
                const loadingTask = pdfjsLib.getDocument({
                    data: new Uint8Array(pdfBuffer),
                    standardFontDataUrl: 'node_modules/pdfjs-dist/standard_fonts/',
                    disableFontFace: true, // often helps in node
                })

                const pdfDocument = await loadingTask.promise
                const page = await pdfDocument.getPage(1)

                const viewport = page.getViewport({ scale: 2.0 }) // Higher scale for better OCR
                const canvas = createCanvas(viewport.width, viewport.height)
                const context = canvas.getContext('2d')

                // Render
                await page.render({
                    canvasContext: context as any,
                    viewport: viewport
                }).promise

                // Get Image Data
                const imageBuffer = canvas.toBuffer('image/png')

                // OCR
                const { data: { text } } = await worker.recognize(imageBuffer)

                // Parse Text
                const part = parseOcrText(text, entry.name)
                parsedParts.push(part)

            } catch (e) {
                console.error(`Failed to parse ${entry.name}:`, e)
                // Add a dummy entry so user knows it failed? Or skip?
                // Let's add with error name
                parsedParts.push({
                    id: uuidv4(),
                    filename: entry.name,
                    partNumber: entry.name.replace('.pdf', ''),
                    description: "FAILED TO PARSE",
                    quantity: 0,
                    material: "",
                    thickness: 0,
                    width: 0,
                    length: 0,
                    confidence: 0
                })
            }
        }

        await worker.terminate()

        return { success: true, parts: parsedParts }

    } catch (error: any) {
        console.error("ZIP Parse Error:", error)
        return { success: false, error: error.message || "Failed to process ZIP file" }
    }
}

function parseOcrText(text: string, filename: string): ParsedPart {
    // Normalize text: remove extra spaces, fix common OCR errors
    // 0 vs O, etc. if relevant. 
    // Text often comes with newlines.
    const cleanText = text
    const lines = text.split('\n')

    // 1. Part Number: Default to filename, but look for "Part No:" or "Part Number"
    let partNumber = filename.replace(/\.pdf$/i, '')
    // OCR often messes up labels, look for patterns
    const partNoMatch = text.match(/(?:Part\s*No|Part\s*Number|Item\s*No)[\s.:]+([A-Z0-9-]+)/i)
    if (partNoMatch) {
        // If match is reasonably long, use it
        if (partNoMatch[1].length > 3) partNumber = partNoMatch[1]
    }

    // 2. Quantity
    let quantity = 1
    // Look for "QTY: 5" or "Quantity 5"
    // OCR might see "QTV" or "0TY"
    const qtyMatch = text.match(/(?:QTY|QUAN|QTV)[\s.:]+([0-9]+)/i)
    if (qtyMatch) {
        quantity = parseInt(qtyMatch[1])
    }

    // 3. Material
    let material = ""
    // Common grades
    const grades = ['S355', 'S235', 'S275', '304', '316', 'ALU', 'HARDOX', 'S355J2', 'S355J2+N']
    for (const g of grades) {
        if (new RegExp(g, 'i').test(text)) { // wait, 'await' in sync loop? no.
            // also avoid matching substrings incorrectly
            if (text.toUpperCase().includes(g.toUpperCase())) {
                material = g
                break
            }
        }
    }

    // 4. Dimensions
    // Look for patterns like "10x100x200" or "PL 10*100*200" or "Ø50"
    // OCR might output 'x', 'X', '*', 'x'
    let thickness = 0, width = 0, length = 0

    // Try to find standard dimension line: T x W x L
    // e.g. 10 x 200 x 3000
    // Regex allows whitespace and X/x/*
    const dimMatch = text.match(/([0-9]+(?:\.[0-9]+)?)\s*[xX*]\s*([0-9]+(?:\.[0-9]+)?)\s*[xX*]\s*([0-9]+(?:\.[0-9]+)?)/)
    if (dimMatch) {
        // Sort dimensions: smallest = thick, middle = width, largest = length
        const dims = [parseFloat(dimMatch[1]), parseFloat(dimMatch[2]), parseFloat(dimMatch[3])].sort((a, b) => a - b)
        thickness = dims[0]
        width = dims[1]
        length = dims[2]
    } else {
        // Try to find Thickness (t=10, thk=10)
        const thkMatch = text.match(/(?:thk|t|thickness)[\s.:=]+([0-9]+(?:\.[0-9]+)?)/i)
        if (thkMatch) thickness = parseFloat(thkMatch[1])
    }

    // Confidence is rudimentary
    let confidence = 0
    if (qtyMatch) confidence += 20
    if (material) confidence += 20
    if (width > 0 && length > 0) confidence += 40
    if (partNumber !== filename.replace('.pdf', '')) confidence += 20

    return {
        id: uuidv4(),
        filename,
        partNumber: partNumber.trim(),
        description: "", // tough to extract description reliably without specific layout
        quantity,
        material,
        thickness,
        width,
        length,
        confidence
    }
}
