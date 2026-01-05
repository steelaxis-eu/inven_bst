import prisma from '@/lib/prisma'
import { PrintView } from '@/components/print/print-view'
import { notFound } from 'next/navigation'

export default async function PrintWorkOrderPage({ params }: { params: Promise<{ id: string, woId: string }> }) {
    const { woId } = await params

    const wo = await prisma.workOrder.findUnique({
        where: { id: woId },
        include: {
            project: true,
            items: {
                include: {
                    piece: {
                        include: {
                            part: {
                                include: {
                                    profile: true,
                                    grade: true
                                }
                            }
                        }
                    },
                    assembly: true
                }
            }
        }
    })

    if (!wo) {
        return notFound()
    }

    return <PrintView workOrder={wo} />
}
