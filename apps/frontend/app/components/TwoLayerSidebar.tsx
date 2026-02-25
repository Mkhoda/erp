"use client";
import React from 'react';
import Link from 'next/link';
import MENU, { MenuItem } from '../../lib/menu';

type Props = { className?: string };

export default function TwoLayerSidebar({ className }: Props) {
  const [allowedPages, setAllowedPages] = React.useState<string[] | null>(null);
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>(() => {
    try { const s = localStorage.getItem('menu.expanded'); return s? JSON.parse(s): {}; } catch { return {}; }
  });

  React.useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const url = (process.env.NEXT_PUBLIC_API_URL || '/api') + '/permissions/menu';
    if (!token) { setAllowedPages([]); return; }
    fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null).then(data => {
      if (!data) { setAllowedPages([]); return; }
      setAllowedPages(data.menuPages || []);
    }).catch(()=> setAllowedPages([]));
  }, []);

  React.useEffect(()=>{ try{ localStorage.setItem('menu.expanded', JSON.stringify(expanded)); }catch{} }, [expanded]);

  const isAllowed = (page?: string) => {
    if (!page) return true;
    if (allowedPages === null) return true; // loading -> show all until known
    return allowedPages.includes(page);
  };

  return (
    <nav className={className} aria-label="ناوبری">
      {MENU.map(item => {
        if (item.children && item.children.length>0) {
          // determine if any child allowed
          const any = item.children.some(c => isAllowed(c.page));
          if (!any) return null;
          const open = !!expanded[item.id];
          return (
            <div key={item.id} className="px-3">
              <button onClick={()=>setExpanded(s=>({ ...s, [item.id]: !s[item.id] }))} className="w-full flex items-center gap-2 py-2.5 px-3 rounded-xl hover:bg-theme-secondary text-theme-secondary">
                {item.icon && <item.icon className="w-4 h-4" />}
                <span className="flex-1 text-sm font-medium">{item.title}</span>
                <span className="text-xs">{open? '▾':'▸'}</span>
              </button>
              {open && (
                <div className="pl-6 mt-1 space-y-1">
                  {item.children!.map(child => isAllowed(child.page) ? (
                    <Link key={child.id} href={child.page||'#'} className="block px-3 py-2 rounded-md text-theme-secondary hover:bg-theme-secondary text-sm font-medium">{child.title}</Link>
                  ) : null)}
                </div>
              )}
            </div>
          );
        }
        if (!isAllowed(item.page)) return null;
        return (
          <div key={item.id} className="px-3">
            <Link href={item.page||'#'} className="flex items-center gap-2 py-2.5 px-3 rounded-xl hover:bg-theme-secondary text-theme-secondary text-sm font-medium">
              {item.icon && <item.icon className="w-4 h-4" />}
              <span>{item.title}</span>
            </Link>
          </div>
        );
      })}
    </nav>
  );
}
