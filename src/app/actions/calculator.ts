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
    // 1. Determine Density
    let density = 7.85 // kg/dm3 default
    if (params.gradeId) {
        const grade = await prisma.materialGrade.findUnique({
            where: { id: params.gradeId },
            select: { density: true }
        })
        if (grade) {
            // Normalize density. If > 100, assume kg/m3 and convert to kg/dm3
            // e.g. 7850 kg/m3 -> 7.85 kg/dm3
            if (grade.density > 100) {
                density = grade.density / 1000
            } else {
                density = grade.density
            }
        }
    }

    // 2. Check Standard Profile
    // If "dimensions" string is passed (e.g. "100", "HEA 100"), try to find it
    if (params.dimensions) {
        // Try exact match first
        const standard = await prisma.standardProfile.findUnique({
            where: { type_dimensions: { type, dimensions: params.dimensions } }
        })

        if (standard) {
            if (standard.crossSectionArea) {
                // Precise calculation: Area (mm2) * Density (kg/dm3) conversion
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

    // 3. Custom Shape Calculation (Formula based)
    // Check if shape exists in DB to use its formula
    const shape = await prisma.profileShape.findUnique({ where: { id: type } })
    if (shape && shape.formula) {
        const shapeParams = shape.params as string[] // e.g. ["h", "w", "t"]
        const numericParams: Record<string, number> = {}

        // Populate numericParams
        // Option A: Explicit params provided (w, h, t...)
        if (params.w !== undefined) numericParams.w = params.w
        if (params.h !== undefined) numericParams.h = params.h
        if (params.t !== undefined) numericParams.t = params.t
        if (params.d !== undefined) numericParams.d = params.d
        if (params.s !== undefined) numericParams.s = params.s

        // Option B: Parse from dimensions string (e.g. "100x50x4") if explicit params missing
        if (params.dimensions && Object.keys(numericParams).length === 0) {
            const dimParts = params.dimensions.toLowerCase().split(/[x* ]+/).map(s => parseFloat(s)).filter(n => !isNaN(n))

            // Map sequential numbers to params
            shapeParams.forEach((param, i) => {
                if (dimParts[i] !== undefined) {
                    numericParams[param] = dimParts[i]
                }
            })
        }

        try {
            // Check if we have all required params
            const missingParams = shapeParams.filter(p => numericParams[p] === undefined)
            if (missingParams.length === 0) {
                const areaMm2 = evaluateFormula(shape.formula, numericParams)
                // Weight = Area(mm2) * 0.001 * Density(kg/dm3) 
                // (See explanation: mm2 -> m2 is /1e6. Density kg/m3 is *1000. So factor is /1000.)
                return (areaMm2 / 1000000) * (density * 1000)
            }
        } catch (e) {
            console.error("Formula eval failed:", e)
        }
    }

    // Fallback to hardcoded logic if no DB shape found (Legacy support)
    return calculateCustomWeight(type, { ...params, density })
}
