'use client'

import { QualityChecksList, QualitySummary } from "./quality-checks-list"
import { CreateQualityCheckDialog } from "./create-quality-check-dialog"
import { updateQualityCheckStatus } from "@/app/actions/quality"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Title3, Text, makeStyles, tokens } from "@fluentui/react-components"

const useStyles = makeStyles({
    root: {
        marginTop: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
    }
})

interface ProjectQualityTabProps {
    projectId: string
    checks: any[]
    assemblies: any[]
}

export function ProjectQualityTab({ projectId, checks, assemblies }: ProjectQualityTabProps) {
    const styles = useStyles()
    const router = useRouter()

    const handleStatusChange = async (id: string, status: string, findings?: string, ncr?: string) => {
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
        <div className={styles.root}>
            <div className={styles.header}>
                <div>
                    <Title3>Quality Checks</Title3>
                    <Text block style={{ color: tokens.colorNeutralForeground3 }}>
                        Manage inspections, NDT reports, and quality records.
                    </Text>
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
