'use client'

import { useParams } from 'next/navigation'
import { Button, Card, Title1, Text, makeStyles, tokens } from "@fluentui/react-components"
import { ChevronLeftRegular, PrintRegular } from '@fluentui/react-icons'
import Link from 'next/link'

const useStyles = makeStyles({
    root: {
        padding: '32px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
    },
    header: {
        display: 'flex',
        gap: '16px',
        alignItems: 'center',
    },
    card: {
        padding: '48px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: '16px',
        backgroundColor: tokens.colorNeutralBackground1,

    },
    link: {
        textDecoration: 'none',
        color: 'inherit',
    }
})

export default function WorkOrderDetailsPage() {
    const params = useParams()
    const projectId = params.id as string
    const woId = params.woId as string
    const styles = useStyles()

    return (
        <div className={styles.root}>
            <div className={styles.header}>
                <Link href={`/projects/${projectId}`} className={styles.link}>
                    <Button appearance="subtle" icon={<ChevronLeftRegular />}>
                        Back to Project
                    </Button>
                </Link>
            </div>

            <Card className={styles.card}>
                <Title1>Work Order Details</Title1>
                <Text size={400}>Work Order ID: {woId}</Text>
                <Text style={{ fontStyle: 'italic', marginTop: '16px' }}>
                    Full details view for this Work Order is coming soon.
                </Text>
                <div style={{ marginTop: '32px', display: 'flex', gap: '16px' }}>
                    <Link href={`/projects/${projectId}/work-orders/${woId}/print`} target="_blank" className={styles.link}>
                        <Button appearance="outline" icon={<PrintRegular />}>
                            Print View
                        </Button>
                    </Link>
                </div>
            </Card>
        </div>
    )
}
