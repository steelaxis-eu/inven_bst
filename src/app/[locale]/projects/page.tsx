import { getActiveProjects } from "@/app/actions/projects"
import { getCustomers } from "@/app/actions/customers"
import { ProjectsView } from "./projects-view"

export const dynamic = 'force-dynamic'

export default async function ProjectsPage() {
    let projects: any[] = []
    let customers: any[] = []
    try {
        projects = await getActiveProjects()
        customers = await getCustomers()
    } catch (e) { console.error(e) }

    return <ProjectsView projects={projects} customers={customers} />
}
