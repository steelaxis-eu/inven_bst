'use server'

import prisma from '@/lib/prisma'

export async function getActiveProjects() {
    return await prisma.project.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { projectNumber: 'asc' }
    })
}



export async function createProject(data: { number: string, name: string }) {
    if (!data.number || !data.name) return { success: false, error: 'Missing fields' }

    try {
        await prisma.project.create({
            data: {
                projectNumber: data.number,
                name: data.name,
                status: 'ACTIVE',
                createdBy: 'System', // Replace with session user if auth enabled
                modifiedBy: 'System'
            }
        })
        return { success: true }
    } catch (e: any) {
        if (e.code === 'P2002') return { success: false, error: 'Project Number already exists' }
        return { success: false, error: e.message }
    }
}

export async function archiveProject(id: string) {
    try {
        await prisma.project.update({
            where: { id },
            data: { status: 'ARCHIVED' }
        })
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

export async function getProject(id: string) {
    console.log(`[getProject] Fetching project with ID: "${id}"`) // Server log for debug

    // Try exact match first
    let project = await prisma.project.findUnique({
        where: { id },
        include: {
            usages: {
                include: {
                    lines: {
                        include: {
                            inventory: { include: { profile: true } },
                            remnant: { include: { profile: true } }
                        }
                    }
                }
            },
            remnants: {
                include: { profile: true }
            }
        }
    })

    // If not found, try robust fallback (trim, first)
    if (!project) {
        console.log(`[getProject] Exact match failed for "${id}". Trying robust search...`)
        const cleanId = id.trim()
        project = await prisma.project.findFirst({
            where: { id: cleanId },
            include: {
                usages: {
                    include: {
                        lines: {
                            include: {
                                inventory: { include: { profile: true } },
                                remnant: { include: { profile: true } }
                            }
                        }
                    }
                },
                remnants: {
                    include: { profile: true }
                }
            }
        })
    }

    if (!project) console.log(`[getProject] Project not found even after robust search.`)
    else console.log(`[getProject] Found project: ${project.projectNumber} with ${project.usages.length} usages.`)

    return project
}
