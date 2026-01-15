import { getInventory, getProfiles, getStandardProfiles, getGrades, deleteInventory, getProfileShapes } from "@/app/actions/inventory"
import { getSuppliers } from "@/app/actions/suppliers"
import { getActiveProjects } from "@/app/actions/projects"
import { InventoryView } from "./inventory-view"

export const dynamic = 'force-dynamic'

export default async function InventoryPage() {
    // Try/catch for build safety
    let inventory: any[] = []
    let profiles: any[] = []
    let standardProfiles: any[] = []
    let grades: any[] = []
    let shapes: any[] = []
    let suppliers: any[] = []
    let projects: any[] = []
    try {
        inventory = await getInventory()
        profiles = await getProfiles()
        standardProfiles = await getStandardProfiles()
        grades = await getGrades()
        shapes = await getProfileShapes()
        suppliers = await getSuppliers()
        projects = await getActiveProjects()
    } catch (e) { }

    async function deleteItem(formData: FormData) {
        'use server'
        const id = formData.get('id') as string
        if (id) await deleteInventory(id)
    }

    return (
        <InventoryView
            inventory={inventory}
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
