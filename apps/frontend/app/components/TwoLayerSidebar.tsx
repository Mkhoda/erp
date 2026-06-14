"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import MENU, { MenuItem, Role } from "../../lib/menu";

type Props = {
  allowedPages: string[] | null;
  role: Role | null;
  collapsed?: boolean;
  onNavigate?: () => void;
};

function isAllowed(page: string | undefined, allowedPages: string[] | null): boolean {
  if (!page) return true;
  if (allowedPages === null) return true; // optimistic while loading
  return allowedPages.includes(page);
}

/** Check if item is allowed based on its roles constraint. */
function isRoleAllowed(itemRoles: Role[] | undefined, userRole: Role | null): boolean {
  if (!itemRoles || itemRoles.length === 0) return true; // no restriction
  if (!userRole) return false;
  return itemRoles.includes(userRole);
}

function SidebarItem({
  item,
  allowedPages,
  role,
  collapsed,
  onNavigate,
}: {
  item: MenuItem;
  allowedPages: string[] | null;
  role: Role | null;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  const [open, setOpen] = React.useState(() => {
    if (!item.children) return false;
    try {
      const saved = localStorage.getItem("menu.expanded");
      return saved ? JSON.parse(saved)[item.id] ?? false : false;
    } catch { return false; }
  });

  const isActive = (page?: string) => {
    if (!page) return false;
    if (page === "/dashboard") return pathname === "/dashboard";
    return pathname === page || pathname.startsWith(page + "/");
  };

  const hasActiveChild = item.children?.some(c => isActive(c.page)) ?? false;

  React.useEffect(() => {
    if (hasActiveChild && !open) setOpen(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("menu.expanded");
      const state = saved ? JSON.parse(saved) : {};
      state[item.id] = open;
      localStorage.setItem("menu.expanded", JSON.stringify(state));
    } catch {}
  }, [open, item.id]);

  // Group with children
  if (item.children && item.children.length > 0) {
    // Check roles first — if parent item is not allowed for this role, hide entirely
    if (!isRoleAllowed(item.roles, role)) return null;

    const visibleChildren = item.children.filter(c => isAllowed(c.page, allowedPages) && isRoleAllowed(c.roles, role));
    if (visibleChildren.length === 0) return null;

    // Collapsed: show icon-only button with tooltip
    if (collapsed) {
      return (
        <div className="group relative">
          <button
            title={item.title}
            className={`w-full flex items-center justify-center p-2.5 rounded-xl transition-all duration-200
              ${hasActiveChild ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300" : "text-theme-muted hover:bg-theme-hover"}`}
          >
            {item.icon && <item.icon className="w-4 h-4" />}
          </button>
          {/* Tooltip */}
          <div className="top-1/2 right-full z-50 absolute opacity-0 group-hover:opacity-100 mr-2 transition-opacity -translate-y-1/2 pointer-events-none">
            <div className="bg-theme-primary shadow-lg px-2 py-1 rounded-lg text-white text-xs whitespace-nowrap">
              {item.title}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div>
        <button
          onClick={() => setOpen(v => !v)}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group
            ${hasActiveChild
              ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
              : "text-theme-secondary hover:bg-theme-hover hover:text-theme-primary"
            }`}
        >
          {item.icon && (
            <item.icon className={`w-4 h-4 flex-shrink-0 ${hasActiveChild ? "text-blue-600 dark:text-blue-400" : "text-theme-muted group-hover:text-theme-secondary"}`} />
          )}
          <span className="flex-1 text-right">{item.title}</span>
          {item.isNew && <span className="badge-new">جدید</span>}
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className={`flex-shrink-0 ${hasActiveChild ? "text-blue-500" : "text-theme-muted"}`}
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </motion.span>
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="relative space-y-0.5 mt-0.5 mb-1 pr-5">
                <div className="top-1 right-[18px] bottom-1 absolute bg-theme-secondary/50 w-px" />
                {visibleChildren.map(child => {
                  const active = isActive(child.page);
                  return (
                    <Link
                      key={child.id}
                      href={child.page || "#"}
                      onClick={onNavigate}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-150
                        ${active
                          ? "bg-blue-600 text-white shadow-sm shadow-blue-500/30"
                          : "text-theme-secondary hover:bg-theme-hover hover:text-theme-primary"
                        }`}
                    >
                      {child.icon && <child.icon className={`w-3.5 h-3.5 flex-shrink-0 ${active ? "text-white" : "text-theme-muted"}`} />}
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

  // Leaf item — check permission (page + role)
  if (!isAllowed(item.page, allowedPages) || !isRoleAllowed(item.roles, role)) return null;
  const active = isActive(item.page);

  // Collapsed leaf
  if (collapsed) {
    return (
      <div className="group relative">
        <Link
          href={item.page || "#"}
          onClick={onNavigate}
          title={item.title}
          className={`flex items-center justify-center p-2.5 rounded-xl transition-all duration-200
            ${active ? "bg-blue-600 text-white shadow-md shadow-blue-500/30" : "text-theme-muted hover:bg-theme-hover"}`}
        >
          {item.icon && <item.icon className="w-4 h-4" />}
        </Link>
        <div className="top-1/2 right-full z-50 absolute opacity-0 group-hover:opacity-100 mr-2 transition-opacity -translate-y-1/2 pointer-events-none">
          <div className="flex items-center gap-1.5 bg-theme-primary shadow-lg px-2 py-1 rounded-lg text-white text-xs whitespace-nowrap">
            {item.title}
            {item.isNew && <span className="badge-new">جدید</span>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Link
      href={item.page || "#"}
      onClick={onNavigate}
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group
        ${active
          ? "bg-blue-600 text-white shadow-md shadow-blue-500/30"
          : "text-theme-secondary hover:bg-theme-hover hover:text-theme-primary"
        }`}
    >
      {item.icon && (
        <item.icon className={`w-4 h-4 flex-shrink-0 ${active ? "text-white" : "text-theme-muted group-hover:text-theme-secondary"}`} />
      )}
      <span className="flex-1">{item.title}</span>
      {item.isNew && <span className="badge-new">جدید</span>}
    </Link>
  );
}

export default function TwoLayerSidebar({ allowedPages, role, collapsed, onNavigate }: Props) {
  // Track which sections we've already rendered a label for
  const renderedSections = new Set<string>();

  return (
    <nav className="space-y-0.5" aria-label="ناوبری">
      {MENU.map(item => {
        // Skip items not allowed for the user's role
        if (!isRoleAllowed(item.roles, role)) return null;

        const showSection = item.section && !renderedSections.has(item.section);
        if (item.section) renderedSections.add(item.section);

        return (
          <React.Fragment key={item.id}>
            {showSection && !collapsed && (
              <div className="sidebar-section-label">{item.section}</div>
            )}
            {showSection && collapsed && (
              <div className="opacity-50 mx-2 my-1 border-theme border-t" />
            )}
            <SidebarItem
              item={item}
              allowedPages={allowedPages}
              role={role}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          </React.Fragment>
        );
      })}
    </nav>
  );
}
