"use client";
import {
  LucideIcon,
  LayoutDashboard,
  Boxes,
  Users,
  Settings,
  FileText,
  CircleDollarSign,
  Layers,
  Tag,
  Handshake,
  MapPin,
  Building,
  Home,
  MessageSquare,
  Brain,
  Workflow,
  Bot,
  Sparkles,
  Shield,
  BarChart3,
  Cpu,
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

  // ── هوش مصنوعی (accordion) ────────────────────────────────
  {
    id: 'ai',
    title: 'هوش مصنوعی',
    icon: Sparkles,
    children: [
      { id: 'ai.chat',      title: 'گفتگو با AI',     page: '/dashboard/chat',       icon: MessageSquare, isNew: true },
      { id: 'ai.knowledge', title: 'پایگاه دانش',    page: '/dashboard/knowledge',  icon: Brain },
      { id: 'ai.workflows', title: 'گردش‌کارها',      page: '/dashboard/workflows',  icon: Workflow },
      { id: 'ai.agents',    title: 'عوامل هوشمند',   page: '/dashboard/agents',     icon: Bot, isNew: true },
    ],
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
    id: 'accounting',
    title: 'حسابداری دارایی',
    page: '/dashboard/accounting',
    icon: CircleDollarSign,
    roles: ['ADMIN', 'MANAGER', 'EXPERT'],
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

  // ── مدیریت سیستم (accordion, ADMIN only) ──────────────────
  {
    id: 'admin',
    title: 'مدیریت سیستم',
    icon: Shield,
    section: 'مدیریت',
    roles: ['ADMIN'],
    children: [
      { id: 'admin.aiSettings', title: 'تنظیمات AI',      page: '/dashboard/ai-settings', icon: Cpu },
      { id: 'admin.aiUsage',    title: 'مصرف AI',          page: '/dashboard/ai-usage',    icon: BarChart3 },
      { id: 'access',           title: 'دسترسی صفحات',    page: '/dashboard/access',       icon: FileText },
      { id: 'admin.roles',      title: 'نقش‌ها',           page: '/dashboard/roles',        icon: Shield },
    ],
  },
  {
    id: 'settings',
    title: 'تنظیمات',
    page: '/dashboard/settings',
    icon: Settings,
    roles: ['ADMIN', 'MANAGER'],
  },
];

export default MENU;
