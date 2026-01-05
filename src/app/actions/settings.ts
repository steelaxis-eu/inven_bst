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
        const settings = await getGlobalSettings()
        const now = new Date()
        const year = now.getFullYear().toString()
        const yy = year.slice(-2)
        const month = (now.getMonth() + 1).toString().padStart(2, '0')
        const day = now.getDate().toString().padStart(2, '0')

        let format = ''
        let seq = 1
        let updateField = ''

        switch (type) {
            case 'NCR':
                format = settings.ncrFormat
                seq = settings.ncrNextSeq
                updateField = 'ncrNextSeq'
                break
            case 'LOT':
                format = settings.lotFormat
                seq = settings.lotNextSeq
                updateField = 'lotNextSeq'
                break
            case 'PROJECT':
                format = settings.projectFormat
                seq = settings.projectNextSeq
                updateField = 'projectNextSeq'
                break
        }

        // Format Sequence (padding to at least 3 digits if not specified, or just simplistic)
        // User format example: "NCR-{YYYY}-{SEQ}"

        // Simple Replacements
        let id = format
            .replace('{YYYY}', year)
            .replace('{YY}', yy)
            .replace('{MM}', month)
            .replace('{DD}', day)
            .replace('{SEQ}', seq.toString().padStart(3, '0')) // Default 3 digit padding

        // Increment sequence atomically (attempt)
        await prisma.globalSettings.update({
            where: { id: 'settings' },
            data: { [updateField]: { increment: 1 } }
        })

        return id

    } catch (e) {
        console.error(`Failed to generate ID for ${type}:`, e)
        throw new Error(`Failed to generate ${type} ID`)
    }
}
