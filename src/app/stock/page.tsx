
import { searchStock } from "@/app/actions/stock"
import { StockSearch } from "@/components/stock-search"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function StockPage({ searchParams }: { searchParams: Promise<{ q?: string, type?: string, dim?: string }> }) {
    const { q, type, dim } = await searchParams
    let stock: any[] = []
    try {
        stock = await searchStock(q, type, dim)
    } catch (e) { }

    return (
        <div className="container mx-auto py-8">
            <h1 className="text-3xl font-bold mb-8">Stock Availability</h1>

            <Card>
                <CardHeader>
                    <CardTitle>Filters</CardTitle>
                </CardHeader>
                <CardContent>
                    <StockSearch />
                </CardContent>
            </Card>

            <div className="mt-8">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Profile</TableHead>
                            <TableHead>Length (mm)</TableHead>
                            <TableHead>Quantity</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {stock.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell className="font-mono">{item.originalId}</TableCell>
                                <TableCell>
                                    <span className={`px - 2 py - 1 rounded text - xs ${item.type === 'INVENTORY' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'} `}>
                                        {item.type}
                                    </span>
                                </TableCell>
                                <TableCell>{item.profileType} {item.dimensions} ({item.grade})</TableCell>
                                <TableCell>{item.length}</TableCell>
                                <TableCell>{item.quantity}</TableCell>
                                <TableCell>{item.location}</TableCell>
                                <TableCell>{item.status}</TableCell>
                            </TableRow>
                        ))}
                        {stock.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                    No stock found matching criteria.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
