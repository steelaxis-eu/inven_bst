'use server'

import prisma from '@/lib/prisma'
import { createClient } from '@/lib/supabase-server'
import { headers } from 'next/headers'
import { v4 as uuidv4 } from 'uuid'
import { tasks } from "@trigger.dev/sdk/v3"
import { ParsedPart } from '@/lib/smart-parsing-logic'
import { scanFileWithAI, ScanResult } from '@/lib/agentic-scanner'
import { createServiceClient } from '@/lib/supabase-service'
import { ParsedDrawing } from '@prisma/client'

export async function scanSmartFiles(
    files: { filename: string, storagePath: string }[]
): Promise<{ results: ScanResult[], error?: string }> {
    try {
        const supabase = createServiceClient()
        const results: ScanResult[] = []

        // Run scans in parallel (limited concurrency could be better but let's try parallel for speed)
        // Actually, let's limit 5 at a time to avoid rate limits or memory bursts
        const CONCURRENCY = 5
        for (let i = 0; i < files.length; i += CONCURRENCY) {
            const chunk = files.slice(i, i + CONCURRENCY)
            const chunkResults = await Promise.all(chunk.map(async (file) => {
                const { data, error } = await supabase.storage
                    .from('Projects')
                    .download(file.storagePath)

                if (error || !data) {
                    return {
                        filename: file.filename,
                        description: "Failed to download file.",
                        classification: 'OTHER',
                        suggestedAction: 'IGNORE',
                        confidence: 0
                    } as ScanResult
                }

                const arrayBuffer = await data.arrayBuffer()
                const buffer = Buffer.from(arrayBuffer)
                return scanFileWithAI(buffer, file.filename)
            }))
            results.push(...chunkResults)
        }

        return { results }
    } catch (e: any) {
        console.error("Scan Error:", e)
        return { results: [], error: e.message }
    }
}

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
    files: { filename: string, storagePath: string, type: string, instruction?: string }[],
    projectId: string
): Promise<{ success: boolean, batchId?: string, error?: string }> {
    try {
        const batchId = uuidv4()

        const records = files.map(f => ({
            id: uuidv4(),
            jobId: batchId,
            projectId,
            filename: f.filename,
            fileUrl: f.storagePath,
            status: 'PENDING',
            // Store the agentic instruction and detected type in rawResponse for the worker to find
            rawResponse: {
                instruction: f.instruction || 'IMPORT_PARTS',
                detectedType: f.type
            } as any
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
    files: { filename: string, storagePath: string, type: 'PDF' | 'EXCEL' | 'DXF' | 'OTHER', instruction?: string }[],
    projectId: string
): Promise<{ success: boolean, error?: string }> {
    try {
        const records = files.map(f => {
            const isAsset = f.type === 'DXF' || f.type === 'OTHER' || f.instruction === 'ASSOCIATE'
            return {
                id: uuidv4(),
                jobId: batchId,
                status: isAsset ? 'COMPLETED' : 'PENDING',
                filename: f.filename,
                fileUrl: f.storagePath,
                projectId: projectId,
                rawResponse: { instruction: f.instruction || 'IMPORT_PARTS', detectedType: f.type } as any
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
    totalPartsFound: number,
    fileSummaries: { id: string, filename: string, status: string, error?: string, partCount: number, summary?: string, rawData?: any }[]
}> {
    if (!batchId) {
        return { total: 0, completed: 0, pending: 0, failed: 0, results: [], totalPartsFound: 0, fileSummaries: [] }
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

    const fileSummaries = jobs.map((j: any) => {
        let partCount = 0
        let summary = undefined
        let raw = undefined

        if (j.status === 'COMPLETED' && j.result) {
            const res = j.result as any
            const parts = (Array.isArray(res) ? res : (res.parts || [res])) // Handle both old array and new object format
            partCount = Array.isArray(parts) ? parts.length : 0

            // Extract tokens if available (from new format)
            if (res.raw) {
                summary = res.raw.summary
                raw = res.raw
            }
        }
        return {
            id: j.id,
            filename: j.filename,
            status: j.status,
            error: j.error,
            partCount,
            summary,
            rawData: raw
        }
    })

    const totalPartsFound = results.length

    return { total, completed, pending, failed, results, totalPartsFound, fileSummaries }
}

// ============================================================================
// Persistence & Resumable Session
// ============================================================================

export interface SavedScannedFileDto {
    id: string
    name: string
    storagePath?: string
    scanResult?: ScanResult
    selectedAction?: string
}

export async function processScannedBatch(
    batchId: string,
    files: { id: string, instruction: string }[],
    projectId: string
): Promise<{ success: boolean, error?: string }> {
    try {
        // 1. Update records to PENDING status and set instruction
        // We do this in a loop or parallel promises as updateMany doesn't support different values per row
        // But usually instructions are group-based? No, per file.

        await Promise.all(files.map(async (f) => {
            const isAsset = f.instruction === 'ASSOCIATE' || f.instruction === 'IGNORE' // IGNORE shouldn't happen here usually
            // If Associate, we mark COMPLETED directly? Or PENDING for association? 
            // Current flow: Assets (DXF) are completed.
            // If we have 'IMPORT_PARTS' -> PENDING -> Worker.

            const status = (f.instruction === 'ASSOCIATE' || f.instruction === 'IGNORE') ? 'COMPLETED' : 'PENDING' // Simple logic

            // Trigger worker if PENDING
            await prisma.parsedDrawing.update({
                where: { id: f.id },
                data: {
                    status,
                    rawResponse: {
                        instruction: f.instruction,
                        // Maintain existing data if we could, but rawResponse is JSON.
                        // We might overwrite scanResult. Ideally we merge.
                        // For speed, let's assume we just need instruction now.
                    } as any
                }
            })

            if (status === 'PENDING') {
                await tasks.trigger("process-smart-import-single", { id: f.id })
            }
        }))

        return { success: true }
    } catch (e: any) {
        console.error("processScannedBatch Error:", e)
        return { success: false, error: e.message }
    }
}

export async function getPendingImportSession(projectId: string): Promise<ParsedDrawing[] | null> {
    try {
        // Find most recent batch that has items in SCANNED or PENDING state
        // We look for items created in the last 24h
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)

        const recentItems = await prisma.parsedDrawing.findMany({
            where: {
                projectId,
                status: { in: ['SCANNED', 'PENDING'] },
                createdAt: { gt: yesterday }
            },
            orderBy: { createdAt: 'desc' },
            take: 1
        })

        if (!recentItems || recentItems.length === 0) return null

        const batchId = recentItems[0].jobId

        // Get all items in this batch
        const batchItems = await prisma.parsedDrawing.findMany({
            where: { jobId: batchId }
        })

        return batchItems
    } catch (e) {
        console.error("Failed to get pending session", e)
        return null
    }
}

export async function saveScannedFile(
    batchId: string,
    projectId: string,
    file: SavedScannedFileDto
): Promise<boolean> {
    try {
        await prisma.parsedDrawing.upsert({
            where: {
                id: file.id // Ensure ScannedFile has ID locally generated or we reuse one
            },
            create: {
                id: file.id,
                jobId: batchId,
                projectId,
                filename: file.name,
                fileUrl: file.storagePath || "",
                status: 'SCANNED',
                rawResponse: {
                    scanResult: file.scanResult,
                    selectedAction: file.selectedAction
                } as any
            },
            update: {
                status: 'SCANNED',
                rawResponse: {
                    scanResult: file.scanResult,
                    selectedAction: file.selectedAction
                } as any
            }
        })
        return true
    } catch (e) {
        console.error("Failed to save scanned file", e)
        return false
    }
}

export async function updateTriageAction(
    fileId: string,
    action: string
): Promise<boolean> {
    try {
        const record = await prisma.parsedDrawing.findUnique({ where: { id: fileId } })
        if (!record) return false

        const newRaw = {
            ...(record.rawResponse as any || {}),
            selectedAction: action,
            instruction: action // Sync instruction here too
        }

        await prisma.parsedDrawing.update({
            where: { id: fileId },
            data: {
                rawResponse: newRaw
            }
        })
        return true
    } catch (e) {
        console.error("Failed to update triage action", e)
        return false
    }
}
