import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Starting seed...')

    // 1. Seed Global Settings
    await prisma.globalSettings.upsert({
        where: { id: 'settings' },
        update: { scrapPricePerKg: 0.25 },
        create: { id: 'settings', scrapPricePerKg: 0.25 }
    })
    console.log('✓ Settings seeded')

    // 2. Seed Projects
    const skyline = await prisma.project.upsert({
        where: { projectNumber: 'P-2024-001' },
        update: {},
        create: {
            projectNumber: 'P-2024-001',
            name: 'Skyline Tower',
            status: 'ACTIVE',
            createdBy: 'Admin',
            modifiedBy: 'Admin'
        }
    })

    const bridge = await prisma.project.upsert({
        where: { projectNumber: 'P-2023-099' },
        update: {},
        create: {
            projectNumber: 'P-2023-099',
            name: 'City Bridge Renovation',
            status: 'COMPLETED',
            createdBy: 'Admin',
            modifiedBy: 'Admin'
        }
    })
    console.log('✓ Projects seeded')

    // 3. Seed Standard Reference Profiles (Catalog)
    const STANDARD_PROFILES: Record<string, Record<string, number>> = {
        HEA: {
            "200": 42.3, "240": 60.3, "300": 88.3
        },
        IPE: {
            "160": 15.8, "200": 22.4, "300": 42.2
        },
        UPN: {
            "200": 25.3
        }
    }

    const profiles: any[] = []
    for (const type of Object.keys(STANDARD_PROFILES)) {
        for (const dim of Object.keys(STANDARD_PROFILES[type])) {
            const w = STANDARD_PROFILES[type][dim]
            const p = await prisma.steelProfile.upsert({
                where: {
                    type_dimensions_grade: {
                        type: type,
                        dimensions: dim,
                        grade: 'S355'
                    }
                },
                update: { weightPerMeter: w },
                create: {
                    type: type,
                    dimensions: dim,
                    grade: 'S355',
                    weightPerMeter: w
                }
            })
            profiles.push(p)
        }
    }
    console.log('✓ Profiles seeded')

    // Helpers
    const getProfile = (t: string, d: string) => profiles.find(p => p.type === t && p.dimensions === d)!

    // 4. Seed Inventory
    // Clean existing mostly to avoid dups if re-running without reset
    // But upsert is better.

    // Lot A: HEA 200 (Full Lengths)
    const hea200 = getProfile('HEA', '200')
    if (hea200) {
        await prisma.inventory.upsert({
            where: { lotId: 'L-HEA200-001' },
            update: {},
            create: {
                lotId: 'L-HEA200-001',
                profileId: hea200.id,
                length: 12100,
                quantityReceived: 10,
                quantityAtHand: 8,
                costPerMeter: 45.0, // €
                status: 'ACTIVE',
                certificateFilename: 'cert-L-HEA200-001.pdf',
                createdAt: new Date('2024-01-10')
            }
        })
    }

    // Lot B: IPE 300 (Partial Stock)
    const ipe300 = getProfile('IPE', '300')
    if (ipe300) {
        await prisma.inventory.upsert({
            where: { lotId: 'L-IPE300-055' },
            update: {},
            create: {
                lotId: 'L-IPE300-055',
                profileId: ipe300.id,
                length: 15100,
                quantityReceived: 6,
                quantityAtHand: 2, // Low stock
                costPerMeter: 60.5,
                status: 'ACTIVE',
                createdAt: new Date('2024-02-15')
            }
        })
    }

    console.log('✓ Inventory seeded')

    // 5. Seed Remnants
    if (hea200) {
        // Remnant from Project Bridge (Available)
        await prisma.remnant.upsert({
            where: { id: 'L-HEA200-001-3400' },
            update: {},
            create: {
                id: 'L-HEA200-001-3400',
                rootLotId: 'L-HEA200-001',
                profileId: hea200.id,
                length: 3400,
                quantity: 1,
                costPerMeter: 45.0,
                status: 'AVAILABLE',
                projectId: bridge.id
            }
        })

        // Remnant (Scrap)
        await prisma.remnant.upsert({
            where: { id: 'L-HEA200-001-450' },
            update: {},
            create: {
                id: 'L-HEA200-001-450',
                rootLotId: 'L-HEA200-001',
                profileId: hea200.id,
                length: 450, // Short piece
                quantity: 1,
                costPerMeter: 45.0,
                status: 'SCRAP',
                projectId: skyline.id
            }
        })
    }
    console.log('✓ Remnants seeded')

    // 6. Seed Usage History (Simulate some consumption)
    if (skyline && hea200) {

        // Ensure we have a usage record
        const usage = await prisma.usage.create({
            data: {
                projectId: skyline.id,
                userId: 'user-seed',
                createdBy: 'Seed',
                date: new Date('2024-03-01T10:00:00Z')
            }
        })

        // Usage 1: Cut 4000mm from HEA200
        const stockItem = await prisma.inventory.findUnique({ where: { lotId: 'L-HEA200-001' } })

        if (stockItem) {
            await prisma.usageLine.create({
                data: {
                    usageId: usage.id,
                    inventoryId: stockItem.id,
                    quantityUsed: 1,
                    cost: 270.0, // 6m * 45
                    projectId: skyline.id
                }
            })
        }
    }
    console.log('✓ Usage History seeded')

    console.log('Seeding finished.')
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
