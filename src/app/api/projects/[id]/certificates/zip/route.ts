import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getBlobStream } from '@/lib/azure-storage'
import archiver from 'archiver'
import { PassThrough } from 'stream'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id: projectId } = await params

    if (!projectId) {
        return NextResponse.json({ error: 'Project ID required' }, { status: 400 })
    }

    try {
        // Fetch Project for filename
        const project = await prisma.project.findUnique({
            where: { id: projectId }
        })

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 })
        }

        // 1. Find all usage lines for this project
        const usageLines = await prisma.usageLine.findMany({
            where: {
                OR: [
                    { usage: { projectId: projectId } }, // Linked via Usage
                    { projectId: projectId }             // Direct override
                ]
            },
            include: {
                inventory: true,
                remnant: true
            }
        })

        // 2. Extract unique root Lot IDs and find certificates
        const certificates = new Set<string>()
        const lotIds = new Set<string>()
        let missingCertDetected = false

        for (const line of usageLines) {
            if (line.inventory) {
                if (line.inventory.certificateFilename) {
                    certificates.add(line.inventory.certificateFilename)
                } else {
                    missingCertDetected = true
                }
            }
            if (line.remnant?.rootLotId) {
                lotIds.add(line.remnant.rootLotId)
            }
        }

        // Fetch Inventory for Remnants' root lots to get certs
        const parentMap = new Map<string, string | null>()
        if (lotIds.size > 0) {
            const parentInventories = await prisma.inventory.findMany({
                where: { lotId: { in: Array.from(lotIds) } }
            })
            for (const inv of parentInventories) {
                parentMap.set(inv.lotId, inv.certificateFilename)
            }
        }

        // Check remnants again
        for (const line of usageLines) {
            if (line.remnant && line.remnant.rootLotId) {
                const cert = parentMap.get(line.remnant.rootLotId)
                if (cert) {
                    certificates.add(cert)
                } else {
                    missingCertDetected = true
                }
            }
        }

        if (missingCertDetected) {
            return NextResponse.json({ error: 'Cannot download: Some materials are missing certificates.' }, { status: 400 })
        }

        if (certificates.size === 0) {
            return NextResponse.json({ error: 'No certificates found for this project' }, { status: 404 })
        }

        // 3. Stream Zip
        const archive = archiver('zip', { zlib: { level: 9 } })
        const stream = new PassThrough()

        // TypeScript workaround for stream as response
        const responseStream: any = stream

        archive.pipe(stream)

        // Append files
        let fileCount = 0
        for (const filename of Array.from(certificates)) {
            const blobStream = await getBlobStream(filename)
            if (blobStream) {
                archive.append(blobStream as any, { name: filename })
                fileCount++
            }
        }

        if (fileCount === 0) {
            return NextResponse.json({ error: 'Files not found in storage' }, { status: 404 })
        }

        archive.finalize()

        return new Response(responseStream, {
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="${project.projectNumber}.zip"`,
            },
        })
    } catch (error: any) {
        console.error('Certificate Zip Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
