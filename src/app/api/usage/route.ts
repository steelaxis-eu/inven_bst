import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { projectId, userId, lines } = body

        if (!projectId || !lines || lines.length === 0) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        const result = await prisma.$transaction(async (tx) => {
            // Create Usage Record
            const usage = await tx.usage.create({
                data: {
                    projectId,
                    userId: userId || 'system',
                    createdBy: userId || 'system',
                    modifiedBy: userId || 'system'
                }
            })

            const results = []

            for (const line of lines) {
                const { type, id, lengthUsed, createRemnant } = line
                let rootLotId = ''
                let originalLength = 0
                let profileId = ''
                let costPerMeter = 0
                let item = null

                if (type === 'INVENTORY') {
                    const inventory = await tx.inventory.findUnique({ where: { id } })
                    if (!inventory) throw new Error(`Inventory item ${id} not found`)
                    if (inventory.quantityAtHand <= 0) throw new Error(`Inventory item ${id} is out of stock`)

                    item = inventory
                    rootLotId = inventory.lotId
                    originalLength = inventory.length
                    profileId = inventory.profileId
                    costPerMeter = inventory.costPerMeter || 0

                    // Decrement quantity
                    await tx.inventory.update({
                        where: { id },
                        data: { quantityAtHand: { decrement: 1 } }
                    })

                } else if (type === 'REMNANT') {
                    const remnant = await tx.remnant.findUnique({ where: { id } })
                    if (!remnant) throw new Error(`Remnant item ${id} not found`)
                    if (remnant.status !== 'AVAILABLE') throw new Error(`Remnant item ${id} is not available`)

                    item = remnant
                    rootLotId = remnant.rootLotId
                    originalLength = remnant.length
                    profileId = remnant.profileId
                    costPerMeter = remnant.costPerMeter || 0

                    // Mark as USED
                    await tx.remnant.update({
                        where: { id },
                        data: { status: 'USED' }
                    })
                }

                if (!item) throw new Error(`Item ${line.id} has invalid type`)

                // Calculate Cost
                const lineCost = (lengthUsed / 1000) * costPerMeter

                // Create Usage Line
                await tx.usageLine.create({
                    data: {
                        usageId: usage.id,
                        inventoryId: type === 'INVENTORY' ? id : undefined,
                        remnantId: type === 'REMNANT' ? id : undefined,
                        quantityUsed: 1, // Logic assumes 1 item used partially or fully
                        projectId, // Optional override
                        cost: lineCost
                    }
                })

                // Handle Remnant Creation (or Scrap)
                const remainingLength = originalLength - lengthUsed

                // Ensure remaining length is positive and reasonable (e.g. > 100mm)
                if (remainingLength > 0) {
                    // Generate ID
                    // If creating a usable Remnant, use standard naming.
                    // If Scrap, we might want a different ID format or just same.
                    // Using same format keeps it simple: {RootLotId}-{Length}
                    const newRemnantId = `${rootLotId}-${Math.floor(remainingLength)}`

                    // Check if exists (idempotency safety)
                    const existing = await tx.remnant.findUnique({ where: { id: newRemnantId } })

                    if (!existing) {
                        await tx.remnant.create({
                            data: {
                                id: newRemnantId,
                                rootLotId,
                                profileId,
                                length: remainingLength,
                                costPerMeter: costPerMeter, // Propagate cost
                                status: createRemnant ? 'AVAILABLE' : 'SCRAP', // TRUE = Remnant, FALSE = Scrap
                                projectId, // Link to Origin Project for Scrap tracking
                                createdBy: userId || 'system',
                                modifiedBy: userId || 'system'
                            }
                        })
                    }
                }

                results.push({ id, status: 'processed' })
            }

            return usage
        })

        return NextResponse.json({ success: true, usageId: result.id })
    } catch (error: any) {
        console.error('Usage Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
