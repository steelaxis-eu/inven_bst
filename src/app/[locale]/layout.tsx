import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";
import Link from "next/link";
import { APP_CONFIG } from "@/lib/config";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: APP_CONFIG.name,
  description: APP_CONFIG.description,
  manifest: "/manifest.json",
};

import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { ModeToggle } from "@/components/mode-toggle"
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/next"

import { getCurrentUser } from "@/lib/auth"
import { UserNav } from "@/components/user-nav"
import { LanguageSwitcher } from "@/components/language-switcher"
import { useTranslations } from 'next-intl';

function Navigation() {
  const t = useTranslations('Navigation');
  return (
    <nav className="hidden md:flex gap-6">
      <Link href="/" className="hover:text-blue-600 font-medium text-muted-foreground hover:text-primary transition-colors">{t('dashboard')}</Link>
      <Link href="/stock" className="hover:text-blue-600 font-medium text-muted-foreground hover:text-primary transition-colors">{t('stock')}</Link>
      <Link href="/inventory" className="hover:text-blue-600 font-medium text-muted-foreground hover:text-primary transition-colors">{t('inventory')}</Link>
      <Link href="/usage/history" className="hover:text-blue-600 font-medium text-muted-foreground hover:text-primary transition-colors">{t('history')}</Link>
      <Link href="/projects" className="hover:text-blue-600 font-medium text-muted-foreground hover:text-primary transition-colors">{t('projects')}</Link>
      <Link href="/customers" className="hover:text-blue-600 font-medium text-muted-foreground hover:text-primary transition-colors">{t('customers')}</Link>
      <Link href="/settings" className="hover:text-blue-600 font-medium text-muted-foreground hover:text-primary transition-colors">{t('settings')}</Link>
    </nav>
  );
}

export default async function RootLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const locale = (await params).locale;
  const messages = await getMessages();
  const user = await getCurrentUser()

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <NextIntlClientProvider messages={messages} locale={locale}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <header className="border-b bg-background p-4 shadow-sm sticky top-0 z-10 transition-colors">
              <div className="container mx-auto flex justify-between items-center">
                <Link href="/" className="font-bold text-xl tracking-tight text-primary hover:text-blue-600 transition-colors">
                  {APP_CONFIG.name}
                </Link>
                <div className="flex items-center gap-6">
                  <Navigation />
                  <div className="flex items-center gap-2">
                    <LanguageSwitcher />
                    <ModeToggle />
                    <UserNav userEmail={user?.email} />
                  </div>
                </div>
              </div>
            </header>
            <main className="flex-1 bg-gradient-to-br from-background to-muted/50">
              {children}
            </main>
            <Toaster />
            <Analytics />
            <SpeedInsights />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
