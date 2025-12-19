/**
 * Authentication Utilities
 * Centralized functions for getting current user context
 */

import { createClient } from '@/lib/supabase-server'

export interface AuthUser {
    id: string
    email: string | null
}

/**
 * Get the current authenticated user
 * @returns User object or null if not authenticated
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()

        if (error || !user) {
            return null
        }

        return {
            id: user.id,
            email: user.email ?? null,
        }
    } catch (error) {
        console.error('Error getting current user:', error)
        return null
    }
}

/**
 * Get the current user ID
 * @param fallback - Value to return if user is not authenticated (default: 'system')
 * @returns User ID or fallback value
 */
export async function getCurrentUserId(fallback: string = 'system'): Promise<string> {
    const user = await getCurrentUser()
    return user?.id ?? fallback
}

/**
 * Get user email for display purposes
 * @param fallback - Value to return if user is not authenticated
 * @returns User email or fallback value
 */
export async function getCurrentUserEmail(fallback: string = 'Guest'): Promise<string> {
    const user = await getCurrentUser()
    return user?.email ?? fallback
}
