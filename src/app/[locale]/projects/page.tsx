import { getActiveProjects } from "@/app/actions/projects"
import { getCustomers } from "@/app/actions/customers"
import { ProjectsView } from "./projects-view"

export const dynamic = 'force-dynamic'

export default async function ProjectsPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const sp = await searchParams
    const page = Number(sp?.page) || 1
    const search = (sp?.search as string) || ''

    let projectsData: any[] = []
    let total = 0
    let totalPages = 0
    let customers: any[] = []

    try {
        const result = await getActiveProjects({ page, search, limit: 50 })
        projectsData = result.data
        total = result.total
        totalPages = result.totalPages

        customers = await getCustomers()
    } catch (e) { console.error(e) }

    return (
        <ProjectsView
            projects={projectsData}
            page={page}
            totalPages={totalPages}
            totalItems={total}
            search={search}
            customers={customers}
        />
    )
}
