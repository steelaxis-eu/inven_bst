'use client'

import { useEffect, useState } from 'react'
import { getProjectActiveJobs } from '@/app/actions/optimization'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export function BackgroundTasksIndicator({ projectId }: { projectId: string }) {
    const [jobs, setJobs] = useState<any[]>([])
    const [prevCount, setPrevCount] = useState(0)
    const router = useRouter()

    useEffect(() => {
        let mounted = true

        const fetchJobs = async () => {
            const res = await getProjectActiveJobs(projectId)
            if (mounted && res.success && res.jobs) {
                const currentCount = res.jobs.length

                // If jobs finished (count dropped to 0 from something), refresh data
                if (currentCount === 0 && prevCount > 0) {
                    toast.success("Background tasks completed")
                    router.refresh()
                }

                setJobs(res.jobs)
                setPrevCount(currentCount)
            }
        }

        // Initial fetch
        fetchJobs()

        // Poll every 3 seconds
        const interval = setInterval(fetchJobs, 3000)

        return () => {
            mounted = false
            clearInterval(interval)
        }
    }, [projectId, prevCount, router])

    if (jobs.length === 0) return null

    return (
        <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full border border-primary/20">
            <Loader2 className="h-3 w-3 animate-spin text-primary" />
            <span className="text-xs font-medium text-primary">
                {jobs.length} Task{jobs.length > 1 ? 's' : ''} Running...
            </span>
        </div>
    )
}
