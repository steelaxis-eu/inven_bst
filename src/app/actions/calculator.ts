'use server'

import { calculateCustomWeight } from "@/lib/steel-weights"
import prisma from "@/lib/prisma"

export async function getStandardProfileTypes() {
    // Fetch distinct types for CATALOG grade
    const types = await prisma.steelProfile.findMany({
        where: { grade: 'CATALOG' },
        distinct: ['type'],
        select: { type: true },
        orderBy: { type: 'asc' }
    })
    return types.map(t => t.type)
}

export async function getStandardProfileDimensions(type: string) {
    // Fetch dimensions for CATALOG grade for specific type
    const profiles = await prisma.steelProfile.findMany({
        where: {
            type: type,
            grade: 'CATALOG'
        },
        select: { dimensions: true, weightPerMeter: true },
        // Simple alphanumeric sort might be messy (100 vs 80), but let's just get them first
    })

    // Check if dimensions are simple numbers or strings like "20x20x3"
    // Sort logic: if numeric, sort numeric. If string, sort string.

    return profiles.sort((a, b) => {
        const numA = parseFloat(a.dimensions)
        const numB = parseFloat(b.dimensions)
        if (!isNaN(numA) && !isNaN(numB) && a.dimensions === numA.toString() && b.dimensions === numB.toString()) {
            return numA - numB
        }
        return a.dimensions.localeCompare(b.dimensions, undefined, { numeric: true, sensitivity: 'base' })
    }).map(p => p.dimensions)
}

export async function calculateProfileWeight(type: string, params: any) {
    if (params.mode === 'STANDARD') {
        const { dimension } = params
        const profile = await prisma.steelProfile.findFirst({
            where: {
                type: type,
                dimensions: dimension,
                grade: 'CATALOG'
            }
        })
        return profile ? profile.weightPerMeter : 0
    }

    // Custom calculation
    return calculateCustomWeight(type, params)
}
