import { defineConfig } from "@trigger.dev/sdk/v3";
import { prismaExtension } from "@trigger.dev/build/extensions/prisma";

export default defineConfig({
    project: "proj_bgflxruuqqqbujtgkhry",
    runtime: "node",
    logLevel: "log",
    // Set a reasonable timeout (e.g., 1 hour to process a huge batch)
    maxDuration: 3600,
    build: {
        extensions: [
            prismaExtension({
                schema: "prisma/schema.prisma",
                mode: "legacy",
            }),
        ],
    },
    retries: {
        enabledInDev: true,
        default: {
            maxAttempts: 3,
            minTimeoutInMs: 1000,
            maxTimeoutInMs: 10000,
            factor: 2,
            randomize: true,
        },
    },
});

