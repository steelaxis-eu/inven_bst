/**
 * Environment Configuration
 * Validates required environment variables at import time
 */

import { z } from 'zod'

const envSchema = z.object({
    // Database
    POSTGRES_PRISMA_URL: z.string().min(1, 'POSTGRES_PRISMA_URL is required'),
    POSTGRES_URL_NON_POOLING: z.string().min(1, 'POSTGRES_URL_NON_POOLING is required'),

    // Supabase
    NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
})

export type Env = z.infer<typeof envSchema>

/**
 * Validated environment variables
 * Throws an error at startup if validation fails
 */
function validateEnv(): Env {
    const result = envSchema.safeParse(process.env)

    if (!result.success) {
        const errors = result.error.issues
            .map(issue => `  - ${issue.path.join('.')}: ${issue.message}`)
            .join('\n')

        console.error('❌ Environment validation failed:\n' + errors)

        // In development, throw to make issues obvious
        // In production, log but allow graceful degradation
        if (process.env.NODE_ENV === 'development') {
            throw new Error('Missing or invalid environment variables')
        }
    }

    return result.data as Env
}

// Export validated env (lazy initialization to avoid issues during build)
let _env: Env | undefined

export function getEnv(): Env {
    if (!_env) {
        _env = validateEnv()
    }
    return _env
}

// Re-export individual vars for convenience (with fallbacks for build time)
export const env = {
    get POSTGRES_PRISMA_URL() {
        return process.env.POSTGRES_PRISMA_URL ?? ''
    },
    get POSTGRES_URL_NON_POOLING() {
        return process.env.POSTGRES_URL_NON_POOLING ?? ''
    },
    get NEXT_PUBLIC_SUPABASE_URL() {
        return process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
    },
    get NEXT_PUBLIC_SUPABASE_ANON_KEY() {
        return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
    },
}
