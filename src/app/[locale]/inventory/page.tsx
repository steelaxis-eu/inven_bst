import { getInventory, getProfiles, getStandardProfiles, getGrades, deleteInventory, getProfileShapes } from "@/app/actions/inventory"
import { getSuppliers } from "@/app/actions/suppliers"
import { getActiveProjects } from "@/app/actions/projects"
import { InventoryView } from "./inventory-view"

export const dynamic = 'force-dynamic'

export default async function InventoryPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const sp = await searchParams
    const page = Number(sp?.page) || 1
    const search = (sp?.search as string) || ''

    // Try/catch for build safety
    let inventoryData: any[] = []
    let total = 0
    let totalPages = 0

    let profiles: any[] = []
    let standardProfiles: any[] = []
    let grades: any[] = []
    let shapes: any[] = []
    let suppliers: any[] = []
    let projects: any[] = []

    try {
        const result = await getInventory({ page, search, limit: 50 })
        inventoryData = result.data
        total = result.total
        totalPages = result.totalPages

        profiles = await getProfiles()
        standardProfiles = await getStandardProfiles()
        grades = await getGrades()
        shapes = await getProfileShapes()
        suppliers = await getSuppliers()
        const projectsResult = await getActiveProjects({ limit: 1000 })
        projects = projectsResult.data
    } catch (e) { }

    async function deleteItem(formData: FormData) {
        'use server'
        const id = formData.get('id') as string
        if (id) await deleteInventory(id)
    }

    return (
        <InventoryView
            inventory={inventoryData}
            page={page}
            totalPages={totalPages}
            totalItems={total}
            search={search}
            profiles={profiles}
            standardProfiles={standardProfiles}
            grades={grades}
            shapes={shapes}
            suppliers={suppliers}
            projects={projects}
            onDelete={deleteItem}
        />
    )
}
