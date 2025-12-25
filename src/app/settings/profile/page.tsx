import { getCurrentUser } from '@/lib/auth'
import { ProfileForm } from '@/components/profile-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
    const user = await getCurrentUser()

    if (!user) {
        redirect('/login')
    }

    return (
        <div className="container mx-auto px-4 py-10">
            <div className="flex items-center gap-4 mb-8">
                <Link href="/"><Button variant="outline">← Back</Button></Link>
                <h1 className="text-3xl font-bold">User Profile</h1>
            </div>

            <Card className="max-w-2xl">
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
