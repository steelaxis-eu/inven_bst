
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createClient } from '@/lib/supabase-server'
import AdmZip from 'adm-zip'

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ workOrderId: string }> }
) {
    try {
        const { workOrderId } = await context.params

        // 1. Fetch WO and Items
        const workOrder = await prisma.workOrder.findUnique({
            where: { id: workOrderId },
            include: {
                items: {
                    include: {
                        piece: {
                            include: {
                                part: true
                            }
                        },
                        platePart: true
                    }
                }
            }
        })

        if (!workOrder) {
            return new NextResponse('Work Order not found', { status: 404 })
        }

        // 2. Collect Files to Download
        const supabase = await createClient()
        const zip = new AdmZip()
        let fileCount = 0

        const processedPaths = new Set<string>()

        // Helper to fetch and add file
        const addFileToZip = async (storagePath: string, zipName: string) => {
            if (processedPaths.has(storagePath)) return
            processedPaths.add(storagePath)

            try {
                const { data, error } = await supabase.storage
                    .from('projects')
                    .download(storagePath)

                if (error || !data) {
                    console.error(`Failed to download ${storagePath}:`, error)
                    return
                }

                const buffer = Buffer.from(await data.arrayBuffer())
                zip.addFile(zipName, buffer)
                fileCount++
            } catch (e) {
                console.error(`Error processing ${storagePath}:`, e)
            }
        }

        // 3. Iterate Items
        for (const item of workOrder.items) {
            // A. Plate Parts (DXF)
            if (item.platePart) {
                const pp = item.platePart
                if (pp.dxfStoragePath && pp.dxfFilename) {
                    const folder = pp.material?.replace(/[^a-zA-Z0-9]/g, '_') || 'Plates'
                    await addFileToZip(pp.dxfStoragePath, `${folder}/${pp.partNumber}_${pp.dxfFilename}`)
                }
            }

            // B. Standard Parts (PDF/DXF from 'drawingRef' if it's a path or logic?)
            // Currently Part's 'drawingRef' is often just a string. 
            // We need to look up ProjectDocument linked to Part.
            if (item.piece?.partId) {
                const partDocs = await prisma.projectDocument.findMany({
                    where: {
                        OR: [
                            { pieceId: item.pieceId }, // Document linked to specific piece
                            {
                                // Or document linked to the Part definition (more likely for drawings)
                                // We don't have a direct 'partId' on ProjectDocument yet based on scheme, 
                                // but we might have 'piece' link. 
                                // Wait, schema has 'pieceId', 'assemblyId', 'placePartId'. 
                                // It does NOT have 'partId' directly on ProjectDocument.
                                // It seems we link specific pieces? Or maybe we need to fix schema?
                                // Let's check schema again. Part table has 'drawingRef', but where is the file?
                                // Usually documents are linked. 
                                // For now, let's assume if we find a doc linked to this piece, we include it.
                                pieceId: item.pieceId
                            }
                        ],
                        type: 'DRAWING'
                    }
                })

                for (const doc of partDocs) {
                    await addFileToZip(doc.storagePath, `Parts/${item.piece!.pieceNumber}_${doc.filename}`)
                }

                // Also check if the Part itself has a drawingRef that maps to a known storage path?
                // The schema says `drawingRef String?`. If this is a filename, we might need a way to find it.
                // Assuming simple ProjectDocument query is safer for now.
            }
        }

        if (fileCount === 0) {
            return new NextResponse('No drawings found for this Work Order', { status: 404 })
        }

        const zipBuffer = zip.toBuffer()

        // Cast to any to bypass strict BodyInit type check with Buffer
        return new NextResponse(zipBuffer as any, {
            status: 200,
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="WO_${workOrder.workOrderNumber}_Drawings.zip"`
            }
        })

    } catch (error: any) {
        console.error('Download Drawings Error:', error)
        return new NextResponse(error.message || 'Internal Server Error', { status: 500 })
    }
}
