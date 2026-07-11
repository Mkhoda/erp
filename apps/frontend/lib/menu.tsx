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
  MessageCircle,
  Shield,
  ShieldCheck,
  BarChart3,
  Cpu,
  ScrollText,
  Fingerprint,
  Settings,
  ClipboardList,
  SlidersHorizontal,
  ClipboardCheck,
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

  // ── پیام‌رسانی داخلی ─────────────────────────────────────
  {
    id: 'messaging',
    title: 'پیام‌رسانی',
    page: '/dashboard/messaging',
    icon: MessageCircle,
  },

  // ── حضور من (همه کاربران) ─────────────────────────────────
  {
    id: 'attendance.my',
    title: 'حضور من',
    page: '/dashboard/attendance/my',
    icon: Fingerprint,
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

  // ── حضور و غیاب ───────────────────────────────────────────
  // NOTE: only settings + sync pages exist today (slices 1-2). The
  // employee/manager/HR pages (records, calendar, requests, approvals,
  // holidays, shifts, reports) are added here as their slices ship.
  {
    id: 'attendance',
    title: 'حضور و غیاب',
    icon: Fingerprint,
    section: 'حضور و غیاب',
    roles: ['ADMIN'],
    children: [
      { id: 'attendance.dashboard', title: 'داشبورد حضور',         page: '/dashboard/attendance',          icon: LayoutDashboard },
      { id: 'attendance.records',   title: 'کارکرد روزانه',        page: '/dashboard/attendance/records',  icon: ClipboardList },
      { id: 'attendance.approvals', title: 'صف تایید',            page: '/dashboard/attendance/approvals', icon: ClipboardCheck },
      { id: 'attendance.workRules', title: 'قوانین و تقویم کاری', page: '/dashboard/attendance/work-rules', icon: SlidersHorizontal },
    ],
  },

  // ── مدیریت سیستم (ADMIN only) ─────────────────────────────
  {
    id: 'admin',
    title: 'مدیریت سیستم',
    icon: Shield,
    section: 'مدیریت',
    roles: ['ADMIN'],
    children: [
      { id: 'admin.aiSettings',  title: 'تنظیمات AI',     page: '/dashboard/ai-settings',          icon: Cpu },
      { id: 'admin.aiUsage',     title: 'مصرف AI',         page: '/dashboard/ai-usage',             icon: BarChart3 },
      { id: 'admin.quota',       title: 'سقف توکن',        page: '/dashboard/quota',                 icon: Shield },
      { id: 'admin.logs',        title: 'لاگ سیستم',      page: '/dashboard/system-logs',          icon: ScrollText },
      { id: 'access',            title: 'دسترسی صفحات',   page: '/dashboard/access',               icon: FileText },
      { id: 'admin.sessions',    title: 'مدیریت نشست‌ها', page: '/dashboard/security/sessions',    icon: ShieldCheck },
      { id: 'admin.secSettings', title: 'تنظیمات امنیتی', page: '/dashboard/security/settings',   icon: Settings },
    ],
  },
];

export default MENU;
