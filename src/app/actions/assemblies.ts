'use server'

import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { AssemblyStatus, PartPieceStatus, PlatePieceStatus } from '@prisma/client'

// ============================================================================
// ASSEMBLY CRUD
// ============================================================================

export interface CreateAssemblyInput {
    projectId: string
    assemblyNumber: string
    name: string
    description?: string
    parentId?: string
    sequence?: number
    scheduledDate?: Date
    notes?: string
    quantity?: number
    bom?: { partNumber: string; quantity: number }[]
    drawingRef?: string
}

/**
 * Create a new assembly
 */
export async function createAssembly(input: CreateAssemblyInput) {
    try {
        const user = await getCurrentUser()
        if (!user) return { success: false, error: 'Unauthorized' }

        const { projectId, assemblyNumber, name, quantity = 1, bom, drawingRef, ...rest } = input

        if (!projectId || !assemblyNumber || !name) {
            return { success: false, error: 'Missing required fields' }
        }

        const result = await prisma.$transaction(async (tx) => {
            // Create Assembly
            const assembly = await tx.assembly.create({
                data: {
                    projectId,
                    assemblyNumber,
                    name,
                    quantity,
                    ...rest
                }
            })

            // Link Drawing if provided
            if (drawingRef) {
                const filename = drawingRef.split('/').pop() || 'drawing.pdf'
                await tx.projectDocument.create({
                    data: {
                        projectId,
                        assemblyId: assembly.id,
                        type: 'DRAWING',
                        filename,
                        storagePath: drawingRef,
                        uploadedBy: 'System',
                        description: 'Imported Assembly Drawing'
                    }
                })
            }

            // Create Pieces (Instances)
            if (quantity > 0) {
                const pieces = Array.from({ length: quantity }, (_, i) => ({
                    assemblyId: assembly.id,
                    pieceNumber: i + 1,
                    status: AssemblyStatus.PENDING
                }))
                await tx.assemblyPiece.createMany({ data: pieces })
            }

            // LINK BOM PARTS
            if (bom && bom.length > 0) {
                // Pre-fetch all project parts for matching to avoid N queries
                const projectParts = await tx.part.findMany({
                    where: { projectId },
                    select: { id: true, partNumber: true }
                })

                const projectPlates = await (tx as any).platePart.findMany({
                    where: { projectId },
                    select: { id: true, partNumber: true }
                })

                // Helper for normalization
                const normalizeSimple = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
                const normalizeAdvanced = (s: string) => {
                    let cleaned = s.toLowerCase()
                    // Remove "part", "pos", "item", "no" prefixes (with optional dot/space)
                    cleaned = cleaned.replace(/^(part|pos|item|no)\.?\s*/, '')
                    // Remove "p", "a" prefixes ONLY if followed by separator (e.g. P-101, A_200)
                    cleaned = cleaned.replace(/^(p|a)[-._\s]+/, '')
                    return cleaned.replace(/[^a-z0-9]/g, '')
                }

                for (const item of bom) {
                    const itemSimple = normalizeSimple(item.partNumber)
                    const itemAdv = normalizeAdvanced(item.partNumber)

                    // 1. Try finding in Parts
                    // We try strict match first, then loose match
                    let matchedPart = projectParts.find(p => p.partNumber === item.partNumber)
                    if (!matchedPart) matchedPart = projectParts.find(p => normalizeSimple(p.partNumber) === itemSimple)
                    if (!matchedPart) matchedPart = projectParts.find(p => normalizeAdvanced(p.partNumber) === itemSimple)
                    if (!matchedPart) matchedPart = projectParts.find(p => normalizeSimple(p.partNumber) === itemAdv)
                    if (!matchedPart) matchedPart = projectParts.find(p => normalizeAdvanced(p.partNumber) === itemAdv)

                    if (matchedPart) {
                        console.log(`Matched Assembly Part: ${item.partNumber} -> ${matchedPart.partNumber}`)
                        await tx.assemblyPart.create({
                            data: {
                                assemblyId: assembly.id,
                                partId: matchedPart.id,
                                quantityInAssembly: item.quantity
                            }
                        })
                        // Increment part quantity
                        const totalNeeded = item.quantity * quantity
                        if (totalNeeded > 0) {
                            await tx.part.update({
                                where: { id: matchedPart.id },
                                data: { quantity: { increment: totalNeeded } }
                            })
                            // Create pieces
                            const partData = await tx.part.findUnique({ where: { id: matchedPart.id }, include: { pieces: { select: { pieceNumber: true } } } })
                            if (partData) {
                                const maxNum = partData.pieces.reduce((max, p) => p.pieceNumber > max ? p.pieceNumber : max, 0)
                                const newPieces = Array.from({ length: totalNeeded }, (_, i) => ({
                                    partId: matchedPart.id,
                                    pieceNumber: maxNum + i + 1,
                                    status: PartPieceStatus.PENDING
                                }))
                                await tx.partPiece.createMany({ data: newPieces })
                            }
                        }
                        continue;
                    }

                    // 2. Try finding in PlateParts
                    let matchedPlate = projectPlates.find((p: any) => p.partNumber === item.partNumber)
                    if (!matchedPlate) matchedPlate = projectPlates.find((p: any) => normalizeSimple(p.partNumber) === itemSimple)
                    if (!matchedPlate) matchedPlate = projectPlates.find((p: any) => normalizeAdvanced(p.partNumber) === itemSimple)
                    if (!matchedPlate) matchedPlate = projectPlates.find((p: any) => normalizeSimple(p.partNumber) === itemAdv)
                    if (!matchedPlate) matchedPlate = projectPlates.find((p: any) => normalizeAdvanced(p.partNumber) === itemAdv)

                    if (matchedPlate) {
                        console.log(`Matched Assembly Plate: ${item.partNumber} -> ${matchedPlate.partNumber}`)
                        await tx.plateAssemblyPart.create({
                            data: {
                                assemblyId: assembly.id,
                                platePartId: matchedPlate.id,
                                quantityInAssembly: item.quantity
                            }
                        })
                        // Increment plate quantity
                        const totalNeeded = item.quantity * quantity
                        if (totalNeeded > 0) {
                            await tx.platePart.update({
                                where: { id: matchedPlate.id },
                                data: { quantity: { increment: totalNeeded } }
                            })
                            // Create pieces
                            const plateData = await (tx as any).platePart.findUnique({ where: { id: matchedPlate.id }, include: { pieces: { select: { pieceNumber: true } } } })
                            if (plateData) {
                                const maxNum = plateData.pieces.reduce((max: number, p: any) => p.pieceNumber > max ? p.pieceNumber : max, 0)
                                const newPieces = Array.from({ length: totalNeeded }, (_, i) => ({
                                    platePartId: matchedPlate.id,
                                    pieceNumber: maxNum + i + 1,
                                    status: PlatePieceStatus.PENDING
                                }))
                                await tx.platePiece.createMany({ data: newPieces })
                            }
                        }
                        continue
                    }

                    console.log(`Failed to link BOM item: ${item.partNumber} in project ${projectId}`)
                }
            }

            return assembly
        })

        revalidatePath(`/projects/${projectId}`)
        return { success: true, data: result }

    } catch (e: any) {
        if (e.code === 'P2002') {
            return { success: false, error: 'Assembly number already exists in this project' }
        }
        console.error('createAssembly error:', e)
        return { success: false, error: e.message }
    }
}

