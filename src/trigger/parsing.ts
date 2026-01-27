import { task } from "@trigger.dev/sdk/v3";
import prisma from "./db";
import { processDrawingWithGemini } from "@/lib/parsing-logic";

export const processDrawingSingle = task({
    id: "process-drawing-single",
    maxDuration: 600, // 10 mins per file max
    run: async (payload: { id: string }, { ctx }) => {
        const { id } = payload;

        // 1. Lock & Fetch
        const job = await prisma.parsedDrawing.findUnique({ where: { id } });
        if (!job) return; // Should not happen

        try {
            await prisma.parsedDrawing.update({
                where: { id },
                data: { status: 'PROCESSING' }
            });

            console.log(`[Trigger] Processing job ${id} (${job.filename})...`);

            // 2. Process
            const { parts: processedParts, raw } = await processDrawingWithGemini(job.fileUrl, job.projectId, job.filename);

            // 3. Complete
            await prisma.parsedDrawing.update({
                where: { id },
                data: {
                    status: 'COMPLETED',
                    result: processedParts as any,
                    rawResponse: raw
                }
            });
            console.log(`[Trigger] Job ${id} completed.`);

        } catch (e: any) {
            console.error(`[Trigger] Job ${id} failed:`, e);
            await prisma.parsedDrawing.update({
                where: { id },
                data: {
                    status: 'FAILED',
                    error: e.message || "Unknown error"
                }
            });
            throw e; // Rethrow to mark task as failed in Trigger.dev dashboard
        } finally {
            await prisma.$disconnect();
        }
    }
});

export const processDrawingBatch = task({
    id: "process-drawing-batch",
    maxDuration: 3600,
    run: async (payload: { batchId: string }, { ctx }) => {
        const { batchId } = payload;
        console.log(`[Trigger] Starting batch processing for ${batchId}`);

        // 1. Find all pending jobs
        const jobs = await prisma.parsedDrawing.findMany({
            where: {
                status: 'PENDING',
                jobId: batchId
            },
            select: { id: true }
        });

        if (jobs.length === 0) {
            console.log(`[Trigger] No pending jobs for batch ${batchId}.`);
            return { success: true, count: 0 };
        }

        console.log(`[Trigger] Fanning out ${jobs.length} jobs...`);

        // 2. Trigger in parallel
        try {
            await processDrawingSingle.batchTrigger(
                jobs.map(job => ({ payload: { id: job.id } }))
            );

            return { success: true, count: jobs.length };
        } finally {
            await prisma.$disconnect();
        }
    },
});
