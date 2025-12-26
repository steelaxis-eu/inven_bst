'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function createCustomer(data: {
    companyName: string
    contactName?: string
    contactEmail?: string
    contactPhone?: string
    address?: string
}) {
    try {
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
        await prisma.customer.delete({ where: { id } })
        revalidatePath('/customers')
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}
