
import { getActiveProjects } from "@/app/actions/projects"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CreateProjectDialog } from "@/components/create-project-dialog"

export const dynamic = 'force-dynamic'

export default async function ProjectsPage() {
    let projects: any[] = []
    try {
        projects = await getActiveProjects()
    } catch (e) { console.error(e) }

    return (
        <div className="container mx-auto py-8">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold">Projects</h1>
                <CreateProjectDialog />
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {projects.map(p => (
                    <Card key={p.id}>
                        <CardHeader>
                            <CardTitle>{p.projectNumber}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="mb-4 text-gray-600 font-bold">{p.name}</p>
                            <p className="mb-4 text-sm text-gray-500">Status: {p.status}</p>
                            <Link href={`/projects/${p.id}`}>
                                <Button variant="outline" className="w-full">View Dashboard</Button>
                            </Link>
                        </CardContent>
                    </Card>
                ))}
                {projects.length === 0 && <p>No active projects.</p>}
            </div>
        </div>
    )
}
