'use client'

import { Skeleton, SkeletonItem, Card, CardHeader, makeStyles } from "@fluentui/react-components"

const useStyles = makeStyles({
    root: {
        padding: '32px 16px',
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '32px'
    },
    card: {
        marginBottom: '32px'
    },
    grid: {
        display: 'grid',
        gap: '16px'
    },
    row: {
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '16px'
    }
})

export default function StockLoading() {
    const styles = useStyles()

    return (
        <Skeleton className={styles.root}>
            <SkeletonItem style={{ height: '36px', width: '200px' }} />

            <Card className={styles.card}>
                <CardHeader header={<SkeletonItem style={{ height: '24px', width: '80px' }} />} />
                <div style={{ padding: '0 12px 12px 12px', display: 'flex', gap: '16px' }}>
                    <SkeletonItem style={{ height: '40px', width: '100%' }} />
                    <SkeletonItem style={{ height: '40px', width: '100px' }} />
                </div>
            </Card>

            <div className={styles.grid}>
                {/* Header */}
                <div className={styles.row}>
                    {Array.from({ length: 7 }).map((_, i) => (
                        <SkeletonItem key={i} style={{ height: '20px', width: '100%' }} />
                    ))}
                </div>

                {/* Rows */}
                {Array.from({ length: 5 }).map((_, rowIdx) => (
                    <div key={rowIdx} className={styles.row}>
                        {Array.from({ length: 7 }).map((_, colIdx) => (
                            <SkeletonItem key={colIdx} style={{ height: '32px', width: '100%' }} />
                        ))}
                    </div>
                ))}
            </div>
        </Skeleton>
    )
}
