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
        await prisma.standardProfile.deleteMany({}) // Clean standard catalog to refresh with CSV data
        console.log('✓ SteelProfile, StandardProfile, and dependent tables cleaned')
    } catch (e) {
        console.log('! Note: Could not clean some tables (maybe empty or constraint invisible):', e)
    }

    // 1. Seed Global Settings
    await prisma.globalSettings.upsert({
        where: { id: 'settings' },
        update: {},
        create: { id: 'settings' }
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
        { name: 'S235', density: 7.85, scrapPrice: 0.25 },
        { name: 'S275', density: 7.85, scrapPrice: 0.25 },
        { name: 'S355', density: 7.85, scrapPrice: 0.25 },
        { name: 'SS304', density: 7.90, scrapPrice: 1.50 },
        { name: 'SS316', density: 7.95, scrapPrice: 1.80 }
    ]
    for (const g of GRADES) {
        await prisma.materialGrade.upsert({
            where: { name: g.name },
            update: { density: g.density, scrapPrice: g.scrapPrice },
            create: { name: g.name, density: g.density, scrapPrice: g.scrapPrice }
        })
    }
    console.log('✓ Grades seeded')

    // 2.2 Seed Profile Shapes (Definitions for Custom)
    // Formulas use params as variables. Area in mm^2.
    // 2.2 Seed Profile Shapes (Definitions for Custom)
    // Precise EN 10210/10219 formulas for RHS/SHS (A.3)
    // Area = 2T(B+H-2T) - (4 - PI)(ro^2 - ri^2)
    // ro/ri depend on T.
    const enFormulaBox = `
        const ro = (t <= 6) ? 2.0 * t : (t <= 10) ? 2.5 * t : 3.0 * t;
        const ri = (t <= 6) ? 1.0 * t : (t <= 10) ? 1.5 * t : 2.0 * t;
        const area = 2*t*(b + h - 2*t) - (4 - Math.PI)*(ro*ro - ri*ri);
        return area;
    `
    // For SHS, b=h. We can reuse the same formula if we map params, but here simple separate string is cleaner.
    const enFormulaSquare = `
        const h = b; 
        const ro = (t <= 6) ? 2.0 * t : (t <= 10) ? 2.5 * t : 3.0 * t;
        const ri = (t <= 6) ? 1.0 * t : (t <= 10) ? 1.5 * t : 2.0 * t;
        const area = 2*t*(b + h - 2*t) - (4 - Math.PI)*(ro*ro - ri*ri);
        return area;
    `

    const SHAPES = [
        { id: 'FB', name: 'Flat Bar / Plate', params: ['w', 't'], formula: 'w * t' },
        { id: 'R', name: 'Round Bar', params: ['d'], formula: 'Math.PI * (d/2) * (d/2)' },
        { id: 'SQB', name: 'Square Bar', params: ['b'], formula: 'b * b' },
        { id: 'RHS', name: 'Rectangular Hollow (EN)', params: ['b', 'h', 't'], formula: enFormulaBox.replace(/\n\s+/g, ' ') }, // Minify slightly for DB storage if preferred, or keep structure.
        { id: 'SHS', name: 'Square Hollow (EN)', params: ['b', 't'], formula: enFormulaSquare.replace(/\n\s+/g, ' ') },
        { id: 'CHS', name: 'Circular Hollow', params: ['d', 't'], formula: 'Math.PI * ((d/2)*(d/2) - ((d-2*t)/2)*((d-2*t)/2))' },
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
                    // Exclude shapes that should be treated as "Custom" with formulas (RHS, SHS, CHS)
                    // This forces the UI to use the Formula inputs instead of the limited Standard Catalog list.
                    if (['RHS', 'SHS', 'CHS'].includes(type.toUpperCase())) continue

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
