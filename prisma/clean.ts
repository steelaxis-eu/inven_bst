import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Cleaning demo data...')

    // 0. Delete Usage (for seeded projects)
    await prisma.usage.deleteMany({
        where: {
            project: {
                projectNumber: { in: ['P-2024-001', 'P-2023-099'] }
            }
        }
    })

    // 1. Delete Remnants
    await prisma.remnant.deleteMany({
        where: {
            id: { in: ['L-HEA200-001-3400', 'L-HEA200-001-450'] }
        }
    })

    // 2. Delete Inventory
    await prisma.inventory.deleteMany({
        where: {
            lotId: { in: ['L-HEA200-001', 'L-IPE300-055'] }
        }
    })

    // 3. Delete Projects
    await prisma.project.deleteMany({
        where: {
            projectNumber: { in: ['P-2024-001', 'P-2023-099'] }
        }
    })

    // 4. Delete Profiles (optional, but good for full cleanup if we want only standard ones to remain?)
    // Actually, maybe we keep profiles as they are "reference" data. 
    // But if we want to clean everything added by seed:
    // We added HEA 200, 240, 300, IPE 160, 200, 300, UPN 200 with grade S355.
    // Be careful not to delete used profiles if user created real data linked to them.
    // Safe option: only delete projects/stock.

    console.log('✓ Demo data cleaned.')
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
