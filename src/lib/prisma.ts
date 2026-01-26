import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL

if (!connectionString) {
    throw new Error('DATABASE_URL or POSTGRES_PRISMA_URL is not defined')
}

// Strip sslmode from the connection string to allow explicit Pool config to take precedence
// This prevents 'sslmode=require' in the URL from forcing 'verify-full' behavior
const url = new URL(connectionString)
url.searchParams.delete('sslmode')

const pool = new Pool({
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: false } // Required for many cloud providers (Supabase/Neon)
})
const adapter = new PrismaPg(pool)

const prismaClientSingleton = () => {
    return new PrismaClient({ adapter })
}

declare global {
    var prisma_v2: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = globalThis.prisma_v2 ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prisma_v2 = prisma
