/**
 * CSV/Excel Parser Utility for Inventory Import
 */

import * as XLSX from 'xlsx'

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
    invoiceNumber?: string
    valid: boolean
    errors: string[]
}

export interface ParseResult {
    rows: ParsedInventoryRow[]
    totalValid: number
    totalInvalid: number
}

const HEADERS = ['LotID', 'ProfileType', 'Dimensions', 'Grade', 'Length(mm)', 'Quantity', 'TotalCost', 'Certificate', 'Supplier', 'InvoiceNumber']

/**
 * Generate a CSV template for inventory import
 */
export function generateCSVTemplate(): string {
    const exampleRow = ['LOT-001', 'HEA', '200', 'S355', '6000', '10', '1500.00', 'cert-001.pdf', 'SteelCorp', 'INV-2024-001']

    return [
        HEADERS.join(','),
        exampleRow.join(','),
        '# Add your rows below (delete this line)',
    ].join('\n')
}

/**
 * Generate an Excel (.xlsx) template for inventory import
 */
export function generateExcelTemplate(): Uint8Array {
    const wb = XLSX.utils.book_new()

    const exampleData = [
        HEADERS,
        ['LOT-001', 'HEA', '200', 'S355', 6000, 10, 1500.00, 'cert-001.pdf', 'SteelCorp', 'INV-2024-001'],
        ['LOT-002', 'IPE', '300', 'S235', 12000, 5, 2400.00, '', '', 'INV-2024-001'],
    ]

    const ws = XLSX.utils.aoa_to_sheet(exampleData)

    // Set column widths
    ws['!cols'] = [
        { wch: 12 }, // LotID
        { wch: 12 }, // ProfileType
        { wch: 12 }, // Dimensions
        { wch: 8 },  // Grade
        { wch: 12 }, // Length
        { wch: 8 },  // Quantity
        { wch: 12 }, // TotalCost
        { wch: 20 }, // Certificate
        { wch: 15 }, // Supplier
        { wch: 15 }, // InvoiceNumber
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'Inventory')

    return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as Uint8Array
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

    const parsedRows = dataLines.map(line => parseRowFromArray(parseCSVLine(line)))

    return {
        rows: parsedRows,
        totalValid: parsedRows.filter(r => r.valid).length,
        totalInvalid: parsedRows.filter(r => !r.valid).length
    }
}

/**
 * Parse Excel file into inventory rows
 */
export function parseExcel(data: ArrayBuffer): ParseResult {
    const wb = XLSX.read(data, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })

    // Skip header row
    const dataRows = rows.slice(1).filter(row => row.length > 0 && row[0])

    const parsedRows = dataRows.map(row => parseRowFromArray(row.map(c => String(c ?? ''))))

    return {
        rows: parsedRows,
        totalValid: parsedRows.filter(r => r.valid).length,
        totalInvalid: parsedRows.filter(r => !r.valid).length
    }
}

/**
 * Parse a row from array of values
 */
function parseRowFromArray(cols: string[]): ParsedInventoryRow {
    const errors: string[] = []

    const lotId = cols[0]?.trim() || ''
    const profileType = cols[1]?.trim() || ''
    const dimensions = cols[2]?.trim() || ''
    const grade = cols[3]?.trim() || ''
    const lengthMm = parseFloat(cols[4]?.trim() || '0')
    const quantity = parseInt(cols[5]?.trim() || '0', 10)
    const totalCost = parseFloat(cols[6]?.trim() || '0')
    const certificate = cols[7]?.trim() || ''
    const supplier = cols[8]?.trim() || undefined
    const invoiceNumber = cols[9]?.trim() || undefined

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
        invoiceNumber,
        valid: errors.length === 0,
        errors
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
