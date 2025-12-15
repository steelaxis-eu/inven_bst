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

    // 2.3 Seed Standard Profiles Catalog from CSVs
    const fs = require('fs')
    const path = require('path')

    console.log('Reading Profiles.csv...')
    // Parse Profiles.csv (Pivot table: Dimension, UPN, UPE, ...)
    const profilesPath = path.join(__dirname, '../docs/Profiles.csv')
    const profilesContent = fs.readFileSync(profilesPath, 'utf8')
    const profilesLines = profilesContent.split(/\r?\n/).filter((l: string) => l.trim() !== '')

    // Header: Dimension,UPN,UPE,IPE,IPN,HEM,HEB,HEA
    // Remove BOM if present
    const cleanHeader = profilesLines[0].replace(/^\uFEFF/, '')
    const headers = cleanHeader.split(',')
    const types = headers.slice(1) // ["UPN", "UPE", ...]

    let count = 0
    for (let i = 1; i < profilesLines.length; i++) {
        const line = profilesLines[i]
        const cols = line.split(',')
        const dim = cols[0] // e.g., "80" or "40x20"

        for (let j = 0; j < types.length; j++) {
            const type = types[j]
            const weightStr = cols[j + 1] // Corresponding column

            if (weightStr && weightStr.trim() !== '') {
                const w = parseFloat(weightStr)
                if (!isNaN(w)) {
                    // Calc area
                    const area = w / 0.00785

                    await prisma.standardProfile.upsert({
                        where: { type_dimensions: { type, dimensions: dim } },
                        update: { weightPerMeter: w, crossSectionArea: area },
                        create: { type, dimensions: dim, weightPerMeter: w, crossSectionArea: area }
                    })
                    count++
                }
            }
        }
    }
    console.log(`✓ Seeded ${count} profiles from Profiles.csv`)

    // Parse L profiles.csv (width,Height,t,kg/m)
    console.log('Reading L profiles.csv...')
    const lPath = path.join(__dirname, '../docs/L profiles.csv')
    const lContent = fs.readFileSync(lPath, 'utf8')
    const lLines = lContent.split(/\r?\n/).filter((l: string) => l.trim() !== '')

    // Skip header: width,Height,t,kg/m
    let lCount = 0
    for (let i = 1; i < lLines.length; i++) {
        const line = lLines[i]
        const cols = line.split(',')
        if (cols.length < 4) continue

        const width = cols[0]
        const height = cols[1]
        const t = cols[2]
        const w = parseFloat(cols[3])

        if (!isNaN(w)) {
            const dim = `${width}x${height}x${t}`
            const area = w / 0.00785

            await prisma.standardProfile.upsert({
                where: { type_dimensions: { type: 'L', dimensions: dim } },
                update: { weightPerMeter: w, crossSectionArea: area },
                create: { type: 'L', dimensions: dim, weightPerMeter: w, crossSectionArea: area }
            })
            lCount++
        }
    }
    console.log(`✓ Seeded ${lCount} profiles from L profiles.csv`)

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
