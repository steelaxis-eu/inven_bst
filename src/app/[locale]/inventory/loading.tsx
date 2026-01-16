'use client'

import { Skeleton, SkeletonItem, makeStyles } from "@fluentui/react-components"

const useStyles = makeStyles({
    root: {
        padding: '32px 16px',
        maxWidth: '1400px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '32px'
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '32px'
    },
    controls: {
        display: 'flex',
        gap: '8px'
    },
    tableContainer: {
        border: '1px solid #e0e0e0',
        borderRadius: '4px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
    },
    row: {
        display: 'grid',
        gridTemplateColumns: 'repeat(9, 1fr)',
        gap: '16px'
    }
})

export default function InventoryLoading() {
    const styles = useStyles()

    return (
        <Skeleton className={styles.root}>
            <div className={styles.header}>
                <SkeletonItem style={{ height: '36px', width: '160px' }} />
                <div className={styles.controls}>
                    <SkeletonItem style={{ height: '40px', width: '120px' }} />
                    <SkeletonItem style={{ height: '40px', width: '120px' }} />
                </div>
            </div>

            <div className={styles.tableContainer}>
                {/* Header */}
                <div className={styles.row}>
                    {Array.from({ length: 9 }).map((_, i) => (
                        <SkeletonItem key={i} style={{ height: '20px', width: '100%' }} />
                    ))}
                </div>

                {/* Rows */}
                {Array.from({ length: 5 }).map((_, rowIdx) => (
                    <div key={rowIdx} className={styles.row}>
                        {Array.from({ length: 9 }).map((_, colIdx) => (
                            <SkeletonItem key={colIdx} style={{ height: '32px', width: '100%' }} />
                        ))}
                    </div>
                ))}
            </div>
        </Skeleton>
    )
}
