'use server'

import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function createCustomer(data: {
    companyName: string
    contactName?: string
    contactEmail?: string
    contactPhone?: string
    address?: string
}) {
    try {
        const user = await getCurrentUser()
        if (!user) return { success: false, error: 'Unauthorized' }

        const customer = await prisma.customer.create({
            data
        })
        revalidatePath('/customers')
        revalidatePath('/projects') // Projects dropdown needs update
        return { success: true, customer }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

export async function getCustomers() {
    return await prisma.customer.findMany({
        orderBy: { companyName: 'asc' }
    })
}

export async function deleteCustomer(id: string) {
    try {
        const user = await getCurrentUser()
        if (!user) return { success: false, error: 'Unauthorized' }

        await prisma.customer.delete({ where: { id } })
        revalidatePath('/customers')
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}
