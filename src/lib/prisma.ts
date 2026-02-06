import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_PRISMA_URL

if (!connectionString) {
    throw new Error('DATABASE_URL or POSTGRES_PRISMA_URL is not defined')
}

// Strip sslmode from the connection string to allow explicit Pool config to take precedence
const url = new URL(connectionString)
url.searchParams.delete('sslmode')

const prismaClientSingleton = () => {
    const pool = new Pool({
        connectionString: url.toString(),
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 20000,
        max: 10,
        idleTimeoutMillis: 20000
    })
    const adapter = new PrismaPg(pool)
    return new PrismaClient({ adapter })
}

declare global {
    var prisma_v7: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = globalThis.prisma_v7 ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prisma_v7 = prisma
