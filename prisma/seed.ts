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
    // 2.1 Seed Material Grades
    const GRADES = [
        { name: 'S235', density: 7.85 },
        { name: 'S275', density: 7.85 },
        { name: 'S355', density: 7.85 },
        { name: 'SS304', density: 7.90 },
        { name: 'SS316', density: 7.95 }
    ]
    for (const g of GRADES) {
        await prisma.materialGrade.upsert({
            where: { name: g.name },
            update: { density: g.density },
            create: { name: g.name, density: g.density }
        })
    }
    console.log('✓ Grades seeded')

    // 2.2 Seed Profile Shapes (Definitions for Custom)
    const SHAPES = [
        { id: 'Plate', name: 'Plate / Flat Bar', params: ['w', 't'], formula: 'w * t * 1' },
        { id: 'Round', name: 'Round Bar', params: ['d'], formula: 'PI * (d/2)^2' },
        { id: 'RHS', name: 'Rectangular Hollow Section', params: ['h', 'w', 't'], formula: 'Advanced' },
        { id: 'SHS', name: 'Square Hollow Section', params: ['s', 't'], formula: 'Advanced' },
        { id: 'CHS', name: 'Circular Hollow Section', params: ['d', 't'], formula: 'Advanced' },
    ]
    for (const s of SHAPES) {
        await prisma.profileShape.upsert({
            where: { id: s.id },
            update: { name: s.name, params: s.params, formula: s.formula },
            create: { id: s.id, name: s.name, params: s.params as any, formula: s.formula }
        })
    }
    console.log('✓ Profile Shapes seeded')

    // 2.3 Seed Standard Profiles Catalog (Fuller mock)
    // NOTE: In a real app, this would be thousands of lines. Accessing a limited set here.
    const STANDARD_PROFILES: Record<string, Record<string, number>> = {
        HEA: {
            "100": 16.7, "120": 19.9, "140": 24.7, "160": 30.4, "180": 35.5,
            "200": 42.3, "220": 50.5, "240": 60.3, "260": 68.2, "280": 76.4,
            "300": 88.3, "320": 97.6, "340": 105.0, "360": 112.0, "400": 125.0
        },
        HEB: {
            "100": 20.4, "120": 26.7, "140": 33.7, "160": 42.6, "180": 51.2,
            "200": 61.3, "220": 71.5
        },
        IPE: {
            "80": 6.0, "100": 8.1, "120": 10.4, "140": 12.9, "160": 15.8, "180": 18.8,
            "200": 22.4, "220": 26.2, "240": 30.7, "270": 36.1, "300": 42.2, "330": 49.1
        },
        UPN: {
            "80": 8.6, "100": 10.6, "120": 13.4, "140": 16.0, "160": 18.8, "180": 22.0,
            "200": 25.3, "220": 29.4
        },
        UPE: {
            "80": 7.9, "100": 9.82, "120": 12.1, "140": 14.5
        },
        L: {
            "50x5": 3.77, "60x6": 5.42, "100x10": 15.1
        }
    }

    for (const type of Object.keys(STANDARD_PROFILES)) {
        for (const dim of Object.keys(STANDARD_PROFILES[type])) {
            const w = STANDARD_PROFILES[type][dim]
            await prisma.standardProfile.upsert({
                where: { type_dimensions: { type, dimensions: dim } },
                update: { weightPerMeter: w },
                create: { type, dimensions: dim, weightPerMeter: w }
            })
        }
    }
    console.log('✓ Standard Catalog seeded')


    // 3. Seed SteelProfiles (Legacy/Linker) - Shapes ONLY
    // We only create profiles that are actually USED in the inventory.
    console.log('✓ Profiles (Shapes) seeded (Specific usage only)')

    // Helpers
    const ensureProfile = async (t: string, d: string, w: number) => {
        return await prisma.steelProfile.upsert({
            where: { type_dimensions: { type: t, dimensions: d } },
            update: { weightPerMeter: w },
            create: { type: t, dimensions: d, weightPerMeter: w }
        })
    }

    const s355 = await prisma.materialGrade.findUnique({ where: { name: 'S355' } })
    if (!s355) throw new Error("S355 not found")

    // 4. Seed Inventory

    // Lot A: HEA 200 (Full Lengths)
    // Ensure Profile Exists first
    const hea200 = await ensureProfile('HEA', '200', STANDARD_PROFILES['HEA']['200'])

    if (hea200) {
        await prisma.inventory.upsert({
            where: { lotId: 'L-HEA200-001' },
            update: {},
            create: {
                lotId: 'L-HEA200-001',
                profileId: hea200.id,
                gradeId: s355.id,
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
    const ipe300 = await ensureProfile('IPE', '300', STANDARD_PROFILES['IPE']['300'])
    if (ipe300) {
        await prisma.inventory.upsert({
            where: { lotId: 'L-IPE300-055' },
            update: {},
            create: {
                lotId: 'L-IPE300-055',
                profileId: ipe300.id,
                gradeId: s355.id,
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
                gradeId: s355.id,
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
                gradeId: s355.id,
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
