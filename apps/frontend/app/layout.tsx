import type { Metadata, Viewport } from "next";
import "@/styles/global.css";
import React from "react";
import { DEFAULT_SYSTEM_NAME } from "../lib/branding";

export const viewport: Viewport = {
  themeColor: '#0B5ED7',
  width: 'device-width',
  initialScale: 1,
};

// Server-side read of the configurable org name, used for the SSR-rendered
// <title>/<meta> tags. Guarded with try/catch + a short revalidate window —
// the backend isn't reachable yet during `next build`, so this must never
// throw (falls back to the hardcoded default).
async function fetchOrgName(): Promise<string> {
  const API = process.env.NEXT_PUBLIC_API_URL || '/api';
  const url = API.startsWith('http') ? `${API}/branding` : `http://localhost:3001/api/branding`;
  try {
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (res.ok) {
      const data = await res.json();
      const name = (data?.name || '').toString().trim();
      if (name) return name;
    }
  } catch {
    // backend unreachable (e.g. at build time) — use the default
  }
  return DEFAULT_SYSTEM_NAME;
}

export async function generateMetadata(): Promise<Metadata> {
  const name = await fetchOrgName();
  return {
    title: {
      template: `%s | ${name}`,
      default: name,
    },
    description: `سیستم برنامه‌ریزی و مدیریت ارزش (${name})`,
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
    manifest: '/manifest.json',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: name,
    },
    icons: {
      icon: '/icons/icon-192.png',
      apple: '/icons/icon-192.png',
    },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="/css/fontiran.css" />
      </head>
      <body className="bg-theme-secondary text-theme-primary antialiased">
        {children}
      </body>
    </html>
  );
}
