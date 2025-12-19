import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"

export default function ProjectsLoading() {
    return (
        <div className="container mx-auto py-8">
            <div className="flex justify-between items-center mb-8">
                <Skeleton className="h-9 w-32" />
                <Skeleton className="h-10 w-36" />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <Card key={i} className="p-6">
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <Skeleton className="h-6 w-28" />
                                <Skeleton className="h-8 w-8" />
                            </div>
                            <Skeleton className="h-5 w-48" />
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    )
}
