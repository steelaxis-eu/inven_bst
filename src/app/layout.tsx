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

import { ThemeProvider } from "@/components/theme-provider"
import { ModeToggle } from "@/components/mode-toggle"

// ...

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <header className="border-b bg-background p-4 shadow-sm sticky top-0 z-10 transition-colors">
            <div className="container mx-auto flex justify-between items-center">
              <Link href="/" className="font-bold text-xl tracking-tight text-primary hover:text-blue-600 transition-colors">
                SteelSys
              </Link>
              <div className="flex items-center gap-6">
                <nav className="hidden md:flex gap-6">
                  <Link href="/" className="hover:text-blue-600 font-medium text-muted-foreground hover:text-primary transition-colors">Dashboard</Link>
                  <Link href="/stock" className="hover:text-blue-600 font-medium text-muted-foreground hover:text-primary transition-colors">Stock</Link>
                  <Link href="/inventory" className="hover:text-blue-600 font-medium text-muted-foreground hover:text-primary transition-colors">Inventory</Link>
                  <Link href="/usage" className="hover:text-blue-600 font-medium text-muted-foreground hover:text-primary transition-colors">Usage</Link>
                  <Link href="/projects" className="hover:text-blue-600 font-medium text-muted-foreground hover:text-primary transition-colors">Projects</Link>
                </nav>
                <ModeToggle />
              </div>
            </div>
          </header>
          <main className="flex-1 bg-muted/20">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
