import { Button } from "@/components/ui/button"
import Link from 'next/link'

export default function AuthErrorPage() {
    return (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-50 gap-4 p-4 text-center">
            <h1 className="text-2xl font-bold text-red-600">Authentication Failed</h1>
            <p className="text-gray-600 max-w-md">
                We could not log you in. This usually happens if the "Redirect URL" is not authorized in Supabase.
            </p>
            <div className="bg-white p-4 rounded shadow text-left text-sm font-mono text-gray-800 border">
                <p className="font-bold mb-2">Troubleshooting:</p>
                <ol className="list-decimal list-inside space-y-1">
                    <li>Go to Supabase Dashboard → Authentication → URL Configuration.</li>
                    <li>Under <strong>Redirect URLs</strong>, add your Vercel URL:</li>
                    <li className="bg-gray-100 p-1 mt-1 break-all">
                        https://[your-app].vercel.app/auth/callback
                    </li>
                    <li className="mt-2">Also ensure <strong>Site URL</strong> is set correctly.</li>
                </ol>
            </div>
            <Button asChild>
                <Link href="/login">Try Again</Link>
            </Button>
        </div>
    )
}
