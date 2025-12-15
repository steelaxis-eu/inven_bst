'use server'

import { calculateCustomWeight } from "@/lib/steel-weights"
import prisma from "@/lib/prisma"

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

export async function calculateProfileWeight(type: string, params: { gradeId?: string, w?: number, h?: number, t?: number, d?: number, s?: number, dimensions?: string }) {
    // 1. Determine Density
    let density = 7.85 // kg/dm3
    if (params.gradeId) {
        const grade = await prisma.materialGrade.findUnique({
            where: { id: params.gradeId },
            select: { density: true }
        })
        if (grade) {
            density = grade.density
        }
    }

    // 2. Check Standard Profile
    // If "dimensions" string is passed (e.g. "100"), try to find it
    if (params.dimensions) {
        const standard = await prisma.standardProfile.findUnique({
            where: { type_dimensions: { type, dimensions: params.dimensions } }
        })

        if (standard) {
            if (standard.crossSectionArea) {
                // Precise calculation: Area (mm2) * Density (kg/dm3) conversion
                // Weight = Area(mm2) / 1,000,000 * 1000 * Density(kg/dm3) => Area * 0.001 * Density
                // or just: convert Density to kg/m3 (x1000). Area(m2) * Density(kg/m3).
                // Area(m2) = Area(mm2) / 1e6.
                // Weight = (standard.crossSectionArea / 1000000) * (density * 1000)
                return (standard.crossSectionArea / 1000000) * (density * 1000)
            } else {
                // Fallback: Scale standard weight based on density ratio
                // Standard weight is assumed at 7.85 usually.
                const ratio = density / 7.85
                return standard.weightPerMeter * ratio
            }
        }
    }

    // 3. Custom Shape Calculation
    return calculateCustomWeight(type, { ...params, density })
}
