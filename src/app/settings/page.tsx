import { getGlobalSettings } from "@/app/actions/settings"
import { getProfileShapes, getGrades, getStandardProfiles, getProfiles } from "@/app/actions/inventory"
import { getSuppliers } from "@/app/actions/suppliers"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { SettingsClient } from "@/app/settings/client-page"

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
    // Fetch all necessary settings data via server actions
    const [shapes, grades, standardProfiles, steelProfiles, suppliers, globalSettings] = await Promise.all([
        getProfileShapes(),
        getGrades(),
        getStandardProfiles(),
        getProfiles(),
        getSuppliers(),
        getGlobalSettings()
    ])

    return (
        <div className="container mx-auto px-4 py-10">
            <div className="flex items-center gap-4 mb-8">
                <Link href="/"><Button variant="outline">← Back</Button></Link>
                <h1 className="text-3xl font-bold">Settings</h1>
            </div>

            <SettingsClient
                initialShapes={shapes}
                initialGrades={grades}
                initialStandardProfiles={standardProfiles}
                initialSteelProfiles={steelProfiles}
                initialSuppliers={suppliers}
                initialGlobalSettings={globalSettings}
            />
        </div>
    )
}


