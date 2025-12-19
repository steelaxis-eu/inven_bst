import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const path = searchParams.get('path')

    if (!path) {
        return NextResponse.json({ error: 'Path is required' }, { status: 400 })
    }

    try {
        const supabase = await createClient()

        // Download file from Supabase
        const { data, error } = await supabase.storage
            .from('certificates')
            .download(path)

        if (error) {
            console.error('[CertProxy] Supabase error:', error)
            return NextResponse.json({ error: 'File not found' }, { status: 404 })
        }

        if (!data) {
            return NextResponse.json({ error: 'No data returned' }, { status: 404 })
        }

        // Determine content type from file extension
        const ext = path.split('.').pop()?.toLowerCase()
        let contentType = 'application/octet-stream'
        if (ext === 'pdf') contentType = 'application/pdf'
        else if (ext === 'png') contentType = 'image/png'
        else if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg'

        // Get file as array buffer and return as response
        const buffer = await data.arrayBuffer()

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': `inline; filename="${path.split('/').pop()}"`,
                'Cache-Control': 'private, max-age=300', // Cache for 5 minutes
            }
        })
    } catch (e: any) {
        console.error('[CertProxy] Error:', e)
        return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 })
    }
}
