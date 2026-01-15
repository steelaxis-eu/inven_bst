'use client'

import { Button, Spinner } from "@fluentui/react-components"
import { ArrowSyncRegular } from "@fluentui/react-icons"
import { startRecalculateJob } from "@/app/actions/optimization"
import { toast } from "sonner"
import { useState } from "react"

interface RecalculateWeightsButtonProps {
    projectId: string
}

export function RecalculateWeightsButton({ projectId }: RecalculateWeightsButtonProps) {
    const [loading, setLoading] = useState(false)

    const handleRecalculate = async () => {
        setLoading(true)
        try {
            const res = await startRecalculateJob(projectId)
            if (res.success) {
                toast.success("Weight recalculation started in background")
            } else {
                toast.error(res.error || "Failed to start job")
            }
        } catch (e) {
            toast.error("Error starting job")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Button
            appearance="outline"
            onClick={handleRecalculate}
            disabled={loading}
            icon={loading ? <Spinner size="tiny" /> : <ArrowSyncRegular />}
            title="Recalculate weights for all parts based on profiles"
        >
            Recalculate Weights
        </Button>
    )
}
