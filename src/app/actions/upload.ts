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

        // Ensure bucket exists or we assume 'projects' bucket
        // The path should be like 'projects/{projectId}/certificates/{filename}'
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
