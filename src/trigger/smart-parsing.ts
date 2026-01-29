import { task } from "@trigger.dev/sdk/v3";
import prisma from "./db";
import { processSmartFileWithAI } from "@/lib/smart-parsing-logic";

export const processSmartImportSingle = task({
    id: "process-smart-import-single",
    retry: {
        maxAttempts: 3, // Lower retries for experimental
        factor: 2,
        minTimeoutInMs: 1000,
        maxTimeoutInMs: 30000,
        randomize: true,
    },
    queue: {
        concurrencyLimit: 5,
    },
    run: async (payload: { id: string }, { ctx }) => {
        const { id } = payload;

        // 1. Lock & Fetch
        const job = await prisma.parsedDrawing.findUnique({ where: { id } });
        if (!job) return;

        try {
            await prisma.parsedDrawing.update({
                where: { id },
                data: { status: 'PROCESSING' }
            });

            console.log(`[SmartTrigger] Processing job ${id} (${job.filename})...`);

            // 2. Extract Instruction & Type
            const rawInput = (job.rawResponse as any) || {}
            const instruction = rawInput.instruction || 'IMPORT_PARTS'
            const detectedType = rawInput.detectedType || (job.filename.toLowerCase().endsWith('.pdf') ? 'PDF' : 'EXCEL')

            // 3. Process
            const { parts: processedParts, raw } = await processSmartFileWithAI(
                job.fileUrl,
                job.projectId,
                job.filename,
                detectedType as any,
                instruction,
                async (status) => {
                    await prisma.parsedDrawing.update({
                        where: { id },
                        data: { status }
                    });
                    console.log(`[SmartTrigger] Job ${id} status: ${status}`);
                }
            );

            // 4. Complete
            await prisma.parsedDrawing.update({
                where: { id },
                data: {
                    status: 'COMPLETED',
                    result: processedParts as any,
                    rawResponse: raw
                }
            });
            console.log(`[SmartTrigger] Job ${id} completed. Found ${processedParts.length} parts.`);

        } catch (e: any) {
            console.error(`[SmartTrigger] Job ${id} failed:`, e);
            await prisma.parsedDrawing.update({
                where: { id },
                data: {
                    status: 'FAILED',
                    error: e.message || "Unknown error"
                }
            });
            throw e;
        }
    }
});

export const processSmartImportBatch = task({
    id: "process-smart-import-batch",
    maxDuration: 3600,
    run: async (payload: { batchId: string }, { ctx }) => {
        const { batchId } = payload;
        console.log(`[SmartTrigger] Starting batch processing for ${batchId}`);

        // 1. Find all pending jobs
        const jobs = await prisma.parsedDrawing.findMany({
            where: {
                status: 'PENDING',
                jobId: batchId
            },
            select: { id: true }
        });

        if (jobs.length === 0) {
            console.log(`[SmartTrigger] No pending jobs for batch ${batchId}.`);
            return { success: true, count: 0 };
        }

        console.log(`[SmartTrigger] Fanning out ${jobs.length} jobs...`);

        // 2. Trigger in parallel
        try {
            await processSmartImportSingle.batchTrigger(
                jobs.map(job => ({ payload: { id: job.id } }))
            );

            return { success: true, count: jobs.length };
        } finally {
            await prisma.$disconnect();
        }
    },
});
