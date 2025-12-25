'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

export async function updateProfile(formData: FormData) {
    const supabase = await createClient()
    const name = formData.get('name') as string

    if (!name || name.trim().length === 0) {
        return { success: false, error: "Name cannot be empty" }
    }

    const { error } = await supabase.auth.updateUser({
        data: {
            full_name: name,
            name: name
        }
    })

    if (error) {
        return { success: false, error: error.message }
    }

    revalidatePath('/', 'layout') // Revalidate everything to update UserNav
    return { success: true }
}
