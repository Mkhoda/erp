"use client";
import React from 'react';
import { refreshSystemName } from '../../lib/branding';

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  // Apply theme on client mount
  React.useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = savedTheme || (prefersDark ? 'dark' : 'light');

    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // Refresh the configurable system name on every page load so pages that set
  // their own document.title after mount pick up the latest value.
  React.useEffect(() => {
    refreshSystemName();
  }, []);

  return <>{children}</>;
}
