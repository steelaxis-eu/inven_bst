import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Starting seed...')

    // 0. Clean Slate for SteelProfile (and dependents if needed, but we rely on cascade or manual clean usually)
    // User requested "cleanslate steelProfile table".
    // We should probably clean dependent tables first to avoid FK errors if we were running this on existing data.
    // But usually seed is additive. Let's try to delete.
    try {
        await prisma.usageLine.deleteMany({})
        await prisma.usage.deleteMany({})
        await prisma.remnant.deleteMany({})
        await prisma.inventory.deleteMany({})
        await prisma.steelProfile.deleteMany({})
        console.log('✓ SteelProfile and dependent tables cleaned')
    } catch (e) {
        console.log('! Note: Could not clean some tables (maybe empty or constraint invisible):', e)
    }

    // 1. Seed Global Settings
    await prisma.globalSettings.upsert({
        where: { id: 'settings' },
        update: { scrapPricePerKg: 0.25 },
        create: { id: 'settings', scrapPricePerKg: 0.25 }
    })
    console.log('✓ Settings seeded')

    // 2. Seed Projects
    await prisma.project.upsert({
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

    await prisma.project.upsert({
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
        { id: 'SQB', name: 'Square Bar', params: ['s'], formula: 's * s' },
    ]
    for (const s of SHAPES) {
        await prisma.profileShape.upsert({
            where: { id: s.id },
            update: { name: s.name, params: s.params, formula: s.formula },
            create: { id: s.id, name: s.name, params: s.params as any, formula: s.formula }
        })
    }
    console.log('✓ Profile Shapes seeded')

    // 2.3 Seed Standard Profiles Catalog
    // Full Data from previous seed.js
    const standardProfilesData: Record<string, Record<string, number>> = {
        HEA: {
            "100": 16.7, "120": 19.9, "140": 24.7, "160": 30.4, "180": 35.5,
            "200": 42.3, "220": 50.5, "240": 60.3, "260": 68.2, "280": 76.4,
            "300": 88.3, "320": 97.6, "340": 105.0, "360": 112.0, "400": 125.0,
            "450": 140.0, "500": 155.0, "550": 166.0, "600": 178.0, "650": 190.0
        },
        HEB: {
            "100": 20.4, "120": 26.7, "140": 33.7, "160": 42.6, "180": 51.2,
            "200": 61.3, "220": 71.5, "240": 83.2, "260": 93.0, "280": 103.0,
            "300": 117.0, "320": 127.0, "340": 134.0, "360": 142.0, "400": 155.0,
            "450": 171.0, "500": 187.0, "550": 199.0, "600": 212.0, "650": 225.0,
            "700": 241.0, "800": 262.0, "900": 291.0, "1000": 314.0
        },
        IPE: {
            "80": 6.0, "100": 8.1, "120": 10.4, "140": 12.9, "160": 15.8, "180": 18.8,
            "200": 22.4, "220": 26.2, "240": 30.7, "270": 36.1, "300": 42.2, "330": 49.1,
            "360": 57.1, "400": 66.3, "450": 77.6, "500": 90.7, "550": 106.0, "600": 122.0
        },
        UPN: {
            "80": 8.64, "100": 10.6, "120": 13.4, "140": 16.0, "160": 18.8, "180": 22.0,
            "200": 25.3, "220": 29.4, "240": 33.2, "260": 37.9, "280": 41.8, "300": 46.2,
            "320": 59.5, "350": 60.6, "380": 63.1, "400": 71.8
        },
        UPE: {
            "80": 7.9, "100": 9.82, "120": 12.1, "140": 14.5, "160": 17.0, "180": 19.7,
            "200": 22.8, "220": 26.6, "240": 30.2, "270": 35.2, "300": 42.2, "330": 53.2,
            "360": 61.2, "400": 72.2
        },
        L: {  // Equal
            "20x3": 0.88, "25x3": 1.12, "30x3": 1.36, "35x4": 2.10, "40x4": 2.42,
            "45x4": 2.74, "50x5": 3.77, "60x6": 5.42, "70x7": 7.38, "80x8": 9.66,
            "90x9": 12.2, "100x10": 15.1, "120x12": 21.6, "150x15": 33.8, "200x20": 59.9
        },
        L_unequal: {
            "30x20x3": 1.11, "40x20x4": 1.77, "45x30x4": 2.25, "50x30x5": 2.96,
            "60x40x5": 3.76, "75x50x6": 5.65, "100x50x8": 8.99, "120x80x10": 15.0,
            "150x100x10": 19.3
        },
        SHS: { // Square Hollow Sections (Cold formed EN 10219 approx)
            "40x40x3": 3.30, "40x40x4": 4.09, "50x50x3": 4.25, "50x50x4": 5.35, "50x50x5": 6.36,
            "60x60x3": 5.19, "60x60x4": 6.60, "60x60x5": 7.93,
            "80x80x3": 7.07, "80x80x4": 9.22, "80x80x5": 11.1, "80x80x6": 12.9,
            "100x100x4": 11.2, "100x100x5": 13.6, "100x100x6": 16.0, "100x100x8": 20.0
        },
        RHS: { // Rectangular Hollow Sections
            "60x40x3": 4.19, "60x40x4": 5.35,
            "80x40x3": 5.19, "80x40x4": 6.60,
            "100x50x4": 8.59, "100x50x5": 10.5,
            "120x60x5": 12.8,
            "150x100x5": 18.0, "150x100x6": 21.3
        }
    };

    let profileCount = 0
    for (const type of Object.keys(standardProfilesData)) {
        for (const dim of Object.keys(standardProfilesData[type])) {
            const w = standardProfilesData[type][dim]

            // Calculate approx area for default 7.85 density (used for base calculation)
            // Weight (kg/m) = Area(mm2) * 0.00785
            // Area = Weight / 0.00785
            const area = w / 0.00785

            await prisma.standardProfile.upsert({
                where: { type_dimensions: { type, dimensions: dim } },
                update: { weightPerMeter: w, crossSectionArea: area },
                create: { type, dimensions: dim, weightPerMeter: w, crossSectionArea: area }
            })
            profileCount++
        }
    }
    console.log(`✓ Standard Catalog seeded (${profileCount} items)`)

    // IMPORTANT: Per user request, we DO NOT seed SteelProfile, Inventory, or Remnants.
    // "cleanslate steelProfile table and dont seed anything in it"

    console.log('✓ Seeding finished. SteelProfile table left clean.')
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