/**
 * Get all assemblies for a project (hierarchical)
 */
export async function getProjectAssemblies(projectId: string) {
    const assemblies = await prisma.assembly.findMany({
        where: { projectId },
        include: {
            parent: true,
            children: true,
            pieces: {
                orderBy: { pieceNumber: 'asc' }
            },
            assemblyParts: {
                include: {
                    part: {
                        include: {
                            profile: true,
                            pieces: true
                        }
                    }
                }
            },
            plateAssemblyParts: {
                include: {
                    platePart: true
                }
            },
            deliveryItems: {
                include: {
                    deliverySchedule: true
                }
            }
        },
        orderBy: [
            { sequence: 'asc' },
            { assemblyNumber: 'asc' }
        ]
    })

    return assemblies
}

/**
 * Get a single assembly with all details
 */
export async function getAssembly(assemblyId: string) {
    return await prisma.assembly.findUnique({
        where: { id: assemblyId },
        include: {
            parent: true,
            pieces: {
                orderBy: { pieceNumber: 'asc' },
                include: { childPieces: true }
            },
            children: {
                include: {
                    assemblyParts: {
                        include: {
                            part: { include: { pieces: true } }
                        }
                    },
                    plateAssemblyParts: {
                        include: {
                            platePart: true
                        }
                    }
                }
            },
            assemblyParts: {
                include: {
                    part: {
                        include: {
                            profile: true,
                            grade: true,
                            pieces: true
                        }
                    }
                }
            },
            plateAssemblyParts: {
                include: {
                    platePart: true
                }
            }
        }
    })
}

