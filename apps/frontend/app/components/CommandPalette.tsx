"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, X, ArrowRight, LayoutDashboard, MessageSquare,
  Brain, Boxes, Users, Settings, FileText, Workflow, Bot,
  BarChart3, Building, MapPin, Handshake, CircleDollarSign,
} from "lucide-react";

type CommandItem = {
  id: string;
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  href: string;
  section: string;
  keywords?: string[];
};

const ALL_COMMANDS: CommandItem[] = [
  // AI
  { id: "workspace", title: "فضای کاری", subtitle: "خانه", icon: LayoutDashboard, href: "/dashboard", section: "هوش مصنوعی", keywords: ["home", "خانه", "داشبورد"] },
  { id: "chat", title: "گفتگو با AI", subtitle: "چت جدید", icon: MessageSquare, href: "/dashboard/chat", section: "هوش مصنوعی", keywords: ["chat", "چت", "هوش"] },
  { id: "knowledge", title: "پایگاه دانش", subtitle: "اسناد و دانش", icon: Brain, href: "/dashboard/knowledge", section: "هوش مصنوعی", keywords: ["knowledge", "دانش"] },
  { id: "workflows", title: "گردش‌کارها", subtitle: "اتوماسیون", icon: Workflow, href: "/dashboard/workflows", section: "هوش مصنوعی", keywords: ["workflow", "automation"] },
  { id: "agents", title: "عوامل هوشمند", subtitle: "مدیریت عوامل", icon: Bot, href: "/dashboard/agents", section: "هوش مصنوعی", keywords: ["agent", "bot"] },
  // ERP
  { id: "assets", title: "دارایی‌ها", subtitle: "مدیریت دارایی", icon: Boxes, href: "/dashboard/assets", section: "ERP", keywords: ["asset", "دارایی"] },
  { id: "assignments", title: "واگذاری‌ها", subtitle: "تخصیص دارایی", icon: Handshake, href: "/dashboard/assets/assignments", section: "ERP", keywords: ["assignment", "واگذاری"] },
  { id: "accounting", title: "حسابداری دارایی", icon: CircleDollarSign, href: "/dashboard/accounting", section: "ERP", keywords: ["account", "حسابداری"] },
  { id: "users", title: "کاربران", subtitle: "مدیریت کاربران", icon: Users, href: "/dashboard/users", section: "ERP", keywords: ["user", "کاربر"] },
  { id: "departments", title: "دپارتمان‌ها", icon: MapPin, href: "/dashboard/departments", section: "ERP", keywords: ["dept", "دپارتمان"] },
  { id: "buildings", title: "ساختمان‌ها", icon: Building, href: "/dashboard/buildings", section: "ERP", keywords: ["building", "ساختمان"] },
  // Admin
  { id: "reports", title: "گزارش‌ها", icon: BarChart3, href: "/dashboard/reports", section: "تحلیل", keywords: ["report", "گزارش"] },
  { id: "access", title: "دسترسی صفحات", icon: FileText, href: "/dashboard/access", section: "مدیریت", keywords: ["access", "permission", "دسترسی"] },
  { id: "settings", title: "تنظیمات", icon: Settings, href: "/dashboard/settings", section: "مدیریت", keywords: ["setting", "تنظیمات"] },
];

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function CommandPalette({ open, onClose }: Props) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [activeIdx, setActiveIdx] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const filtered = React.useMemo(() => {
    if (!query.trim()) return ALL_COMMANDS.slice(0, 8);
    const q = query.toLowerCase();
    return ALL_COMMANDS.filter(c =>
      c.title.includes(q) ||
      c.subtitle?.includes(q) ||
      c.section.includes(q) ||
      c.keywords?.some(k => k.includes(q))
    ).slice(0, 10);
  }, [query]);

  // Reset when opened
  React.useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Clamp active index when results change
  React.useEffect(() => {
    setActiveIdx(0);
  }, [filtered.length]);

  const navigate = (href: string) => {
    onClose();
    router.push(href);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[activeIdx]) {
      navigate(filtered[activeIdx].href);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  // Group by section
  const grouped = React.useMemo(() => {
    const map: Record<string, CommandItem[]> = {};
    filtered.forEach(item => {
      if (!map[item.section]) map[item.section] = [];
      map[item.section].push(item);
    });
    return map;
  }, [filtered]);

  let globalIdx = -1;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="cmd-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[200] cmd-backdrop"
            onClick={onClose}
          />

          {/* Palette */}
          <motion.div
            key="cmd-palette"
            initial={{ opacity: 0, scale: 0.96, y: -16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -16 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-[15vh] left-1/2 -translate-x-1/2 z-[201] w-full max-w-xl cmd-palette rounded-2xl overflow-hidden"
            dir="rtl"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-theme">
              <Search className="w-4 h-4 text-theme-muted shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKey}
                placeholder="جستجو در همه چیز..."
                className="flex-1 bg-transparent text-theme-primary text-sm outline-none placeholder:text-theme-muted"
              />
              {query && (
                <button onClick={() => setQuery("")} className="p-1 rounded hover:bg-theme-hover">
                  <X className="w-3.5 h-3.5 text-theme-muted" />
                </button>
              )}
              <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-theme-muted bg-theme-secondary border border-theme rounded">
                Esc
              </kbd>
            </div>

            {/* Results */}
            <div className="max-h-80 overflow-y-auto py-1.5">
              {filtered.length === 0 ? (
                <div className="py-8 text-center text-theme-muted text-sm">نتیجه‌ای یافت نشد</div>
              ) : (
                Object.entries(grouped).map(([section, items]) => (
                  <div key={section}>
                    <div className="sidebar-section-label">{section}</div>
                    {items.map(item => {
                      globalIdx++;
                      const idx = globalIdx;
                      const isActive = idx === activeIdx;
                      return (
                        <button
                          key={item.id}
                          onMouseEnter={() => setActiveIdx(idx)}
                          onClick={() => navigate(item.href)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-right transition-colors ${
                            isActive ? "bg-blue-500 text-white" : "hover:bg-theme-hover text-theme-secondary"
                          }`}
                        >
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isActive ? "bg-white/20" : "bg-theme-secondary"
                          }`}>
                            <item.icon className={`w-4 h-4 ${isActive ? "text-white" : "text-theme-muted"}`} />
                          </div>
                          <div className="flex-1 min-w-0 text-right">
                            <div className={`text-sm font-medium ${isActive ? "text-white" : "text-theme-primary"}`}>
                              {item.title}
                            </div>
                            {item.subtitle && (
                              <div className={`text-xs ${isActive ? "text-white/70" : "text-theme-muted"}`}>
                                {item.subtitle}
                              </div>
                            )}
                          </div>
                          <ArrowRight className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-white/60" : "text-theme-muted opacity-0 group-hover:opacity-100"}`} />
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-4 px-4 py-2 border-t border-theme text-[10px] text-theme-muted">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-theme-secondary border border-theme rounded font-mono">↑↓</kbd>
                انتخاب
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-theme-secondary border border-theme rounded font-mono">↵</kbd>
                رفتن
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-theme-secondary border border-theme rounded font-mono">Esc</kbd>
                بستن
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
