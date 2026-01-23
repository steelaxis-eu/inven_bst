import { NextRequest, NextResponse } from 'next/server'
import { processNextPendingJob } from '@/app/actions/drawings'

export const dynamic = 'force-dynamic' // Ensure it's not cached
export const maxDuration = 60 // Allow longer execution if possible (Vercel has limit, but good to set)

export async function POST(req: NextRequest) {
    // Optional: Check for secret if we want to protect this endpoint, 
    // but relies on internal triggering mostly.

    let batchId: string | undefined
    try {
        const body = await req.json()
        batchId = body.batchId
    } catch (e) {
        // body might be empty, that's fine
    }

    console.log(`[Queue] Processing job for batch ${batchId || 'ANY'}...`)

    const result = await processNextPendingJob(batchId)

    if (result.processed) {
        // If there are more jobs remaining, trigger the next one recursively
        if (result.remaining && result.remaining > 0) {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
            console.log(`[Queue] Triggering next job (Remaining: ${result.remaining})...`)

            // Fire and forget next call
            fetch(`${baseUrl}/api/process-queue`, {
                method: 'POST',
                body: JSON.stringify({ batchId }),
                headers: { 'Content-Type': 'application/json' }
            }).catch(e => console.error("Failed to chain queue:", e))
        } else {
            console.log(`[Queue] Batch ${batchId} completed!`)
        }

        return NextResponse.json({ success: true, processed: true, jobId: result.jobId })
    } else {
        return NextResponse.json({ success: true, processed: false, message: "No pending jobs" })
    }
}

export async function GET(req: NextRequest) {
    return POST(req)
}
