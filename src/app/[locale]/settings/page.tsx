import { getGlobalSettings } from "@/app/actions/settings"
import { getProfileShapes, getGrades, getStandardProfiles, getProfiles } from "@/app/actions/inventory"
import { getSuppliers } from "@/app/actions/suppliers"
import { SettingsView } from "./settings-view"

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
        <SettingsView
            shapes={shapes}
            grades={grades}
            standardProfiles={standardProfiles}
            steelProfiles={steelProfiles}
            suppliers={suppliers}
            globalSettings={globalSettings}
        />
    )
}
