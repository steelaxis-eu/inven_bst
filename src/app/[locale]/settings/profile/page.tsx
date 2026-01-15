import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ProfileView } from './profile-view'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
    const user = await getCurrentUser()

    if (!user) {
        redirect('/login')
    }

    return <ProfileView user={{ name: user.name, email: user.email }} />
}
