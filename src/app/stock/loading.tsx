import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function StockLoading() {
    return (
        <div className="container mx-auto py-8">
            <Skeleton className="h-9 w-48 mb-8" />

            <Card className="mb-8">
                <CardHeader>
                    <Skeleton className="h-6 w-20" />
                </CardHeader>
                <CardContent>
                    <div className="flex gap-4">
                        <Skeleton className="h-10 flex-1" />
                        <Skeleton className="h-10 w-24" />
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-4">
                {/* Table Header */}
                <div className="grid grid-cols-7 gap-4">
                    {Array.from({ length: 7 }).map((_, i) => (
                        <Skeleton key={i} className="h-5 w-full" />
                    ))}
                </div>

                {/* Table Rows */}
                {Array.from({ length: 5 }).map((_, rowIdx) => (
                    <div key={rowIdx} className="grid grid-cols-7 gap-4">
                        {Array.from({ length: 7 }).map((_, colIdx) => (
                            <Skeleton key={colIdx} className="h-8 w-full" />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    )
}
