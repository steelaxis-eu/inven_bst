import { getActiveProjects } from "@/app/actions/projects"
import { getCustomers } from "@/app/actions/customers"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CreateProjectDialog } from "@/components/create-project-dialog"
import { ProjectCardActions } from "@/components/project-card-actions"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"

export const dynamic = 'force-dynamic'

export default async function ProjectsPage() {
    let projects: any[] = []
    let customers: any[] = []
    try {
        projects = await getActiveProjects()
        customers = await getCustomers()
    } catch (e) { console.error(e) }

    return (
        <div className="container mx-auto py-8">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold">Projects</h1>
                <CreateProjectDialog customers={customers} />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Active Projects</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Number</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>Coating</TableHead>
                                <TableHead>Delivery Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {projects.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center text-muted-foreground h-24">
                                        No active projects.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                projects.map(p => (
                                    <TableRow key={p.id} className="group hover:bg-muted/50">
                                        <TableCell className="font-mono font-bold">
                                            <Link href={`/projects/${p.id}`} className="hover:underline">
                                                {p.projectNumber}
                                            </Link>
                                        </TableCell>
                                        <TableCell>
                                            <Link href={`/projects/${p.id}`} className="block">
                                                {p.name}
                                            </Link>
                                        </TableCell>
                                        <TableCell>{p.customer?.companyName || p.client || '-'}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                <span className="text-sm font-medium">{p.coatingType || '-'}</span>
                                                {p.corrosionCategory && (
                                                    <span className="text-xs text-muted-foreground">
                                                        Cat: {p.corrosionCategory} {p.corrosionDurability ? `(${p.corrosionDurability})` : ''}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {p.deliveryDate ? format(new Date(p.deliveryDate), "PPP") : '-'}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{p.status}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            <ProjectCardActions id={p.id} name={p.name} />
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
