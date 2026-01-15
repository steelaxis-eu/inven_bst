'use client'

import { useEffect } from 'react'
import { Button, Card, CardHeader, Text, Title3, makeStyles, tokens } from '@fluentui/react-components'
import { ArrowRotateClockwiseRegular, ErrorCircleRegular, ArrowLeftRegular } from '@fluentui/react-icons'
import Link from "next/link"

const useStyles = makeStyles({
    container: {
        padding: '32px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
    },
    card: {
        width: '100%',
        maxWidth: '480px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '24px',
    },
    errorBox: {
        backgroundColor: tokens.colorPaletteRedBackground1,
        color: tokens.colorPaletteRedForeground1,
        padding: '8px 12px',
        borderRadius: tokens.borderRadiusMedium,
        fontFamily: 'monospace',
        fontSize: '12px',
    },
    link: {
        textDecoration: 'none',
        color: 'inherit',
    }
})

export default function SettingsError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    const styles = useStyles()

    useEffect(() => {
        console.error('Settings Error:', error)
    }, [error])

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <Link href="/" className={styles.link}>
                    <Button icon={<ArrowLeftRegular />}>Back</Button>
                </Link>
                <Title3>Settings</Title3>
            </div>

            <Card className={styles.card}>
                <CardHeader
                    header={<Title3>Something went wrong</Title3>}
                    description={<Text>Failed to load settings. Please try again.</Text>}
                    image={<ErrorCircleRegular style={{ fontSize: 32, color: tokens.colorPaletteRedForeground3 }} />}
                />

                {error.message && (
                    <div className={styles.errorBox}>
                        {error.message}
                    </div>
                )}

                <Button
                    appearance="primary"
                    onClick={reset}
                    icon={<ArrowRotateClockwiseRegular />}
                >
                    Try again
                </Button>
            </Card>
        </div>
    )
}
