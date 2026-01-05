'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

// ============================================================================
// BACKGROUND JOBS
// ============================================================================

/**
 * Start a background job to recalculate weights
 */
export async function startRecalculateJob(projectId: string) {
    try {
        const job = await prisma.optimizationJob.create({
            data: {
                projectId,
                type: 'WEIGHT_RECALC',
                status: 'PENDING'
            }
        })

        // Fire and forget - do not await
        processRecalculateJob(job.id).catch(err => {
            console.error(`Job ${job.id} failed:`, err)
        })

        return { success: true, jobId: job.id }
    } catch (e: any) {
        console.error('startRecalculateJob error:', e)
        return { success: false, error: e.message }
    }
}

/**
 * Get status of a job
 */
export async function getJobStatus(jobId: string) {
    try {
        const job = await prisma.optimizationJob.findUnique({
            where: { id: jobId }
        })
        return { success: true, job }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

/**
 * Get active jobs for a project
 */
export async function getProjectActiveJobs(projectId: string) {
    try {
        const jobs = await prisma.optimizationJob.findMany({
            where: {
                projectId,
                status: { in: ['PENDING', 'PROCESSING'] }
            },
            orderBy: { createdAt: 'desc' }
        })
        return { success: true, jobs }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

/**
 * Process the Recalculation Job (Async)
 */
async function processRecalculateJob(jobId: string) {
    try {
        // Mark as Processing
        await prisma.optimizationJob.update({
            where: { id: jobId },
            data: { status: 'PROCESSING' }
        })

        const job = await prisma.optimizationJob.findUnique({ where: { id: jobId } })
        if (!job) return

        // --- HEAVY CALCULATION START ---
        const parts = await prisma.part.findMany({
            where: { projectId: job.projectId },
            include: { profile: true }
        })

        let updatedCount = 0

        for (const part of parts) {
            // Recalculate if explicitly 0 or seemingly wrong, or just checking all?
            // Let's check all that don't have hardcoded manual override (if we had that flag).
            // For now, assume if calculated differs from stored, update it.
            // But to save time, only if stored is 0 or user requested fixing.
            // "Recalculate Weights" implies fixing broken ones.

            let weightPerMeter = 0

            if (part.unitWeight > 0.01) continue // Skip ones that look fine? Or user wants to FORCE update?
            // If we only touch 0 weights, it's safer.
            // But if profile changed, we should update.
            // Let's assume this tool is to "Fix Missing Weights". 
            // If user updated Profile weight, they might want all parts updated.
            // Let's remove the "continue" check to allow full refresh?
            // "if (part.unitWeight > 0.01) continue" was in my previous code.
            // I'll keep it for now to avoid overwriting manual edits (if any).
            // Actually, if I remove it, I might overwrite manually entered weights for custom parts.
            // So I'll keep the check: "Only fix 0 weights".

            if (part.unitWeight > 0.01) continue

            if (part.profile?.weightPerMeter) {
                weightPerMeter = part.profile.weightPerMeter
            } else if (part.profileType && part.profileDimensions) {
                // Lookup
                const active = await prisma.steelProfile.findUnique({
                    where: { type_dimensions: { type: part.profileType, dimensions: part.profileDimensions } }
                })
                if (active) {
                    weightPerMeter = active.weightPerMeter
                } else {
                    const std = await prisma.standardProfile.findUnique({
                        where: { type_dimensions: { type: part.profileType, dimensions: part.profileDimensions } }
                    })
                    if (std) weightPerMeter = std.weightPerMeter
                }
            }

            if (weightPerMeter > 0 && part.length) {
                const newWeight = (part.length / 1000) * weightPerMeter

                // Update if different (or 0)
                if (Math.abs(newWeight - part.unitWeight) > 0.001) {
                    await prisma.part.update({
                        where: { id: part.id },
                        data: { unitWeight: newWeight }
                    })
                    updatedCount++
                }
            }
        }
        // --- HEAVY CALCULATION END ---

        // Mark as Completed
        await prisma.optimizationJob.update({
            where: { id: jobId },
            data: {
                status: 'COMPLETED',
                result: { updatedParts: updatedCount },
                completedAt: new Date()
            }
        })

        revalidatePath(`/projects/${job.projectId}`)

    } catch (e: any) {
        console.error('processRecalculateJob error:', e)
        await prisma.optimizationJob.update({
            where: { id: jobId },
            data: {
                status: 'FAILED',
                error: e.message,
                completedAt: new Date()
            }
        })
    }
}

/**
 * Start a Nesting Optimization Job
 */
export async function startNestingJob(projectId: string, pieceIds: string[], stockLength: number) {
    try {
        const job = await prisma.optimizationJob.create({
            data: {
                projectId,
                type: 'NESTING',
                status: 'PENDING',
                parameters: { pieceIds, stockLength }
            }
        })

        processNestingJob(job.id).catch(err => {
            console.error(`Nesting Job ${job.id} failed:`, err)
        })

        return { success: true, jobId: job.id }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

async function processNestingJob(jobId: string) {
    try {
        await prisma.optimizationJob.update({
            where: { id: jobId },
            data: { status: 'PROCESSING' }
        })

        const job = await prisma.optimizationJob.findUnique({ where: { id: jobId } })
        if (!job || !job.parameters) return

        const { pieceIds, stockLength } = job.parameters as { pieceIds: string[], stockLength: number }

        // Import the heavy calculation
        const { calculateCuttingPlan } = await import('./planning')

        const res = await calculateCuttingPlan(pieceIds, stockLength)

        if (res.success && res.data) {
            await prisma.optimizationJob.update({
                where: { id: jobId },
                data: {
                    status: 'COMPLETED',
                    result: res.data as any,
                    completedAt: new Date()
                }
            })
        } else {
            throw new Error(res.error || "Optimization calculation failed")
        }

    } catch (e: any) {
        console.error('processNestingJob error:', e)
        await prisma.optimizationJob.update({
            where: { id: jobId },
            data: {
                status: 'FAILED',
                error: e.message,
                completedAt: new Date()
            }
        })
    }
}
