'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

// ============================================================================
// SETTINGS
// ============================================================================

export async function getGlobalSettings() {
    let settings = await prisma.globalSettings.findUnique({
        where: { id: 'settings' }
    })

    if (!settings) {
        settings = await prisma.globalSettings.create({
            data: { id: 'settings' }
        })
    }

    return settings
}

// Alias for compatibility
export const getSettings = getGlobalSettings

export async function updateGlobalSettings(data: {
    ncrFormat?: string
    ncrNextSeq?: number
    lotFormat?: string
    lotNextSeq?: number
    projectFormat?: string
    projectNextSeq?: number
    scrapPricePerKg?: number
}) {
    try {
        await prisma.globalSettings.upsert({
            where: { id: 'settings' },
            update: data,
            create: { id: 'settings', ...data }
        })
        revalidatePath('/settings')
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

// ============================================================================
// ID GENERATION
// ============================================================================

export async function generateNextId(type: 'NCR' | 'LOT' | 'PROJECT') {
    try {
        // Determine fields
        let seqField = ''
        let formatField = ''

        switch (type) {
            case 'NCR': seqField = 'ncrNextSeq'; formatField = 'ncrFormat'; break;
            case 'LOT': seqField = 'lotNextSeq'; formatField = 'lotFormat'; break;
            case 'PROJECT': seqField = 'projectNextSeq'; formatField = 'projectFormat'; break;
        }

        // Atomic update: increment and get new value
        // "NextSeq" in DB usually means the value to be used for the next item. 
        // We will increment by 1, and the value we *should* use is the one *before* the increment (the matching logic of previous code),
        // OR we consider the DB value as "last used". 
        // Looking at previous code: seq = settings.ncrNextSeq; ... update ... increment: 1.
        // So it used the value currently in DB.

        // To do this atomically: We increment, get the NEW value, and subtract 1 to get the value we "claimed".
        const updated = await prisma.globalSettings.update({
            where: { id: 'settings' },
            data: { [seqField]: { increment: 1 } },
            select: { [seqField]: true, [formatField]: true }
        })

        // @ts-ignore - Dynamic access
        const nextSeq = (updated[seqField] as number) - 1
        // @ts-ignore
        const format = updated[formatField] as string

        const now = new Date()
        const year = now.getFullYear().toString()
        const yy = year.slice(-2)
        const month = (now.getMonth() + 1).toString().padStart(2, '0')
        const day = now.getDate().toString().padStart(2, '0')

        return format
            .replace('{YYYY}', year)
            .replace('{YY}', yy)
            .replace('{MM}', month)
            .replace('{DD}', day)
            .replace('{SEQ}', nextSeq.toString().padStart(3, '0'))

    } catch (e) {
        console.error(`Failed to generate ID for ${type}:`, e)
        throw new Error(`Failed to generate ${type} ID`)
    }
}

/**
 * Reserve a batch of IDs atomically
 * Used for bulk creation to avoid N+1 DB calls
 */
export async function reserveIds(type: 'NCR' | 'LOT' | 'PROJECT', count: number) {
    try {
        let seqField = ''
        let formatField = ''

        switch (type) {
            case 'NCR': seqField = 'ncrNextSeq'; formatField = 'ncrFormat'; break;
            case 'LOT': seqField = 'lotNextSeq'; formatField = 'lotFormat'; break;
            case 'PROJECT': seqField = 'projectNextSeq'; formatField = 'projectFormat'; break;
        }

        // Atomic update: increment by count
        const updated = await prisma.globalSettings.update({
            where: { id: 'settings' },
            data: { [seqField]: { increment: count } },
            select: { [seqField]: true, [formatField]: true }
        })

        // @ts-ignore
        const endSeq = (updated[seqField] as number)
        // @ts-ignore
        const format = updated[formatField] as string // Format might be needed by caller, but usually caller just wants IDs.

        // The range reserved is [endSeq - count, endSeq - 1]
        // Assuming the DB value was "next available".
        // Example: DB=1. Reserve 5. DB becomes 6.
        // We own 1, 2, 3, 4, 5.
        // Start = 6 - 5 = 1.

        const startSeq = endSeq - count

        return { startSeq, count, format }

    } catch (e) {
        console.error(`Failed to reserve IDs for ${type}:`, e)
        throw new Error(`Failed to reserve ${type} IDs`)
    }
}
