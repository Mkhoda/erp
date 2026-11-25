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
  Globe,
  Landmark,
  Bot,
  BookOpen,
  UserCog,
  GitMerge,
  Ticket,
  TicketCheck,
  PlusCircle,
  PieChart,
  Bell,
  Megaphone,
  CalendarRange,
  ListTodo,
  Biohazard,
  Trophy,
  FolderTree,
  NotebookPen,
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

// Order = sidebar order. A `section` starts a new labelled block; items after it belong to it
// until the next section. Visibility: a leaf shows when its page is in the user's allowed pages
// (and its `roles`, if any, match); a group shows when its role matches or any child is allowed.
export const MENU: MenuItem[] = [
  { id: 'workspace', title: 'فضای کاری', page: '/dashboard', icon: LayoutDashboard },

  // ── شخصی (همه کاربران) ───────────────────────────────────
  { id: 'attendance.my', title: 'حضور من', page: '/dashboard/attendance/my', icon: Fingerprint, section: 'شخصی' },
  { id: 'worklog.my', title: 'عملکرد من', page: '/dashboard/work-log/my', icon: ListTodo },
  { id: 'tickets.my', title: 'تیکت‌های من', page: '/dashboard/tickets/my', icon: TicketCheck },
  { id: 'ai.chat', title: 'گفتگو با AI', page: '/dashboard/chat', icon: MessageSquare },

  // ── ارتباطات ─────────────────────────────────────────────
  { id: 'messaging', title: 'پیام‌رسانی', page: '/dashboard/messaging', icon: MessageCircle, section: 'ارتباطات' },
  { id: 'announcements', title: 'اطلاعیه‌ها', page: '/dashboard/announcements', icon: Megaphone },
  {
    id: 'notifications',
    title: 'اعلان‌ها',
    icon: Bell,
    children: [
      { id: 'notifications.center',        title: 'مرکز اعلان‌ها',    page: '/dashboard/notifications',               icon: Bell },
      { id: 'notifications.announcements', title: 'مدیریت اطلاعیه‌ها', page: '/dashboard/notifications/announcements', icon: Megaphone, roles: ['ADMIN'] as Role[] },
      { id: 'notifications.dashboard',     title: 'آمار اعلان‌ها',     page: '/dashboard/notifications/dashboard',     icon: BarChart3, roles: ['ADMIN'] as Role[] },
    ],
  },

  // ── پایش و تحلیل ──────────────────────────────────────────
  { id: 'analytics', title: 'داشبورد مدیریتی', page: '/dashboard/analytics', icon: PieChart, section: 'پایش و تحلیل' },
  { id: 'performance', title: 'امتیاز عملکرد', page: '/dashboard/performance', icon: Trophy },
  { id: 'worldmonitor', title: 'پایش جهانی', page: '/dashboard/worldmonitor', icon: Globe },
  { id: 'biosecurity', title: 'پایش امنیت زیستی', page: '/dashboard/biosecurity', icon: Biohazard },

  // ── منابع انسانی ──────────────────────────────────────────
  {
    id: 'attendance',
    title: 'حضور و غیاب',
    icon: Fingerprint,
    section: 'منابع انسانی',
    roles: ['ADMIN'],
    children: [
      { id: 'attendance.records',   title: 'کارکرد روزانه',        page: '/dashboard/attendance/records',    icon: ClipboardList },
      { id: 'attendance.monthly',   title: 'کارکرد ماهانه',        page: '/dashboard/attendance/monthly',    icon: CalendarRange },
      { id: 'attendance.approvals', title: 'صف تایید',             page: '/dashboard/attendance/approvals',  icon: ClipboardCheck },
      { id: 'attendance.workRules', title: 'قوانین و تقویم کاری', page: '/dashboard/attendance/work-rules', icon: SlidersHorizontal },
      { id: 'attendance.shifts',    title: 'شیفت‌های نگهبانی',     page: '/dashboard/attendance/shifts',     icon: ShieldCheck },
    ],
  },
  { id: 'worklog.reports', title: 'گزارش عملکرد کاربران', page: '/dashboard/work-log/reports', icon: NotebookPen },
  { id: 'users', title: 'کاربران', page: '/dashboard/users', icon: Users, roles: ['ADMIN', 'MANAGER'] },
  { id: 'departments', title: 'دپارتمان‌ها', page: '/dashboard/departments', icon: FolderTree, roles: ['ADMIN'] },

  // ── ERP ───────────────────────────────────────────────────
  {
    id: 'assets',
    title: 'مدیریت دارایی',
    icon: Boxes,
    section: 'ERP',
    roles: ['ADMIN', 'MANAGER', 'EXPERT'],
    children: [
      { id: 'assets.list',        title: 'دارایی‌ها',    page: '/dashboard/assets',             icon: Boxes },
      { id: 'assets.assignments', title: 'واگذاری‌ها',   page: '/dashboard/assets/assignments', icon: Handshake },
      { id: 'assets.types',       title: 'انواع دارایی', page: '/dashboard/assets/types',       icon: Layers },
      { id: 'assets.categories',  title: 'دسته‌بندی‌ها', page: '/dashboard/assets/categories',  icon: Tag },
    ],
  },
  {
    id: 'org',
    title: 'ساختمان و مکان',
    icon: MapPin,
    roles: ['ADMIN', 'MANAGER'],
    children: [
      { id: 'buildings', title: 'ساختمان‌ها', page: '/dashboard/buildings', icon: Building },
      { id: 'floors',    title: 'طبقات',      page: '/dashboard/floors',    icon: Layers },
      { id: 'rooms',     title: 'اتاق‌ها',    page: '/dashboard/rooms',     icon: Home },
    ],
  },
  { id: 'accounting', title: 'حسابداری', page: '/dashboard/accounting', icon: Landmark, roles: ['ADMIN', 'MANAGER'] },

  // ── سرویس‌دهی / Help Desk ─────────────────────────────────
  {
    id: 'tickets',
    title: 'میز خدمت',
    icon: Ticket,
    section: 'سرویس‌دهی',
    children: [
      { id: 'tickets.new',       title: 'تیکت جدید',      page: '/dashboard/tickets/new',       icon: PlusCircle },
      { id: 'tickets.list',      title: 'همه تیکت‌ها',    page: '/dashboard/tickets',           icon: ClipboardList, roles: ['ADMIN', 'MANAGER', 'EXPERT'] as Role[] },
      { id: 'tickets.dashboard', title: 'داشبورد تیکت‌ها', page: '/dashboard/tickets/dashboard', icon: PieChart, roles: ['ADMIN', 'MANAGER'] as Role[] },
      { id: 'tickets.settings',  title: 'تنظیمات',         page: '/dashboard/tickets/settings',  icon: Settings, roles: ['ADMIN'] as Role[] },
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
      { id: 'access',           title: 'دسترسی صفحات',     page: '/dashboard/access',            icon: FileText },
      { id: 'admin.scoring',    title: 'شاخص‌های امتیاز',  page: '/dashboard/performance/settings', icon: Trophy },
      { id: 'admin.settings',   title: 'تنظیمات سامانه',   page: '/dashboard/settings',          icon: SlidersHorizontal },
      { id: 'admin.sessions',   title: 'مدیریت نشست‌ها',   page: '/dashboard/security/sessions', icon: ShieldCheck },
      { id: 'admin.logs',       title: 'لاگ سیستم',        page: '/dashboard/system-logs',       icon: ScrollText },
      { id: 'admin.aiSettings', title: 'هوش مصنوعی',       page: '/dashboard/ai-settings',       icon: Cpu },
      { id: 'admin.agents',     title: 'عوامل هوشمند',     page: '/dashboard/agents',            icon: Bot },
      { id: 'admin.knowledge',  title: 'پایگاه دانش',      page: '/dashboard/knowledge',         icon: BookOpen },
      { id: 'admin.workflows',  title: 'جریان‌های کاری',   page: '/dashboard/workflows',         icon: GitMerge },
      { id: 'admin.roles',      title: 'نقش‌ها و دسترسی', page: '/dashboard/roles',             icon: UserCog },
      { id: 'admin.pages',      title: 'مدیریت صفحات',     page: '/dashboard/pages',             icon: FileText },
    ],
  },
];

export default MENU;
