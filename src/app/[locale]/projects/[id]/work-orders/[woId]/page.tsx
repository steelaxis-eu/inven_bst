'use client'

import { useParams } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'

export default function WorkOrderDetailsPage() {
    const params = useParams()
    const projectId = params.id as string
    const woId = params.woId as string

    return (
        <div className="p-8 space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" asChild>
                    <Link href={`/projects/${projectId}`}>
                        <ChevronLeft className="h-4 w-4 mr-2" />
                        Back to Project
                    </Link>
                </Button>
            </div>

            <div className="bg-card border rounded-lg p-12 text-center text-muted-foreground">
                <h1 className="text-2xl font-bold text-foreground mb-4">Work Order Details</h1>
                <p>Work Order ID: {woId}</p>
                <p className="mt-4 italic">Full details view for this Work Order is coming soon.</p>
                <div className="mt-8 flex justify-center gap-4">
                    <Button variant="outline" asChild>
                        <Link href={`/projects/${projectId}/work-orders/${woId}/print`} target="_blank">
                            Print View
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
    )
}
