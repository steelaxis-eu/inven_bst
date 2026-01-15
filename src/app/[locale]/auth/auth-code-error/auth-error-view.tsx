"use client"

import { Button, Title1, Text, Card, CardHeader, Subtitle1, tokens } from "@fluentui/react-components"
import { DismissCircleRegular } from "@fluentui/react-icons"
import Link from 'next/link'

export function AuthErrorView() {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            gap: '16px',
            padding: '16px',
            textAlign: 'center'
        }}>
            <DismissCircleRegular style={{ fontSize: '48px', color: tokens.colorPaletteRedForeground1 }} />
            <Title1 style={{ color: tokens.colorPaletteRedForeground1 }}>Authentication Failed</Title1>
            <Text style={{ maxWidth: '400px', color: tokens.colorNeutralForeground3 }}>
                We could not log you in. This usually happens if the "Redirect URL" is not authorized in Supabase.
            </Text>

            <Card style={{ maxWidth: '500px', width: '100%', textAlign: 'left', marginTop: '16px' }}>
                <CardHeader header={<Subtitle1>Troubleshooting:</Subtitle1>} />
                <div style={{ padding: '0 16px 16px 16px', fontSize: '12px' }}>
                    <ol style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <li>Go to Supabase Dashboard → Authentication → URL Configuration.</li>
                        <li>Under <strong>Redirect URLs</strong>, add your Vercel URL:</li>
                        <li style={{
                            backgroundColor: tokens.colorNeutralBackground3,
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontFamily: 'monospace',
                            wordBreak: 'break-all'
                        }}>
                            https://[your-app].vercel.app/auth/callback
                        </li>
                        <li>Also ensure <strong>Site URL</strong> is set correctly.</li>
                    </ol>
                </div>
            </Card>

            <Link href="/login" style={{ textDecoration: 'none', marginTop: '16px' }}>
                <Button appearance="primary">Try Again</Button>
            </Link>
        </div>
    )
}
