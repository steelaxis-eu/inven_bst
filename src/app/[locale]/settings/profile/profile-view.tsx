"use client"

import { ProfileForm } from '@/components/profile-form'
import { Card, CardHeader, Text, Button, Title3 } from '@fluentui/react-components'
import { ArrowLeftRegular } from '@fluentui/react-icons'
import Link from 'next/link'

interface ProfileViewProps {
    user: {
        name: string | null
        email: string | null
    }
}

export function ProfileView({ user }: ProfileViewProps) {
    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
                <Link href="/">
                    <Button appearance="outline" icon={<ArrowLeftRegular />}>Back</Button>
                </Link>
                <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>User Profile</h1>
            </div>

            <Card>
                <CardHeader
                    header={<Title3>Personal Information</Title3>}
                    description={<Text>Update your personal details and how they appear in the system.</Text>}
                />
                <div style={{ padding: '0 16px 16px 16px' }}>
                    <ProfileForm
                        initialName={user.name || ''}
                        email={user.email || ''}
                    />
                </div>
            </Card>
        </div>
    )
}
