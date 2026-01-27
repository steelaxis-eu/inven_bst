import { PrismaClient } from '@prisma/client'

// Use standard Prisma Client for Trigger.dev (Node.js runtime)
// This avoids issues with the Vercel/Edge adapter config
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_PRISMA_URL

if (!connectionString) {
    throw new Error('No valid database connection string found (DATABASE_URL, POSTGRES_URL_NON_POOLING, or POSTGRES_PRISMA_URL)')
}

// Strip sslmode if present to avoid conflicts, though standard client handles it well usually.
// For standard client, we generally pass the URL directly.
// We explicitly set log levels for better debugging in Trigger dashboard

const prisma = new PrismaClient({
    datasourceUrl: connectionString,
    log: ['warn', 'error'],
})

export default prisma
