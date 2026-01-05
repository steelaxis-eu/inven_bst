import { getCustomers } from "@/app/actions/customers"
import { NewCustomerDialog } from "@/components/customers/new-customer-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const dynamic = 'force-dynamic'

export default async function CustomersPage() {
    let customers: any[] = []
    try {
        customers = await getCustomers()
    } catch (e) {
        console.error("Failed to load customers", e)
    }

    return (
        <div className="container mx-auto py-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Customers</h1>
                <NewCustomerDialog />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Customer Directory</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Company</TableHead>
                                <TableHead>Contact Person</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Phone</TableHead>
                                <TableHead>Address</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {customers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center text-muted-foreground h-24">
                                        No customers found. Add your first customer.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                customers.map((c) => (
                                    <TableRow key={c.id}>
                                        <TableCell className="font-medium">{c.companyName}</TableCell>
                                        <TableCell>{c.contactName || '-'}</TableCell>
                                        <TableCell>{c.contactEmail || '-'}</TableCell>
                                        <TableCell>{c.contactPhone || '-'}</TableCell>
                                        <TableCell className="max-w-xs truncate" title={c.address}>{c.address || '-'}</TableCell>
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
