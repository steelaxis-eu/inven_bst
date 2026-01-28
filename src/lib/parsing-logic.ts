import { createServiceClient } from '@/lib/supabase-service'
import { v4 as uuidv4 } from 'uuid'
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'
import { GoogleAIFileManager } from "@google/generative-ai/server"
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

// ============================================================================
// Interfaces
// ============================================================================

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
    profileType?: string
    profileDimensions?: string
    type?: string
    confidence: number
    thumbnail?: string
    drawingRef?: string
    warnings?: string[]
    raw?: any
    isSplit?: boolean
    cutAngles?: string
}

// ============================================================================
// ============================================================================
// Utilities
// ============================================================================

export function normalizePartData(type: string, dims: string, warnings: string[] = []): { profileType: string, profileDimensions: string } {
    let pType = type?.toUpperCase() || "";
    let pDims = dims || "";

    // Basic cleaning
    if (pDims) {
        pDims = pDims.replace(/\*/g, 'x').toLowerCase()
        const typePrefix = pType.toLowerCase()
        if (pDims.startsWith(typePrefix)) pDims = pDims.substring(typePrefix.length).trim()
    }

    // Normalize CHS / Pipe / Tube / RO
    if (['CHS', 'RO', 'ROUND TUBE', 'PIPE', 'TUBE'].some(t => pType === t || pType.includes(t))) {
        // Check if it's explicitly NOT a circular hollow section if needed, but for now enforcing CHS-EN10219
        // Logic: "CHS", "CHS EN 10219", "CHS EN-10219", "RO", "PIPE", "TUBE" -> "CHS-EN10219"
        if (!pType.includes('RHS') && !pType.includes('SHS')) {
            pType = 'CHS-EN10219';
        }
    }

    // Normalize logic
    if (pType === 'UNP') pType = 'UPN';

    // Round Bar Normalization
    // Handle "Round bar", "RD", "R", etc. -> "R"
    // Be careful not to mix with CHS/RO if logic above didn't catch it, but usually RO is tube in this context? 
    // Actually, typically RO = Round Bar in some systems, but user requested RO -> CHS EN10219 specifically.
    // Let's refine based on User Request "any RO, CHS... must default to CHS EN10219"
    // Note: If previously RO was mapped to Round Bar, this is a change.
    // Checked previous code: `if (pType === 'RO') pType = 'CHS-EN10219';` existed. So preserving/enhancing that.

    if (pType.toUpperCase() === 'ROUND BAR' || pType.toUpperCase() === 'RD') {
        pType = 'R';
    }
    // If type is R, clean dimensions to digits only (e.g. RD12 -> 12)
    if (pType === 'R') {
        pDims = pDims.replace(/[^0-9.,]/g, '').replace(',', '.');
    }

    // Clean beam dimensions (strip prefix like U200 -> 200, IPE200 -> 200)
    if (['UPN', 'UPE', 'IPE', 'HEA', 'HEB', 'HEM'].includes(pType)) {
        // Remove all non-digit/decimal/separator characters from start
        // e.g. "U 200" -> "200", "IPE200" -> "200"
        pDims = pDims.replace(/^[a-zA-Z\s]+/, '')
    }

    // Flag U-Profiles for manual verification (AI often guesses UPN vs UPE)
    if (['UPN', 'UPE'].includes(pType)) {
        if (!warnings.includes('Verify UPN vs UPE')) {
            warnings.push('Verify UPN vs UPE');
        }
    }

    // QRO Logic (Quadratrohr/Rectangular)
    if (pType === 'QRO') {
        const dims = pDims.split('x');
        // If 2 dims (e.g., 100x5), it's SHS (100x100x5)
        if (dims.length === 2) {
            pType = 'SHS-EN10219';
            // Optional: normalize dims locally if needed, but UI handles string mostly
        }
        // If 3 dims (e.g., 100x50x5), it's RHS
        else if (dims.length === 3) {
            pType = 'RHS-EN10219';
        }
        else {
            // Fallback default
            pType = 'SHS-EN10219';
        }
    }

    // Threaded Bar Detection
    if (pType.includes('THREAD') || pType.includes('GEWINDE') || pDims.toUpperCase().startsWith('M')) {
        pType = 'THREADED BAR';
    }

    // Detect RHS/SHS
    if (pType.includes('RHS') || pType.includes('SHS') || pType === 'HOLLOW SECTION') {
        const dims = pDims.split('x');
        const d1 = parseFloat(dims[0]);
        const d2 = parseFloat(dims[1]);
        const isThickFormat = dims.length === 2 && d2 < d1 * 0.4; // e.g. 50x5 (10%) = Side x Thick. 100x50 (50%) = W x H.

        if (pType.includes('SHS')) {
            // Start with SHS. Only switch to RHS if dims are CLEARLY rectangular W x H (not Side x Thick)
            // and not equal.

            // Case: 50x5 -> SHS (Side x Thick)
            // Case: 100x50 -> RHS (W x H)
            // Case: 100x100 -> SHS
            // Case: 100x50x5 -> RHS

            if (dims.length === 2 && d1 !== d2 && !isThickFormat) {
                pType = 'RHS-EN10219';
            } else if (dims.length === 3 && d1 !== d2) {
                pType = 'RHS-EN10219';
            } else {
                pType = 'SHS-EN10219';
            }
        } else if (pType.includes('RHS')) {
            pType = 'RHS-EN10219';
        } else {
            // Indeterminate "HOLLOW SECTION"
            if (dims.length === 2) {
                if (d1 === d2 || isThickFormat) pType = 'SHS-EN10219';
                else pType = 'RHS-EN10219';
            } else if (dims.length > 2) {
                if (d1 === d2) pType = 'SHS-EN10219';
                else pType = 'RHS-EN10219';
            } else {
                // Default
                pType = 'RHS-EN10219';
            }
        }
    }

    if (pType === 'RHS') pType = 'RHS-EN10219';
    if (pType === 'SHS') pType = 'SHS-EN10219';

    // User Request: U-profile Ambiguity Flag
    // If we have "U200" or just "U" specific type, valid types are UPN or UPE.
    // If the AI just says "U" or "Channel" or returns "U200" without UPN/UPE distinction.
    const isAmbiguousU = pType === 'U' || pType === 'CHANNEL' || (pDims.toUpperCase().startsWith('U') && !pType.includes('UPN') && !pType.includes('UPE'));

    if (isAmbiguousU || (pType.includes('U') && !pType.includes('UPN') && !pType.includes('UPE'))) {
        warnings.push("Ambiguous U-Profile: Verify UPN vs UPE");
    }

    return { profileType: pType, profileDimensions: pDims };
}


