import { getSettings } from "@/app/actions/settings"
import prisma from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { revalidatePath } from "next/cache"
import Link from "next/link"
import { SettingsClient } from "@/app/settings/client-page"

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
    // Fetch all necessary settings data
    const settings = await getSettings()
    const scrapPrice = settings.scrapPricePerKg
    const shapes = await prisma.profileShape.findMany({ orderBy: { id: 'asc' } })
    const grades = await prisma.materialGrade.findMany({ orderBy: { name: 'asc' } })
    const standardProfiles = await prisma.standardProfile.findMany({
        orderBy: [{ type: 'asc' }, { dimensions: 'asc' }],
        take: 100 // Cap for performance, maybe implement pagination later or search in client
    })
    const steelProfiles = await prisma.steelProfile.findMany({
        orderBy: [{ type: 'asc' }, { dimensions: 'asc' }]
    })

    return (
        <div className="container py-10">
            <div className="flex items-center gap-4 mb-8">
                <Link href="/"><Button variant="outline">← Back</Button></Link>
                <h1 className="text-3xl font-bold">Settings</h1>
            </div>

            <SettingsClient
                initialScrapPrice={scrapPrice}
                initialShapes={shapes}
                initialGrades={grades}
                initialStandardProfiles={standardProfiles}
                initialSteelProfiles={steelProfiles}
            />
        </div>
    )
}