/**
 * Update assembly details
 */
export async function updateAssembly(
    assemblyId: string,
    data: Partial<Omit<CreateAssemblyInput, 'projectId'>>
) {
    try {
        const user = await getCurrentUser()
        if (!user) return { success: false, error: 'Unauthorized' }

        const result = await prisma.$transaction(async (tx) => {
            const oldAssembly = await tx.assembly.findUnique({
                where: { id: assemblyId },
                include: {
                    assemblyParts: true,
                    plateAssemblyParts: true
                }
            })
            if (!oldAssembly) throw new Error('Assembly not found')

            const assembly = await tx.assembly.update({
                where: { id: assemblyId },
                data
            })

            // If quantity changed, adjust all parts
            if (data.quantity !== undefined && data.quantity !== oldAssembly.quantity) {
                const diff = data.quantity - oldAssembly.quantity

                // Adjust Profiles
                for (const ap of oldAssembly.assemblyParts) {
                    const totalDiff = diff * ap.quantityInAssembly
                    if (totalDiff === 0) continue

                    if (totalDiff > 0) {
                        // Increment
                        const part = await tx.part.findUnique({ where: { id: ap.partId }, include: { pieces: true } })
                        if (part) {
                            const maxNum = part.pieces.reduce((max, p) => p.pieceNumber > max ? p.pieceNumber : max, 0)
                            await tx.part.update({ where: { id: ap.partId }, data: { quantity: { increment: totalDiff } } })
                            const newPieces = Array.from({ length: totalDiff }, (_, i) => ({
                                partId: ap.partId,
                                pieceNumber: maxNum + i + 1,
                                status: PartPieceStatus.PENDING
                            }))
                            await tx.partPiece.createMany({ data: newPieces })
                        }
                    } else {
                        // Decrement (totalDiff is negative)
                        const amountToRemove = Math.abs(totalDiff)
                        await tx.part.update({ where: { id: ap.partId }, data: { quantity: { decrement: amountToRemove } } })
                        // Delete last N pieces (safest to delete from end? or unstarted?)
                        // We'll delete pieces with highest pieceNumber
                        const pieces = await tx.partPiece.findMany({
                            where: { partId: ap.partId },
                            orderBy: { pieceNumber: 'desc' },
                            take: amountToRemove
                        })
                        await tx.partPiece.deleteMany({ where: { id: { in: pieces.map(p => p.id) } } })
                    }
                }

                // Adjust Plates
                for (const pap of oldAssembly.plateAssemblyParts) {
                    const totalDiff = diff * pap.quantityInAssembly
                    if (totalDiff === 0) continue

                    if (totalDiff > 0) {
                        const plate = await (tx as any).platePart.findUnique({ where: { id: pap.platePartId }, include: { pieces: true } })
                        if (plate) {
                            const maxNum = (plate.pieces as any[]).reduce((max: number, p: any) => p.pieceNumber > max ? p.pieceNumber : max, 0)
                            await tx.platePart.update({ where: { id: pap.platePartId }, data: { quantity: { increment: totalDiff } } })
                            const newPieces = Array.from({ length: totalDiff }, (_, i) => ({
                                platePartId: pap.platePartId,
                                pieceNumber: maxNum + i + 1,
                                status: PlatePieceStatus.PENDING
                            }))
                            await (tx as any).platePiece.createMany({ data: newPieces })
                        }
                    } else {
                        const amountToRemove = Math.abs(totalDiff)
                        await tx.platePart.update({ where: { id: pap.platePartId }, data: { quantity: { decrement: amountToRemove } } })
                        const pieces = await (tx as any).platePiece.findMany({
                            where: { platePartId: pap.platePartId },
                            orderBy: { pieceNumber: 'desc' },
                            take: amountToRemove
                        })
                        await (tx as any).platePiece.deleteMany({ where: { id: { in: pieces.map((p: any) => p.id) } } })
                    }
                }
            }

            return assembly
        })

        revalidatePath(`/projects/${result.projectId}`)
        return { success: true, data: result }

    } catch (e: any) {
        console.error('updateAssembly error:', e)
        return { success: false, error: e.message }
    }
}

