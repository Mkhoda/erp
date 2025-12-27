import type { Metadata } from "next";
import { Montserrat, Poppins } from "next/font/google";
import "@/styles/global.css";
import React from "react";
import GlassyBackground from "@/components/GlassyBackground";

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800']
});

const poppins = Poppins({
  subsets: ['latin'],
  variable: '--font-poppins',
  display: 'swap',
  weight: ['400', '500', '600', '700']
});

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

export function generateViewport() {
  return {
    themeColor: '#0B5ED7',
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0B5ED7" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Arzesh ERP" />
        <link rel="icon" href="/icons/icon-192.png" sizes="192x192" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        
        {/* PWA Install Prompt */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Apply saved theme before hydration to avoid flash
              (function(){
                try {
                  var theme = localStorage.getItem('theme');
                  // Prefer light by default for application pages; user can still switch to dark elsewhere
                  if (!theme) {
                    theme = 'light';
                    localStorage.setItem('theme', theme);
                  }
                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch(e) {
                  console.warn('Theme initialization failed:', e);
                }
              })();

              let deferredPrompt;
              window.addEventListener('beforeinstallprompt', (e) => {
                e.preventDefault();
                deferredPrompt = e;
                // Show install button or banner
                document.dispatchEvent(new CustomEvent('pwa-installable'));
              });
              // Silence console noise in production
              try {
                if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
                  const noop = () => {};
                  console.log = noop;
                  console.info = noop;
                  console.debug = noop;
                }
              } catch {}
            `,
          }}
        />
      </head>
      <body className={`${montserrat.variable} ${poppins.variable} font-montserrat antialiased bg-theme-secondary text-theme-primary`}>
        <GlassyBackground />
        {children}
      </body>
    </html>
  );
}
