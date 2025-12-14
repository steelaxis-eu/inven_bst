import { getActiveProjects } from "@/app/actions/projects"
import { UsageWizard } from "@/components/usage-wizard"

export const dynamic = 'force-dynamic'

export default async function UsagePage() {
    let projects: any[] = []
    try {
        projects = await getActiveProjects()
    } catch (e) { }

    return (
        <div className="container mx-auto py-8">
            <h1 className="text-3xl font-bold mb-8">Register Usage</h1>
            <UsageWizard projects={projects} />
        </div>
    )
}
