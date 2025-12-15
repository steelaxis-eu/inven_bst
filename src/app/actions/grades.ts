'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function updateGrade(id: string, data: { density: number, scrapPrice: number }) {
    try {
        await prisma.materialGrade.update({
            where: { id },
            data: {
                density: data.density,
                scrapPrice: data.scrapPrice
            }
        })
        revalidatePath('/settings')
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}
