import prisma from '@/lib/prisma'
import { RfqView } from '@/components/print/rfq-view'
import { notFound } from 'next/navigation'

export default async function RfqWorkOrderPage({ params }: { params: Promise<{ id: string, woId: string }> }) {
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

    if (wo.type !== 'MATERIAL_PREP') {
        return (
            <div className="p-8 text-center text-red-600 font-bold text-xl">
                Only Material Prep Work Orders can be exported as an RFQ.
            </div>
        )
    }

    return <RfqView workOrder={wo} />
}
