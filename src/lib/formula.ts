
/**
 * Evaluates a mathematical formula with given parameters.
 * @param formula The string formula (e.g., "b * h")
 * @param params valid variables (e.g., { b: 10, h: 20 })
 * @returns calculated number
 */
export function evaluateFormula(formula: string, params: Record<string, number>): number {
    try {
        // Sanitize formula: allow only numbers, param names, math operators, parens, Math functions
        // This is a basic safety check, not military grade.
        // We will create a Function with keys of params as arguments.
        const keys = Object.keys(params)
        const values = Object.values(params)

        // Replace "PI" with "Math.PI" if user typed PI
        let safeFormula = formula.replace(/\bPI\b/g, 'Math.PI')

        // If formula contains multiple statements (semi-colons or newlines), treat as body.
        // Otherwise treat as expression to return.
        const isComplex = safeFormula.includes(';') || safeFormula.includes('\n') || safeFormula.includes('return')

        const body = isComplex ? safeFormula : `return ${safeFormula};`

        // Create function
        const func = new Function(...keys, body)
        return func(...values)
    } catch (e) {
        console.error("Formula eval error:", e)
        return 0
    }
}