export async function retryWithBackoff<T>(
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
            // Enhanced retry condition for network/fetch errors
            const isNetworkError =
                error?.message?.includes('fetch failed') ||
                error?.code === 'ECONNRESET' ||
                error?.code === 'EPIPE' ||
                error?.code === 'ETIMEDOUT';

            const isRateLimit =
                error?.status === 503 ||
                error?.status === 429 ||
                error?.message?.includes('503') ||
                error?.message?.includes('overloaded');

            if (isNetworkError || isRateLimit) {
                const delay = initialDelay * Math.pow(2, i);
                console.log(`Gemini API issue (${error.message}). Attempt ${i + 1}/${maxRetries}. Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            throw error;
        }
    }
    throw lastError;
}

// ============================================================================
// AI Processing Logic
// ============================================================================

export async function processDrawingWithGemini(storagePath: string, projectId: string, filename: string): Promise<{ parts: ParsedPart[], raw: any }> {
    // Use service-role client since this runs in background/workers
    const supabase = createServiceClient()

    // Download
    const { data: fileData, error: downloadError } = await supabase.storage
        .from('Projects')
        .download(storagePath)

    if (downloadError || !fileData) throw new Error("Failed to download file from storage")

    const arrayBuffer = await fileData.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64Pdf = buffer.toString('base64')

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error("GEMINI_API_KEY missing")

    const genAI = new GoogleGenerativeAI(apiKey)
    const fileManager = new GoogleAIFileManager(apiKey)

    const schema = {
        type: SchemaType.OBJECT,
        properties: {
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
                        isSplit: { type: SchemaType.BOOLEAN, description: "True if profile is split/cut in half (e.g. 1/2 HEA)" },
                        cutAngles: { type: SchemaType.STRING, description: "Cut angles if specified (e.g. 45/90)" }
                    },
                    required: ["partNumber", "quantity", "type"]
                }
            }
        }
    } as any

    const modelCandidates = [
        { id: "gemini-3-flash-preview", retries: 2 }, // User preference: High speed & reasoning
        { id: "gemini-2.0-flash-exp", retries: 2 },   // Strong fallback
        { id: "gemini-1.5-pro", retries: 1 }          // Reliable fallback for complex docs
    ]

    const prompt = `
      Analyze this technical drawing (PDF) and extract ALL distinct parts found into the 'parts' array.
      CRITICAL CLASSIFICATION RULES:
      1. **PROFILE**: Any part that is a standard section (RHS, SHS, IPE, HEA, HEB, UNP/UPE, CHS, Angle, Round Bar).
      2. **PLATE**: Any part that is a flat sheet (Thickness x Width x Length).
      
      PARSING RULES:
      - Clean profile dimensions (e.g. "100x100x5").
      - Split Round Bar (1 dim) vs CHS (2 dims).
      - Square tube = SHS, Rect tube = RHS.
      
      NEW FIELDS:
      - **isSplit**: set to true if part is described as "1/2", "Half", or "Split" (e.g. "1/2 HEA 140").
      - **cutAngles**: extract any cut angles shown (e.g. "45°", "45-90"). Format as "45/90".
      `

    let resultText = "";
    let rootData: any = {};
    let lastError: Error | null = null;

    for (const candidate of modelCandidates) {
        try {
            console.log(`[Gemini] Attempting with model ${candidate.id}...`);
            const model = genAI.getGenerativeModel({
                model: candidate.id,
                generationConfig: { responseMimeType: "application/json", responseSchema: schema }
            }, {
                timeout: 600000 // 10 minutes timeout for large PDFs
            });

            // 1. Save buffer to temp file
            const tempFilePath = path.join(os.tmpdir(), `upload-${uuidv4()}.pdf`);
            await fs.writeFile(tempFilePath, buffer);

            // 2. Upload to Gemini
            const uploadResult = await fileManager.uploadFile(tempFilePath, {
                mimeType: "application/pdf",
                displayName: filename,
            });

            // 3. Delete local temp file
            await fs.unlink(tempFilePath);

            // Retry network errors
            const result = await retryWithBackoff(() =>
                model.generateContent([
                    { fileData: { mimeType: uploadResult.file.mimeType, fileUri: uploadResult.file.uri } },
                    prompt
                ]),
                candidate.retries
            );

            resultText = result.response.text();

            // Try to parse JSON immediately to validate
            try {
                rootData = JSON.parse(resultText);
                // If successful, break the loop
                break;
            } catch (jsonError) {
                console.warn(`[Gemini] Invalid JSON from model ${candidate.id}:`, jsonError);
                throw new Error("Invalid JSON extraction"); // Throw to trigger catch block and continue loop
            }

        } catch (error: any) {
            console.error(`[Gemini] Model ${candidate.id} failed:`, error.message);
            lastError = error;
            // Continue to next candidate
            continue;
        }
    }

    if (Object.keys(rootData).length === 0) {
        throw new Error(`AI Processing failed after trying all models. Last error: ${lastError?.message || "Unknown"}`);
    }

    let partsList = rootData.parts || (rootData.partNumber ? [rootData] : [])

    let processedParts: ParsedPart[] = []

    if (partsList.length === 0) {
        processedParts = [{
            id: uuidv4(),
            filename,
            partNumber: filename.replace('.pdf', ''),
            description: "AI FOUND NO PARTS",
            quantity: 0,
            material: "",
            thickness: 0,
            width: 0,
            length: 0,
            confidence: 0,
            drawingRef: storagePath,
            type: 'PLATE',
            warnings: []
        } as ParsedPart]
    } else {
        processedParts = partsList.map((data: any) => {
            let pType = data.profileType?.toUpperCase() || "";
            let pDims = data.profileDimensions || "";
            const warnings: string[] = [];


            // Use shared normalization logic
            const { profileType: normalizedType, profileDimensions: normalizedDims } = normalizePartData(pType, pDims, warnings);
            pType = normalizedType;
            pDims = normalizedDims;




            // Detect Split Profile manually if AI missed it
            let isSplit = !!data.isSplit;
            if (pDims.includes('1/2') || pType.includes('1/2') || pType.includes('HALF') || pDims.includes('SPLIT')) {
                isSplit = true;
                // Remove "1/2" trash from dims/type to normalize
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
                type: (data.type === 'PROFILE' || !!data.profileType) ? 'PROFILE' : 'PLATE',
                confidence: Number(data.confidence) || 80,
                drawingRef: storagePath,
                warnings,
                isSplit,
                cutAngles: data.cutAngles || null
            }
        })
    }

    return { parts: processedParts, raw: rootData }
}
