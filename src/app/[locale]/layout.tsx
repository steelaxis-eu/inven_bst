import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";
import { APP_CONFIG } from "@/lib/config";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { Toaster } from 'sonner';

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
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/next"

import { getCurrentUser } from "@/lib/auth"
import { ImportProvider } from "@/context/import-context";
import { ImportStatus } from "@/components/layout/import-status";
import StyledComponentsRegistry from "../registry";
import { AppFluentProvider } from "../fluent-provider";
import { Header } from "@/components/layout/header";

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
        <StyledComponentsRegistry>
          <NextIntlClientProvider messages={messages} locale={locale}>
            <ImportProvider>
              <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem
                disableTransitionOnChange
              >
                <AppFluentProvider>
                  <Header userEmail={user?.email ?? undefined} />
                  <ImportStatus />
                  <main className="flex-1 bg-gradient-to-br from-white to-gray-50 dark:from-neutral-900 dark:to-neutral-950">
                    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
                      {children}
                    </div>
                  </main>
                  <Toaster richColors position="bottom-right" />
                  <Analytics />
                  <SpeedInsights />
                </AppFluentProvider>
              </ThemeProvider>
            </ImportProvider>
          </NextIntlClientProvider>
        </StyledComponentsRegistry>
      </body>
    </html>
  );
}
