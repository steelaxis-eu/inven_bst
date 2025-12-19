/**
 * CSV Parser Utility for Inventory Import
 */

export interface ParsedInventoryRow {
    lotId: string
    profileType: string
    dimensions: string
    grade: string
    lengthMm: number
    quantity: number
    totalCost: number
    certificate: string
    supplier?: string
    valid: boolean
    errors: string[]
}

export interface ParseResult {
    rows: ParsedInventoryRow[]
    totalValid: number
    totalInvalid: number
}

/**
 * Generate a CSV template for inventory import
 */
export function generateCSVTemplate(): string {
    const headers = ['LotID', 'ProfileType', 'Dimensions', 'Grade', 'Length(mm)', 'Quantity', 'TotalCost', 'Certificate', 'Supplier']
    const exampleRow = ['LOT-001', 'HEA', '200', 'S355', '6000', '10', '1500.00', 'cert-001.pdf', 'SteelCorp']

    return [
        headers.join(','),
        exampleRow.join(','),
        '# Add your rows below (delete this line)',
    ].join('\n')
}

/**
 * Parse CSV text into inventory rows
 */
export function parseCSV(csvText: string): ParseResult {
    const lines = csvText.trim().split('\n')

    // Skip header and comment lines
    const dataLines = lines.filter((line, idx) => {
        if (idx === 0) return false // Header
        if (line.trim().startsWith('#')) return false // Comment
        if (!line.trim()) return false // Empty
        return true
    })

    const rows: ParsedInventoryRow[] = dataLines.map(line => {
        const cols = parseCSVLine(line)
        const errors: string[] = []

        // Extract values
        const lotId = cols[0]?.trim() || ''
        const profileType = cols[1]?.trim() || ''
        const dimensions = cols[2]?.trim() || ''
        const grade = cols[3]?.trim() || ''
        const lengthMm = parseFloat(cols[4]?.trim() || '0')
        const quantity = parseInt(cols[5]?.trim() || '0', 10)
        const totalCost = parseFloat(cols[6]?.trim() || '0')
        const certificate = cols[7]?.trim() || ''
        const supplier = cols[8]?.trim() || undefined

        // Validate
        if (!lotId) errors.push('LotID is required')
        if (!profileType) errors.push('ProfileType is required')
        if (!dimensions) errors.push('Dimensions is required')
        if (!grade) errors.push('Grade is required')
        if (isNaN(lengthMm) || lengthMm <= 0) errors.push('Length must be a positive number')
        if (isNaN(quantity) || quantity <= 0) errors.push('Quantity must be a positive integer')
        if (isNaN(totalCost) || totalCost < 0) errors.push('TotalCost must be a non-negative number')

        return {
            lotId,
            profileType,
            dimensions,
            grade,
            lengthMm,
            quantity,
            totalCost,
            certificate,
            supplier,
            valid: errors.length === 0,
            errors
        }
    })

    return {
        rows,
        totalValid: rows.filter(r => r.valid).length,
        totalInvalid: rows.filter(r => !r.valid).length
    }
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
        const char = line[i]

        if (char === '"') {
            inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
            result.push(current)
            current = ''
        } else {
            current += char
        }
    }

    result.push(current)
    return result
}
