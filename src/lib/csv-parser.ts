/**
 * CSV/Excel Parser Utility for Inventory Import
 */

import ExcelJS from 'exceljs'

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
export async function generateExcelTemplate(): Promise<Uint8Array> {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Inventory')

    // Add Headers
    worksheet.addRow(HEADERS)

    // Add Example Rows
    worksheet.addRow(['LOT-001', 'HEA', '200', 'S355', 6000, 10, 1500.00, 'cert-001.pdf', 'SteelCorp', 'INV-2024-001'])
    worksheet.addRow(['LOT-002', 'IPE', '300', 'S235', 12000, 5, 2400.00, '', '', 'INV-2024-001'])

    // Set column widths
    const colWidths = [12, 12, 12, 8, 12, 8, 12, 20, 15, 15]
    worksheet.columns.forEach((col, idx) => {
        if (col && idx < colWidths.length) {
            col.width = colWidths[idx]
        }
    })

    const buffer = await workbook.xlsx.writeBuffer()
    return new Uint8Array(buffer)
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
export async function parseExcel(data: ArrayBuffer): Promise<ParseResult> {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(data)

    // Get first worksheet
    const worksheet = workbook.worksheets[0]
    if (!worksheet) {
        return { rows: [], totalValid: 0, totalInvalid: 0 }
    }

    const rows: string[][] = []

    worksheet.eachRow((row, rowNumber) => {
        // Skip header row usually row 1
        if (rowNumber === 1) return

        const rowValues: string[] = []
        // Iterate cells 1 to max column
        for (let i = 1; i <= row.cellCount || i <= 10; i++) {
            const cell = row.getCell(i)
            // .text or .value could be used. .text gives string representation formatted
            // value might be object for hyperlinks etc. safe to use toString or text ?
            // For simple data imports, text or value works. 
            // exceljs .value can be null.
            const val = cell.value
            if (val === null || val === undefined) {
                rowValues.push('')
            } else if (typeof val === 'object') {
                // handle potential rich text or hyperlinks
                if ('text' in val) rowValues.push((val as any).text)
                else if ('result' in val) rowValues.push(String((val as any).result))
                else rowValues.push(String(val))
            } else {
                rowValues.push(String(val))
            }
        }

        // Only add if not completely empty
        if (rowValues.some(v => v.trim() !== '')) {
            rows.push(rowValues)
        }
    })

    const parsedRows = rows.map(row => parseRowFromArray(row))

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
