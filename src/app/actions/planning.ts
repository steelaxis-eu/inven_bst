'use server'

import prisma from '@/lib/prisma'
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
    }[]
    newStockNeeded: {
        length: number
        quantity: number
        partsCount: number
    }[]
    partsFromStock: string[] // IDs of parts to cut from stock
    partsFromNew: string[]   // IDs of parts needing new material
}

export async function calculateCuttingPlan(
    pieceIds: string[],
    standardStockLength: number = 12000
): Promise<{ success: boolean, data?: PlanningResult[], error?: string }> {
    try {
        // 1. Fetch pieces with profile info
        const pieces = await prisma.partPiece.findMany({
            where: { id: { in: pieceIds } },
            include: {
                part: {
                    include: { profile: true, grade: true }
                }
            }
        })

        // 2. Group by Profile + Grade
        const groups: Record<string, {
            profile: any,
            grade: any,
            pieces: { id: string, length: number }[]
        }> = {}

        for (const piece of pieces) {
            const profile = piece.part.profile
            const grade = piece.part.grade
            if (!profile || !grade) continue // Skip if missing info

            const key = `${profile.type}|${profile.dimensions}|${grade.name}`
            if (!groups[key]) {
                groups[key] = {
                    profile,
                    grade,
                    pieces: []
                }
            }
            // Use part length (assuming piece length is same? Part Piece logic usually inherits)
            // If piece has specific length (e.g. variable), use it. But typically Part has length.
            const len = piece.part.length || 0
            groups[key].pieces.push({ id: piece.id, length: len })
        }

        const results: PlanningResult[] = []

        // 3. Optimize each group
        for (const key in groups) {
            const group = groups[key]

            // Fetch Inventory (Stock + Remnants)
            // Use greedy fetch: Available items matching profile/grade
            const inventory = await prisma.inventory.findMany({
                where: {
                    profileId: group.profile.id,
                    gradeId: group.grade.id,
                    status: 'ACTIVE',
                    quantityAtHand: { gt: 0 }
                },
                orderBy: { length: 'asc' } // Try smallest first? Or largest?
                // Usually for minimizing waste, Best Fit works well with any order, 
                // but using Remnants (usually smaller) first is good practice.
            })

            const stockInfo: StockInfo[] = inventory.flatMap(inv => {
                // Expand quantity into individual items for the optimizer
                return Array(inv.quantityAtHand).fill({
                    id: inv.lotId, // Use Lot ID as reference
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

            const plan = optimizeCuttingPlan(optParts, stockInfo, standardStockLength)

            // Map results
            const stockUsed = plan.stockUsed.map(s => ({
                lotId: s.stockId,
                length: s.parts.reduce((sum, p) => sum + p.length, 0) + s.waste, // reconstruct orig length
                partsCount: s.parts.length,
                waste: s.waste
            }))

            const newStockNeeded = plan.newStockNeeded.map(n => ({
                length: n.length,
                quantity: n.quantity,
                partsCount: n.parts.length
            }))

            const partsFromStock = plan.stockUsed.flatMap(s => s.parts.map(p => p.partId))
            const partsFromNew = plan.newStockNeeded.flatMap(n => n.parts.flatMap(p => p.partId))

            results.push({
                profileType: group.profile.type,
                dimensions: group.profile.dimensions,
                grade: group.grade.name,
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
