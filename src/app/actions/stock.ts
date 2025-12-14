'use server'

import prisma from '@/lib/prisma'

export type StockItem = {
    id: string
    originalId: string // lotId or remnant id
    type: 'INVENTORY' | 'REMNANT'
    profileType: string // HEA, IPE
    dimensions: string
    grade: string
    length: number
    quantity: number
    status: string
    location: string // inferred from ID or standard
}

export async function searchStock(query?: string, profileType?: string, dimension?: string): Promise<StockItem[]> {
    let queries: string[] = []
    if (query) {
        queries.push(query)
        // Heuristic: If L100, try L-100
        const lMatch = query.match(/^L(\d+)$/i)
        if (lMatch) {
            queries.push(`L-${lMatch[1]}`)
        }
    }

    const whereProfile = {
        type: profileType ? { contains: profileType } : undefined,
        dimensions: dimension ? { contains: dimension } : undefined,
    }

    const OR = queries.length > 0 ? queries.flatMap(q => [
        { lotId: { contains: q } },
        { profile: { type: { contains: q } } }
    ]) : undefined

    // 1. Fetch Inventory
    const inventoryItems = await prisma.inventory.findMany({
        where: {
            quantityAtHand: { gt: 0 },
            OR,
            profile: whereProfile
        },
        include: { profile: true }
    })

    // 2. Fetch Remnants
    const remnantItems = await prisma.remnant.findMany({
        where: {
            status: 'AVAILABLE',
            OR: queries.length > 0 ? queries.flatMap(q => [
                { id: { contains: q } },
                { rootLotId: { contains: q } }
            ]) : undefined,
            profile: whereProfile
        },
        include: { profile: true }
    })

    // 3. Unify
    const stock: StockItem[] = [
        ...inventoryItems.map(i => ({
            id: i.id,
            originalId: i.lotId,
            type: 'INVENTORY' as const,
            profileType: i.profile.type,
            dimensions: i.profile.dimensions,
            grade: i.profile.grade,
            length: i.length,
            quantity: i.quantityAtHand,
            status: i.status,
            location: 'Warehouse'
        })),
        ...remnantItems.map(r => ({
            id: r.id,
            originalId: r.id, // Remnant ID is the display ID
            type: 'REMNANT' as const,
            profileType: r.profile.type,
            dimensions: r.profile.dimensions,
            grade: r.profile.grade,
            length: r.length,
            quantity: 1,
            status: r.status,
            location: 'Yard'
        }))
    ]

    return stock
}
