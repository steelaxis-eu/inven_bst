import { NextResponse } from 'next/server'
import { getFileStream, CERTIFICATES_BUCKET } from '@/lib/storage'
import { PassThrough } from 'stream'

export async function GET(req: Request, { params }: { params: Promise<{ filename: string }> }) {
    const { filename } = await params

    if (!filename) {
        return NextResponse.json({ error: 'Filename required' }, { status: 400 })
    }

    try {
        const fileStream = await getFileStream(CERTIFICATES_BUCKET, filename)

        if (!fileStream) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 })
        }

        // TypeScript workaround for stream as response
        const responseStream: any = new PassThrough()
        fileStream.pipe(responseStream)

        return new Response(responseStream, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="${filename}"`,
            },
        })
    } catch (error: any) {
        console.error('Certificate View Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
