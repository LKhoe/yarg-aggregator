import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { NextIntlClientProvider } from "next-intl";
import { TranslationProvider } from "@/contexts/TranslationContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ServiceWorkerRegistration } from "@/components/pwa/ServiceWorkerRegistration";
import { WebVitals } from "@/app/components/WebVitals";
import { getMessages, getLocale } from "next-intl/server";
import { cache } from "react";
import "./globals.css";

// Cache the getMessages function for per-request deduplication
const getCachedMessages = cache(async () => {
  return await getMessages();
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "YARG Aggregator - Music Chart Library",
  description:
    "Browse, search, and download music charts from multiple sources for YARG (Yet Another Rhythm Game). Create collections and share with other players.",
  keywords: [
    "YARG",
    "rhythm game",
    "music charts",
    "enchor",
    "rhythmverse",
    "guitar hero",
    "clone hero",
  ],
  authors: [{ name: "YARG Aggregator" }],
  openGraph: {
    title: "YARG Aggregator",
    description: "Your ultimate music chart library for YARG",
    type: "website",
  },
  ...(process.env.GOOGLE_SITE_VERIFICATION && {
    verification: {
      google: process.env.GOOGLE_SITE_VERIFICATION,
    },
  }),
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const messages = await getCachedMessages();
  const locale = await getLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="YargAggregator" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <AuthProvider>
              <TranslationProvider>{children}</TranslationProvider>
            </AuthProvider>
            <Toaster />
          </ThemeProvider>
        </NextIntlClientProvider>
        <ServiceWorkerRegistration />
        <WebVitals />
      </body>
    </html>
  );
}
