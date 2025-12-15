import { createClient } from "./supabase-server"

export const CERTIFICATES_BUCKET = 'certificates'

export async function downloadFile(bucket: string, path: string): Promise<ArrayBuffer | null> {
    const supabase = await createClient()

    // Check if exists/get URL? 
    // Supabase storage download() returns a Blob.
    // In Node env (Next.js server actions/routes), Blob might need handling.

    const { data, error } = await supabase.storage
        .from(bucket)
        .download(path)

    if (error) {
        console.error(`Supabase Download Error (${path}):`, error)
        return null
    }

    if (!data) return null

    return await data.arrayBuffer()
}

export async function getFileStream(bucket: string, path: string) {
    const buffer = await downloadFile(bucket, path)
    if (!buffer) return null

    const { Readable } = require('stream')
    const stream = new Readable()
    stream.push(Buffer.from(buffer))
    stream.push(null)
    return stream
}
