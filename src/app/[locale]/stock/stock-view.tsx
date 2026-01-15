"use client"

import { StockSearch } from "@/components/stock-search"
import {
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
    TableHeaderCell,
    Card,
    CardHeader,
    Title1,
    Title3,
    Badge,
    tokens
} from "@fluentui/react-components"

interface StockViewProps {
    stock: any[]
}

export function StockView({ stock }: StockViewProps) {
    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 16px' }}>
            <Title1 style={{ marginBottom: '32px', display: 'block' }}>Stock Availability</Title1>

            <Card style={{ marginBottom: '32px' }}>
                <CardHeader header={<Title3>Filters</Title3>} />
                <div style={{ padding: '0 16px 16px 16px' }}>
                    <StockSearch />
                </div>
            </Card>

            <div style={{ border: `1px solid ${tokens.colorNeutralStroke1}`, borderRadius: tokens.borderRadiusMedium }}>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHeaderCell>ID</TableHeaderCell>
                            <TableHeaderCell>Type</TableHeaderCell>
                            <TableHeaderCell>Profile</TableHeaderCell>
                            <TableHeaderCell>Length (mm)</TableHeaderCell>
                            <TableHeaderCell>Quantity</TableHeaderCell>
                            <TableHeaderCell>Location</TableHeaderCell>
                            <TableHeaderCell>Status</TableHeaderCell>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {stock.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell style={{ fontFamily: 'monospace' }}>{item.originalId}</TableCell>
                                <TableCell>
                                    <Badge
                                        color={item.type === 'INVENTORY' ? 'brand' : 'informative'}
                                        appearance="tint"
                                    >
                                        {item.type}
                                    </Badge>
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
                                <TableCell colSpan={7} style={{ textAlign: 'center', padding: '32px', color: tokens.colorNeutralForeground3 }}>
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
