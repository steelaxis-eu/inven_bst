'use client'

import { Skeleton, SkeletonItem, Card, makeStyles } from "@fluentui/react-components"

const useStyles = makeStyles({
    root: {
        padding: '32px',
        maxWidth: '1200px',
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
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '16px'
    },
    cardContent: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '24px'
    },
    cardHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    }
})

export default function ProjectsLoading() {
    const styles = useStyles()

    return (
        <Skeleton className={styles.root}>
            <div className={styles.header}>
                <SkeletonItem style={{ height: '36px', width: '120px' }} />
                <SkeletonItem style={{ height: '40px', width: '150px' }} />
            </div>

            <div className={styles.grid}>
                {Array.from({ length: 6 }).map((_, i) => (
                    <Card key={i}>
                        <div className={styles.cardContent}>
                            <div className={styles.cardHeader}>
                                <SkeletonItem style={{ height: '24px', width: '120px' }} />
                                <SkeletonItem style={{ height: '32px', width: '32px', borderRadius: '50%' }} />
                            </div>
                            <SkeletonItem style={{ height: '20px', width: '180px' }} />
                            <SkeletonItem style={{ height: '16px', width: '100px' }} />
                            <SkeletonItem style={{ height: '10px', width: '100%' }} />
                        </div>
                    </Card>
                ))}
            </div>
        </Skeleton>
    )
}
