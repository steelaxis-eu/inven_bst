import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    try {
        // Validate environment variables to prevent "URL constructor" errors if they are undefined
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
            console.error("Middleware Error: Missing Supabase environment variables.")
            // Determine if we should fail hard or pass through. 
            // Passing through might be safer to avoid breaking the entire site, 
            // but auth won't work.
            return NextResponse.next({
                request: {
                    headers: request.headers,
                },
            })
        }

        let response = NextResponse.next({
            request: {
                headers: request.headers,
            },
        })

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
                        response = NextResponse.next({
                            request: {
                                headers: request.headers,
                            },
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
                        response = NextResponse.next({
                            request: {
                                headers: request.headers,
                            },
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
            ]) as { data: { user: any } } // Type assertion to help TS if needed
            userVal = data.user
        } catch (timeoutError) {
            console.error("Middleware Auth Timeout or Error:", timeoutError)
            // If timeout, we treat as no user.
            // This will trigger the redirect logic below if needed.
        }

        const user = userVal

        // Protected Routes Logic
        // If user is NOT logged in and trying to access anything other than /login or /auth...
        if (!user && !request.nextUrl.pathname.startsWith('/login') && !request.nextUrl.pathname.startsWith('/auth')) {
            return NextResponse.redirect(new URL('/login', request.url))
        }

        // If user IS logged in and trying to access /login, send them to dashboard
        if (user && request.nextUrl.pathname.startsWith('/login')) {
            return NextResponse.redirect(new URL('/', request.url))
        }

        return response
    } catch (e) {
        console.error("Middleware invocation failed:", e)
        // Return a generic response to avoid the ugly 500 page if possible, 
        // or rethrow if we want specific Next.js error handling behavior.
        // For debugging, we want to see the error, but we also want the site to not crash entirely if possible.
        // Returning next() might allow static pages to work even if auth fails.
        return NextResponse.next({
            request: {
                headers: request.headers,
            },
        })
    }
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - Feel free to modify this pattern to include more paths.
         */
        '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|workbox-.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
