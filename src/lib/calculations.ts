/**
 * Calculation Utilities
 * Centralized functions for cost and ID calculations
 */

import Decimal from 'decimal.js'

/**
 * Calculate cost for a given length and cost per meter
 * @param lengthMm - Length in millimeters
 * @param costPerMeter - Cost per meter
 * @returns Cost rounded to 2 decimal places
 */
export function calculateCost(lengthMm: number, costPerMeter: number): number {
    if (costPerMeter <= 0 || lengthMm <= 0) return 0
    const lengthM = new Decimal(lengthMm).dividedBy(1000)
    return lengthM.times(costPerMeter).toDecimalPlaces(2).toNumber()
}

/**
 * Calculate cost per meter from total cost and dimensions
 * @param totalCost - Total cost
 * @param lengthMm - Length per piece in millimeters
 * @param quantity - Number of pieces
 * @returns Cost per meter
 */
export function calculateCostPerMeter(totalCost: number, lengthMm: number, quantity: number): number {
    if (totalCost <= 0 || lengthMm <= 0 || quantity <= 0) return 0
    const totalLengthM = new Decimal(lengthMm).times(quantity).dividedBy(1000)
    if (totalLengthM.isZero()) return 0
    return new Decimal(totalCost).dividedBy(totalLengthM).toDecimalPlaces(4).toNumber()
}

/**
 * Generate a consistent remnant ID
 * @param rootLotId - Original lot ID
 * @param lengthMm - Remaining length in millimeters
 * @returns Formatted remnant ID
 */
export function generateRemnantId(rootLotId: string, lengthMm: number): string {
    return `${rootLotId}-${Math.floor(lengthMm)}`
}

/**
 * Calculate estimated length from cost
 * @param cost - Cost value
 * @param costPerMeter - Cost per meter
 * @returns Length in millimeters
 */
export function estimateLengthFromCost(cost: number, costPerMeter: number): number {
    if (cost <= 0 || costPerMeter <= 0) return 0
    return new Decimal(cost).dividedBy(costPerMeter).times(1000).toNumber()
}

/**
 * Calculate weight for a given length
 * @param lengthMm - Length in millimeters
 * @param weightPerMeter - Weight per meter in kg
 * @returns Weight in kg
 */
export function calculateWeight(lengthMm: number, weightPerMeter: number): number {
    if (lengthMm <= 0 || weightPerMeter <= 0) return 0
    const lengthM = new Decimal(lengthMm).dividedBy(1000)
    return lengthM.times(weightPerMeter).toDecimalPlaces(2).toNumber()
}

/**
 * Format a number to a fixed number of decimal places for display
 * @param value - Number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted number
 */
export function formatNumber(value: number, decimals: number = 2): number {
    return new Decimal(value).toDecimalPlaces(decimals).toNumber()
}