/**
 * Update assembly status
 */
export async function updateAssemblyStatus(
    assemblyId: string,
    status: AssemblyStatus
) {
    try {
        const user = await getCurrentUser()
        if (!user) return { success: false, error: 'Unauthorized' }

        const updateData: any = { status }

        if (status === AssemblyStatus.SHIPPED) {
            updateData.shippedAt = new Date()
        }

        const assembly = await prisma.assembly.update({
            where: { id: assemblyId },
            data: updateData
        })

        revalidatePath(`/projects/${assembly.projectId}`)
        return { success: true }

    } catch (e: any) {
        console.error('updateAssemblyStatus error:', e)
        return { success: false, error: e.message }
    }
}

export async function deleteAssembly(assemblyId: string) {
    try {
        const user = await getCurrentUser()
        if (!user) return { success: false, error: 'Unauthorized' }

        const result = await prisma.$transaction(async (tx) => {
            const assembly = await tx.assembly.findUnique({
                where: { id: assemblyId },
                include: {
                    children: true,
                    assemblyParts: true,
                    plateAssemblyParts: true
                }
            })

            if (!assembly) throw new Error('Assembly not found')
            if (assembly.children.length > 0) throw new Error('Cannot delete assembly with sub-assemblies')

            // Decrement all parts
            for (const ap of assembly.assemblyParts) {
                const amountToRemove = assembly.quantity * ap.quantityInAssembly
                await tx.part.update({ where: { id: ap.partId }, data: { quantity: { decrement: amountToRemove } } })
                const pieces = await tx.partPiece.findMany({ where: { partId: ap.partId }, orderBy: { pieceNumber: 'desc' }, take: amountToRemove })
                await tx.partPiece.deleteMany({ where: { id: { in: pieces.map(p => p.id) } } })
            }

            for (const pap of assembly.plateAssemblyParts) {
                const amountToRemove = assembly.quantity * pap.quantityInAssembly
                await tx.platePart.update({ where: { id: pap.platePartId }, data: { quantity: { decrement: amountToRemove } } })
                const pieces = await tx.platePiece.findMany({ where: { platePartId: pap.platePartId }, orderBy: { pieceNumber: 'desc' }, take: amountToRemove })
                await tx.platePiece.deleteMany({ where: { id: { in: pieces.map(p => p.id) } } })
            }

            await tx.assembly.delete({ where: { id: assemblyId } })
            return assembly
        })

        revalidatePath(`/projects/${result.projectId}`)
        return { success: true }

    } catch (e: any) {
        console.error('deleteAssembly error:', e)
        return { success: false, error: e.message }
    }
}

// ============================================================================
// ASSEMBLY PARTS (Junction)
// ============================================================================

/**
 * Add a part to an assembly
 */
