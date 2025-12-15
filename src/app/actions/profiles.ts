'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function getSteelProfiles() {
    return await prisma.steelProfile.findMany({
        orderBy: { type: 'asc' }
    })
}

export async function createSteelProfile(data: { type: string, dimensions: string, weightPerMeter: number }) {
    try {
        const profile = await prisma.steelProfile.create({
            data: {
                type: data.type,
                dimensions: data.dimensions,
                weightPerMeter: data.weightPerMeter,
            }
        })
        revalidatePath('/settings/profiles')
        return { success: true, profile }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function updateSteelProfile(id: string, data: { type: string, dimensions: string, weightPerMeter: number }) {
    try {
        const profile = await prisma.steelProfile.update({
            where: { id },
            data: {
                type: data.type,
                dimensions: data.dimensions,
                weightPerMeter: data.weightPerMeter,
            }
        })
        revalidatePath('/settings/profiles')
        return { success: true, profile }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function deleteSteelProfile(id: string) {
    try {
        await prisma.steelProfile.delete({
            where: { id }
        })
        revalidatePath('/settings/profiles')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}
