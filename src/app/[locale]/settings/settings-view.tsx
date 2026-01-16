"use client"

import { Button } from "@fluentui/react-components"
import { ArrowLeftRegular } from "@fluentui/react-icons"
import Link from "next/link"
import { SettingsClient } from "./client-page"

interface SettingsViewProps {
    shapes: any[]
    grades: any[]
    standardProfiles: any[]
    steelProfiles: any[]
    suppliers: any[]
    globalSettings: any
}

export function SettingsView({
    shapes,
    grades,
    standardProfiles,
    steelProfiles,
    suppliers,
    globalSettings
}: SettingsViewProps) {
    return (
        <div className="container mx-auto px-4 py-10" style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
                <Link href="/" style={{ textDecoration: 'none' }}>
                    <Button appearance="subtle" icon={<ArrowLeftRegular />}>Dashboard</Button>
                </Link>
                <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>Settings</h1>
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
