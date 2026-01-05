'use client'

import { QualityChecksList, QualitySummary } from "./quality-checks-list"
import { CreateQualityCheckDialog } from "./create-quality-check-dialog"
import { updateQualityCheckStatus } from "@/app/actions/quality"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface ProjectQualityTabProps {
    projectId: string
    checks: any[]
    assemblies: any[]
}

export function ProjectQualityTab({ projectId, checks, assemblies }: ProjectQualityTabProps) {
    const router = useRouter()

    const handleStatusChange = async (id: string, status: string, findings?: string, ncr?: string) => {
        // Optimistic update could go here, but for now we look for simplicity
        try {
            const result = await updateQualityCheckStatus(id, status as any, findings, ncr)
            if (result.success) {
                toast.success(`Inspection marked as ${status}`)
                router.refresh()
            } else {
                toast.error(result.error || "Failed to update status")
            }
        } catch (error) {
            toast.error("An unexpected error occurred")
        }
    }

    const assemblyOptions = assemblies.map(a => ({
        id: a.id,
        name: a.name,
        assemblyNumber: a.assemblyNumber
    }))

    return (
        <div className="mt-6">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h2 className="text-xl font-semibold">Quality Checks</h2>
                    <p className="text-sm text-muted-foreground">Manage inspections, NDT reports, and quality records.</p>
                </div>
                <CreateQualityCheckDialog
                    projectId={projectId}
                    assemblyOptions={assemblyOptions}
                />
            </div>

            <QualitySummary checks={checks} />

            <QualityChecksList
                checks={checks}
                onStatusChange={handleStatusChange}
            />
        </div>
    )
}
