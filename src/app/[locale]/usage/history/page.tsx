import { getGlobalUsageHistory } from "@/app/actions/history"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EditUsageDialog } from "@/components/edit-usage-dialog"
import { FileViewer } from "@/components/ui/file-viewer"

export const dynamic = 'force-dynamic'

export default async function HistoryPage() {
    let history: any[] = []
    try {
        history = await getGlobalUsageHistory()
    } catch (e) { }

    return (
        <div className="container mx-auto py-8">
            <h1 className="text-3xl font-bold mb-8">Global Material Usage History</h1>
            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>User</TableHead>
                            <TableHead>Project</TableHead>
                            <TableHead>Item ID</TableHead>
                            <TableHead>Profile</TableHead>
                            <TableHead>Source</TableHead>
                            <TableHead>Qty Used</TableHead>
                            <TableHead>Scrap Generated</TableHead>
                            <TableHead>Created By</TableHead>
                            <TableHead>Cert</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {history.map(row => (
                            <TableRow key={row.id}>
                                <TableCell>{row.date.toLocaleDateString()} {row.date.toLocaleTimeString()}</TableCell>
                                <TableCell>{row.user}</TableCell>
                                <TableCell className="font-medium">{row.projectName}</TableCell>
                                <TableCell className="font-mono">{row.itemId}</TableCell>
                                <TableCell>{row.profile}</TableCell>
                                <TableCell>{row.source}</TableCell>
                                <TableCell>{row.quantityUsed}</TableCell>
                                <TableCell>
                                    {row.generatedRemnantStatus === 'SCRAP' ? (
                                        row.scrapValue > 0 ? (
                                            <span className="text-green-600 font-medium">+€{row.scrapValue.toFixed(2)}</span>
                                        ) : '-'
                                    ) : row.generatedRemnantStatus === 'AVAILABLE' ? (
                                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">Remnant</span>
                                    ) : (
                                        '-'
                                    )}
                                </TableCell>
                                <TableCell className="text-muted-foreground">{row.createdBy || '-'}</TableCell>
                                <TableCell>
                                    {row.certificateFilename ? (
                                        <FileViewer bucketName="certificates" path={row.certificateFilename} fileName="View" />
                                    ) : (
                                        <span className="text-muted-foreground/50 text-xs">-</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <EditUsageDialog
                                        usageId={row.id}
                                        originalLength={row.originalLength}
                                        cost={row.cost}
                                        costPerMeter={row.costPerMeter}
                                        profile={row.profile}
                                        initialStatus={row.generatedRemnantStatus as any}
                                    />
                                </TableCell>
                            </TableRow>
                        ))}
                        {history.length === 0 && (
                            <TableRow><TableCell colSpan={10} className="text-center py-8">No usage recorded yet.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}

