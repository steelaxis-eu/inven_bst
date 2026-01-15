'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
    Menu,
    MenuTrigger,
    MenuList,
    MenuItem,
    MenuPopover,
    MenuDivider,
    Avatar,
    Button,
    Spinner
} from '@fluentui/react-components'
import { SignOutRegular, PersonRegular } from '@fluentui/react-icons'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'

interface UserNavProps {
    userEmail?: string | null
}

export function UserNav({ userEmail }: UserNavProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)

    const handleSignOut = async () => {
        setLoading(true)
        try {
            await supabase.auth.signOut()
            router.refresh()
            router.push('/login')
        } catch (error) {
            toast.error('Error signing out')
        } finally {
            setLoading(false)
        }
    }

    if (!userEmail) {
        return (
            <Link href="/login" passHref legacyBehavior>
                <Button as="a" appearance="subtle">Sign In</Button>
            </Link>
        )
    }

    return (
        <Menu>
            <MenuTrigger disableButtonEnhancement>
                <Button appearance="transparent" icon={<Avatar name={userEmail} size={32} color="brand" />} style={{ minWidth: 'auto', padding: 0 }} />
            </MenuTrigger>
            <MenuPopover>
                <MenuList>
                    <div style={{ padding: '8px 12px' }}>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: '14px' }}>Account</p>
                        <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>{userEmail}</p>
                    </div>
                    <MenuDivider />
                    <MenuItem icon={<PersonRegular />}>
                        <Link href="/settings/profile" style={{ textDecoration: 'none', color: 'inherit', display: 'block', width: '100%' }}>
                            Profile
                        </Link>
                    </MenuItem>
                    <MenuDivider />
                    <MenuItem
                        icon={loading ? <Spinner size="tiny" /> : <SignOutRegular />}
                        onClick={handleSignOut}
                        disabled={loading}
                        style={{ color: '#d32f2f' }}
                    >
                        Log out
                    </MenuItem>
                </MenuList>
            </MenuPopover>
        </Menu>
    )
}
