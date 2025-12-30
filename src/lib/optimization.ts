export interface OptimizationItem {
    id: string
    length: number
    quantity: number
}

export interface StockInfo {
    id: string
    length: number
    quantity: number
}

export interface OptimizationResult {
    stockUsed: {
        stockId: string
        parts: { id: string, length: number }[]
        waste: number
    }[]
    newStockNeeded: {
        length: number // e.g. 6000 or 12000
        quantity: number
        parts: { id: string, length: number }[]
    }[]
    unallocatedParts: OptimizationItem[]
}

/**
 * 1D Bin Packing (Best Fit Decreasing)
 */
export function optimizeCuttingPlan(
    parts: OptimizationItem[],
    availableStock: StockInfo[],
    standardStockLength: number = 12000
): OptimizationResult {
    // 1. Flatten parts
    let allParts: { id: string, length: number }[] = []
    parts.forEach(p => {
        for (let i = 0; i < p.quantity; i++) {
            allParts.push({ id: p.id, length: p.length })
        }
    })

    // Sort parts descending (longer parts are hardest to fit)
    allParts.sort((a, b) => b.length - a.length)

    // Prepare Stock bins
    let stockBins = availableStock.map(s => ({
        id: s.id,
        maxLength: s.length,
        remaining: s.length,
        parts: [] as { id: string, length: number }[],
        isUsed: false
    }))

    // Sort stock bins? Maybe smallest sufficient first to use up remnants?
    // Best fit strategy: find the smallest bin that fits the item to minimize waste on used bins
    // But we might want to prioritize Remnants over Full Bars?
    // Assuming availableStock is passed in preferred order (e.g. Remnants first)

    const result: OptimizationResult = {
        stockUsed: [],
        newStockNeeded: [],
        unallocatedParts: []
    }

    // New Stock Tracking (Virtual Bins)
    const newStockBins: { length: number, remaining: number, parts: { id: string, length: number }[] }[] = []

    // Allocation
    for (const part of allParts) {
        let assigned = false

        // 1. Try Existing Stock
        // Find best fit: smallest remaining space that is >= part.length
        let bestBinIndex = -1
        let minRem = Number.MAX_VALUE

        for (let i = 0; i < stockBins.length; i++) {
            if (stockBins[i].remaining >= part.length) {
                if (stockBins[i].remaining < minRem) {
                    minRem = stockBins[i].remaining
                    bestBinIndex = i
                }
            }
        }

        if (bestBinIndex !== -1) {
            stockBins[bestBinIndex].remaining -= part.length
            stockBins[bestBinIndex].parts.push(part)
            stockBins[bestBinIndex].isUsed = true
            assigned = true
        }

        // 2. Try New Stock if not assigned
        if (!assigned) {
            // Try best fit in existing New Stock bins
            bestBinIndex = -1
            minRem = Number.MAX_VALUE

            for (let i = 0; i < newStockBins.length; i++) {
                if (newStockBins[i].remaining >= part.length) {
                    if (newStockBins[i].remaining < minRem) {
                        minRem = newStockBins[i].remaining
                        bestBinIndex = i
                    }
                }
            }

            if (bestBinIndex !== -1) {
                newStockBins[bestBinIndex].remaining -= part.length
                newStockBins[bestBinIndex].parts.push(part)
            } else {
                // Create new Bar
                if (part.length > standardStockLength) {
                    // Part too long for standard stock - add as unallocated or need special order
                    // For now, assume special order of exact length or warn?
                    // Let's create a custom length bin equal to part
                    newStockBins.push({
                        length: part.length,
                        remaining: 0,
                        parts: [part]
                    })
                } else {
                    newStockBins.push({
                        length: standardStockLength,
                        remaining: standardStockLength - part.length,
                        parts: [part]
                    })
                }
            }
        }
    }

    // Compile Result
    result.stockUsed = stockBins
        .filter(b => b.isUsed)
        .map(b => ({
            stockId: b.id,
            parts: b.parts,
            waste: b.remaining
        }))

    // Group new stock needed
    // Simple aggregation: We just list the bins we created
    // We can group by length if needed? 
    // The requirement says "outputs pieces needed". 
    // Usually buying list is "5x 12m".

    // Let's verify if we need to group. Ideally yes.
    const groupedNewStock: Record<number, { count: number, parts: { id: string, length: number }[] }> = {}

    newStockBins.forEach(bin => {
        if (!groupedNewStock[bin.length]) {
            groupedNewStock[bin.length] = { count: 0, parts: [] }
        }
        groupedNewStock[bin.length].count++
        groupedNewStock[bin.length].parts.push(...bin.parts)
    })

    result.newStockNeeded = Object.entries(groupedNewStock).map(([len, data]) => ({
        length: Number(len),
        quantity: data.count,
        parts: data.parts
    }))

    return result
}
