"use client";
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import MENU, { MenuItem, Role } from '../../lib/menu';

type Props = {
  allowedPages: string[] | null;
  role: Role | null;
  onNavigate?: () => void;
};

function isAllowed(page: string | undefined, allowedPages: string[] | null): boolean {
  if (!page) return true;
  if (allowedPages === null) return true; // still loading — optimistic show
  return allowedPages.includes(page);
}

function SidebarItem({ item, allowedPages, role, onNavigate }: { item: MenuItem; allowedPages: string[] | null; role: Role | null; onNavigate?: () => void }) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(() => {
    if (!item.children) return false;
    try {
      const saved = localStorage.getItem('menu.expanded');
      return saved ? JSON.parse(saved)[item.id] ?? false : false;
    } catch { return false; }
  });

  const isActive = (page?: string) => {
    if (!page) return false;
    if (page === '/dashboard') return pathname === '/dashboard';
    return pathname === page || pathname.startsWith(page + '/');
  };

  const hasActiveChild = item.children?.some(c => isActive(c.page)) ?? false;

  // Open group if a child is active (on mount)
  React.useEffect(() => {
    if (hasActiveChild && !open) setOpen(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('menu.expanded');
      const state = saved ? JSON.parse(saved) : {};
      state[item.id] = open;
      localStorage.setItem('menu.expanded', JSON.stringify(state));
    } catch {}
  }, [open, item.id]);

  if (item.children && item.children.length > 0) {
    const visibleChildren = item.children.filter(c => isAllowed(c.page, allowedPages));
    if (visibleChildren.length === 0) return null;

    return (
      <div>
        <button
          onClick={() => setOpen(v => !v)}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group
            ${hasActiveChild
              ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
              : 'text-theme-secondary hover:bg-theme-hover hover:text-theme-primary'
            }`}
        >
          {item.icon && (
            <item.icon className={`w-4 h-4 flex-shrink-0 ${hasActiveChild ? 'text-blue-600 dark:text-blue-400' : 'text-theme-muted group-hover:text-theme-secondary'}`} />
          )}
          <span className="flex-1 text-right">{item.title}</span>
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className={`flex-shrink-0 ${hasActiveChild ? 'text-blue-500' : 'text-theme-muted'}`}
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </motion.span>
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="relative mt-0.5 mb-1 pr-5 space-y-0.5">
                {/* Vertical line */}
                <div className="top-1 bottom-1 right-[18px] absolute bg-theme-secondary/50 w-px" />
                {visibleChildren.map(child => {
                  const active = isActive(child.page);
                  return (
                    <Link
                      key={child.id}
                      href={child.page || '#'}
                      onClick={onNavigate}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-150
                        ${active
                          ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                          : 'text-theme-secondary hover:bg-theme-hover hover:text-theme-primary'
                        }`}
                    >
                      {child.icon && <child.icon className={`w-3.5 h-3.5 flex-shrink-0 ${active ? 'text-white' : 'text-theme-muted'}`} />}
                      <span>{child.title}</span>
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (!isAllowed(item.page, allowedPages)) return null;

  const active = isActive(item.page);
  return (
    <Link
      href={item.page || '#'}
      onClick={onNavigate}
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group
        ${active
          ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
          : 'text-theme-secondary hover:bg-theme-hover hover:text-theme-primary'
        }`}
    >
      {item.icon && (
        <item.icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-white' : 'text-theme-muted group-hover:text-theme-secondary'}`} />
      )}
      <span>{item.title}</span>
    </Link>
  );
}

export default function TwoLayerSidebar({ allowedPages, role, onNavigate }: Props) {
  return (
    <nav className="space-y-0.5" aria-label="ناوبری">
      {MENU.map(item => (
        <SidebarItem
          key={item.id}
          item={item}
          allowedPages={allowedPages}
          role={role}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}
