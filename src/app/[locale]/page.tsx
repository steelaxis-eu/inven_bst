import { CreateUsageDialog } from "@/components/create-usage-dialog"
import { createClient } from "@/lib/supabase-server"
import { getActiveProjects } from "@/app/actions/projects"

export const dynamic = 'force-dynamic'

import { APP_CONFIG } from "@/lib/config"
import { DashboardView } from "@/components/dashboard/dashboard-view"

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch projects for the dialog
  let projects: any[] = []
  try {
    const projectsResult = await getActiveProjects({ limit: 1000 })
    projects = projectsResult.data
  } catch (e) { console.error(e) }

  return (
    <DashboardView
      userEmail={user?.email}
      appName={APP_CONFIG.name}
      appVersion={APP_CONFIG.version}
      projects={projects}
    // messages passed via NextIntlClientProvider usually, but we can pass explicit translate strings if needed
    // But DashboardView uses useTranslations.
    />
  )
}
