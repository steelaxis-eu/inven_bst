'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'

// ============================================================================
// QUALITY CHECK CRUD
// ============================================================================

export interface CreateQualityCheckInput {
    projectId: string
    assemblyId?: string
    processStage: string  // FABRICATION, WELDING, PAINTING, FINAL
    type: string          // VISUAL, DIMENSIONAL, NDT, COATING
    dueDate?: Date
    notes?: string
    status?: 'PENDING' | 'PASSED' | 'FAILED' | 'WAIVED'
    findings?: string
    ncr?: string
}

/**
 * Create a new quality check
 */
export async function createQualityCheck(input: CreateQualityCheckInput) {
    try {
        const { projectId, processStage, type, ...rest } = input

        if (!projectId || !processStage || !type) {
            return { success: false, error: 'Missing required fields' }
        }

        const user = await getCurrentUser()

        const data: any = {
            projectId,
            processStage,
            type,
            dueDate: rest.dueDate ? new Date(rest.dueDate) : undefined,
            notes: rest.notes
        }

        // Handle immediate inspection result
        if (rest.status && rest.status !== 'PENDING') {
            data.status = rest.status
            data.inspectedAt = new Date()
            data.inspectedBy = user?.id || 'system'
            data.findings = rest.findings
            data.ncr = rest.ncr
        }

        const qc = await prisma.qualityCheck.create({
            data
        })

        revalidatePath(`/projects/${projectId}`)
        return { success: true, data: qc }

    } catch (e: any) {
        console.error('createQualityCheck error:', e)
        return { success: false, error: e.message }
    }
}

/**
 * Get all quality checks for a project
 */
export async function getProjectQualityChecks(projectId: string) {
    return await prisma.qualityCheck.findMany({
        where: { projectId },
        include: {
            assembly: true,
            documents: true
        },
        orderBy: { createdAt: 'desc' }
    })
}

/**
 * Get quality checks for an assembly
 */
export async function getAssemblyQualityChecks(assemblyId: string) {
    return await prisma.qualityCheck.findMany({
        where: { assemblyId },
        include: { documents: true },
        orderBy: { processStage: 'asc' }
    })
}

/**
 * Update quality check status (record inspection)
 */
export async function updateQualityCheckStatus(
    qcId: string,
    status: 'PENDING' | 'PASSED' | 'FAILED' | 'WAIVED',
    findings?: string,
    ncr?: string
) {
    try {
        const user = await getCurrentUser()

        const updateData: any = { status, findings }

        if (status !== 'PENDING') {
            updateData.inspectedAt = new Date()
            updateData.inspectedBy = user?.id || 'system'
        }

        if (status === 'FAILED' && ncr) {
            updateData.ncr = ncr
        }

        const qc = await prisma.qualityCheck.update({
            where: { id: qcId },
            data: updateData
        })

        revalidatePath(`/projects/${qc.projectId}`)
        return { success: true }

    } catch (e: any) {
        console.error('updateQualityCheckStatus error:', e)
        return { success: false, error: e.message }
    }
}

/**
 * Delete a quality check
 */
export async function deleteQualityCheck(qcId: string) {
    try {
        const qc = await prisma.qualityCheck.findUnique({ where: { id: qcId } })

        if (!qc) {
            return { success: false, error: 'Quality check not found' }
        }

        await prisma.qualityCheck.delete({ where: { id: qcId } })

        revalidatePath(`/projects/${qc.projectId}`)
        return { success: true }

    } catch (e: any) {
        console.error('deleteQualityCheck error:', e)
        return { success: false, error: e.message }
    }
}

/**
 * Get QC summary for project (counts by status)
 */
export async function getProjectQualitySummary(projectId: string) {
    const checks = await prisma.qualityCheck.groupBy({
        by: ['status'],
        where: { projectId },
        _count: true
    })

    const summary = {
        total: 0,
        pending: 0,
        passed: 0,
        failed: 0,
        waived: 0
    }

    checks.forEach(c => {
        summary.total += c._count
        switch (c.status) {
            case 'PENDING': summary.pending = c._count; break
            case 'PASSED': summary.passed = c._count; break
            case 'FAILED': summary.failed = c._count; break
            case 'WAIVED': summary.waived = c._count; break
        }
    })

    return summary
}
