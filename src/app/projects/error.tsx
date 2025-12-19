'use client'

import { useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function ProjectsError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error('Projects Error:', error)
    }, [error])

    return (
        <div className="container mx-auto py-8">
            <Card className="max-w-md mx-auto">
                <CardHeader>
                    <CardTitle className="text-destructive">Something went wrong</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Failed to load projects. Please try again.
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
