
import { ProjectCardActions } from "@/components/project-card-actions"

// ... imports

// ... inside map ...
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xl font-bold">{p.projectNumber}</CardTitle>
                            <ProjectCardActions id={p.id} name={p.name} />
                        </CardHeader>
                        <CardContent>
                            <p className="mb-4 text-gray-600 font-bold">{p.name}</p>
                            <p className="mb-4 text-sm text-gray-500">Status: {p.status}</p>
                            <Link href={`/projects/${p.id}`}>
                                <Button variant="outline" className="w-full">View Dashboard</Button>
                            </Link>
                        </CardContent>
                    </Card >
                ))}
{ projects.length === 0 && <p>No active projects.</p> }
            </div >
        </div >
    )
}