export async function addPartToAssembly(
    assemblyId: string,
    partId: string,
    quantityInAssembly: number = 1,
    notes?: string
) {
    try {
        const user = await getCurrentUser()
        if (!user) return { success: false, error: 'Unauthorized' }

        // Validate that part and assembly belong to same project
        const [assembly, part] = await Promise.all([
            prisma.assembly.findUnique({ where: { id: assemblyId } }),
            prisma.part.findUnique({ where: { id: partId } })
        ])

        if (!assembly || !part) {
            return { success: false, error: 'Assembly or part not found' }
        }

        if (assembly.projectId !== part.projectId) {
            return { success: false, error: 'Part and assembly must belong to the same project' }
        }

        await prisma.$transaction(async (tx) => {
            await tx.assemblyPart.create({
                data: {
                    assemblyId,
                    partId,
                    quantityInAssembly,
                    notes
                }
            })

            // Get assembly quantity to know how much to add to part total
            const totalToAdd = assembly.quantity * quantityInAssembly

            // Update Part Quantity and Generate Pieces
            const partWithPieces = await tx.part.findUnique({
                where: { id: partId },
                include: { pieces: { select: { pieceNumber: true } } }
            })

            if (partWithPieces && totalToAdd > 0) {
                const maxNum = partWithPieces.pieces.reduce((max, p) => p.pieceNumber > max ? p.pieceNumber : max, 0)

                await tx.part.update({
                    where: { id: partId },
                    data: { quantity: { increment: totalToAdd } }
                })

                const newPieces = Array.from({ length: totalToAdd }, (_, i) => ({
                    partId: partId,
                    pieceNumber: maxNum + i + 1,
                    status: PartPieceStatus.PENDING
                }))
                await tx.partPiece.createMany({ data: newPieces })
            }
        })

        revalidatePath(`/projects/${assembly.projectId}`)
        return { success: true }

    } catch (e: any) {
        if (e.code === 'P2002') {
            return { success: false, error: 'Part is already in this assembly' }
        }
        console.error('addPartToAssembly error:', e)
        return { success: false, error: e.message }
    }
}

/**
 * Add a PLATE part to an assembly
 */
export async function addPlatePartToAssembly(
    assemblyId: string,
    platePartId: string,
    quantityInAssembly: number = 1,
    notes?: string
) {
    try {
        const user = await getCurrentUser()
        if (!user) return { success: false, error: 'Unauthorized' }

        const [assembly, platePart] = await Promise.all([
            prisma.assembly.findUnique({ where: { id: assemblyId } }),
            prisma.platePart.findUnique({ where: { id: platePartId } })
        ])

        if (!assembly || !platePart) {
            return { success: false, error: 'Assembly or plate part not found' }
        }

        if (assembly.projectId !== platePart.projectId) {
            return { success: false, error: 'Part and assembly must belong to the same project' }
        }

        await prisma.$transaction(async (tx) => {
            await tx.plateAssemblyPart.create({
                data: {
                    assemblyId,
                    platePartId,
                    quantityInAssembly,
                    notes
                }
            })

            // Increment PlatePart quantity
            const totalToAdd = assembly.quantity * quantityInAssembly

            const platePartWithPieces: any = await (tx as any).platePart.findUnique({
                where: { id: platePartId },
                include: { pieces: { select: { pieceNumber: true } } }
            })

            if (platePartWithPieces && totalToAdd > 0) {
                const maxNum = (platePartWithPieces.pieces as any[]).reduce((max: number, p: any) => p.pieceNumber > max ? p.pieceNumber : max, 0)

                await tx.platePart.update({
                    where: { id: platePartId },
                    data: {
                        quantity: { increment: totalToAdd },
                        // receivedQty might stay same? Yes.
                    }
                })

                // Generate PlatePieces
                const newPieces = Array.from({ length: totalToAdd }, (_, i) => ({
                    platePartId: platePartId,
                    pieceNumber: maxNum + i + 1,
                    status: PlatePieceStatus.PENDING
                }))
                await (tx as any).platePiece.createMany({ data: newPieces })
            }
        })

        revalidatePath(`/projects/${assembly.projectId}`)
        return { success: true }

    } catch (e: any) {
        if (e.code === 'P2002') {
            return { success: false, error: 'Part is already in this assembly' }
        }
        console.error('addPlatePartToAssembly error:', e)
        return { success: false, error: e.message }
    }
}

/**
 * Remove a part from an assembly
 */
