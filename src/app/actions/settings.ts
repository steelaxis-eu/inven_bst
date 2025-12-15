'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function getSettings() {
    let settings = await (prisma as any).globalSettings.findUnique({ where: { id: 'settings' } })
    if (!settings) {
        settings = await (prisma as any).globalSettings.create({
            data: { id: 'settings' }
        })
    }
    return settings
}

export async function updateSettings(scrapPricePerKg: number) {
    await (prisma as any).globalSettings.upsert({
        where: { id: 'settings' },
        create: { id: 'settings' },
        update: {}
    })
    revalidatePath('/settings')
    revalidatePath('/projects')
}
