export interface OptimizationItem {
    id: string
    length: number
    quantity: number
    profileType?: string // Optional verification
}

export interface StockInfo {
    id: string
    length: number
    quantity: number
    type: 'INVENTORY' | 'REMNANT'
    costPerMeter?: number
}

export interface AllocatedPart {
    partId: string
    length: number
}

export interface StockAllocation {
    stockId: string
    stockType: 'INVENTORY' | 'REMNANT'
    originalLength: number
    usedLength: number
    waste: number
    parts: AllocatedPart[]
}

export interface NewStockAllocation {
    length: number
    quantity: number
    parts: AllocatedPart[] // Parts allocated to this new bar type
}

export interface OptimizationResult {
    stockUsed: StockAllocation[]
    newStockNeeded: NewStockAllocation[]
    unallocated: OptimizationItem[] // Handling extremely long parts
    efficiency: number // Overall efficiency 0-1
}

/**
 * Advanced 1D Bin Packing (Best Fit Decreasing)
 * Prioritizes:
 * 1. Remnants (Offcuts) - Best Fit
 * 2. Existing Inventory (Full Bars) - Best Fit
 * 3. New Stock (Standard Length)
 */
export function optimizeCuttingPlan(
    parts: OptimizationItem[],
    availableStock: StockInfo[],
    standardStockLength: number = 12000
): OptimizationResult {
    // 1. Flatten parts request into individual pieces
    let allPieces: { id: string, length: number }[] = []

    parts.forEach(p => {
        for (let i = 0; i < p.quantity; i++) {
            allPieces.push({ id: p.id, length: p.length })
        }
    })

    // 2. Sort pieces descending (Hardest to fit first)
    allPieces.sort((a, b) => b.length - a.length)

    // 3. Prepare Stock Bins
    // We treat each unit of stock as a separate bin for the algorithm
    let existingBins: {
        id: string
        type: 'INVENTORY' | 'REMNANT'
        length: number
        remaining: number
        parts: AllocatedPart[]
    }[] = []

    availableStock.forEach(s => {
        for (let i = 0; i < s.quantity; i++) {
            existingBins.push({
                id: s.id,
                type: s.type,
                length: s.length,
                remaining: s.length,
                parts: []
            })
        }
    })

    // Sort bins: We want to match Remnants first, then Inventory. 
    // Within type, Best Fit is done by finding smallest sufficient bin.
    // So we don't strictly need to sort bins by size here if we search correctly,
    // but sorting by size ascending helps "Best Fit" by taking the first match.
    // HOWEVER, we want REMNANTS checked before STOCK.
    existingBins.sort((a, b) => {
        if (a.type !== b.type) {
            return a.type === 'REMNANT' ? -1 : 1 // Remnants first
        }
        return a.length - b.length // Ascending length (Tightest fit)
    })

    // 4. Allocation Logic
    const usedBins = new Map<number, typeof existingBins[0]>() // Track used indices
    const newStockBins: { length: number, remaining: number, parts: AllocatedPart[] }[] = []
    const unallocated: OptimizationItem[] = []

    for (const piece of allPieces) {
        let assigned = false

        // A. Try Existing Stock (Remnants -> Inventory)
        // Best Fit: Find the bin with smallest 'remaining' that still fits the piece
        let bestBinIndex = -1
        let minRemainder = Number.MAX_VALUE

        for (let i = 0; i < existingBins.length; i++) {
            const bin = existingBins[i]

            // Check if fits
            if (bin.remaining >= piece.length) {
                const potentialRemainder = bin.remaining - piece.length

                // Prioritize Remnants over Inventory strictly
                // If we found a remnant candidate, only replace with another remnant
                // If we have an inventory candidate, a remnant is always better
                const currentBest = bestBinIndex !== -1 ? existingBins[bestBinIndex] : null

                let isBetter = false

                if (!currentBest) {
                    isBetter = true
                } else {
                    if (bin.type === 'REMNANT' && currentBest.type === 'INVENTORY') {
                        isBetter = true // Always prefer remnant
                    } else if (bin.type === 'INVENTORY' && currentBest.type === 'REMNANT') {
                        isBetter = false // Never prefer inventory over remnant
                    } else {
                        // Same type: prefer tighter fit (smaller remainder)
                        if (potentialRemainder < minRemainder) {
                            isBetter = true
                        }
                    }
                }

                if (isBetter) {
                    minRemainder = potentialRemainder
                    bestBinIndex = i
                }
            }
        }

        if (bestBinIndex !== -1) {
            const bin = existingBins[bestBinIndex]
            bin.remaining -= piece.length
            bin.parts.push({ partId: piece.id, length: piece.length })
            usedBins.set(bestBinIndex, bin) // Mark as used
            assigned = true
        }

        // B. Try New Stock
        if (!assigned) {
            // Check existing new stock bins first (First Fit / Best Fit)
            // For new stock, we just want to fill them up.
            let bestNewBinIndex = -1
            let minNewRem = Number.MAX_VALUE

            for (let i = 0; i < newStockBins.length; i++) {
                if (newStockBins[i].remaining >= piece.length) {
                    if (newStockBins[i].remaining < minNewRem) {
                        minNewRem = newStockBins[i].remaining
                        bestNewBinIndex = i
                    }
                }
            }

            if (bestNewBinIndex !== -1) {
                newStockBins[bestNewBinIndex].remaining -= piece.length
                newStockBins[bestNewBinIndex].parts.push({ partId: piece.id, length: piece.length })
                assigned = true
            } else {
                // Create NEW Bar
                if (piece.length > standardStockLength) {
                    // Cannot fit on standard bar
                    unallocated.push({ id: piece.id, length: piece.length, quantity: 1 })
                } else {
                    newStockBins.push({
                        length: standardStockLength,
                        remaining: standardStockLength - piece.length,
                        parts: [{ partId: piece.id, length: piece.length }]
                    })
                    assigned = true
                }
            }
        }
    }

    // 5. Compile Results
    const stockUsedResult: StockAllocation[] = Array.from(usedBins.values()).map(bin => ({
        stockId: bin.id,
        stockType: bin.type,
        originalLength: bin.length,
        usedLength: bin.length - bin.remaining,
        waste: bin.remaining,
        parts: bin.parts
    }))

    // Consolidate New Stock
    // We need to group identically packed bars?
    // For simplicity, we'll just return list of bars needed, but maybe aggregate simple counts if empty?
    // Actually, distinct packing matters for cutting instructions.
    // But for "Buying", we just need total length.
    // For "Material Prep WO", we need to know what to cut.
    // So distinct is better.
    // However, to keep the output clean, let's group exact matches if possible, or just list them.
    // The previous interface expected { length, quantity, parts }.
    // If multiple bars have same packing, we can group.

    const groupedNewStock: NewStockAllocation[] = []

    // Simple grouping by exact content is complex (multiset equality).
    // Let's just group by Standard Length for the "Quantity" field, but we might lose per-bar allocation detail?
    // No, the UI needs to show "Bar 1: [A, B]", "Bar 2: [C, D]".
    // Making quantity = 1 for all entries simplifies Logic so we can iterate efficiently.

    newStockBins.forEach(bin => {
        groupedNewStock.push({
            length: bin.length,
            quantity: 1,
            parts: bin.parts
        })
    })

    // Calculate Efficiency
    const totalUsedLength =
        stockUsedResult.reduce((acc, b) => acc + b.usedLength, 0) +
        newStockBins.reduce((acc, b) => acc + (b.length - b.remaining), 0)

    const totalMaterialLength =
        stockUsedResult.reduce((acc, b) => acc + b.originalLength, 0) +
        newStockBins.reduce((acc, b) => acc + b.length, 0)

    const efficiency = totalMaterialLength > 0 ? totalUsedLength / totalMaterialLength : 0

    return {
        stockUsed: stockUsedResult,
        newStockNeeded: groupedNewStock,
        unallocated,
        efficiency
    }
}