export async function removePartFromAssembly(assemblyId: string, partId: string) {
    try {
        const user = await getCurrentUser()
        if (!user) return { success: false, error: 'Unauthorized' }

        const result = await prisma.$transaction(async (tx) => {
            const assembly = await tx.assembly.findUnique({ where: { id: assemblyId } })
            const junction = await tx.assemblyPart.findUnique({
                where: { assemblyId_partId: { assemblyId, partId } }
            })

            if (!assembly || !junction) throw new Error('Assembly or assignment not found')

            const amountToRemove = assembly.quantity * junction.quantityInAssembly

            await tx.assemblyPart.delete({
                where: { assemblyId_partId: { assemblyId, partId } }
            })

            // Decrement Part Quantity
            const pieces = await tx.partPiece.findMany({
                where: { partId },
                orderBy: { pieceNumber: 'desc' },
                take: amountToRemove
            })

            await tx.part.update({
                where: { id: partId },
                data: { quantity: { decrement: amountToRemove } }
            })

            await tx.partPiece.deleteMany({
                where: { id: { in: pieces.map(p => p.id) } }
            })

            return assembly
        })

        revalidatePath(`/projects/${result.projectId}`)
        return { success: true }

    } catch (e: any) {
        console.error('removePartFromAssembly error:', e)
        return { success: false, error: e.message }
    }
}

/**
 * Remove a PLATE part from an assembly
 */
export async function removePlatePartFromAssembly(assemblyId: string, platePartId: string) {
    try {
        const user = await getCurrentUser()
        if (!user) return { success: false, error: 'Unauthorized' }

        const result = await prisma.$transaction(async (tx) => {
            const assembly = await tx.assembly.findUnique({ where: { id: assemblyId } })
            const junction = await tx.plateAssemblyPart.findUnique({
                where: { assemblyId_platePartId: { assemblyId, platePartId } }
            })

            if (!assembly || !junction) throw new Error('Assembly or assignment not found')

            const amountToRemove = assembly.quantity * junction.quantityInAssembly

            await tx.plateAssemblyPart.delete({
                where: { assemblyId_platePartId: { assemblyId, platePartId } }
            })

            // Decrement PlatePart Quantity
            const pieces = await tx.platePiece.findMany({
                where: { platePartId },
                orderBy: { pieceNumber: 'desc' },
                take: amountToRemove
            })

            await tx.platePart.update({
                where: { id: platePartId },
                data: { quantity: { decrement: amountToRemove } }
            })

            await tx.platePiece.deleteMany({
                where: { id: { in: pieces.map(p => p.id) } }
            })

            return assembly
        })

        revalidatePath(`/projects/${result.projectId}`)
        return { success: true }

    } catch (e: any) {
        console.error('removePlatePartFromAssembly error:', e)
        return { success: false, error: e.message }
    }
}

/**
 * Update quantity of a part in an assembly
 */
export async function updateAssemblyPartQuantity(
    assemblyId: string,
    partId: string,
    newQuantityInAssembly: number
) {
    try {
        const user = await getCurrentUser()
        if (!user) return { success: false, error: 'Unauthorized' }

        const result = await prisma.$transaction(async (tx) => {
            const assembly = await tx.assembly.findUnique({ where: { id: assemblyId } })
            const junction = await tx.assemblyPart.findUnique({
                where: { assemblyId_partId: { assemblyId, partId } }
            })

            if (!assembly || !junction) throw new Error('Assembly or assignment not found')

            const diff = newQuantityInAssembly - junction.quantityInAssembly
            const totalDiff = diff * assembly.quantity

            await tx.assemblyPart.update({
                where: { assemblyId_partId: { assemblyId, partId } },
                data: { quantityInAssembly: newQuantityInAssembly }
            })

            if (totalDiff > 0) {
                const part = await tx.part.findUnique({ where: { id: partId }, include: { pieces: true } })
                if (part) {
                    const maxNum = part.pieces.reduce((max, p) => p.pieceNumber > max ? p.pieceNumber : max, 0)
                    await tx.part.update({ where: { id: partId }, data: { quantity: { increment: totalDiff } } })
                    const newPieces = Array.from({ length: totalDiff }, (_, i) => ({
                        partId,
                        pieceNumber: maxNum + i + 1,
                        status: PartPieceStatus.PENDING
                    }))
                    await tx.partPiece.createMany({ data: newPieces })
                }
            } else if (totalDiff < 0) {
                const amountToRemove = Math.abs(totalDiff)
                await tx.part.update({ where: { id: partId }, data: { quantity: { decrement: amountToRemove } } })
                const pieces = await tx.partPiece.findMany({
                    where: { partId },
                    orderBy: { pieceNumber: 'desc' },
                    take: amountToRemove
                })
                await tx.partPiece.deleteMany({ where: { id: { in: pieces.map(p => p.id) } } })
            }

            return assembly
        })

        revalidatePath(`/projects/${result.projectId}`)
        return { success: true }

    } catch (e: any) {
        console.error('updateAssemblyPartQuantity error:', e)
        return { success: false, error: e.message }
    }
}

