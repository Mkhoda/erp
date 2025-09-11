import React from 'react';
import AppShell from '@/components/AppShell';

export default function ApplicationLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
