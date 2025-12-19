import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function SettingsLoading() {
    return (
        <div className="container py-10">
            <div className="flex items-center gap-4 mb-8">
                <Skeleton className="h-10 w-20" />
                <Skeleton className="h-9 w-32" />
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-32" />
            </div>

            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-48" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-4 gap-4">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <Skeleton key={i} className="h-5 w-full" />
                        ))}
                    </div>
                    {Array.from({ length: 5 }).map((_, rowIdx) => (
                        <div key={rowIdx} className="grid grid-cols-4 gap-4">
                            {Array.from({ length: 4 }).map((_, colIdx) => (
                                <Skeleton key={colIdx} className="h-8 w-full" />
                            ))}
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    )
}
