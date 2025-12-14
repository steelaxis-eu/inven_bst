import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Steel Inventory System",
  description: "MVP for Steel Inventory Management",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <header className="border-b bg-white p-4 shadow-sm">
          <div className="container mx-auto flex justify-between items-center">
            <div className="font-bold text-xl tracking-tight">SteelSys</div>
            <nav className="flex gap-6">
              <Link href="/stock" className="hover:text-blue-600 font-medium">Stock Search</Link>
              <Link href="/inventory" className="hover:text-blue-600 font-medium">Inventory</Link>
              <Link href="/usage" className="hover:text-blue-600 font-medium">Register Usage</Link>
              <Link href="/usage/history" className="hover:text-blue-600 font-medium">History</Link>
              <Link href="/projects" className="hover:text-blue-600 font-medium">Projects</Link>
            </nav>
          </div>
        </header>
        <main className="flex-1 bg-gray-50">
          {children}
        </main>
      </body>
    </html>
  );
}
