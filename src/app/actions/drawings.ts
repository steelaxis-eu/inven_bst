'use server'

import prisma from '@/lib/prisma'
import { createClient } from '@/lib/supabase-server'
import { headers } from 'next/headers'
import { v4 as uuidv4 } from 'uuid'
import { tasks } from "@trigger.dev/sdk/v3"
import { ParsedPart } from '@/lib/parsing-logic'
import { processDrawingBatch } from '@/trigger/parsing' // Import task for type safety if needed, or just use string ID

// Re-export for compatibility
export type { ParsedPart } from '@/lib/parsing-logic'

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
// Batch Creation & Triggering
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

        // TRIGGER REMOTE PROCESSING
        try {
            const handle = await tasks.trigger("process-drawing-batch", { batchId });
            console.log(`[Batch] Triggered parsing job: ${handle.id} for batch ${batchId}`);
        } catch (triggerError: any) {
            console.error("Failed to trigger remote job:", triggerError);
            // We don't fail the request, because the user might be offline or config missing
            // But we should ideally let them know. For now we log it.
            // If Trigger.dev is not configured, this will fail.
        }

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
    results: ParsedPart[],
    totalPartsFound: number
}> {
    if (!batchId) {
        return { total: 0, completed: 0, pending: 0, failed: 0, results: [] }
    }
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
            const parts = Array.isArray(res) ? res : [res]
            return parts.map((p: any) => ({ ...p, raw: j.rawResponse }))
        })

    const totalPartsFound = results.length

    return { total, completed, pending, failed, results, totalPartsFound }
}

export async function cancelImportBatch(batchId: string): Promise<{ success: boolean, deleted?: number }> {
    try {
        if (!batchId) return { success: false }
        const result = await prisma.parsedDrawing.deleteMany({
            where: { jobId: batchId }
        })
        return { success: true, deleted: result.count }
    } catch (e: any) {
        console.error("Failed to cancel batch:", e)
        return { success: false }
    }
}
