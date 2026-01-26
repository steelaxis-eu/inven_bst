import { createServiceClient } from '@/lib/supabase-service'
import { v4 as uuidv4 } from 'uuid'
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'

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
}

// ============================================================================
// Utilities
// ============================================================================

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
                        profileDimensions: { type: SchemaType.STRING }
                    },
                    required: ["partNumber", "quantity", "type"]
                }
            }
        }
    } as any

    const modelCandidates = [
        { id: "gemini-3-flash-preview", retries: 3 },
        { id: "gemini-2.5-flash", retries: 3 },
        { id: "gemini-2.5-pro", retries: 2 }
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
            });

            // Retry network errors
            const result = await retryWithBackoff(() =>
                model.generateContent([{ inlineData: { data: base64Pdf, mimeType: "application/pdf" } }, prompt]),
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

            // Basic cleaning
            if (pDims) {
                pDims = pDims.replace(/\*/g, 'x').toLowerCase()
                const typePrefix = pType.toLowerCase()
                if (pDims.startsWith(typePrefix)) pDims = pDims.substring(typePrefix.length).trim()
            }

            // Normalize logic
            if (pType === 'UNP') pType = 'UPN';
            if (pType === 'QRO') pType = 'SHS-EN10219'; // User Request: SHS is also QRO
            if (['TUBE', 'PIPE'].some(t => pType.includes(t))) pType = 'CHS-EN10219';

            // Detect RHS/SHS
            if (pType.includes('RHS') || pType.includes('SHS') || pType === 'HOLLOW SECTION') {
                const dims = pDims.split('x')
                if (dims.length === 2 && dims[0] === dims[1]) pType = 'SHS-EN10219'
                else if (dims.length > 0) pType = 'RHS-EN10219'
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
                warnings
            }
        })
    }

    return { parts: processedParts, raw: rootData }
}
