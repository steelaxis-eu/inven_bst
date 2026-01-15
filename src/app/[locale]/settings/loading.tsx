'use client'

import { Skeleton, SkeletonItem, Card, CardHeader, makeStyles } from "@fluentui/react-components"

const useStyles = makeStyles({
    root: {
        padding: '40px',
        maxWidth: '1000px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '32px'
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '24px'
    },
    tabs: {
        display: 'flex',
        gap: '8px',
        marginBottom: '24px'
    },
    cardContent: {
        padding: '0 24px 24px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
    },
    row: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px'
    }
})

export default function SettingsLoading() {
    const styles = useStyles()

    return (
        <Skeleton className={styles.root}>
            <div className={styles.header}>
                <SkeletonItem style={{ height: '40px', width: '80px' }} />
                <SkeletonItem style={{ height: '36px', width: '120px' }} />
            </div>

            <div className={styles.tabs}>
                <SkeletonItem style={{ height: '40px', width: '100px' }} />
                <SkeletonItem style={{ height: '40px', width: '100px' }} />
                <SkeletonItem style={{ height: '40px', width: '120px' }} />
            </div>

            <Card>
                <CardHeader header={<SkeletonItem style={{ height: '24px', width: '200px' }} />} />
                <div className={styles.cardContent}>
                    <div className={styles.row}>
                        {Array.from({ length: 4 }).map((_, i) => (
                            <SkeletonItem key={i} style={{ height: '20px', width: '100%' }} />
                        ))}
                    </div>
                    {Array.from({ length: 5 }).map((_, rowIdx) => (
                        <div key={rowIdx} className={styles.row}>
                            {Array.from({ length: 4 }).map((_, colIdx) => (
                                <SkeletonItem key={colIdx} style={{ height: '32px', width: '100%' }} />
                            ))}
                        </div>
                    ))}
                </div>
            </Card>
        </Skeleton>
    )
}
