'use client'

import { Button, makeStyles, tokens, Card, CardHeader, CardFooter, Text, Spinner, Title2, Caption1 } from '@fluentui/react-components'

import { supabase } from "@/lib/supabase"
import { useState } from "react"

// If SocialIcons doesn't have Microsoft, we can use a generic icon or Image. 
// For now, let's use a simple SVG or just text if icon is not readily available in standard set without extra install.
// Actually, standard fluent icons might not have "MicrosoftLogo". 
// I'll stick to text or a generic icon to be safe, or just the standard Button.

const useStyles = makeStyles({
    container: {
        display: 'flex',
        height: '100vh',
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: tokens.colorNeutralBackground2,
    },
    card: {
        width: '100%',
        maxWidth: '360px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '24px',
    },
    header: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: '8px',
    },
    button: {
        width: '100%',
    }
})

export default function LoginPage() {
    const styles = useStyles()
    const [loading, setLoading] = useState(false)

    const handleLogin = async () => {
        setLoading(true)
        try {
            // User requested explicit domain redirect
            const redirectTo = process.env.NODE_ENV === 'production'
                ? 'https://bstinventory.steelaxis.eu/auth/callback'
                : `${window.location.origin}/auth/callback`

            await supabase.auth.signInWithOAuth({
                provider: 'azure',
                options: {
                    scopes: 'email',
                    redirectTo: redirectTo,
                },
            })
        } catch (error) {
            console.error(error)
            alert("Error logging in")
            setLoading(false)
        }
    }

    return (
        <div className={styles.container}>
            <Card className={styles.card}>
                <div className={styles.header}>
                    <Title2>Inventory System</Title2>
                    <Caption1>Sign in to access the dashboard</Caption1>
                </div>

                <Button
                    appearance="primary"
                    size="large"
                    className={styles.button}
                    onClick={handleLogin}
                    disabled={loading}
                    icon={loading ? <Spinner size="tiny" /> : undefined}
                >
                    {loading ? 'Signing in...' : 'Sign in with Microsoft'}
                </Button>
            </Card>
        </div>
    )
}
