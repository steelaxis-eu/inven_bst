'use client'

import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { useState } from "react"
import { Loader2 } from "lucide-react"

export default function LoginPage() {
    const [loading, setLoading] = useState(false)

    const handleLogin = async () => {
        setLoading(true)
        try {
            // User requested explicit domain redirect
            const redirectTo = process.env.NODE_ENV === 'production'
                ? 'https://bstinventory.steelaxis.eu/auth/callback'
                : `${window.location.origin}/auth/callback`

            await supabase.auth.signInWithOAuth({
                provider: 'azure',
                options: {
                    scopes: 'email',
                    redirectTo: redirectTo,
                },
            })
        } catch (error) {
            console.error(error)
            alert("Error logging in")
            setLoading(false)
        }
    }

    return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
            <div className="w-full max-w-sm p-6 bg-card rounded-lg shadow-md border text-center">
                <h1 className="text-2xl font-bold mb-2">Inventory System</h1>
                <p className="text-sm text-muted-foreground mb-6">Sign in to access the dashboard</p>

                <Button
                    onClick={handleLogin}
                    className="w-full bg-[#0078D4] hover:bg-[#005a9e]"
                    disabled={loading}
                >
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Sign in with Microsoft
                </Button>
            </div>
        </div>
    )
}
