"use client"

import {
    Card,
    CardHeader,
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
    TableHeaderCell,
    Badge,
    Title1,
    Title3,
    tokens
} from "@fluentui/react-components"
import Link from "next/link"
import { CreateProjectDialog } from "@/components/create-project-dialog"
import { ProjectCardActions } from "@/components/project-card-actions"
import { format } from "date-fns"

interface ProjectsViewProps {
    projects: any[]
    customers: any[]
}

export function ProjectsView({ projects, customers }: ProjectsViewProps) {
    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <Title1>Projects</Title1>
                <CreateProjectDialog customers={customers} />
            </div>

            <Card>
                <CardHeader header={<Title3>Active Projects</Title3>} />
                <div style={{ padding: '0 16px 16px 16px' }}>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHeaderCell>Number</TableHeaderCell>
                                <TableHeaderCell>Name</TableHeaderCell>
                                <TableHeaderCell>Customer</TableHeaderCell>
                                <TableHeaderCell>Coating</TableHeaderCell>
                                <TableHeaderCell>Delivery Date</TableHeaderCell>
                                <TableHeaderCell>Status</TableHeaderCell>
                                <TableHeaderCell style={{ width: '50px' }}></TableHeaderCell>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {projects.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} style={{ textAlign: 'center', padding: '48px', color: tokens.colorNeutralForeground3 }}>
                                        No active projects.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                projects.map(p => (
                                    <TableRow key={p.id}>
                                        <TableCell>
                                            <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                                                <Link href={`/projects/${p.id}`} style={{ color: 'inherit', textDecoration: 'none' }} className="hover:underline">
                                                    {p.projectNumber}
                                                </Link>
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <Link href={`/projects/${p.id}`} style={{ color: 'inherit', textDecoration: 'none', display: 'block' }} className="hover:underline">
                                                {p.name}
                                            </Link>
                                        </TableCell>
                                        <TableCell>{p.customer?.companyName || p.client || '-'}</TableCell>
                                        <TableCell>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontSize: '14px', fontWeight: 500 }}>{p.coatingType || '-'}</span>
                                                {p.corrosionCategory && (
                                                    <span style={{ fontSize: '12px', color: tokens.colorNeutralForeground3 }}>
                                                        Cat: {p.corrosionCategory} {p.corrosionDurability ? `(${p.corrosionDurability})` : ''}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {p.deliveryDate ? format(new Date(p.deliveryDate), "PPP") : '-'}
                                        </TableCell>
                                        <TableCell>
                                            <Badge appearance="outline">{p.status}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            <ProjectCardActions id={p.id} name={p.name} />
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </Card>
        </div>
    )
}
