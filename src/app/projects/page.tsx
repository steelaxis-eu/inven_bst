import { getActiveProjects } from "@/app/actions/projects"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CreateProjectDialog } from "@/components/create-project-dialog"
import { ProjectCardActions } from "@/components/project-card-actions"

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
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xl font-bold">{p.projectNumber}</CardTitle>
                            <ProjectCardActions id={p.id} name={p.name} />
                        </CardHeader>
                        <CardContent>
                            <p className="mb-4 text-muted-foreground font-bold">{p.name}</p>
                            <p className="mb-4 text-sm text-muted-foreground">Status: {p.status}</p>
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
