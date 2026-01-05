import { Skeleton } from "@/components/ui/skeleton"

export default function InventoryLoading() {
    return (
        <div className="container mx-auto py-8">
            <div className="flex justify-between items-center mb-8">
                <Skeleton className="h-9 w-40" />
                <div className="flex gap-2">
                    <Skeleton className="h-10 w-32" />
                    <Skeleton className="h-10 w-32" />
                </div>
            </div>

            <div className="border rounded-md">
                <div className="p-4 space-y-4">
                    {/* Table Header */}
                    <div className="grid grid-cols-9 gap-4">
                        {Array.from({ length: 9 }).map((_, i) => (
                            <Skeleton key={i} className="h-5 w-full" />
                        ))}
                    </div>

                    {/* Table Rows */}
                    {Array.from({ length: 5 }).map((_, rowIdx) => (
                        <div key={rowIdx} className="grid grid-cols-9 gap-4">
                            {Array.from({ length: 9 }).map((_, colIdx) => (
                                <Skeleton key={colIdx} className="h-8 w-full" />
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