/**
 * Update quantity of a PLATE part in an assembly
 */
export async function updatePlateAssemblyPartQuantity(
    assemblyId: string,
    platePartId: string,
    newQuantityInAssembly: number
) {
    try {
        const user = await getCurrentUser()
        if (!user) return { success: false, error: 'Unauthorized' }

        const result = await prisma.$transaction(async (tx) => {
            const assembly = await tx.assembly.findUnique({ where: { id: assemblyId } })
            const junction = await tx.plateAssemblyPart.findUnique({
                where: { assemblyId_platePartId: { assemblyId, platePartId } }
            })

            if (!assembly || !junction) throw new Error('Assembly or assignment not found')

            const diff = newQuantityInAssembly - junction.quantityInAssembly
            const totalDiff = diff * assembly.quantity

            await tx.plateAssemblyPart.update({
                where: { assemblyId_platePartId: { assemblyId, platePartId } },
                data: { quantityInAssembly: newQuantityInAssembly }
            })

            if (totalDiff > 0) {
                const plate = await (tx as any).platePart.findUnique({ where: { id: platePartId }, include: { pieces: true } })
                if (plate) {
                    const maxNum = (plate.pieces as any[]).reduce((max: number, p: any) => p.pieceNumber > max ? p.pieceNumber : max, 0)
                    await tx.platePart.update({ where: { id: platePartId }, data: { quantity: { increment: totalDiff } } })
                    const newPieces = Array.from({ length: totalDiff }, (_, i) => ({
                        platePartId,
                        pieceNumber: maxNum + i + 1,
                        status: PlatePieceStatus.PENDING
                    }))
                    await (tx as any).platePiece.createMany({ data: newPieces })
                }
            } else if (totalDiff < 0) {
                const amountToRemove = Math.abs(totalDiff)
                await tx.platePart.update({ where: { id: platePartId }, data: { quantity: { decrement: amountToRemove } } })
                const pieces = await (tx as any).platePiece.findMany({
                    where: { platePartId },
                    orderBy: { pieceNumber: 'desc' },
                    take: amountToRemove
                })
                await (tx as any).platePiece.deleteMany({ where: { id: { in: pieces.map((p: any) => p.id) } } })
            }

            return assembly
        })

        revalidatePath(`/projects/${result.projectId}`)
        return { success: true }

    } catch (e: any) {
        console.error('updatePlateAssemblyPartQuantity error:', e)
        return { success: false, error: e.message }
    }
}

// ============================================================================
// ASSEMBLY PROGRESS CALCULATIONS
// ============================================================================

/**
 * Calculate progress for an assembly based on its parts' pieces
 */
