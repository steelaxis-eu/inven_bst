import { task } from "@trigger.dev/sdk/v3";
import prisma from "@/lib/prisma";
import { processDrawingWithGemini } from "@/lib/parsing-logic";

export const processDrawingBatch = task({
    id: "process-drawing-batch",
    // Set a reasonable timeout (e.g., 1 hour to process a huge batch)
    maxDuration: 3600,
    run: async (payload: { batchId: string }, { ctx }) => {
        const { batchId } = payload;
        console.log(`[Trigger] Starting batch processing for ${batchId}`);

        // Loop until no pending jobs remain
        while (true) {
            // 1. Find next pending job
            const job = await prisma.parsedDrawing.findFirst({
                where: {
                    status: 'PENDING',
                    jobId: batchId
                },
                orderBy: { createdAt: 'asc' }
            });

            if (!job) {
                console.log(`[Trigger] No more pending jobs for batch ${batchId}. Done.`);
                break;
            }

            // 2. Optimistic Locking: Set to PROCESSING
            try {
                await prisma.parsedDrawing.update({
                    where: { id: job.id, status: 'PENDING' },
                    data: { status: 'PROCESSING' }
                });
            } catch (e) {
                // Race condition: someone else took it (unlikely in single worker per batch, but good practice)
                console.log(`[Trigger] Job ${job.id} already locked. Skipping.`);
                continue;
            }

            // 3. Process
            try {
                console.log(`[Trigger] Processing job ${job.id} (${job.filename})...`);

                const { parts: processedParts, raw } = await processDrawingWithGemini(job.fileUrl, job.projectId, job.filename);

                await prisma.parsedDrawing.update({
                    where: { id: job.id },
                    data: {
                        status: 'COMPLETED',
                        result: processedParts as any,
                        rawResponse: raw
                    }
                });
                console.log(`[Trigger] Job ${job.id} completed.`);

            } catch (e: any) {
                console.error(`[Trigger] Job ${job.id} failed:`, e);
                await prisma.parsedDrawing.update({
                    where: { id: job.id },
                    data: {
                        status: 'FAILED',
                        error: e.message || "Unknown error"
                    }
                });
                // We continue to the next job even if one fails
            }

            // Small delay to prevent hammering database too hard if loop is tight
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        return { success: true, batchId };
    },
});
