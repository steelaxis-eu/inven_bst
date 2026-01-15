'use client'

import { useEffect, useState } from 'react'
import { getProjectActiveJobs } from '@/app/actions/optimization'
import { Spinner, Text, makeStyles, tokens, shorthands } from '@fluentui/react-components'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

const useStyles = makeStyles({
    root: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '4px 12px',
        backgroundColor: tokens.colorBrandBackground2,
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        border: `1px solid ${tokens.colorBrandStroke2}`,
    }
})

export function BackgroundTasksIndicator({ projectId }: { projectId: string }) {
    const styles = useStyles()
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
        <div className={styles.root}>
            <Spinner size="extra-tiny" />
            <Text size={200} weight="medium" style={{ color: tokens.colorBrandForeground2 }}>
                {jobs.length} Task{jobs.length > 1 ? 's' : ''} Running...
            </Text>
        </div>
    )
}