export async function getAssemblyProgress(assemblyId: string) {
    const assembly = await prisma.assembly.findUnique({
        where: { id: assemblyId },
        include: {
            assemblyParts: {
                include: {
                    part: {
                        include: {
                            pieces: true
                        }
                    }
                }
            },
            plateAssemblyParts: {
                include: {
                    platePart: true
                }
            }
        }
    })

    if (!assembly) {
        return null
    }

    let totalPiecesNeeded = 0
    let totalPiecesReady = 0
    let totalWeightNeeded = 0
    let totalWeightReady = 0

    // PROFILES
    for (const ap of assembly.assemblyParts) {
        const part = ap.part
        const piecesNeeded = ap.quantityInAssembly
        const unitWeight = part.unitWeight || 0

        // Count ready pieces for this part
        const readyPieces = part.pieces.filter(p => p.status === PartPieceStatus.READY).length
        const availableForAssembly = Math.min(readyPieces, piecesNeeded)

        totalPiecesNeeded += piecesNeeded
        totalPiecesReady += availableForAssembly
        totalWeightNeeded += piecesNeeded * unitWeight
        totalWeightReady += availableForAssembly * unitWeight
    }

    // PLATES
    for (const pap of assembly.plateAssemblyParts) {
        const part = pap.platePart
        const piecesNeeded = pap.quantityInAssembly
        const unitWeight = part.unitWeight || 0

        // Plate is ready if RECEIVED or QC_PASSED
        const isReady = part.status === 'RECEIVED' || part.status === 'QC_PASSED'
        const availableForAssembly = isReady ? piecesNeeded : 0 // Plates are batch managed usually, but simplifed here for now. 
        // Actually PlatePart has receivedQty. Let's use that if available, or just boolean status for now as singular items?
        // PlatePart is quantity based. 'receivedQty'
        const readyCount = part.receivedQty || 0
        const actuallyReady = Math.min(readyCount, piecesNeeded)

        totalPiecesNeeded += piecesNeeded
        totalPiecesReady += actuallyReady
        totalWeightNeeded += piecesNeeded * unitWeight
        totalWeightReady += actuallyReady * unitWeight
    }

    return {
        assemblyId,
        totalPiecesNeeded,
        totalPiecesReady,
        totalWeightNeeded,
        totalWeightReady,
        percentByCount: totalPiecesNeeded > 0
            ? Math.round((totalPiecesReady / totalPiecesNeeded) * 100)
            : 0,
        percentByWeight: totalWeightNeeded > 0
            ? Math.round((totalWeightReady / totalWeightNeeded) * 100)
            : 0,
        isComplete: totalPiecesReady >= totalPiecesNeeded
    }
}

/**
 * Get progress for all assemblies in a project
 */
export async function getProjectAssemblyProgress(projectId: string) {
    const assemblies = await prisma.assembly.findMany({
        where: { projectId },
        include: {
            assemblyParts: {
                include: {
                    part: {
                        include: {
                            pieces: true
                        }
                    }
                }
            },
            plateAssemblyParts: {
                include: {
                    platePart: true
                }
            }
        }
    })

    const progressList = assemblies.map(assembly => {
        let totalPiecesNeeded = 0
        let totalPiecesReady = 0
        let totalWeight = 0

        // Profiles
        for (const ap of assembly.assemblyParts) {
            const part = ap.part
            const piecesNeeded = ap.quantityInAssembly
            const readyPieces = part.pieces.filter(p => (p.status as string) === PartPieceStatus.READY).length
            const availableForAssembly = Math.min(readyPieces, piecesNeeded)

            totalPiecesNeeded += piecesNeeded
            totalPiecesReady += availableForAssembly
            totalWeight += piecesNeeded * (part.unitWeight || 0)
        }

        // Plates
        for (const pap of assembly.plateAssemblyParts) {
            const part = pap.platePart
            const piecesNeeded = pap.quantityInAssembly
            // Use receivedQty for readiness
            const readyCount = part.receivedQty || 0
            const availableForAssembly = Math.min(readyCount, piecesNeeded)

            totalPiecesNeeded += piecesNeeded
            totalPiecesReady += availableForAssembly
            totalWeight += piecesNeeded * (part.unitWeight || 0)
        }

        return {
            id: assembly.id,
            assemblyNumber: assembly.assemblyNumber,
            name: assembly.name,
            status: assembly.status,
            scheduledDate: assembly.scheduledDate,
            totalPieces: totalPiecesNeeded,
            readyPieces: totalPiecesReady,
            weight: totalWeight,
            percentComplete: totalPiecesNeeded > 0
                ? Math.round((totalPiecesReady / totalPiecesNeeded) * 100)
                : 0
        }
    })

    return progressList
}

