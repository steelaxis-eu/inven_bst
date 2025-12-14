import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <div className="max-w-4xl w-full p-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Steel Inventory System</h1>
          <p className="text-xl text-gray-600">Welcome, User Demo</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
          <Link href="/inventory" className="block">
            <div className="h-40 bg-white border-2 border-slate-200 rounded-xl hover:border-slate-800 hover:shadow-lg transition-all flex flex-col items-center justify-center p-6 cursor-pointer group">
              <h2 className="text-2xl font-bold group-hover:text-blue-600 mb-2">Inventory</h2>
              <p className="text-gray-500 text-center">Manage Stock, Add Items, View Availability</p>
            </div>
          </Link>

          <Link href="/usage" className="block">
            <div className="h-40 bg-white border-2 border-slate-200 rounded-xl hover:border-slate-800 hover:shadow-lg transition-all flex flex-col items-center justify-center p-6 cursor-pointer group">
              <h2 className="text-2xl font-bold group-hover:text-green-600 mb-2">Register Usage</h2>
              <p className="text-gray-500 text-center">Record consumption, Create Remnants</p>
            </div>
          </Link>

          <Link href="/projects" className="block">
            <div className="h-40 bg-white border-2 border-slate-200 rounded-xl hover:border-slate-800 hover:shadow-lg transition-all flex flex-col items-center justify-center p-6 cursor-pointer group">
              <h2 className="text-2xl font-bold group-hover:text-purple-600 mb-2">Projects</h2>
              <p className="text-gray-500 text-center">View Projects, Track Costs, Download Certs</p>
            </div>
          </Link>

          <Link href="/stock" className="block">
            <div className="h-40 bg-white border-2 border-slate-200 rounded-xl hover:border-slate-800 hover:shadow-lg transition-all flex flex-col items-center justify-center p-6 cursor-pointer group">
              <h2 className="text-2xl font-bold group-hover:text-orange-600 mb-2">Search Stock</h2>
              <p className="text-gray-500 text-center">Unified Search (Inventory & Remnants)</p>
            </div>
          </Link>

          <Link href="/settings" className="block col-span-1 md:col-span-2 lg:col-span-1">
            <div className="h-40 bg-white border-2 border-slate-200 rounded-xl hover:border-slate-800 hover:shadow-lg transition-all flex flex-col items-center justify-center p-6 cursor-pointer group">
              <h2 className="text-2xl font-bold group-hover:text-gray-600 mb-2">Settings</h2>
              <p className="text-gray-500 text-center">Scrap Price & Profile Weights</p>
            </div>
          </Link>
        </div>

        <div className="mt-12 text-center text-gray-400 text-sm">
          System Active • v0.1 MVP
        </div>
      </div>
    </div>
  )
}
