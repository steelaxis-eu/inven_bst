'use client'

import { useState } from 'react'
import { updateProfile } from '@/app/actions/profile'
import { Button, Input, Label, Spinner } from '@fluentui/react-components'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export function ProfileForm({
    initialName,
    email
}: {
    initialName: string,
    email: string
}) {
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    async function handleSubmit(formData: FormData) {
        setLoading(true)
        try {
            const res = await updateProfile(formData)
            if (res.success) {
                toast.success('Profile updated successfully')
                router.refresh()
            } else {
                toast.error(res.error || 'Failed to update profile')
            }
        } catch (e) {
            toast.error('An unexpected error occurred')
        } finally {
            setLoading(false)
        }
    }

    return (
        <form action={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '400px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={email} disabled />
                <span style={{ fontSize: '10px', color: '#666' }}>Email cannot be changed.</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <Label htmlFor="name">Display Name</Label>
                <Input
                    id="name"
                    name="name"
                    defaultValue={initialName}
                    placeholder="Your Name"
                    required
                />
                <span style={{ fontSize: '10px', color: '#666' }}>This name will appear in usage logs and reports.</span>
            </div>
            <div style={{ paddingTop: '16px' }}>
                <Button type="submit" appearance="primary" disabled={loading} icon={loading ? <Spinner size="tiny" /> : undefined}>
                    {loading ? 'Saving...' : 'Save Changes'}
                </Button>
            </div>
        </form>
    )
}
