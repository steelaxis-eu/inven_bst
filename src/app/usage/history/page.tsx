import { getGlobalUsageHistory } from "@/app/actions/history"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EditUsageDialog } from "@/components/edit-usage-dialog"
import { Eye } from "lucide-react"

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
                                    {row.scrapValue > 0 ? (
                                        <span className="text-green-600 font-medium">+€{row.scrapValue.toFixed(2)}</span>
                                    ) : '-'}
                                </TableCell>
                                <TableCell className="text-gray-500">{row.createdBy || '-'}</TableCell>
                                <TableCell>
                                    {row.certificateFilename ? (
                                        <a href={`/api/certificates/${row.certificateFilename}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 flex items-center gap-1">
                                            <Eye className="w-4 h-4" />
                                            <span className="text-xs">View</span>
                                        </a>
                                    ) : (
                                        <span className="text-gray-300 text-xs">-</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <EditUsageDialog
                                        usageId={row.id}
                                        originalLength={row.originalLength}
                                        cost={row.cost}
                                        costPerMeter={row.costPerMeter}
                                        profile={row.profile}
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
