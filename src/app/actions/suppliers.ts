'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function getSuppliers() {
    return await prisma.supplier.findMany({
        orderBy: { name: 'asc' }
    })
}

export async function getSupplier(id: string) {
    return await prisma.supplier.findUnique({
        where: { id },
        include: {
            inventory: {
                include: { profile: true, grade: true }
            }
        }
    })
}

export async function createSupplier(data: {
    name: string
    code?: string
    contact?: string
    email?: string
    phone?: string
    notes?: string
}) {
    try {
        if (!data.name?.trim()) {
            return { success: false, error: 'Supplier name is required' }
        }

        const supplier = await prisma.supplier.create({
            data: {
                name: data.name.trim(),
                code: data.code?.trim() || null,
                contact: data.contact?.trim() || null,
                email: data.email?.trim() || null,
                phone: data.phone?.trim() || null,
                notes: data.notes?.trim() || null
            }
        })

        revalidatePath('/settings')
        return { success: true, data: supplier }
    } catch (e: any) {
        if (e.code === 'P2002') {
            return { success: false, error: 'A supplier with this name already exists' }
        }
        return { success: false, error: e.message }
    }
}

export async function updateSupplier(id: string, data: {
    name?: string
    code?: string
    contact?: string
    email?: string
    phone?: string
    notes?: string
}) {
    try {
        const supplier = await prisma.supplier.update({
            where: { id },
            data: {
                ...(data.name && { name: data.name.trim() }),
                code: data.code?.trim() || null,
                contact: data.contact?.trim() || null,
                email: data.email?.trim() || null,
                phone: data.phone?.trim() || null,
                notes: data.notes?.trim() || null
            }
        })

        revalidatePath('/settings')
        return { success: true, data: supplier }
    } catch (e: any) {
        if (e.code === 'P2002') {
            return { success: false, error: 'A supplier with this name already exists' }
        }
        return { success: false, error: e.message }
    }
}

export async function deleteSupplier(id: string) {
    try {
        // Check if supplier has any inventory linked
        const inventoryCount = await prisma.inventory.count({
            where: { supplierId: id }
        })

        if (inventoryCount > 0) {
            return {
                success: false,
                error: `Cannot delete supplier: ${inventoryCount} inventory item(s) are linked to this supplier`
            }
        }

        await prisma.supplier.delete({ where: { id } })
        revalidatePath('/settings')
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}
