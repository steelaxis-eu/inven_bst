
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const allStats = await prisma.standardProfile.groupBy({
        by: ['type'],
        _count: { _all: true }
    })
    console.log('Counts:', JSON.stringify(allStats, null, 2))

    const total = await prisma.standardProfile.count()
    console.log('Total:', total)
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
