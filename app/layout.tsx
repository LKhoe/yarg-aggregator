import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner"
import "./globals.css";

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
  description: "Browse, search, and download music charts from multiple sources for YARG (Yet Another Rhythm Game). Create collections and share with other players.",
  keywords: ["YARG", "rhythm game", "music charts", "enchor", "rhythmverse", "guitar hero", "clone hero"],
  authors: [{ name: "YARG Aggregator" }],
  openGraph: {
    title: "YARG Aggregator",
    description: "Your ultimate music chart library for YARG",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
