import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import createIntlMiddleware from 'next-intl/middleware'

const intlMiddleware = createIntlMiddleware({
    locales: ['en', 'lv'],
    defaultLocale: 'en'
})

export async function middleware(request: NextRequest) {
    // 1. Run next-intl middleware first to get the response with locale
    const response = intlMiddleware(request)

    try {
        // Validate environment variables
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
            console.error("Middleware Error: Missing Supabase environment variables.")
            return response
        }

        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return request.cookies.get(name)?.value
                    },
                    set(name: string, value: string, options: CookieOptions) {
                        request.cookies.set({
                            name,
                            value,
                            ...options,
                        })
                        response.cookies.set({
                            name,
                            value,
                            ...options,
                        })
                    },
                    remove(name: string, options: CookieOptions) {
                        request.cookies.set({
                            name,
                            value: '',
                            ...options,
                        })
                        response.cookies.set({
                            name,
                            value: '',
                            ...options,
                        })
                    },
                },
            }
        )

        // Create a timeout promise
        const timeoutPromise = new Promise<{ data: { user: null } }>((_, reject) =>
            setTimeout(() => reject(new Error('Auth timeout')), 5000)
        )

        // Race the auth check against the timeout
        let userVal = null
        try {
            const { data } = await Promise.race([
                supabase.auth.getUser(),
                timeoutPromise
            ]) as { data: { user: any } }
            userVal = data.user
        } catch (timeoutError) {
            console.error("Middleware Auth Timeout or Error:", timeoutError)
        }

        const user = userVal
        const { pathname } = request.nextUrl

        // Helper to check if a pathname matches /login or /auth (with or without locale)
        const isAuthPage = pathname.match(/^\/(?:en|lv)?\/?(login|auth)/)

        // Protected Routes Logic
        if (!user && !isAuthPage) {
            // Get locale from request if possible, or fallback to default
            const localeMatch = pathname.match(/^\/(en|lv)/)
            const locale = localeMatch ? localeMatch[1] : 'en'
            return NextResponse.redirect(new URL(`/${locale}/login`, request.url))
        }

        // If user IS logged in and trying to access /login, send them to dashboard
        if (user && isAuthPage) {
            const localeMatch = pathname.match(/^\/(en|lv)/)
            const locale = localeMatch ? localeMatch[1] : 'en'
            return NextResponse.redirect(new URL(`/${locale}`, request.url))
        }

        return response
    } catch (e) {
        console.error("Middleware invocation failed:", e)
        return response
    }
}

export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|favicon.ico|manifest.json|sw.js|workbox-.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
