const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    // 1. Create Project
    const project = await prisma.project.upsert({
        where: { projectNumber: 'P-1001' },
        update: {},
        create: {
            projectNumber: 'P-1001',
            name: 'Skyline Tower',
            status: 'ACTIVE',
            createdBy: 'System',
            modifiedBy: 'System'
        }
    })

    // 2. Create Profiles
    const hea200 = await prisma.steelProfile.upsert({
        where: {
            type_dimensions_grade: {
                type: 'HEA',
                dimensions: '200',
                grade: 'S355'
            }
        },
        update: {},
        create: { type: 'HEA', dimensions: '200', grade: 'S355' }
    })

    const ipe300 = await prisma.steelProfile.upsert({
        where: {
            type_dimensions_grade: {
                type: 'IPE',
                dimensions: '300',
                grade: 'S355'
            }
        },
        update: {},
        create: { type: 'IPE', dimensions: '300', grade: 'S355' }
    })

    // 3. Create Inventory
    // Lot A: 5 beams of 12m HEA 200
    /*
    await prisma.inventory.create({
        data: {
            lotId: 'L-100',
            profileId: hea200.id,
            length: 12000,
            quantityReceived: 5,
            quantityAtHand: 5,
            certificateFilename: 'cert-L100.pdf',
            status: 'ACTIVE',
            createdBy: 'System',
            modifiedBy: 'System'
        }
    })
    */

    // Lot B: 10 beams of 6m IPE 300
    /*
    await prisma.inventory.create({
        data: {
            lotId: 'L-101',
            profileId: ipe300.id,
            length: 6000,
            quantityReceived: 10,
            quantityAtHand: 10,
            certificateFilename: 'cert-L101.pdf',
            status: 'ACTIVE',
            createdBy: 'System',
            modifiedBy: 'System'
        }
    })
    */

    // 4. Seed Standard Reference Profiles (Grade: 'CATALOG')
    const STANDARD_PROFILES = {
        HEA: {
            "100": 16.7, "120": 19.9, "140": 24.7, "160": 30.4, "180": 35.5,
            "200": 42.3, "220": 50.5, "240": 60.3, "260": 68.2, "280": 76.4,
            "300": 88.3, "320": 97.6, "340": 105.0, "360": 112.0, "400": 125.0,
            "450": 140.0, "500": 155.0, "550": 166.0, "600": 178.0
        },
        HEB: {
            "100": 20.4, "120": 26.7, "140": 33.7, "160": 42.6, "180": 51.2,
            "200": 61.3, "220": 71.5, "240": 83.2, "260": 93.0, "280": 103.0,
            "300": 117.0, "320": 127.0, "340": 134.0, "360": 142.0, "400": 155.0,
            "450": 171.0, "500": 187.0, "550": 204.0, "600": 221.0
        },
        IPE: {
            "80": 6.0, "100": 8.1, "120": 10.4, "140": 12.9, "160": 15.8, "180": 18.8,
            "200": 22.4, "220": 26.2, "240": 30.7, "270": 36.1, "300": 42.2, "330": 49.1,
            "360": 57.1, "400": 66.3, "450": 77.6, "500": 90.7, "550": 106.0, "600": 122.0
        },
        UPN: {
            "50": 5.59, "65": 7.09,
            "80": 8.64, "100": 10.6, "120": 13.4, "140": 16.0, "160": 18.8, "180": 22.0,
            "200": 25.3, "220": 29.4, "240": 33.2, "260": 37.9, "280": 41.8, "300": 46.2,
            "320": 59.5, "350": 60.6, "380": 63.1, "400": 71.8
        },
        UPE: {
            "80": 7.9, "100": 9.82, "120": 12.1, "140": 14.5, "160": 17.0, "180": 19.7,
            "200": 22.8, "220": 26.6, "240": 30.2, "270": 35.2, "300": 44.4, "330": 53.2,
            "360": 61.2, "400": 72.2
        },
        L: {
            "20x20x3": 0.88,
            "25x25x3": 1.12, "25x25x4": 1.45, "25x25x5": 1.78,
            "30x30x3": 1.36, "30x30x4": 1.78, "30x30x5": 2.18,
            "35x35x3": 1.6, "35x35x4": 2.09, "35x35x5": 2.57,
            "40x40x3": 1.84, "40x40x4": 2.42, "40x40x5": 2.97, "40x40x6": 3.52,
            "45x45x3": 2.09, "45x45x4": 2.74, "45x45x5": 3.38, "45x45x6": 4.0,
            "50x50x3": 2.33, "50x50x4": 3.06, "50x50x5": 3.77, "50x50x6": 4.47, "50x50x7": 5.15, "50x50x8": 5.82, "50x50x9": 6.47,
            "55x55x4": 3.38, "55x55x5": 4.18, "55x55x6": 4.95,
            "60x60x4": 3.70, "60x60x5": 4.57, "60x60x6": 5.42, "60x60x7": 6.26, "60x60x8": 7.09, "60x60x9": 7.93,
            "70x70x5": 5.23, "70x70x6": 6.38, "70x70x7": 7.38, "70x70x8": 8.37, "70x70x9": 9.32, "70x70x10": 10.3,
            "80x80x6": 7.34, "80x80x7": 8.49, "80x80x8": 9.63, "80x80x9": 10.66, "80x80x10": 11.9,
            "90x90x6": 8.3, "90x90x7": 9.61, "90x90x8": 10.9, "90x90x9": 12.2, "90x90x10": 13.4,
            "100x100x8": 12.2, "100x100x10": 15.0, "100x100x12": 17.8,
            "120x120x10": 18.2, "120x120x12": 21.6,
            "130x130x12": 23.6,
            "150x150x10": 23.0, "150x150x12": 27.3, "150x150x15": 33.8,
            "160x160x15": 36.2,
            "180x180x16": 43.5, "180x180x18": 48.6,
            "200x200x16": 48.5, "200x200x18": 54.3, "200x200x20": 59.9, "200x200x24": 71.1,
            "250x250x17": 64.89, "250x250x18": 68.53, "250x250x19": 72.16, "250x250x20": 75.78, "250x250x21": 79.38,
            "250x250x22": 82.97, "250x250x23": 86.54, "250x250x24": 90.1, "250x250x25": 93.64, "250x250x26": 97.16,
            "250x250x27": 100.67, "250x250x28": 104.17, "250x250x29": 107.64, "250x250x30": 111.11, "250x250x31": 114.55,
            "250x250x32": 117.98, "250x250x33": 121.4, "250x250x34": 124.8, "250x250x35": 128.18,
            "300x300x25": 113.15, "300x300x26": 117.46, "300x300x27": 121.76, "300x300x28": 126.04, "300x300x29": 130.3,
            "300x300x30": 134.55, "300x300x31": 138.78, "300x300x32": 142.99, "300x300x33": 147.19, "300x300x34": 151.38, "300x300x35": 155.54
        },
        L_UNEQUAL: {
            "30x20x3": 1.11, "30x20x4": 1.45,
            "40x20x4": 1.77, "40x25x4": 1.93,
            "45x30x4": 2.25, "45x30x5": 2.77,
            "50x30x5": 2.96, "50x40x5": 3.37,
            "60x30x5": 3.37, "60x40x5": 3.76, "60x40x6": 4.46,
            "65x50x5": 4.35, "65x50x7": 5.97,
            "70x50x6": 5.40,
            "75x50x6": 5.65, "75x50x8": 7.39,
            "80x40x6": 5.41, "80x40x8": 7.07,
            "80x60x7": 7.36,
            "90x60x6": 6.82, "90x60x8": 8.96,
            "100x50x6": 6.85, "100x50x8": 8.99, "100x50x10": 11.1,
            "100x65x7": 8.77, "100x65x9": 11.1, "100x65x11": 13.4,
            "100x75x8": 10.6, "100x75x10": 13.0,
            "120x80x8": 12.2, "120x80x10": 15.0, "120x80x12": 17.8,
            "125x75x8": 12.2, "125x75x10": 15.0, "125x75x12": 17.8,
            "150x75x10": 17.0, "150x75x12": 20.2, "150x75x15": 24.8,
            "150x90x10": 18.2, "150x90x12": 21.6, "150x90x15": 26.6,
            "150x100x10": 19.3, "150x100x12": 23.0, "150x100x14": 26.6,
            "200x100x10": 23.0, "200x100x12": 27.6, "200x100x14": 31.8, "200x100x16": 36.6,
            "200x150x12": 32.7, "200x150x15": 40.3
        }
    }

    console.log("Seeding reference profiles...")
    for (const type of Object.keys(STANDARD_PROFILES)) {
        for (const dim of Object.keys(STANDARD_PROFILES[type])) {
            const w = STANDARD_PROFILES[type][dim]
            await prisma.steelProfile.upsert({
                where: {
                    type_dimensions_grade: {
                        type: type,
                        dimensions: dim,
                        grade: 'CATALOG'
                    }
                },
                update: { weightPerMeter: w },
                create: {
                    type: type,
                    dimensions: dim,
                    grade: 'CATALOG',
                    weightPerMeter: w
                }
            })
        }
    }
    console.log("Seeding complete.")

    console.log({ project, hea200, ipe300 })
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
