'use client'

import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
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
            // We don't need to refresh page immediately, the indicator will show progress
        }
    }

    return (
        <Button
            variant="outline"
            onClick={handleRecalculate}
            disabled={loading}
            className="gap-2"
            title="Recalculate weights for all parts based on profiles"
        >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Recalculate Weights
        </Button>
    )
}
