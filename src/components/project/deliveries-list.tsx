'use client'

import {
    Card,
    CardHeader,
    Badge,
    ProgressBar,
    Button,
    makeStyles,
    tokens,
    Title3,
    Text,
    TabList,
    Tab,
    shorthands
} from "@fluentui/react-components"
import {
    VehicleTruckProfileRegular,
    CalendarRegular,
    BoxRegular,
    CheckmarkCircleRegular,
    WarningRegular,
    PrintRegular
} from "@fluentui/react-icons"
import Link from 'next/link'

interface DeliverySchedule {
    id: string
    projectId: string
    name: string
    scheduledDate: Date
    status: string
    shippedAt: Date | null
    deliveredAt: Date | null
    notes: string | null
    items: {
        assembly: {
            id: string
            assemblyNumber: string
            name: string
            status: string
            assemblyParts: {
                quantityInAssembly: number
                part: { pieces: { status: string }[] }
            }[]
        }
    }[]
}

interface DeliveriesListProps {
    deliveries: DeliverySchedule[]
}

const useStyles = makeStyles({
    root: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
        gap: '16px',
    },
    card: {
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
    },
    cardHeader: {
        paddingBottom: '12px',
        borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
        marginBottom: '12px',
    },
    headerRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    title: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: tokens.fontSizeBase400,
        fontWeight: tokens.fontWeightSemibold,
    },
    metaRow: {
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
        marginTop: '8px',
        color: tokens.colorNeutralForeground3,
        fontSize: tokens.fontSizeBase200,
    },
    content: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
    },
    readinessSection: {
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
    },
    readinessHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: tokens.fontSizeBase200,
    },
    tags: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '4px',
    },
    readyMsg: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        color: tokens.colorPaletteGreenForeground1,
        fontWeight: tokens.fontWeightMedium,
        marginTop: 'auto',
    },
    footer: {
        marginTop: '16px',
        paddingTop: '16px',
        borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
        backgroundColor: tokens.colorNeutralBackground2,
        margin: '16px -12px -12px -12px',
        padding: '12px',
        borderRadius: `0 0 ${tokens.borderRadiusMedium} ${tokens.borderRadiusMedium}`,
    },
    overdue: {
        backgroundColor: tokens.colorPaletteRedBackground1,
        ...shorthands.borderColor(tokens.colorPaletteRedBorder1),
    }
})

const STATUS_COLORS: Record<string, "outline" | "filled" | "tint"> = {
    'PENDING': 'outline',
    'SHIPPED': 'tint',
    'DELIVERED': 'filled',
}

function getDeliveryReadiness(delivery: DeliverySchedule): { ready: number; total: number; percent: number } {
    let total = 0
    let ready = 0

    delivery.items.forEach(item => {
        item.assembly.assemblyParts.forEach(ap => {
            const needed = ap.quantityInAssembly
            const readyPieces = ap.part.pieces.filter(p => p.status === 'READY').length
            total += needed
            ready += Math.min(readyPieces, needed)
        })
    })

    return {
        ready,
        total,
        percent: total > 0 ? Math.round((ready / total) * 100) : 100
    }
}

