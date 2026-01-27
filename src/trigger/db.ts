import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

// Trigger.dev environment isolated Prisma setup
// 1. Must use adapter because schema has "driverAdapters" enabled
// 2. Must use robust pool settings to avoid "Connection terminated"

const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL

if (!connectionString) {
    throw new Error('Missing database connection string (POSTGRES_URL_NON_POOLING or DATABASE_URL)')
}

// Minimal, robust pool for Serverless/Container processing
const pool = new Pool({
    connectionString,
    // Reduce connection count for isolated jobs
    max: 2,
    // Increase timeouts to handle network latency or cold starts
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
    // SSL required for Supabase/Neon usually
    ssl: { rejectUnauthorized: false }
})

const adapter = new PrismaPg(pool)

const prisma = new PrismaClient({
    adapter,
    log: ['warn', 'error']
})

export default prisma
