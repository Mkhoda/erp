// Canonical list of all dashboard pages — single source of truth.
export const ADMIN_PAGES: string[] = [
  '/dashboard/ai-settings',
  '/dashboard/access',
  '/dashboard/ai-usage',
  '/dashboard/system-logs',
  '/dashboard/attendance/settings',
  '/dashboard/attendance/sync',
  '/dashboard/attendance/work-rules',
];

export const KNOWN_PAGES: { page: string; label: string; adminOnly?: boolean }[] = [
  // ── Base pages (all authenticated users) ──
  { page: '/dashboard',                    label: 'نمای کلی' },
  { page: '/dashboard/chat',               label: 'گفتگو با AI' },
  { page: '/dashboard/profile',            label: 'پروفایل' },
  { page: '/dashboard/change-password',    label: 'تغییر رمز عبور' },

  // ── ERP pages (restricted by dept + role) ──
  { page: '/dashboard/assets',             label: 'دارایی‌ها' },
  { page: '/dashboard/assets/types',       label: 'انواع دارایی' },
  { page: '/dashboard/assets/categories',  label: 'دسته‌بندی‌ها' },
  { page: '/dashboard/assets/assignments', label: 'واگذاری‌ها' },
  { page: '/dashboard/departments',        label: 'دپارتمان‌ها' },
  { page: '/dashboard/buildings',          label: 'ساختمان‌ها' },
  { page: '/dashboard/floors',             label: 'طبقات' },
  { page: '/dashboard/rooms',              label: 'اتاق‌ها' },
  { page: '/dashboard/users',              label: 'کاربران' },
  { page: '/dashboard/reports',            label: 'گزارش‌ها' },

  // ── Attendance & Workforce (restricted by dept + role) ──
  { page: '/dashboard/attendance',             label: 'حضور و غیاب' },
  { page: '/dashboard/attendance/records',     label: 'کارکرد روزانه' },
  { page: '/dashboard/attendance/calendar',    label: 'تقویم حضور' },
  { page: '/dashboard/attendance/requests',    label: 'درخواست‌های اصلاح' },
  { page: '/dashboard/attendance/approvals',   label: 'صف تایید حضور' },
  { page: '/dashboard/attendance/holidays',    label: 'تعطیلات' },
  { page: '/dashboard/attendance/shifts',      label: 'شیفت‌ها' },
  { page: '/dashboard/attendance/reports',     label: 'گزارش‌های حضور' },

  // ── Admin-only pages ──
  { page: '/dashboard/ai-settings',        label: 'تنظیمات هوش مصنوعی', adminOnly: true },
  { page: '/dashboard/access',             label: 'دسترسی صفحات',       adminOnly: true },
  { page: '/dashboard/ai-usage',           label: 'مصرف AI',             adminOnly: true },
  { page: '/dashboard/quota',              label: 'سقف توکن',             adminOnly: true },
  { page: '/dashboard/system-logs',        label: 'لاگ سیستم',           adminOnly: true },
  { page: '/dashboard/attendance/settings', label: 'تنظیمات حضور و غیاب', adminOnly: true },
  { page: '/dashboard/attendance/sync',     label: 'پایش همگام‌سازی',      adminOnly: true },
  { page: '/dashboard/attendance/work-rules', label: 'قوانین کارکرد',     adminOnly: true },
];
