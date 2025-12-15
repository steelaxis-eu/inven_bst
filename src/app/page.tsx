import Link from "next/link"
import { Button } from "@/components/ui/button"

import { createClient } from "@/lib/supabase-server"

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="max-w-4xl w-full p-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Steel Inventory System</h1>
          <p className="text-xl text-muted-foreground">Welcome, {user?.email || "Guest"}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
          <Link href="/inventory" className="block">
            <div className="h-40 bg-card border-2 border-border rounded-xl hover:border-primary hover:shadow-lg transition-all flex flex-col items-center justify-center p-6 cursor-pointer group">
              <h2 className="text-2xl font-bold group-hover:text-primary mb-2">Inventory</h2>
              <p className="text-muted-foreground text-center">Manage Stock, Add Items, View Availability</p>
            </div>
          </Link>

          <Link href="/usage" className="block">
            <div className="h-40 bg-card border-2 border-border rounded-xl hover:border-primary hover:shadow-lg transition-all flex flex-col items-center justify-center p-6 cursor-pointer group">
              <h2 className="text-2xl font-bold group-hover:text-primary mb-2">Register Usage</h2>
              <p className="text-muted-foreground text-center">Record consumption, Create Remnants</p>
            </div>
          </Link>

          <Link href="/projects" className="block">
            <div className="h-40 bg-card border-2 border-border rounded-xl hover:border-primary hover:shadow-lg transition-all flex flex-col items-center justify-center p-6 cursor-pointer group">
              <h2 className="text-2xl font-bold group-hover:text-primary mb-2">Projects</h2>
              <p className="text-muted-foreground text-center">View Projects, Track Costs, Download Certs</p>
            </div>
          </Link>

          <Link href="/stock" className="block">
            <div className="h-40 bg-card border-2 border-border rounded-xl hover:border-primary hover:shadow-lg transition-all flex flex-col items-center justify-center p-6 cursor-pointer group">
              <h2 className="text-2xl font-bold group-hover:text-primary mb-2">Search Stock</h2>
              <p className="text-muted-foreground text-center">Unified Search (Inventory & Remnants)</p>
            </div>
          </Link>

          <Link href="/settings" className="block col-span-1 md:col-span-2 lg:col-span-1">
            <div className="h-40 bg-card border-2 border-border rounded-xl hover:border-primary hover:shadow-lg transition-all flex flex-col items-center justify-center p-6 cursor-pointer group">
              <h2 className="text-2xl font-bold group-hover:text-primary mb-2">Settings</h2>
              <p className="text-muted-foreground text-center">Scrap Price & Profile Weights</p>
            </div>
          </Link>
        </div>

        <div className="mt-12 text-center text-muted-foreground text-sm">
          System Active • v0.1 MVP
        </div>
      </div>
    </div>
  )
}
