'use server'

import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { optimizeCuttingPlan, OptimizationItem, StockInfo } from '@/lib/optimization'

export interface PlanningResult {
    profileType: string
    dimensions: string
    grade: string
    stockUsed: {
        lotId: string
        length: number
        partsCount: number
        waste: number
        parts: { partId: string, length: number, partNumber: string }[]
    }[]
    newStockNeeded: {
        length: number
        quantity: number
        partsCount: number
        parts: { partId: string, length: number, partNumber: string }[]
    }[]
    partsFromStock: string[] // IDs of parts to cut from stock
    partsFromNew: string[]   // IDs of parts needing new material
}

export async function calculateCuttingPlan(
    pieceIds: string[],
    standardStockLength: number = 12000,
    customStockOverrides: Record<string, number> = {}
): Promise<{ success: boolean, data?: PlanningResult[], error?: string }> {
    try {
        const user = await getCurrentUser()
        if (!user) return { success: false, error: 'Unauthorized' }

        // 1. Fetch pieces with profile info
        const pieces = await prisma.partPiece.findMany({
            where: { id: { in: pieceIds } },
            include: {
                part: {
                    include: { profile: true, grade: true }
                }
            }
        })

        // 2. Group by Profile + Grade (Enhanced for Custom Profiles)
        const groups: Record<string, {
            profileType: string,
            dimensions: string,
            gradeName: string,
            profileId?: string,
            gradeId?: string,
            pieces: { id: string, length: number }[]
        }> = {}

        // Map pieceId -> partNumber for final result mapping
        const piecePartNumberMap: Record<string, string> = {}

        for (const piece of pieces) {
            // Determine keys even if relations are missing
            const gradeName = piece.part.grade?.name || 'Unknown Grade'
            const gradeId = piece.part.grade?.id

            let profileType = piece.part.profile?.type || piece.part.profileType
            let dimensions = piece.part.profile?.dimensions || piece.part.profileDimensions
            let profileId = piece.part.profile?.id

            // If we have absolutely no info, we can't optimize
            if (!profileType || !dimensions) {
                // Optionally log or handle 'Unknown' parts
                continue
            }

            const key = `${profileType}|${dimensions}|${gradeName}`

            if (!groups[key]) {
                groups[key] = {
                    profileType,
                    dimensions,
                    gradeName,
                    profileId,
                    gradeId,
                    pieces: []
                }
            }

            const len = piece.part.length || 0
            groups[key].pieces.push({ id: piece.id, length: len })
            piecePartNumberMap[piece.id] = piece.part.partNumber
        }

        const results: PlanningResult[] = []

        // 3. Optimize each group
        for (const key in groups) {
            const group = groups[key]

            // Fetch Inventory (Stock + Remnants)
            let inventory: any[] = []

            // Try to find matching profile ID if we don't have one
            let targetProfileId = group.profileId
            if (!targetProfileId) {
                const matchingProfile = await prisma.steelProfile.findFirst({
                    where: { type: group.profileType, dimensions: group.dimensions }
                })
                if (matchingProfile) targetProfileId = matchingProfile.id
            }

            if (targetProfileId && group.gradeId) {
                inventory = await prisma.inventory.findMany({
                    where: {
                        profileId: targetProfileId,
                        gradeId: group.gradeId,
                        status: 'ACTIVE',
                        quantityAtHand: { gt: 0 }
                    },
                    orderBy: { length: 'asc' }
                })
            }

            const stockInfo: StockInfo[] = inventory.flatMap(inv => {
                return Array(inv.quantityAtHand).fill({
                    id: inv.lotId,
                    length: inv.length,
                    quantity: 1
                })
            })

            // Run Optimization
            const optParts: OptimizationItem[] = group.pieces.map(p => ({
                id: p.id,
                length: p.length,
                quantity: 1
            }))

            // Custom Override Check
            const groupKey = `${group.profileType}|${group.dimensions}|${group.gradeName}`
            const stockLengthToUse = customStockOverrides[groupKey] || standardStockLength

            const plan = optimizeCuttingPlan(optParts, stockInfo, stockLengthToUse)

            // Map results
            const stockUsed = plan.stockUsed.map(s => ({
                lotId: s.stockId,
                length: s.parts.reduce((sum, p) => sum + p.length, 0) + s.waste,
                partsCount: s.parts.length,
                waste: s.waste,
                parts: s.parts.map(p => ({
                    ...p,
                    partNumber: piecePartNumberMap[p.partId] || 'Unknown'
                }))
            }))

            const newStockNeeded = plan.newStockNeeded.map(n => ({
                length: n.length,
                quantity: n.quantity,
                partsCount: n.parts.length,
                parts: n.parts.map(p => ({
                    ...p,
                    partNumber: piecePartNumberMap[p.partId] || 'Unknown'
                }))
            }))

            const partsFromStock = plan.stockUsed.flatMap(s => s.parts.map(p => p.partId))
            const partsFromNew = plan.newStockNeeded.flatMap(n => n.parts.flatMap(p => p.partId))

            results.push({
                profileType: group.profileType,
                dimensions: group.dimensions,
                grade: group.gradeName,
                stockUsed,
                newStockNeeded,
                partsFromStock,
                partsFromNew
            })
        }

        return { success: true, data: results }

    } catch (e: any) {
        console.error('calculateCuttingPlan error:', e)
        return { success: false, error: e.message }
    }
}