function DeliveryCard({ delivery }: { delivery: DeliverySchedule }) {
    const styles = useStyles()
    const readiness = getDeliveryReadiness(delivery)
    const scheduledDate = new Date(delivery.scheduledDate)
    const daysUntil = Math.ceil((scheduledDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    const isOverdue = daysUntil < 0 && delivery.status === 'PENDING'
    const isReady = readiness.percent === 100

    return (
        <Card className={styles.card} style={isOverdue ? { border: `1px solid ${tokens.colorPaletteRedBorder1}` } : undefined}>
            <div className={styles.cardHeader}>
                <div className={styles.headerRow}>
                    <div>
                        <div className={styles.title}>
                            <VehicleTruckProfileRegular />
                            {delivery.name}
                        </div>
                        <div className={styles.metaRow}>
                            <CalendarRegular fontSize={14} />
                            {scheduledDate.toLocaleDateString()}
                            {isOverdue && (
                                <span style={{ color: tokens.colorPaletteRedForeground1, fontWeight: tokens.fontWeightBold, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <WarningRegular fontSize={14} />
                                    {Math.abs(daysUntil)} days overdue
                                </span>
                            )}
                            {!isOverdue && delivery.status === 'PENDING' && daysUntil <= 7 && (
                                <span style={{ color: tokens.colorPaletteDarkOrangeForeground1 }}>
                                    {daysUntil === 0 ? 'Today' : `${daysUntil} days`}
                                </span>
                            )}
                        </div>
                    </div>
                    <Badge appearance={STATUS_COLORS[delivery.status] || 'outline'}>
                        {delivery.status}
                    </Badge>
                </div>
            </div>

            <div className={styles.content}>
                <div className={styles.readinessSection}>
                    <div className={styles.readinessHeader}>
                        <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>Readiness</Text>
                        <Text weight="medium">
                            {readiness.ready}/{readiness.total} pieces ({readiness.percent}%)
                        </Text>
                    </div>
                    <ProgressBar value={readiness.percent / 100} thickness="medium" color={isReady ? 'success' : 'brand'} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>Assemblies:</Text>
                    <div className={styles.tags}>
                        {delivery.items.map(item => (
                            <Badge
                                key={item.assembly.id}
                                appearance="outline"
                                color={
                                    item.assembly.status === 'SHIPPED' ? 'success' :
                                        item.assembly.status === 'QC_PASSED' ? 'brand' : 'subtle'
                                }
                            >
                                {item.assembly.assemblyNumber}
                            </Badge>
                        ))}
                    </div>
                </div>

                {delivery.notes && (
                    <Text size={200} italic style={{ color: tokens.colorNeutralForeground3 }}>{delivery.notes}</Text>
                )}

                {isReady && delivery.status === 'PENDING' && (
                    <div className={styles.readyMsg}>
                        <CheckmarkCircleRegular />
                        Ready to ship
                    </div>
                )}
            </div>

            <div className={styles.footer}>
                <Link href={`/projects/${delivery.projectId}/deliveries/${delivery.id}/print`} target="_blank" style={{ textDecoration: 'none' }}>
                    <Button icon={<PrintRegular />} style={{ width: '100%' }}>Print Packing List</Button>
                </Link>
            </div>
        </Card >
    )
}

export function DeliveriesList({ deliveries }: DeliveriesListProps) {
    const styles = useStyles()

    if (deliveries.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '48px', border: `1px dashed ${tokens.colorNeutralStroke1}`, borderRadius: tokens.borderRadiusMedium }}>
                <VehicleTruckProfileRegular fontSize={48} style={{ opacity: 0.5, color: tokens.colorNeutralForeground3 }} />
                <div style={{ marginTop: '8px', fontWeight: 600 }}>No deliveries scheduled yet</div>
                <Text>Create delivery schedules to track shipments.</Text>
            </div>
        )
    }

    // Sort by date, pending first
    const sorted = [...deliveries].sort((a, b) => {
        if (a.status === 'PENDING' && b.status !== 'PENDING') return -1
        if (a.status !== 'PENDING' && b.status === 'PENDING') return 1
        return new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()
    })

    return (
        <div className={styles.root}>
            {sorted.map(delivery => (
                <DeliveryCard key={delivery.id} delivery={delivery} />
            ))}
        </div>
    )
}

export function DeliveriesSummary({ deliveries }: { deliveries: DeliverySchedule[] }) {
    const pending = deliveries.filter(d => d.status === 'PENDING')
    const overdue = pending.filter(d => new Date(d.scheduledDate) < new Date()).length
    const thisWeek = pending.filter(d => {
        const diff = Math.ceil((new Date(d.scheduledDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        return diff >= 0 && diff <= 7
    }).length
    const shipped = deliveries.filter(d => d.status === 'SHIPPED').length
    const delivered = deliveries.filter(d => d.status === 'DELIVERED').length

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <Card>
                <CardHeader header={<Text weight="medium" style={{ color: tokens.colorNeutralForeground3 }}>Total</Text>} />
                <Title3>{deliveries.length}</Title3>
            </Card>
            <Card style={overdue > 0 ? { border: `1px solid ${tokens.colorPaletteRedBorder1}`, backgroundColor: tokens.colorPaletteRedBackground1 } : undefined}>
                <CardHeader header={<Text weight="medium" style={{ color: tokens.colorNeutralForeground3 }}>Overdue</Text>} />
                <Title3 style={overdue > 0 ? { color: tokens.colorPaletteRedForeground1 } : { color: tokens.colorNeutralForegroundDisabled }}>{overdue}</Title3>
            </Card>
            <Card style={thisWeek > 0 ? { border: `1px solid ${tokens.colorPaletteDarkOrangeBorder1}`, backgroundColor: tokens.colorPaletteDarkOrangeBackground1 } : undefined}>
                <CardHeader header={<Text weight="medium" style={{ color: tokens.colorNeutralForeground3 }}>This Week</Text>} />
                <Title3 style={thisWeek > 0 ? { color: tokens.colorPaletteDarkOrangeForeground1 } : { color: tokens.colorNeutralForegroundDisabled }}>{thisWeek}</Title3>
            </Card>
            <Card>
                <CardHeader header={<Text weight="medium" style={{ color: tokens.colorNeutralForeground3 }}>Shipped</Text>} />
                <Title3 style={{ color: tokens.colorPaletteBlueForeground2 }}>{shipped}</Title3>
            </Card>
            <Card>
                <CardHeader header={<Text weight="medium" style={{ color: tokens.colorNeutralForeground3 }}>Delivered</Text>} />
                <Title3 style={{ color: tokens.colorPaletteGreenForeground1 }}>{delivered}</Title3>
            </Card>
        </div>
    )
}
