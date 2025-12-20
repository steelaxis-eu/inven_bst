
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Update Shapes...')

    // EN 10219 (Cold Formed)
    // External corner radius ro:
    // T <= 6mm: 2.0 * T
    // 6 < T <= 10mm: 2.5 * T
    // T > 10mm: 3.0 * T
    // Internal radius ri:
    // T <= 6mm: 1.0 * T
    // 6 < T <= 10mm: 1.5 * T
    // T > 10mm: 2.0 * T
    //
    // Valid JS Formula for area:
    // We can use ternary operators for conditional radius.
    // Area = 2*t*(b + h - 2*t) - (4 - Math.PI)*(ro*ro - ri*ri)

    const formulaEn10219 = `
        const ro = (t <= 6) ? 2.0 * t : (t <= 10) ? 2.5 * t : 3.0 * t;
        const ri = (t <= 6) ? 1.0 * t : (t <= 10) ? 1.5 * t : 2.0 * t;
        const area = 2*t*(b + h - 2*t) - (4 - Math.PI)*(ro*ro - ri*ri);
        return area;
    `

    // EN 10210 (Hot Finished)
    // External corner radius ro:
    // T <= 6mm: 1.5 * T
    // 6 < T <= 10mm: 2.0 * T
    // T > 10mm: 2.5 * T
    // Internal radius ri:
    // T <= 6mm: 1.0 * T
    // 6 < T <= 10mm: 1.5 * T
    // T > 10mm: 2.0 * T
    // Note: EN 10210-2 has slightly different corner definitions but typically R = 1.5T for calculation.
    // Let's us specific logic if needed, but for now we follow similar structure with slightly tighter corners.

    const formulaEn10210 = `
        const ro = (t <= 6) ? 1.5 * t : (t <= 10) ? 2.0 * t : 2.5 * t;
        const ri = (t <= 6) ? 1.0 * t : (t <= 10) ? 1.5 * t : 2.0 * t;
        const area = 2*t*(b + h - 2*t) - (4 - Math.PI)*(ro*ro - ri*ri);
        return area;
    `

    // Square is same but b=s, h=s
    const formulaSquareEn10219 = `
        const b = s; const h = s;
        const ro = (t <= 6) ? 2.0 * t : (t <= 10) ? 2.5 * t : 3.0 * t;
        const ri = (t <= 6) ? 1.0 * t : (t <= 10) ? 1.5 * t : 2.0 * t;
        const area = 2*t*(b + h - 2*t) - (4 - Math.PI)*(ro*ro - ri*ri);
        return area;
    `

    const formulaSquareEn10210 = `
        const b = s; const h = s;
        const ro = (t <= 6) ? 1.5 * t : (t <= 10) ? 2.0 * t : 2.5 * t;
        const ri = (t <= 6) ? 1.0 * t : (t <= 10) ? 1.5 * t : 2.0 * t;
        const area = 2*t*(b + h - 2*t) - (4 - Math.PI)*(ro*ro - ri*ri);
        return area;
    `

    // CHS is simple pipe
    const formulaCHS = `return Math.PI * t * (d - t);`


    const SHAPES = [
        // EN 10219 Cold Formed
        { id: 'RHS-EN10219', name: 'RHS (EN10219 Cold)', params: ['h', 'w', 't'], formula: formulaEn10219 },
        { id: 'SHS-EN10219', name: 'SHS (EN10219 Cold)', params: ['s', 't'], formula: formulaSquareEn10219 },
        { id: 'CHS-EN10219', name: 'CHS (EN10219)', params: ['d', 't'], formula: formulaCHS },

        // EN 10210 Hot Finished
        { id: 'RHS-EN10210', name: 'RHS (EN10210 Hot)', params: ['h', 'w', 't'], formula: formulaEn10210 },
        { id: 'SHS-EN10210', name: 'SHS (EN10210 Hot)', params: ['s', 't'], formula: formulaSquareEn10210 },
        { id: 'CHS-EN10210', name: 'CHS (EN10210)', params: ['d', 't'], formula: formulaCHS },

        // Ensure legacy ones are also present/updated if needed (for safety/backward compat)
        // We will hide these later but good to ensure they exist.
        { id: 'RHS', name: 'RHS (Generic)', params: ['h', 'w', 't'], formula: '2 * t * (w + h - 2 * t)' },
        { id: 'SHS', name: 'SHS (Generic)', params: ['s', 't'], formula: '4 * t * (s - t)' },
        { id: 'CHS', name: 'CHS (Generic)', params: ['d', 't'], formula: 'Math.PI * t * (d - t)' },
    ]

    for (const s of SHAPES) {
        console.log(`Upserting ${s.id}...`)
        await prisma.profileShape.upsert({
            where: { id: s.id },
            update: { name: s.name, params: s.params, formula: s.formula },
            create: { id: s.id, name: s.name, params: s.params, formula: s.formula }
        })
    }

    console.log('✓ Shapes updated')
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
