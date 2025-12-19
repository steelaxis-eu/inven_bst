'use client'

import { useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

export default function SettingsError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error('Settings Error:', error)
    }, [error])

    return (
        <div className="container py-10">
            <div className="flex items-center gap-4 mb-8">
                <Link href="/"><Button variant="outline">← Back</Button></Link>
                <h1 className="text-3xl font-bold">Settings</h1>
            </div>

            <Card className="max-w-md">
                <CardHeader>
                    <CardTitle className="text-destructive">Something went wrong</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Failed to load settings. Please try again.
                    </p>
                    {error.message && (
                        <p className="text-xs font-mono bg-muted p-2 rounded">
                            {error.message}
                        </p>
                    )}
                    <Button onClick={reset} variant="outline" className="w-full">
                        Try again
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
