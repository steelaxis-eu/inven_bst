import { getSettings, updateSettings } from "@/app/actions/settings"
import { getProfiles, updateProfileWeight } from "@/app/actions/inventory"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { revalidatePath } from "next/cache"
import Link from "next/link"

// Client Component for the Form Parts to handle interaction?
// Actually we can use Server Actions with Forms for simple inputs, 
// but for the table editing, client component is smoother. 
// Let's make the whole page dynamic server component and import client islands if needed,
// OR just make a client component wrapper.
// Given the "Input" requirement, Client Component is easiest for "onChange".

import { SettingsClient } from "@/app/settings/client-page"

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
    const settings = await getSettings()
    const profiles = await getProfiles()

    return (
        <div className="container mx-auto py-8">
            <div className="flex items-center gap-4 mb-8">
                <Link href="/"><Button variant="outline">← Back</Button></Link>
                <h1 className="text-3xl font-bold">System Settings</h1>
            </div>

            <SettingsClient
                initialScrapPrice={settings.scrapPricePerKg}
                initialProfiles={JSON.parse(JSON.stringify(profiles))}
            />
        </div>
    )
}
