'use client'

import { useEffect } from 'react'
import { Button, Card, CardHeader, Text, Title3, makeStyles, tokens } from '@fluentui/react-components'
import { ArrowRotateClockwiseRegular, ErrorCircleRegular } from '@fluentui/react-icons'

const useStyles = makeStyles({
    container: {
        display: 'flex',
        justifyContent: 'center',
        padding: '32px',
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
    }
})

export default function ProjectsError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    const styles = useStyles()

    useEffect(() => {
        console.error('Projects Error:', error)
    }, [error])

    return (
        <div className={styles.container}>
            <Card className={styles.card}>
                <CardHeader
                    header={<Title3>Something went wrong</Title3>}
                    description={<Text>Failed to load projects. Please try again.</Text>}
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
