'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, XCircle, AlertTriangle, Shield } from 'lucide-react'

interface QualityCheck {
    id: string
    projectId: string
    assemblyId: string | null
    processStage: string
    type: string
    status: string
    inspectedBy: string | null
    inspectedAt: Date | null
    dueDate: Date | null
    findings: string | null
    ncr: string | null
    assembly?: { assemblyNumber: string; name: string } | null
}

interface QualityChecksListProps {
    checks: QualityCheck[]
    onStatusChange?: (id: string, status: string, findings?: string, ncr?: string) => void
}

const STATUS_COLORS: Record<string, string> = {
    'PENDING': 'bg-gray-100 text-gray-800',
    'PASSED': 'bg-green-100 text-green-800',
    'FAILED': 'bg-red-100 text-red-800',
    'WAIVED': 'bg-yellow-100 text-yellow-800',
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
    'VISUAL': <Shield className="h-4 w-4" />,
    'DIMENSIONAL': <Shield className="h-4 w-4" />,
    'NDT': <Shield className="h-4 w-4" />,
    'COATING': <Shield className="h-4 w-4" />,
}

export function QualityChecksList({ checks, onStatusChange }: QualityChecksListProps) {
    if (checks.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                <Shield className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No quality checks defined yet.</p>
                <p className="text-sm">Create quality checks to track inspections.</p>
            </div>
        )
    }

    return (
        <div className="border rounded-lg overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow className="bg-muted/50">
                        <TableHead>Type</TableHead>
                        <TableHead>Stage</TableHead>
                        <TableHead>Assembly</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Inspector</TableHead>
                        <TableHead>Findings</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-32">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {checks.map(qc => {
                        const isOverdue = qc.dueDate && new Date(qc.dueDate) < new Date() && qc.status === 'PENDING'

                        return (
                            <TableRow key={qc.id} className={isOverdue ? 'bg-red-50/50' : ''}>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        {TYPE_ICONS[qc.type]}
                                        <span>{qc.type}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="font-medium">{qc.processStage}</TableCell>
                                <TableCell>
                                    {qc.assembly
                                        ? `${qc.assembly.assemblyNumber} - ${qc.assembly.name}`
                                        : <span className="text-muted-foreground">Project-level</span>}
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1">
                                        {isOverdue && <AlertTriangle className="h-3 w-3 text-red-500" />}
                                        <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                                            {qc.dueDate ? new Date(qc.dueDate).toLocaleDateString() : '-'}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                    {qc.inspectedBy || '-'}
                                </TableCell>
                                <TableCell>
                                    <div className="max-w-xs truncate text-sm">
                                        {qc.findings || '-'}
                                    </div>
                                    {qc.ncr && (
                                        <div className="text-xs text-red-600">NCR: {qc.ncr}</div>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className={STATUS_COLORS[qc.status] || ''}>
                                        {qc.status}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    {qc.status === 'PENDING' && (
                                        <div className="flex gap-1">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-7 w-7 p-0 text-green-600"
                                                onClick={() => onStatusChange?.(qc.id, 'PASSED')}
                                                title="Pass"
                                            >
                                                <CheckCircle2 className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-7 w-7 p-0 text-red-600"
                                                onClick={() => onStatusChange?.(qc.id, 'FAILED')}
                                                title="Fail"
                                            >
                                                <XCircle className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}
                                </TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
        </div>
    )
}

// Summary cards for quality
export function QualitySummary({ checks }: { checks: QualityCheck[] }) {
    const pending = checks.filter(c => c.status === 'PENDING').length
    const passed = checks.filter(c => c.status === 'PASSED').length
    const failed = checks.filter(c => c.status === 'FAILED').length
    const overdue = checks.filter(c =>
        c.status === 'PENDING' && c.dueDate && new Date(c.dueDate) < new Date()
    ).length

    return (
        <div className="grid grid-cols-4 gap-4 mb-6">
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-gray-600">{pending}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Passed</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-green-600">{passed}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Failed</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-red-600">{failed}</div>
                </CardContent>
            </Card>
            <Card className={overdue > 0 ? 'border-orange-300 bg-orange-50/50' : ''}>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Overdue</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className={`text-2xl font-bold ${overdue > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                        {overdue}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
