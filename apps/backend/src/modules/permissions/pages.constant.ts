// Canonical list of all dashboard pages — single source of truth.
// When a new page is added here it will be created in the DB on the next syncPages() call.
// Keep this in sync with apps/frontend/lib/menu.tsx
export const KNOWN_PAGES: { page: string; label: string }[] = [
  // ── AI / USER PAGES (visible to all authenticated users) ──
  { page: '/dashboard',                     label: 'نمای کلی' },
  { page: '/dashboard/chat',                label: 'گفتگو با AI' },
  { page: '/dashboard/knowledge',           label: 'پایگاه دانش' },
  { page: '/dashboard/workflows',           label: 'گردش‌کارها' },
  { page: '/dashboard/agents',              label: 'عوامل هوشمند' },
  { page: '/dashboard/profile',             label: 'پروفایل' },
  { page: '/dashboard/change-password',     label: 'تغییر رمز عبور' },

  // ── ERP PAGES (restricted by department + role) ──
  { page: '/dashboard/assets',              label: 'دارایی‌ها' },
  { page: '/dashboard/assets/types',        label: 'انواع دارایی' },
  { page: '/dashboard/assets/categories',   label: 'دسته‌بندی‌ها' },
  { page: '/dashboard/assets/assignments',  label: 'واگذاری‌ها' },
  { page: '/dashboard/accounting',          label: 'حسابداری دارایی' },
  { page: '/dashboard/departments',         label: 'دپارتمان‌ها' },
  { page: '/dashboard/buildings',           label: 'ساختمان‌ها' },
  { page: '/dashboard/floors',              label: 'طبقات' },
  { page: '/dashboard/rooms',               label: 'اتاق‌ها' },
  { page: '/dashboard/users',               label: 'کاربران' },
  { page: '/dashboard/reports',             label: 'گزارش‌ها' },

  // ── ADMIN-ONLY PAGES ──
  { page: '/dashboard/ai-settings',         label: 'تنظیمات هوش مصنوعی' },
  { page: '/dashboard/access',              label: 'دسترسی صفحات' },
  { page: '/dashboard/roles',               label: 'نقش‌ها' },
  { page: '/dashboard/pages',               label: 'مدیریت صفحات' },
  { page: '/dashboard/settings',            label: 'تنظیمات' },
];
