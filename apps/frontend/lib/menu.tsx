"use client";
import {
  LucideIcon,
  LayoutDashboard,
  Boxes,
  Users,
  FileText,
  Layers,
  Tag,
  Handshake,
  MapPin,
  Building,
  Home,
  MessageSquare,
  Shield,
  BarChart3,
  Cpu,
  ScrollText,
} from "lucide-react";

export type Role = 'ADMIN' | 'MANAGER' | 'USER' | 'EXPERT';

export type MenuItem = {
  id: string;
  title: string;
  page?: string;
  icon?: LucideIcon;
  children?: MenuItem[];
  roles?: Role[];
  section?: string;
  badge?: string;
  isNew?: boolean;
};

export const MENU: MenuItem[] = [
  // ── فضای کاری — always visible ────────────────────────────
  {
    id: 'workspace',
    title: 'فضای کاری',
    page: '/dashboard',
    icon: LayoutDashboard,
  },

  // ── گفتگو با AI ───────────────────────────────────────────
  {
    id: 'ai.chat',
    title: 'گفتگو با AI',
    page: '/dashboard/chat',
    icon: MessageSquare,
    isNew: true,
  },

  // ── ERP ───────────────────────────────────────────────────
  {
    id: 'assets',
    title: 'مدیریت دارایی',
    icon: Boxes,
    section: 'ERP',
    roles: ['ADMIN', 'MANAGER', 'EXPERT'],
    children: [
      { id: 'assets.list',        title: 'دارایی‌ها',      page: '/dashboard/assets',              icon: Boxes },
      { id: 'assets.types',       title: 'انواع دارایی',   page: '/dashboard/assets/types',        icon: Layers },
      { id: 'assets.categories',  title: 'دسته‌بندی‌ها',   page: '/dashboard/assets/categories',   icon: Tag },
      { id: 'assets.assignments', title: 'واگذاری‌ها',     page: '/dashboard/assets/assignments',  icon: Handshake },
    ],
  },
  {
    id: 'org',
    title: 'مدیریت سازمان',
    icon: MapPin,
    roles: ['ADMIN', 'MANAGER'],
    children: [
      { id: 'departments', title: 'دپارتمان‌ها', page: '/dashboard/departments', icon: MapPin },
      { id: 'buildings',   title: 'ساختمان‌ها',  page: '/dashboard/buildings',   icon: Building },
      { id: 'floors',      title: 'طبقات',        page: '/dashboard/floors',      icon: Layers },
      { id: 'rooms',       title: 'اتاق‌ها',      page: '/dashboard/rooms',       icon: Home },
    ],
  },
  {
    id: 'users',
    title: 'کاربران',
    page: '/dashboard/users',
    icon: Users,
    roles: ['ADMIN', 'MANAGER'],
  },

  // ── تحلیل ─────────────────────────────────────────────────
  {
    id: 'reports',
    title: 'گزارش‌ها',
    page: '/dashboard/reports',
    icon: BarChart3,
    section: 'تحلیل',
    roles: ['ADMIN', 'MANAGER', 'EXPERT'],
  },

  // ── مدیریت سیستم (ADMIN only) ─────────────────────────────
  {
    id: 'admin',
    title: 'مدیریت سیستم',
    icon: Shield,
    section: 'مدیریت',
    roles: ['ADMIN'],
    children: [
      { id: 'admin.aiSettings', title: 'تنظیمات AI',   page: '/dashboard/ai-settings',  icon: Cpu },
      { id: 'admin.aiUsage',    title: 'مصرف AI',       page: '/dashboard/ai-usage',     icon: BarChart3 },
      { id: 'admin.logs',       title: 'لاگ سیستم',    page: '/dashboard/system-logs',  icon: ScrollText },
      { id: 'access',           title: 'دسترسی صفحات', page: '/dashboard/access',       icon: FileText },
    ],
  },
];

export default MENU;
