import { getCurrentUser } from '@/lib/auth'
import { ProfileForm } from '@/components/profile-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
    const user = await getCurrentUser()

    if (!user) {
        redirect('/login')
    }

    return (
        <div className="container max-w-2xl py-8">
            <h1 className="text-3xl font-bold mb-8">User Profile</h1>
            <Card>
                <CardHeader>
                    <CardTitle>Personal Information</CardTitle>
                    <CardDescription>Update your personal details and how they appear in the system.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ProfileForm
                        initialName={user.name || ''}
                        email={user.email || ''}
                    />
                </CardContent>
            </Card>
        </div>
    )
}
