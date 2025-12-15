import { getActiveProjects } from "@/app/actions/projects"
import { getSettings } from "@/app/actions/settings"
import { UsageWizard } from "@/components/usage-wizard"

export const dynamic = 'force-dynamic'

export default async function UsagePage() {
    let projects: any[] = []
    let settings = null
    try {
        projects = await getActiveProjects()
        settings = await getSettings()
    } catch (e) { }

    const scrapPrice = settings?.scrapPricePerKg || 0

    return (
        <div className="container mx-auto py-8">
            <h1 className="text-3xl font-bold mb-8">Register Usage</h1>
            <UsageWizard projects={projects} scrapPrice={scrapPrice} />
        </div>
    )
}
