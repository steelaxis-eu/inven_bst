'use server'

import { calculateCustomWeight } from "@/lib/steel-weights"
import prisma from "@/lib/prisma"
import { evaluateFormula } from "@/lib/formula"

export async function getStandardProfileTypes() {
    // Fetch distinct types from StandardProfile
    const types = await prisma.standardProfile.findMany({
        distinct: ['type'],
        select: { type: true },
        orderBy: { type: 'asc' }
    })
    return types.map(t => t.type)
}

export async function getStandardProfileDimensions(type: string) {
    // Fetch dimensions for specific type from StandardProfile
    const profiles = await prisma.standardProfile.findMany({
        where: { type: type },
        select: { dimensions: true, weightPerMeter: true },
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

export async function getProfileShapes() {
    return await prisma.profileShape.findMany({
        orderBy: { id: 'asc' }
    })
}

export async function getMaterialGrades() {
    return await prisma.materialGrade.findMany({
        orderBy: { name: 'asc' }
    })
}

export async function calculateProfileWeight(type: string, params: { gradeId?: string, w?: number, h?: number, t?: number, d?: number, s?: number, dimensions?: string }) {
    const { calculateProfileWeightInternal } = await import('@/lib/profile-calculation')
    // Cast prisma to any to match the loose type expectation or import type properly if desired
    return await calculateProfileWeightInternal(prisma as any, type, params)
}
