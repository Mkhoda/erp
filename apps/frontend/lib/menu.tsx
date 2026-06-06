"use client";
import { LucideIcon, LayoutDashboard, Boxes, Users, Settings, FileText, CircleDollarSign, Layers, Tag, Handshake, MapPin, Building, Home } from "lucide-react";

export type Role = 'ADMIN'|'MANAGER'|'USER'|'EXPERT';

export type MenuItem = {
  id: string;
  title: string;
  page?: string;
  icon?: LucideIcon;
  children?: MenuItem[];
  roles?: Role[];
};

export const MENU: MenuItem[] = [
  { id: 'overview', title: 'نمای کلی', page: '/dashboard', icon: LayoutDashboard },
  {
    id: 'assets', title: 'مدیریت دارایی', icon: Boxes, children: [
      { id: 'assets.list', title: 'دارایی‌ها', page: '/dashboard/assets', icon: Boxes },
      { id: 'assets.types', title: 'انواع دارایی', page: '/dashboard/assets/types', icon: Layers },
      { id: 'assets.categories', title: 'دسته‌بندی‌ها', page: '/dashboard/assets/categories', icon: Tag },
      { id: 'assets.assignments', title: 'واگذاری‌ها', page: '/dashboard/assets/assignments', icon: Handshake },
    ]
  },
  { id: 'accounting', title: 'حسابداری دارایی', page: '/dashboard/accounting', icon: CircleDollarSign, roles: ['ADMIN','MANAGER','EXPERT'] },
  {
    id: 'org', title: 'مدیریت سازمان', icon: MapPin, children: [
      { id: 'departments', title: 'دپارتمان‌ها', page: '/dashboard/departments', icon: MapPin },
      { id: 'buildings', title: 'ساختمان‌ها', page: '/dashboard/buildings', icon: Building },
      { id: 'floors', title: 'طبقات', page: '/dashboard/floors', icon: Layers },
      { id: 'rooms', title: 'اتاق‌ها', page: '/dashboard/rooms', icon: Home },
    ]
  },
  { id: 'users', title: 'کاربران', page: '/dashboard/users', icon: Users, roles: ['ADMIN','MANAGER'] },
  { id: 'access', title: 'مدیریت دسترسی', page: '/dashboard/access', icon: FileText, roles: ['ADMIN'] },
  { id: 'settings', title: 'تنظیمات', page: '/dashboard/settings', icon: Settings, roles: ['ADMIN','MANAGER'] },
];

export default MENU;
