'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function getProfileShapes() {
    return await prisma.profileShape.findMany({
        orderBy: { id: 'asc' }
    })
}

export async function createProfileShape(data: { id: string, name: string, params: string[], formula: string }) {
    try {
        const shape = await prisma.profileShape.create({
            data: {
                id: data.id,
                name: data.name,
                params: data.params, // Prisma handles string[] -> Json/string[] automatically mostly, but strictly Json is expected.
                formula: data.formula
            }
        })
        revalidatePath('/settings/shapes')
        return { success: true, shape }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function updateProfileShape(id: string, data: { name: string, params: string[], formula: string }) {
    try {
        const shape = await prisma.profileShape.update({
            where: { id },
            data: {
                name: data.name,
                params: data.params,
                formula: data.formula
            }
        })
        revalidatePath('/settings/shapes')
        return { success: true, shape }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function deleteProfileShape(id: string) {
    try {
        await prisma.profileShape.delete({
            where: { id }
        })
        revalidatePath('/settings/shapes')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}
