
// Standard Steel Weights (kg/m)
// Sources: European Standard Tables (EN 10025, etc.)

import { Decimal } from 'decimal.js'

export function calculateCustomWeight(type: string, params: { w?: number, h?: number, t?: number, d?: number, s?: number }) {
    // All inputs in mm
    // Convert Area to m2: Area(mm2) / 1,000,000
    // Weight = Area(m2) * 1 * 7850
    // Density = 7850 kg/m3

    const DENSITY = new Decimal(7850)
    let areaMM2 = new Decimal(0)

    // Safely convert inputs to Decimal, defaulting to 0 if undefined
    const w = params.w ? new Decimal(params.w) : new Decimal(0)
    const h = params.h ? new Decimal(params.h) : new Decimal(0)
    const t = params.t ? new Decimal(params.t) : new Decimal(0)
    const d = params.d ? new Decimal(params.d) : new Decimal(0)
    const s = params.s ? new Decimal(params.s) : new Decimal(0)

    // Constants
    const PI = new Decimal(Math.PI)

    switch (type) {
        case 'PL': // Plate / Flat Bar (FB)
        case 'FB':
            if (params.w && params.t) {
                areaMM2 = w.times(t)
            }
            break
        case 'R': // Round Bar
            if (params.d) {
                const r = d.div(2)
                areaMM2 = PI.times(r).times(r)
            }
            break
        case 'SQB': // Square Bar
            if (params.s) {
                areaMM2 = s.times(s)
            }
            break
        case 'RHS': // Rectangular Hollow Section (EN 10219/10210)
        case 'SHS':
            if (params.w && params.h && params.t) {
                const B = Decimal.min(w, h)
                const H = Decimal.max(w, h)
                const T = t

                // Determine ro (external corner radius)
                let ro = T.times(2.0)
                if (T.gt(6) && T.lte(10)) ro = T.times(2.5)
                if (T.gt(10)) ro = T.times(3.0)

                const ri = ro.minus(T)

                // Formula from EN standard
                // Cross-sectional Area A
                // A = 2*t*(b + h - 2*t) - (4 - pi)*(ro^2 - ri^2)

                const term1 = T.times(2).times(B.plus(H).minus(T.times(2)))
                const cornerFactor = new Decimal(4).minus(PI)
                const cornerArea = cornerFactor.times(ro.pow(2).minus(ri.pow(2)))

                areaMM2 = term1.minus(cornerArea)
            }
            break
        case 'CHS': // Circular Hollow Section (Pipe)
            if (params.d && params.t) {
                const ro = d.div(2)
                const ri = ro.minus(t)
                const areaOuter = PI.times(ro.pow(2))
                const areaInner = PI.times(ri.pow(2))
                areaMM2 = areaOuter.minus(areaInner)
            }
            break
    }

    if (areaMM2.gt(0)) {
        // Result = (Area / 1,000,000) * Density
        return areaMM2.div(1000000).times(DENSITY).toNumber()
    }
    return 0
}
