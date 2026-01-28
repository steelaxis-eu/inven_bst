'use server'

import prisma from '@/lib/prisma'
import { createClient } from '@/lib/supabase-server'
import { headers } from 'next/headers'
import { v4 as uuidv4 } from 'uuid'
import { tasks } from "@trigger.dev/sdk/v3"
import { ParsedPart } from '@/lib/smart-parsing-logic'

// ============================================================================
// Generic Upload
// ============================================================================

export async function uploadSmartFile(formData: FormData, projectId: string): Promise<{ success: boolean, filename?: string, storagePath?: string, error?: string }> {
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

        // Use a "dump" folder to keep it separate from clean parts for now?
        // Or just "uploads/smart"
        const storagePath = `${year}/${projectNumber}/uploads/smart/${uuidv4()}-${file.name}`

        const { error } = await supabase.storage
            .from('Projects')
            .upload(storagePath, buffer, {
                contentType: file.type || 'application/octet-stream',
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
// Batch & Status
// ============================================================================

export async function createSmartImportBatch(
    files: { filename: string, storagePath: string, type: 'PDF' | 'EXCEL' | 'DXF' | 'OTHER' }[],
    projectId: string
): Promise<{ success: boolean, batchId?: string, error?: string }> {
    try {
        const batchId = uuidv4()

        const records = files.map(f => ({
            id: uuidv4(),
            jobId: batchId, // We use the same table but a specific batch ID that we will trigger with
            projectId,
            filename: f.filename,
            fileUrl: f.storagePath,
            status: 'PENDING',
            // We might want to store the "detected type" somewhere, but `ParsedDrawing` schema is rigid?
            // If schema has no "type" field, we can stuff it in `rawResponse` initially or just rely on extension processing
            // For now, we'll just rely on filename extension re-check in the worker, or valid "metadata" capability if schema allows
            // Checked schema in mind: it has `result`, `rawResponse`. 
            // We can store `{ type: f.type }` in `rawResponse` temporarily as initial state? No, status is pending.
            // We'll just rely on file extension in the worker.
        }))

        // Create batches
        const BATCH_SIZE = 50
        for (let i = 0; i < records.length; i += BATCH_SIZE) {
            await prisma.parsedDrawing.createMany({
                data: records.slice(i, i + BATCH_SIZE)
            })
        }

        // TRIGGER NEW SMART WORKER
        try {
            const handle = await tasks.trigger("process-smart-import-batch", { batchId });
            console.log(`[SmartBatch] Triggered parsing job: ${handle.id} for batch ${batchId}`);
        } catch (triggerError: any) {
            console.error("Failed to trigger remote job:", triggerError);
        }

        return { success: true, batchId }
    } catch (e: any) {
        console.error("Failed to create batch:", e)
        return { success: false, error: e.message }
    }
}

export async function addToSmartBatch(
    batchId: string,
    files: { filename: string, storagePath: string, type: 'PDF' | 'EXCEL' | 'DXF' | 'OTHER' }[],
    projectId: string
): Promise<{ success: boolean, error?: string }> {
    try {
        const records = files.map(f => {
            const isAsset = f.type === 'DXF' || f.type === 'OTHER' // Add other asset types if needed
            return {
                id: uuidv4(),
                jobId: batchId,
                status: isAsset ? 'COMPLETED' : 'PENDING',
                filename: f.filename,
                fileUrl: f.storagePath,
                projectId: projectId
            }
        })

        // Create these specific records
        await prisma.parsedDrawing.createMany({ data: records })

        // Trigger SINGLE processing only for PENDING records (PDF/EXCEL)
        const pendingRecords = records.filter(r => r.status === 'PENDING')
        await Promise.all(pendingRecords.map(r =>
            tasks.trigger("process-smart-import-single", { id: r.id })
        ))

        return { success: true }
    } catch (e: any) {
        console.error("addToSmartBatch Error:", e)
        return { success: false, error: e.message }
    }
}


export async function getSmartBatchStatus(batchId: string): Promise<{
    total: number,
    completed: number,
    pending: number,
    failed: number,
    results: ParsedPart[],
    totalPartsFound: number
}> {
    if (!batchId) {
        return { total: 0, completed: 0, pending: 0, failed: 0, results: [], totalPartsFound: 0 }
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
            const parts = (Array.isArray(res) ? res : [res]) as ParsedPart[]
            // Inject Raw Data for Debugging if requested
            // The `ParsedPart` interface in `smart-parsing-logic` has `raw?: any`
            // We ensure it is passed through.
            return parts.map(p => ({
                ...p,
                // If the part didn't have raw attached (from old logic), attach the job's raw response
                raw: p.raw || j.rawResponse
            }))
        })

    const totalPartsFound = results.length

    return { total, completed, pending, failed, results, totalPartsFound }
}
