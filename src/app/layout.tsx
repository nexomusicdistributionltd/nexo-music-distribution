import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { RecoveryHashCatcher } from "@/components/auth/RecoveryHashCatcher";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "NEXO Music Distribution | Digital Distribution & Publishing",
    template: "%s | NEXO Music Distribution",
  },
  description:
    "NEXO MUSIC DISTRIBUTION LTD — digital music distribution, publishing, and royalty management. Publishing division: Nexo Publishing Group.",
  applicationName: "NEXO Music Distribution",
  authors: [{ name: "NEXO MUSIC DISTRIBUTION LTD" }],
  creator: "NEXO MUSIC DISTRIBUTION LTD",
  publisher: "NEXO MUSIC DISTRIBUTION LTD",
  keywords: [
    "music distribution",
    "digital distribution",
    "music publishing",
    "royalty management",
    "Nexo Publishing Group",
  ],
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "NEXO Music Distribution",
    title: "NEXO Music Distribution",
    description:
      "Digital music distribution, publishing, and royalty management for artists and labels.",
    images: [
      {
        url: "/brand/og-default.jpg",
        width: 1200,
        height: 630,
        alt: "NEXO Music Distribution",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "NEXO Music Distribution",
    description:
      "Digital music distribution, publishing, and royalty management.",
    images: ["/brand/og-default.jpg"],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f5" },
    { media: "(prefers-color-scheme: dark)", color: "#050505" },
  ],
  colorScheme: "dark light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} flex min-h-screen flex-col antialiased`}
      >
        <ThemeProvider>
          <RecoveryHashCatcher />
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
