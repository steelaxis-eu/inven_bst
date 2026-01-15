"use client"

import { NewCustomerDialog } from "@/components/customers/new-customer-dialog"
import {
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
    TableHeaderCell,
    Card,
    CardHeader,
    Title3,
    Title1,
    tokens
} from "@fluentui/react-components"

interface CustomersViewProps {
    customers: any[]
}

export function CustomersView({ customers }: CustomersViewProps) {
    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <Title1>Customers</Title1>
                <NewCustomerDialog />
            </div>

            <Card>
                <CardHeader header={<Title3>Customer Directory</Title3>} />
                <div style={{ padding: '0 16px 16px 16px', overflowX: 'auto' }}>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHeaderCell>Company</TableHeaderCell>
                                <TableHeaderCell>Contact Person</TableHeaderCell>
                                <TableHeaderCell>Email</TableHeaderCell>
                                <TableHeaderCell>Phone</TableHeaderCell>
                                <TableHeaderCell>Address</TableHeaderCell>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {customers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} style={{ textAlign: 'center', padding: '48px', color: tokens.colorNeutralForeground3 }}>
                                        No customers found. Add your first customer.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                customers.map((c) => (
                                    <TableRow key={c.id}>
                                        <TableCell style={{ fontWeight: 600 }}>{c.companyName}</TableCell>
                                        <TableCell>{c.contactName || '-'}</TableCell>
                                        <TableCell>{c.contactEmail || '-'}</TableCell>
                                        <TableCell>{c.contactPhone || '-'}</TableCell>
                                        <TableCell style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.address || ''}>
                                            {c.address || '-'}
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
