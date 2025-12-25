'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'

// ============================================================================
// DOCUMENT MANAGEMENT
// Storage: Blob in projects/{projectId}/documents/{filename}
// ============================================================================

export interface CreateDocumentInput {
    projectId: string
    assemblyId?: string
    pieceId?: string
    platePartId?: string
    qualityCheckId?: string
    type: string        // DRAWING, PHOTO, CERTIFICATE, SPEC, NCR, OTHER
    filename: string
    storagePath: string
    mimeType?: string
    fileSize?: number
    description?: string
}

/**
 * Create document record (after file is uploaded to blob storage)
 */
export async function createDocument(input: CreateDocumentInput) {
    try {
        const user = await getCurrentUser()
        const { projectId, type, filename, storagePath, ...rest } = input

        if (!projectId || !type || !filename || !storagePath) {
            return { success: false, error: 'Missing required fields' }
        }

        const doc = await prisma.projectDocument.create({
            data: {
                projectId,
                type,
                filename,
                storagePath,
                uploadedBy: user?.id,
                ...rest
            }
        })

        revalidatePath(`/projects/${projectId}`)
        return { success: true, data: doc }

    } catch (e: any) {
        console.error('createDocument error:', e)
        return { success: false, error: e.message }
    }
}

/**
 * Get all documents for a project
 */
export async function getProjectDocuments(projectId: string, type?: string) {
    return await prisma.projectDocument.findMany({
        where: {
            projectId,
            ...(type ? { type } : {})
        },
        orderBy: { uploadedAt: 'desc' }
    })
}

/**
 * Get documents for a specific entity
 */
export async function getEntityDocuments(
    entityType: 'assembly' | 'piece' | 'platePart' | 'qualityCheck',
    entityId: string
) {
    const where: any = {}

    switch (entityType) {
        case 'assembly': where.assemblyId = entityId; break
        case 'piece': where.pieceId = entityId; break
        case 'platePart': where.platePartId = entityId; break
        case 'qualityCheck': where.qualityCheckId = entityId; break
    }

    return await prisma.projectDocument.findMany({
        where,
        orderBy: { uploadedAt: 'desc' }
    })
}

/**
 * Delete a document (file should be deleted from blob separately)
 */
export async function deleteDocument(documentId: string) {
    try {
        const doc = await prisma.projectDocument.findUnique({ where: { id: documentId } })

        if (!doc) {
            return { success: false, error: 'Document not found' }
        }

        await prisma.projectDocument.delete({ where: { id: documentId } })

        revalidatePath(`/projects/${doc.projectId}`)
        return { success: true, storagePath: doc.storagePath } // Return path so caller can delete from blob

    } catch (e: any) {
        console.error('deleteDocument error:', e)
        return { success: false, error: e.message }
    }
}

/**
 * Link existing document to a quality check (for QC evidence)
 */
export async function linkDocumentToQualityCheck(documentId: string, qualityCheckId: string) {
    try {
        await prisma.projectDocument.update({
            where: { id: documentId },
            data: { qualityCheckId }
        })

        return { success: true }

    } catch (e: any) {
        console.error('linkDocumentToQualityCheck error:', e)
        return { success: false, error: e.message }
    }
}
