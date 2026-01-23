'use server'

import prisma from '@/lib/prisma'
import { createClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase-service'
import { headers } from 'next/headers'
import AdmZip from 'adm-zip'
import { v4 as uuidv4 } from 'uuid'
import { GoogleGenerativeAI, SchemaType, GenerationConfig } from '@google/generative-ai'

// Allow up to 5 minutes for execution


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

        // Helper function to process a single entry
        const processEntry = async (entry: AdmZip.IZipEntry): Promise<ParsedPart[]> => {
            try {
                const pdfBuffer = entry.getData()
                const base64Pdf = pdfBuffer.toString('base64')

                // UPLOAD TO SUPABASE
                const filename = entry.name.split('/').pop() || entry.name
                const storagePath = `${year}/${projectNumber}/uploads/parts/${filename}`

                const { error: uploadError } = await supabase.storage
                    .from('Projects')
                    .upload(storagePath, pdfBuffer, {
                        contentType: 'application/pdf',
                        upsert: true
                    })

                if (uploadError) {
                    console.error("Supabase Upload Error:", uploadError)
                }

                // Call Gemini AI
                const prompt = `
          Analyze this technical drawing (PDF) and extract ALL distinct parts found into the 'parts' array.
          
          If there is only one part, return an array with one item.
          If there are multiple parts (e.g. a sheet with several cutting profiles), extract each one as a separate item.

          CRITICAL CLASSIFICATION RULES:
          1. **PROFILE**: Any part that is a standard section beam, tube, or angle.
             - Keywords: RHS, SHS, IPE, HEA, HEB, UNP, UPE, L-Profile, Angle, Tube, Pipe, Beam, Round Bar.
             - **Standard Nomenclature**: Use "CHS-EN10219", "RHS-EN10219", "SHS-EN10219", "UPN", "ROUND BAR" where applicable.
             - **RHS vs SHS Rule**: 
                - If a tube is SQUARE (e.g. 60x60x4 or Side=60, Wall=4), classify as **SHS**.
                - If a tube is RECTANGULAR (e.g. 100x50x5), classify as **RHS**.
             - **ROUND BAR vs CHS**:
                - If "RO", "Round", "Bar" has **1 Dimension** (Diameter) -> **ROUND BAR**.
                - If "RO", "Tube", "Pipe" has **2 Dimensions** (Diameter x Wall) -> **CHS**.
          
          2. **PLATE**: Any part that is a flat sheet of material defined by Thickness x Width x Length.
             - Typically designated as "PL", "FL", "Flat Bar" (sometimes), or just dimensions like "10x200x500".
             - If the part has a 'Thickness' and 'Width' that define its cross-section, and it is NOT a standard profile, it is a PLATE.

          3. **PARSING RULES**:
             - **Part Number**: Extract the main POS number (e.g. "100", "201").
             - **Quantity**: Extract the quantity for this specific part.
             - **Material**: Extract material grade (e.g. S355, S235, 1.4301).
             - **Profile Dimensions**: 
               - For Profiles: Extract standard notation (e.g. "HEA 200", "100x100x5").
               - For Plates: Leave blank.
             - **Plate Dimensions**:
               - Thickness: Extract thickness (t=...).
               - Width: Extract width.
               - Length: Extract length.

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

                        // Helper for retry
                        const retryOperation = async (fn: () => Promise<any>, retries: number): Promise<any> => {
                            for (let i = 0; i < retries; i++) {
                                try {
                                    return await fn();
                                } catch (error) {
                                    if (i === retries - 1) throw error;
                                    await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
                                }
                            }
                        }

                        result = await retryOperation(() => model.generateContent([
                            {
                                inlineData: {
                                    data: base64Pdf,
                                    mimeType: "application/pdf"
                                }
                            },
                            prompt
                        ]), candidate.retries)

                        break;
                    } catch (error: any) {
                        console.warn(`Model ${candidate.id} failed for ${entry.name}. Trying next model...`);
                        lastError = error;
                    }
                }

                if (!result) {
                    console.error(`All models failed for ${entry.name}.`);
                    throw lastError || new Error("All models failed.");
                }

                const response = await result.response
                const text = response.text()

                let rootData: any = {}
                try {
                    rootData = JSON.parse(text)
                } catch (e) {
                    console.error("Failed to parse Gemini JSON", text)
                }

                let partsList = []
                if (rootData.parts && Array.isArray(rootData.parts)) {
                    partsList = rootData.parts;
                } else if (rootData.partNumber) {
                    partsList = [rootData];
                }

                if (partsList.length === 0) {
                    // Push error part
                    return [{
                        id: uuidv4(),
                        filename: entry.name,
                        partNumber: entry.name.replace('.pdf', ''),
                        description: "AI FOUND NO PARTS",
                        quantity: 0,
                        material: "",
                        thickness: 0,
                        width: 0,
                        length: 0,
                        confidence: 0,
                        drawingRef: storagePath
                    } as ParsedPart]
                }

                const processedParts: ParsedPart[] = []

                for (const data of partsList) {
                    try {
                        const isProfile = data.type === 'PROFILE' || !!data.profileType

                        let pType = data.profileType?.toUpperCase() || "";
                        let pDims = data.profileDimensions || "";

                        // 1. Clean Profile Dimensions
                        if (pDims) {
                            pDims = pDims.replace(/\*/g, 'x').toLowerCase()
                            const typePrefix = pType.toLowerCase()
                            if (pDims.startsWith(typePrefix)) {
                                pDims = pDims.substring(typePrefix.length).trim()
                            }
                            data.profileDimensions = pDims
                        }

                        // 2. Normalize Types
                        if (pType === 'UNP') pType = 'UPN';

                        const isRoundKeyword = ['RO', 'ROUND', 'ROUND BAR', 'BAR', 'RD'].some(t => pType === t || pType.startsWith(t + ' '));
                        const isTubeKeyword = ['TUBE', 'PIPE', 'CHS'].some(t => pType.includes(t));

                        if (isTubeKeyword) {
                            pType = 'CHS';
                        } else if (isRoundKeyword) {
                            const dimCount = pDims.split('x').length;
                            if (dimCount === 1) {
                                pType = 'ROUND BAR';
                            } else if (dimCount >= 2) {
                                pType = 'CHS';
                            }
                        }

                        if (pType === 'RHS' || pType === 'RHS 10219' || pType === 'RHS-EN10219') pType = 'RHS-EN10219';
                        if (pType === 'SHS' || pType === 'SHS 10219' || pType === 'SHS-EN10219') pType = 'SHS-EN10219';
                        if (pType === 'CHS' || pType === 'CHS 10219' || pType === 'CHS-EN10219') pType = 'CHS-EN10219';

                        data.profileType = pType;

                        // 3. Fix SHS/RHS Confusion
                        if (data.type === 'PROFILE' && data.profileType?.includes('RHS')) {
                            const dims = data.profileDimensions?.split('x') || []
                            if (dims.length === 2) {
                                const side = dims[0]
                                const wall = dims[1]
                                data.profileType = "SHS-EN10219"
                                data.profileDimensions = `${side}x${side}x${wall}`
                            }
                        }

                        if (data.type === 'PROFILE' && data.profileType?.includes('SHS')) {
                            const dims = data.profileDimensions?.split('x') || []
                            if (dims.length === 2) {
                                const side = dims[0]
                                const wall = dims[1]
                                data.profileDimensions = `${side}x${side}x${wall}`
                            }
                        }

                        if (data.profileType) {
                            data.profileType = data.profileType.toUpperCase().replace(/\s+/g, '-')
                            data.profileType = data.profileType.replace(/--/g, '-')
                            if (data.profileType.includes('SHS') && data.profileType.includes('10219')) data.profileType = 'SHS-EN10219'
                            if (data.profileType.includes('RHS') && data.profileType.includes('10219')) data.profileType = 'RHS-EN10219'
                            if (data.profileType.includes('CHS') && data.profileType.includes('10219')) data.profileType = 'CHS-EN10219'
                        }

                        processedParts.push({
                            id: uuidv4(),
                            filename: filename,
                            partNumber: data.partNumber ? String(data.partNumber) : "UNKNOWN",
                            description: data.title || filename,
                            quantity: Number(data.quantity) || 1,
                            material: data.material || "S355",
                            thickness: Number(data.thickness) || 0,
                            width: Number(data.width) || 0,
                            length: Number(data.length) || 0,
                            profileType: data.profileType,
                            profileDimensions: data.profileDimensions,
                            type: isProfile ? 'PROFILE' : 'PLATE',
                            confidence: Number(data.confidence) || 80,
                            drawingRef: storagePath
                        })
                    } catch (err) {
                        console.error("Error processing part item:", err)
                    }
                }
                return processedParts
            } catch (error) {
                console.error(`Error processing file ${entry.name}:`, error)
                return []
            }
        }

        // BATCH PROCESSING
        const CONCURRENCY_LIMIT = 3
        const resultPartsLocal: ParsedPart[] = []

        for (let i = 0; i < pdfEntries.length; i += CONCURRENCY_LIMIT) {
            const chunk = pdfEntries.slice(i, i + CONCURRENCY_LIMIT)
            const chunkResults = await Promise.all(chunk.map(entry => processEntry(entry)))

            for (const batch of chunkResults) {
                resultPartsLocal.push(...batch)
            }
        }

        return { success: true, parts: resultPartsLocal }

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

export async function processSingleDrawing(formData: FormData, projectId: string): Promise<{ success: boolean, parts?: ParsedPart[], error?: string }> {
    try {
        const file = formData.get('file') as File
        if (!file) return { success: false, error: "No file uploaded" }
        if (!projectId) return { success: false, error: "Project ID missing" }

        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { projectNumber: true, createdAt: true }
        })

        if (!project) return { success: false, error: "Project not found" }

        const year = new Date(project.createdAt).getFullYear()
        const projectNumber = project.projectNumber
        const supabase = await createClient()

        const apiKey = process.env.GEMINI_API_KEY
        if (!apiKey) return { success: false, error: "GEMINI_API_KEY is missing" }

        const genAI = new GoogleGenerativeAI(apiKey)
        const modelCandidates = [
            { id: "gemini-3-flash-preview", retries: 3 },
            { id: "gemini-2.5-flash", retries: 3 },
            { id: "gemini-2.5-pro", retries: 2 }
        ]

        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const base64Pdf = buffer.toString('base64')
        const filename = file.name

        // UPLOAD TO SUPABASE
        const storagePath = `${year}/${projectNumber}/uploads/parts/${filename}`
        const { error: uploadError } = await supabase.storage
            .from('Projects')
            .upload(storagePath, buffer, {
                contentType: 'application/pdf',
                upsert: true
            })

        if (uploadError) {
            console.error("Supabase Upload Error:", uploadError)
        }

        // Call Gemini AI
        const prompt = `
          Analyze this technical drawing (PDF) and extract ALL distinct parts found into the 'parts' array.
          
          If there is only one part, return an array with one item.
          If there are multiple parts (e.g. a sheet with several cutting profiles), extract each one as a separate item.

          CRITICAL CLASSIFICATION RULES:
          1. **PROFILE**: Any part that is a standard section beam, tube, or angle.
             - Keywords: RHS, SHS, IPE, HEA, HEB, UNP, UPE, L-Profile, Angle, Tube, Pipe, Beam, Round Bar.
             - **Standard Nomenclature**: Use "CHS-EN10219", "RHS-EN10219", "SHS-EN10219", "UPN", "ROUND BAR" where applicable.
             - **RHS vs SHS Rule**: 
                - If a tube is SQUARE (e.g. 60x60x4 or Side=60, Wall=4), classify as **SHS**.
                - If a tube is RECTANGULAR (e.g. 100x50x5), classify as **RHS**.
             - **ROUND BAR vs CHS**:
                - If "RO", "Round", "Bar" has **1 Dimension** (Diameter) -> **ROUND BAR**.
                - If "RO", "Tube", "Pipe" has **2 Dimensions** (Diameter x Wall) -> **CHS**.
          
          2. **PLATE**: Any part that is a flat sheet of material defined by Thickness x Width x Length.
             - Typically designated as "PL", "FL", "Flat Bar" (sometimes), or just dimensions like "10x200x500".
             - If the part has a 'Thickness' and 'Width' that define its cross-section, and it is NOT a standard profile, it is a PLATE.

          3. **PARSING RULES**:
             - **Part Number**: Extract the main POS number (e.g. "100", "201").
             - **Quantity**: Extract the quantity for this specific part.
             - **Material**: Extract material grade (e.g. S355, S235, 1.4301).
             - **Profile Dimensions**: 
               - For Profiles: Extract standard notation (e.g. "HEA 200", "100x100x5").
               - For Plates: Leave blank.
             - **Plate Dimensions**:
               - Thickness: Extract thickness (t=...).
               - Width: Extract width.
               - Length: Extract length.

          Return JSON strictly adhering to the schema.`

        let result;
        let lastError;

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
                ]), candidate.retries)

                break;
            } catch (error: any) {
                console.warn(`Model ${candidate.id} failed for ${filename}. Trying next model...`);
                lastError = error;
            }
        }

        if (!result) {
            console.error(`All models failed for ${filename}.`);
            throw lastError || new Error("All models failed.");
        }

        const response = await result.response
        const text = response.text()

        let rootData: any = {}
        try {
            rootData = JSON.parse(text)
        } catch (e) {
            console.error("Failed to parse Gemini JSON", text)
        }

        let partsList = []
        if (rootData.parts && Array.isArray(rootData.parts)) {
            partsList = rootData.parts;
        } else if (rootData.partNumber) {
            partsList = [rootData];
        }

        if (partsList.length === 0) {
            return {
                success: true,
                parts: [{
                    id: uuidv4(),
                    filename: filename,
                    partNumber: filename.replace('.pdf', ''),
                    description: "AI FOUND NO PARTS",
                    quantity: 0,
                    material: "",
                    thickness: 0,
                    width: 0,
                    length: 0,
                    confidence: 0,
                    drawingRef: storagePath
                } as ParsedPart]
            }
        }

        const processedParts: ParsedPart[] = []

        for (const data of partsList) {
            try {
                const isProfile = data.type === 'PROFILE' || !!data.profileType

                let pType = data.profileType?.toUpperCase() || "";
                let pDims = data.profileDimensions || "";

                if (pDims) {
                    pDims = pDims.replace(/\*/g, 'x').toLowerCase()
                    const typePrefix = pType.toLowerCase()
                    if (pDims.startsWith(typePrefix)) {
                        pDims = pDims.substring(typePrefix.length).trim()
                    }
                    data.profileDimensions = pDims
                }

                if (pType === 'UNP') pType = 'UPN';

                const isRoundKeyword = ['RO', 'ROUND', 'ROUND BAR', 'BAR', 'RD'].some(t => pType === t || pType.startsWith(t + ' '));
                const isTubeKeyword = ['TUBE', 'PIPE', 'CHS'].some(t => pType.includes(t));

                if (isTubeKeyword) {
                    pType = 'CHS';
                } else if (isRoundKeyword) {
                    const dimCount = pDims.split('x').length;
                    if (dimCount === 1) {
                        pType = 'ROUND BAR';
                    } else if (dimCount >= 2) {
                        pType = 'CHS';
                    }
                }

                if (pType === 'RHS' || pType === 'RHS 10219' || pType === 'RHS-EN10219') pType = 'RHS-EN10219';
                if (pType === 'SHS' || pType === 'SHS 10219' || pType === 'SHS-EN10219') pType = 'SHS-EN10219';
                if (pType === 'CHS' || pType === 'CHS 10219' || pType === 'CHS-EN10219') pType = 'CHS-EN10219';

                data.profileType = pType;

                if (data.type === 'PROFILE' && data.profileType?.includes('RHS')) {
                    const dims = data.profileDimensions?.split('x') || []
                    if (dims.length === 2) {
                        const side = dims[0]
                        const wall = dims[1]
                        data.profileType = "SHS-EN10219"
                        data.profileDimensions = `${side}x${side}x${wall}`
                    }
                }

                if (data.type === 'PROFILE' && data.profileType?.includes('SHS')) {
                    const dims = data.profileDimensions?.split('x') || []
                    if (dims.length === 2) {
                        const side = dims[0]
                        const wall = dims[1]
                        data.profileDimensions = `${side}x${side}x${wall}`
                    }
                }

                if (data.profileType) {
                    data.profileType = data.profileType.toUpperCase().replace(/\s+/g, '-') // Ensure no spaces if mixed up
                    // Clean up if double dash
                    data.profileType = data.profileType.replace(/--/g, '-')
                    // Enforce known good IDs if close match
                    if (data.profileType.includes('SHS') && data.profileType.includes('10219')) data.profileType = 'SHS-EN10219'
                    if (data.profileType.includes('RHS') && data.profileType.includes('10219')) data.profileType = 'RHS-EN10219'
                    if (data.profileType.includes('CHS') && data.profileType.includes('10219')) data.profileType = 'CHS-EN10219'
                }

                processedParts.push({
                    id: uuidv4(),
                    filename: filename,
                    partNumber: data.partNumber ? String(data.partNumber) : "UNKNOWN",
                    description: data.title || filename,
                    quantity: Number(data.quantity) || 1,
                    material: data.material || "S355",
                    thickness: Number(data.thickness) || 0,
                    width: Number(data.width) || 0,
                    length: Number(data.length) || 0,
                    profileType: data.profileType,
                    profileDimensions: data.profileDimensions,
                    type: isProfile ? 'PROFILE' : 'PLATE',
                    confidence: Number(data.confidence) || 80,
                    drawingRef: storagePath
                })
            } catch (err) {
                console.error("Error processing part item:", err)
            }
        }
        return { success: true, parts: processedParts }
    } catch (error: any) {
        console.error("Single Drawing Parse Error:", error)
        return { success: false, error: error.message || "Failed to process file" }
    }
}

export async function uploadSingleDrawing(formData: FormData, projectId: string): Promise<{ success: boolean, filename?: string, storagePath?: string, error?: string }> {
    try {
        const file = formData.get('file') as File
        if (!file) return { success: false, error: "No file provided" }

        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { projectNumber: true, createdAt: true }
        })
        if (!project) return { success: false, error: "Project not found" }

        const year = new Date(project.createdAt).getFullYear()
        const projectNumber = project.projectNumber // Adjust if your project number format differs

        const supabase = await createClient()
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        const storagePath = `${year}/${projectNumber}/uploads/parts/${file.name}`

        const { error } = await supabase.storage
            .from('Projects')
            .upload(storagePath, buffer, {
                contentType: 'application/pdf',
                upsert: true
            })

        if (error) throw error

        return { success: true, filename: file.name, storagePath }
    } catch (e: any) {
        console.error("Upload Error:", e)
        return { success: false, error: e.message }
    }
}

// ============================================================================
// NEW: Robust Server-Side Queue Implementation
// ============================================================================

export async function createImportBatch(files: { filename: string, storagePath: string }[], projectId: string): Promise<{ success: boolean, batchId?: string, error?: string }> {
    try {
        const batchId = uuidv4()
        const records = files.map(f => ({
            jobId: batchId,
            projectId,
            filename: f.filename,
            fileUrl: f.storagePath,
            status: 'PENDING'
        }))

        // Create batches of 50 to avoid limits if many files
        const BATCH_SIZE = 50
        for (let i = 0; i < records.length; i += BATCH_SIZE) {
            await prisma.parsedDrawing.createMany({
                data: records.slice(i, i + BATCH_SIZE)
            })
        }

        // TRIGGER QUEUE PROCESSING (Fire & Forget)
        // Need to determine base URL dynamically from headers since env var might be missing
        const headersList = await headers()
        const protocol = headersList.get('x-forwarded-proto') || 'http'
        const host = headersList.get('host')
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`

        // Trigger a few workers to start parallel processing
        // We use fetch without await to not block the response
        fetch(`${baseUrl}/api/process-queue`, {
            method: 'POST',
            body: JSON.stringify({ batchId }),
            headers: { 'Content-Type': 'application/json' }
        }).catch(err => console.error("Failed to trigger queue:", err))

        return { success: true, batchId }
    } catch (e: any) {
        console.error("Failed to create batch:", e)
        return { success: false, error: e.message }
    }
}

export async function getBatchStatus(batchId: string): Promise<{
    total: number,
    completed: number,
    pending: number,
    failed: number,
    results: ParsedPart[]
}> {
    const jobs = await prisma.parsedDrawing.findMany({
        where: { jobId: batchId }
    })

    const total = jobs.length
    const completed = jobs.filter(j => j.status === 'COMPLETED').length
    const failed = jobs.filter(j => j.status === 'FAILED').length
    const pending = jobs.filter(j => j.status === 'PENDING' || j.status === 'PROCESSING').length

    const results: ParsedPart[] = jobs
        .filter(j => j.status === 'COMPLETED' && j.result)
        .flatMap(j => {
            const res = j.result as any
            return Array.isArray(res) ? res : [res]
        })

    return { total, completed, pending, failed, results }
}

export async function processNextPendingJob(batchId?: string): Promise<{ processed: boolean, jobId?: string, remaining?: number }> {
    // 1. Find next pending job
    const job = await prisma.parsedDrawing.findFirst({
        where: {
            status: 'PENDING',
            ...(batchId ? { jobId: batchId } : {})
        },
        orderBy: { createdAt: 'asc' }
    })

    if (!job) return { processed: false }

    // 2. Optimistic Locking: Set to PROCESSING
    try {
        await prisma.parsedDrawing.update({
            where: { id: job.id, status: 'PENDING' },
            data: { status: 'PROCESSING' }
        })
    } catch (e) {
        // Race condition: someone else took it
        return { processed: false }
    }

    // 3. Process
    try {
        const { parts: processedParts, raw } = await processDrawingWithGemini(job.fileUrl, job.projectId, job.filename)

        await prisma.parsedDrawing.update({
            where: { id: job.id },
            data: {
                status: 'COMPLETED',
                result: processedParts as any,
                rawResponse: raw // Save raw JSON
            }
        })

        // check if more exist
        const remaining = await prisma.parsedDrawing.count({
            where: {
                status: 'PENDING',
                ...(batchId ? { jobId: batchId } : {})
            }
        })

        return { processed: true, jobId: job.id, remaining }

    } catch (e: any) {
        console.error(`Job ${job.id} failed:`, e)
        await prisma.parsedDrawing.update({
            where: { id: job.id },
            data: {
                status: 'FAILED',
                error: e.message || "Unknown error"
            }
        })
        return { processed: true, jobId: job.id }
    }
}

// Logic extracted from old function
async function processDrawingWithGemini(storagePath: string, projectId: string, filename: string): Promise<{ parts: ParsedPart[], raw: any }> {
    // Use service-role client since this runs in background without user cookies
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

    // Configs
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
        { id: "gemini-2.0-flash-exp", retries: 3 },
        { id: "gemini-1.5-flash", retries: 3 },
        { id: "gemini-1.5-pro", retries: 2 }
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

    let result;
    for (const candidate of modelCandidates) {
        try {
            const model = genAI.getGenerativeModel({ model: candidate.id, generationConfig: { responseMimeType: "application/json", responseSchema: schema } })
            result = await retryWithBackoff(() => model.generateContent([{ inlineData: { data: base64Pdf, mimeType: "application/pdf" } }, prompt]), candidate.retries)
            break;
        } catch (error) { continue }
    }

    if (!result) throw new Error("AI Processing failed")

    const text = result.response.text()
    let rootData: any = {}
    try { rootData = JSON.parse(text) } catch (e) { throw new Error("Invalid JSON from AI") }

    let partsList = rootData.parts || (rootData.partNumber ? [rootData] : [])

    if (partsList.length === 0) {
        return {
            parts: [{
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
                type: 'PLATE'
            } as ParsedPart], raw: rootData
        }
    }

    const processedParts = partsList.map((data: any) => {
        let pType = data.profileType?.toUpperCase() || "";
        let pDims = data.profileDimensions || "";

        // Basic cleaning
        if (pDims) {
            pDims = pDims.replace(/\*/g, 'x').toLowerCase()
            const typePrefix = pType.toLowerCase()
            if (pDims.startsWith(typePrefix)) pDims = pDims.substring(typePrefix.length).trim()
        }

        // Normalize logic
        if (pType === 'UNP') pType = 'UPN';
        if (['TUBE', 'PIPE'].some(t => pType.includes(t))) pType = 'CHS-EN10219';

        // Detect RHS/SHS
        if (pType.includes('RHS') || pType.includes('SHS') || pType === 'HOLLOW SECTION') {
            const dims = pDims.split('x')
            if (dims.length === 2 && dims[0] === dims[1]) pType = 'SHS-EN10219'
            else if (dims.length > 0) pType = 'RHS-EN10219'
        }

        if (pType === 'RHS') pType = 'RHS-EN10219';
        if (pType === 'SHS') pType = 'SHS-EN10219';

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
            drawingRef: storagePath
        }
    })

    return { parts: processedParts, raw: rootData }
}
