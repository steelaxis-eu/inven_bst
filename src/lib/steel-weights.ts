// Standard Steel Weights (kg/m)
// Sources: European Standard Tables (EN 10025, etc.)

import Decimal from 'decimal.js'

// Helper to calculate Cross Section Area in mm²
export function calculateCrossSectionArea(type: string, params: { w?: number, h?: number, t?: number, d?: number, s?: number }): number {
    let area = new Decimal(0)

    if (type === 'Plate' || type === 'PL' || type === 'FB' || type === 'FL' || type === 'Flach') {
        // Width * Thickness
        if (params.w && params.t) {
            area = new Decimal(params.w).times(params.t)
        }
    } else if (type === 'Round' || type === 'R' || type === 'Rd' || type === 'Rund') {
        // PI * r^2
        if (params.d) {
            const r = new Decimal(params.d).dividedBy(2)
            area = r.pow(2).times(Math.PI)
        }
    } else if (type === 'SQB' || type === 'Vierkant') {
        // Square Bar: s * s
        if (params.s) area = new Decimal(params.s).pow(2)
        else if (params.w) area = new Decimal(params.w).pow(2)
    } else if (type === 'RHS') {
        // Box: Outer Area - Inner Area
        // Outer: h * w
        // Inner: (h - 2t) * (w - 2t)
        if (params.h && params.w && params.t) {
            const outer = new Decimal(params.h).times(params.w)
            const innerH = new Decimal(params.h).minus(new Decimal(2).times(params.t))
            const innerW = new Decimal(params.w).minus(new Decimal(2).times(params.t))
            if (innerH.isPositive() && innerW.isPositive()) {
                const inner = innerH.times(innerW)
                area = outer.minus(inner)
            }
        }
    } else if (type === 'SHS') {
        // Square Hollow
        if (params.s && params.t) {
            const outer = new Decimal(params.s).pow(2)
            const innerS = new Decimal(params.s).minus(new Decimal(2).times(params.t))
            if (innerS.isPositive()) {
                const inner = innerS.pow(2)
                area = outer.minus(inner)
            }
        }
    } else if (type === 'CHS') {
        // Pipe: Outer Circle - Inner Circle
        if (params.d && params.t) {
            const outerR = new Decimal(params.d).dividedBy(2)
            const innerR = outerR.minus(params.t)
            if (innerR.isPositive()) {
                const outerArea = outerR.pow(2).times(Math.PI)
                const innerArea = innerR.pow(2).times(Math.PI)
                area = outerArea.minus(innerArea)
            }
        }
    }

    return area.toNumber()
}

export function calculateCustomWeight(type: string, params: { w?: number, h?: number, t?: number, d?: number, s?: number, density?: number }) {
    // All inputs in mm
    // Area in mm2
    // Weight (kg/m) = Area(mm2) / 1,000,000 (to m2) * 1(m) * Density(kg/m3)

    // Default Density 7.85 kg/dm3 = 7850 kg/m3
    const densityVal = params.density ? params.density * 1000 : 7850
    const DENSITY = new Decimal(densityVal)

    const areaMm2 = calculateCrossSectionArea(type, params)

    if (areaMm2 <= 0) return 0

    // Calculate Weight
    const areaM2 = new Decimal(areaMm2).dividedBy(1000000)
    const weight = areaM2.times(DENSITY)

    return weight.toNumber()
}
