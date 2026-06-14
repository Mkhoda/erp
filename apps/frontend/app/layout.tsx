import type { Metadata, Viewport } from "next";
import "@/styles/global.css";
import React from "react";

export const viewport: Viewport = {
  themeColor: '#0B5ED7',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: {
    template: '%s | Arzesh ERP',
    default: 'Arzesh ERP',
  },
  description: 'سیستم برنامه‌ریزی و مدیریت ارزش (Arzesh ERP)',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Arzesh ERP',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
};

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
