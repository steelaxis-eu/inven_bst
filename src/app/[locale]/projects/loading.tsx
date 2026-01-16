'use client'

import { Skeleton, SkeletonItem, makeStyles, tokens } from "@fluentui/react-components"

const useStyles = makeStyles({
    root: {
        padding: '32px 16px',
        maxWidth: '1280px', // Match standard max-width
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '32px'
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px'
    },
    tableContainer: {
        border: `1px solid ${tokens.colorNeutralStroke1}`,
        borderRadius: tokens.borderRadiusMedium,
        overflow: 'hidden'
    },
    tableHeader: {
        display: 'grid',
        gridTemplateColumns: 'minmax(100px, 1fr) 2fr 1fr 1fr 1fr 1fr',
        padding: '12px 16px',
        backgroundColor: tokens.colorNeutralBackground2,
        borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
        gap: '16px'
    },
    tableRow: {
        display: 'grid',
        gridTemplateColumns: 'minmax(100px, 1fr) 2fr 1fr 1fr 1fr 1fr',
        padding: '16px',
        borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
        gap: '16px',
        alignItems: 'center'
    }
})

export default function ProjectsLoading() {
    const styles = useStyles()

    return (
        <Skeleton className={styles.root}>
            <div className={styles.header}>
                <SkeletonItem style={{ height: '32px', width: '200px' }} />
                <SkeletonItem style={{ height: '40px', width: '120px' }} />
            </div>

            <div className={styles.tableContainer}>
                {/* Header */}
                <div className={styles.tableHeader}>
                    {Array.from({ length: 6 }).map((_, i) => (
                        <SkeletonItem key={i} style={{ height: '16px', width: '80%' }} />
                    ))}
                </div>

                {/* Rows */}
                {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className={styles.tableRow}>
                        <SkeletonItem style={{ height: '20px', width: '80px' }} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <SkeletonItem style={{ height: '20px', width: '180px' }} />
                            <SkeletonItem style={{ height: '14px', width: '120px' }} />
                        </div>
                        <SkeletonItem style={{ height: '20px', width: '100px' }} />
                        <SkeletonItem style={{ height: '24px', width: '80px', borderRadius: '12px' }} />
                        <SkeletonItem style={{ height: '20px', width: '90px' }} />
                        <SkeletonItem style={{ height: '20px', width: '60px' }} />
                    </div>
                ))}
            </div>
        </Skeleton>
    )
}
