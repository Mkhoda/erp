'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function PWAInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallButton(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowInstallButton(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Custom event from layout
    document.addEventListener('pwa-installable', () => {
      setShowInstallButton(true);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      // Optionally track install in development
      if (outcome === 'accepted' && process.env.NODE_ENV !== 'production') {
        console.log('PWA installed successfully');
      }
      
      setDeferredPrompt(null);
      setShowInstallButton(false);
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error installing PWA:', error);
      }
    }
  };

  if (isInstalled || !showInstallButton) {
    return null;
  }

  return (
    <div className="right-4 bottom-4 left-4 z-50 fixed flex justify-between items-center bg-blue-600 shadow-lg p-4 rounded-lg text-white">
      <div className="flex-1">
        <h3 className="font-bold text-sm">نصب اپلیکیشن</h3>
        <p className="opacity-90 text-xs">Arzesh ERP را روی دستگاه خود نصب کنید</p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => setShowInstallButton(false)}
          className="bg-transparent hover:bg-white/10 px-3 py-1 border border-white/30 rounded text-xs"
        >
          بعداً
        </button>
        <button
          onClick={handleInstallClick}
          className="bg-theme-card hover:bg-theme-hover px-3 py-1 rounded font-medium text-blue-600 text-xs"
        >
          نصب
        </button>
      </div>
    </div>
  );
}
