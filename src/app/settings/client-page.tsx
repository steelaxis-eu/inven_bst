'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { updateSettings } from "@/app/actions/settings"
import { updateProfileWeight } from "@/app/actions/inventory"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"

export function SettingsClient({ initialScrapPrice, initialProfiles }: { initialScrapPrice: number, initialProfiles: any[] }) {
    const [scrapPrice, setScrapPrice] = useState(initialScrapPrice.toString())
    const [loadingPrice, setLoadingPrice] = useState(false)
    const [profiles, setProfiles] = useState(initialProfiles)

    // We keep local state for formatting, but actions verify it.

    const handleSavePrice = async () => {
        setLoadingPrice(true)
        try {
            await updateSettings(parseFloat(scrapPrice))
            alert("Scrap price updated!")
        } catch (e) {
            alert("Failed to update price")
        } finally {
            setLoadingPrice(false)
        }
    }

    return (
        <div className="space-y-8">
            <Card>
                <CardHeader><CardTitle>Global Parameters</CardTitle></CardHeader>
                <CardContent>
                    <div className="flex items-end gap-4 max-w-sm">
                        <div className="grid gap-2 w-full">
                            <label className="text-sm font-medium">Scrap Price (€/kg)</label>
                            <Input
                                type="number"
                                value={scrapPrice}
                                onChange={e => setScrapPrice(e.target.value)}
                                step="0.01"
                            />
                        </div>
                        <Button onClick={handleSavePrice} disabled={loadingPrice}>
                            {loadingPrice ? 'Saving...' : 'Save'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Steel Profiles (Weight Configuration)</CardTitle>
                    <div className="flex gap-2">
                        <WeightCalculator />
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Type</TableHead>
                                <TableHead>Dimensions</TableHead>
                                <TableHead>Weight (kg/m)</TableHead>
                                <TableHead></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {profiles.map(profile => (
                                <ProfileRow key={profile.id} profile={profile} />
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}

import { ProfileCalculator } from "@/components/profile-calculator"

function WeightCalculator() {
    return (
        <ProfileCalculator
            trigger={<Button variant="outline">⚖️ Weight Calculator</Button>}
            onSelect={(res) => {
                // In settings, we just want to see the weight.
                // The Calculator component "Use This Profile" button calls onSelect.
                // We can perhaps just show an alert or let user copy it.
                // Or maybe we want to Auto-Create specific profile from here too?
                // The previous implementation just showed the result.
                // Let's just alert the value so user can copy it manually to the row if needed,
                // OR we could add functionality to "Quick Add" this profile to the list?
                // For now, let's just show it.
                alert(`Selected: ${res.type} ${res.dimensions} = ${res.weight.toFixed(2)} kg/m\n\nYou can now enter this value in the table below or create a new profile with it.`)
            }}
        />
    )
}

function ProfileRow({ profile }: { profile: any }) {
    const [weight, setWeight] = useState(profile.weightPerMeter?.toString() || '0')
    const [saving, setSaving] = useState(false)

    const handleSave = async () => {
        setSaving(true)
        try {
            await updateProfileWeight(profile.id, parseFloat(weight))
        } catch (e) {
            alert("Failed")
        } finally {
            setSaving(false)
        }
    }

    return (
        <TableRow>
            <TableCell>{profile.type}</TableCell>
            <TableCell>{profile.dimensions}</TableCell>
            <TableCell>
                <Input
                    type="number"
                    className="w-32"
                    value={weight}
                    onChange={e => setWeight(e.target.value)}
                    step="0.01"
                />
            </TableCell>
            <TableCell>
                <Button size="sm" variant="ghost" onClick={handleSave} disabled={saving}>
                    {saving ? '...' : 'Save'}
                </Button>
            </TableCell>
        </TableRow>
    )
}
