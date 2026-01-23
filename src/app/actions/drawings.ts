'use server'

import prisma from '@/lib/prisma'
import { createClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase-service'
import { headers } from 'next/headers'
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
}

// Kept for backward compatibility with import-context
export interface ParsedAssembly {
    id: string
    filename: string
    assemblyNumber: string
    name: string
    quantity: number
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

// ============================================================================
// Utilities
// ============================================================================

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

// ============================================================================
// Upload Single Drawing to Supabase Storage
// ============================================================================

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
        const projectNumber = project.projectNumber

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
// Batch Creation & Status
// ============================================================================

export async function createImportBatch(files: { filename: string, storagePath: string }[], projectId: string): Promise<{ success: boolean, batchId?: string, error?: string }> {
    try {
        const batchId = uuidv4()

        const records = files.map(f => ({
            id: uuidv4(),
            jobId: batchId,
            projectId,
            filename: f.filename,
            fileUrl: f.storagePath,
            status: 'PENDING'
        }))

        // Create batches of 50 to avoid DB limits
        const BATCH_SIZE = 50
        for (let i = 0; i < records.length; i += BATCH_SIZE) {
            await prisma.parsedDrawing.createMany({
                data: records.slice(i, i + BATCH_SIZE)
            })
        }

        // TRIGGER QUEUE PROCESSING (Fire & Forget)
        const headersList = await headers()
        const protocol = headersList.get('x-forwarded-proto') || 'http'
        const host = headersList.get('host')
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`

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
    const completed = jobs.filter((j: any) => j.status === 'COMPLETED').length
    const failed = jobs.filter((j: any) => j.status === 'FAILED').length
    const pending = jobs.filter((j: any) => j.status === 'PENDING' || j.status === 'PROCESSING').length

    const results: ParsedPart[] = jobs
        .filter((j: any) => j.status === 'COMPLETED' && j.result)
        .flatMap((j: any) => {
            const res = j.result as any
            return Array.isArray(res) ? res : [res]
        })

    return { total, completed, pending, failed, results }
}

export async function cancelImportBatch(batchId: string): Promise<{ success: boolean, deleted?: number }> {
    try {
        const result = await prisma.parsedDrawing.deleteMany({
            where: { jobId: batchId }
        })
        return { success: true, deleted: result.count }
    } catch (e: any) {
        console.error("Failed to cancel batch:", e)
        return { success: false }
    }
}

// ============================================================================
// Queue Processor
// ============================================================================

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
                rawResponse: raw
            }
        })

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

        // Always return remaining count so queue continues after failure
        const remainingAfterError = await prisma.parsedDrawing.count({
            where: {
                status: 'PENDING',
                ...(batchId ? { jobId: batchId } : {})
            }
        })
        return { processed: true, jobId: job.id, remaining: remainingAfterError }
    }
}

// ============================================================================
// AI Processing
// ============================================================================

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
            type: 'PLATE'
        } as ParsedPart]
    } else {
        processedParts = partsList.map((data: any) => {
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
    }

    return { parts: processedParts, raw: rootData }
}
