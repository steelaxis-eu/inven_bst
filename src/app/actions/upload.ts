'use server'

import { createClient } from '@/lib/supabase-server'
import { getCurrentUser } from '@/lib/auth'

/**
 * Get a signed URL for uploading a file directly to Supabase Storage
 */
export async function getSignedUploadUrl(path: string, contentType: string) {
    try {
        const user = await getCurrentUser()
        if (!user?.id) return { success: false, error: 'Unauthorized' }

        const supabase = await createClient()

        // Validate content type
        const allowedTypes = [
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/webp',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'text/csv',
            'text/plain'
        ]

        if (!allowedTypes.includes(contentType)) {
            return { success: false, error: 'Invalid file type' }
        }

        // Validate path structure: projects/{projectId}/{folder}/{filename} or certificates/{filename}
        // Basic check to ensure it doesn't try to go up directories
        if (path.includes('..')) {
            return { success: false, error: 'Invalid path' }
        }

        // Enforce project scoping if applicable
        if (!path.startsWith('projects/') && !path.startsWith('certificates/')) {
            return { success: false, error: 'Invalid upload path. Must act on projects or certificates.' }
        }

        const bucket = 'projects'

        // Create signed upload URL
        const { data, error } = await supabase.storage
            .from(bucket)
            .createSignedUploadUrl(path)

        if (error) throw error

        return {
            success: true,
            url: data?.signedUrl,
            token: data?.token,
            path: data?.path
        }

    } catch (e: any) {
        console.error('getSignedUploadUrl error:', e)
        return { success: false, error: e.message }
    }
}
