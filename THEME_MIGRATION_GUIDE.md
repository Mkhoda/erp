# 🎨 راهنمای مهاجرت به سیستم رنگی یکپارچه

تاریخ ایجاد: ژانویه 2026  
وضعیت: در حال پیاده‌سازی

## 📋 خلاصه تغییرات

یک سیستم رنگی کامل و یکپارچه در `apps/frontend/app/styles/global.css` تعریف شده است که تمامی صفحات باید از آن استفاده کنند.

---

## 🎯 کلاس‌های جدید و استفاده از آن‌ها

### 1️⃣ **پس‌زمینه‌ها (Backgrounds)**

| کلاس قدیمی | کلاس جدید | توضیحات |
|------------|-----------|---------|
| `bg-white dark:bg-gray-900` | `bg-theme-primary` | پس‌زمینه اصلی کارت‌ها |
| `bg-gray-50 dark:bg-gray-800` | `bg-theme-secondary` | پس‌زمینه ثانویه |
| `bg-gray-100 dark:bg-gray-800` | `bg-theme-tertiary` | پس‌زمینه سطح سوم |
| `bg-white/70 dark:bg-gray-900/70` | `bg-theme-card` | کارت با Glass effect |
| `bg-gray-50 dark:bg-gray-900` | `bg-theme-base` | پس‌زمینه صفحه |
| `hover:bg-gray-100 dark:hover:bg-gray-800` | `bg-theme-hover` | حالت hover |

### 2️⃣ **متن‌ها (Text Colors)**

| کلاس قدیمی | کلاس جدید | توضیحات |
|------------|-----------|---------|
| `text-gray-900 dark:text-gray-100` | `text-theme-primary` | متن اصلی/عناوین |
| `text-gray-600 dark:text-gray-400` | `text-theme-secondary` | متن بدنه |
| `text-gray-500 dark:text-gray-400` | `text-theme-muted` | متن کمرنگ/Caption |

### 3️⃣ **بوردرها (Borders)**

| کلاس قدیمی | کلاس جدید | توضیحات |
|------------|-----------|---------|
| `border-gray-200 dark:border-gray-700` | `border-theme` | بوردر اصلی |
| `border-gray-200/50 dark:border-gray-700/50` | `border-theme` | بوردر اصلی |
| `border-gray-100 dark:border-gray-800` | `border-theme-light` | بوردر سبک |
| `border-gray-300 dark:border-gray-600` | `border-theme-strong` | بوردر پررنگ |

### 4️⃣ **کامپوننت‌های آماده**

#### 🎴 کارت‌ها
```tsx
// قدیمی ❌
<div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">

// جدید ✅
<div className="card-theme">
```

#### 📊 جداول
```tsx
// قدیمی ❌
<div className="bg-white dark:bg-gray-900 border border-gray-200 rounded-xl">
  <table className="w-full">

// جدید ✅
<div className="table-theme-container">
  <table className="table-theme">
```

#### 🔘 اینپوت‌ها
```tsx
// قدیمی ❌
<input className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2" />

// جدید ✅
<input className="input-theme" />
```

#### 🎯 دکمه‌ها
```tsx
// Primary Button
<button className="btn-theme-primary">افزودن</button>

// Secondary Button
<button className="btn-theme-secondary">انصراف</button>

// Danger Button
<button className="btn-theme-danger">حذف</button>
```

#### 🏷️ Badge/Pills
```tsx
<span className="badge-theme">فعال</span>
```

---

## 🔄 الگوهای جایگزینی رایج

### الگو 1: هدر صفحات Dashboard
```tsx
// قدیمی ❌
<div className="bg-white/70 dark:bg-gray-900/70 shadow-sm backdrop-blur-sm p-6 border border-gray-200/50 dark:border-gray-700/50 rounded-xl">
  <h1 className="text-gray-900 dark:text-gray-100 font-bold text-2xl">عنوان</h1>
  <p className="text-gray-600 dark:text-gray-400">توضیحات</p>
</div>

// جدید ✅
<div className="bg-theme-card backdrop-blur-sm shadow-theme p-6 rounded-xl">
  <h1 className="text-theme-primary font-bold text-2xl">عنوان</h1>
  <p className="text-theme-secondary">توضیحات</p>
</div>
```

### الگو 2: جداول داده
```tsx
// قدیمی ❌
<div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
  <table className="w-full">
    <thead className="bg-gray-50 dark:bg-gray-800">
      <tr>
        <th className="text-gray-600 dark:text-gray-400">ستون</th>
      </tr>
    </thead>
    <tbody>
      <tr className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
        <td className="text-gray-900 dark:text-gray-100">داده</td>
      </tr>
    </tbody>
  </table>
</div>

// جدید ✅
<div className="table-theme-container">
  <table className="table-theme">
    <thead>
      <tr>
        <th>ستون</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>داده</td>
      </tr>
    </tbody>
  </table>
</div>
```

### الگو 3: فرم‌ها
```tsx
// قدیمی ❌
<div className="space-y-4">
  <div>
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">نام</label>
    <input 
      type="text" 
      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
    />
  </div>
</div>

// جدید ✅
<div className="space-y-4">
  <div>
    <label className="block text-sm font-medium text-theme-primary mb-2">نام</label>
    <input type="text" className="input-theme" />
  </div>
</div>
```

### الگو 4: Modal/Dialog
```tsx
// قدیمی ❌
<div className="fixed inset-0 bg-black/50 flex items-center justify-center">
  <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 max-w-md w-full">

// جدید ✅
<div className="fixed inset-0 bg-black/50 flex items-center justify-center">
  <div className="card-theme p-6 max-w-md w-full">
```

---

## 📝 چک‌لیست مهاجرت صفحات

### ✅ کامل شده
- [x] `global.css` - سیستم رنگی کامل
- [x] `dashboard/roles/page.tsx` - نمونه کامل

### 🔄 در حال انجام
- [ ] `dashboard/page.tsx` - صفحه اصلی داشبورد
- [ ] `dashboard/users/page.tsx` - مدیریت کاربران
- [ ] `dashboard/assets/page.tsx` - مدیریت دارایی‌ها
- [ ] `dashboard/layout.tsx` - Layout اصلی

### ⏳ در انتظار
- [ ] `dashboard/buildings/page.tsx`
- [ ] `dashboard/floors/page.tsx`
- [ ] `dashboard/rooms/page.tsx`
- [ ] `dashboard/departments/page.tsx`
- [ ] `dashboard/profile/page.tsx`
- [ ] `dashboard/settings/page.tsx`
- [ ] `dashboard/accounting/page.tsx`
- [ ] `dashboard/assets/assignments/page.tsx`
- [ ] `(application)/signin/page.tsx`
- [ ] `(application)/signup/page.tsx`
- [ ] صفحات landing pages

---

## 🎨 نکات مهم

### 1. رنگ‌های Semantic
رنگ‌های semantic (success, warning, error, info) همچنان می‌توانند مستقیم استفاده شوند:
```tsx
✅ <span className="text-green-600 dark:text-green-400">موفق</span>
✅ <span className="text-red-600 dark:text-red-400">خطا</span>
✅ <span className="text-amber-600 dark:text-amber-400">هشدار</span>
```

### 2. Shadow ها
```tsx
// سایه معمولی
<div className="shadow-theme">

// سایه بزرگ
<div className="shadow-theme-lg">
```

### 3. Transitions
همه کلاس‌های theme به صورت خودکار transition دارند (تعریف شده در `*` selector در global.css).

---

## 🚀 مراحل بروزرسانی یک صفحه

1. **باز کردن فایل صفحه**
2. **Find & Replace:**
   - `bg-white dark:bg-gray-900` → `bg-theme-primary`
   - `text-gray-900 dark:text-gray-100` → `text-theme-primary`
   - `border-gray-200 dark:border-gray-700` → `border-theme`
3. **جایگزینی کامپوننت‌ها:**
   - جداول → `table-theme` & `table-theme-container`
   - اینپوت‌ها → `input-theme`
   - دکمه‌ها → `btn-theme-*`
4. **تست:**
   - چک کردن در Light Mode
   - چک کردن در Dark Mode
   - بررسی responsive بودن

---

## 📊 آمار پیشرفت

| مرحله | وضعیت | درصد |
|------|-------|------|
| طراحی سیستم رنگی | ✅ Complete | 100% |
| تعریف کلاس‌ها در CSS | ✅ Complete | 100% |
| بروزرسانی صفحات Dashboard | 🔄 In Progress | 10% |
| بروزرسانی صفحات Authentication | ⏳ Pending | 0% |
| بروزرسانی Landing Pages | ⏳ Pending | 0% |
| تست و QA | ⏳ Pending | 0% |

---

## 🐛 مشکلات شناخته شده

1. ⚠️ بعضی جداول هنوز inline styles دارند
2. ⚠️ Modal ها نیاز به یکپارچه‌سازی دارند
3. ⚠️ بعضی form validationها رنگ‌های hardcoded دارند

---

## 🎯 اهداف نهایی

✨ **هدف کلی:** طراحی یکپارچه در تمام صفحات با:
- ✅ رنگ‌های ثابت در light و dark mode
- ✅ Border های consistent
- ✅ Typography یکپارچه
- ✅ Shadow و spacing استاندارد
- ✅ Transition های smooth

---

**آخرین بروزرسانی:** ژانویه 2026  
**مسئول:** GitHub Copilot  
**وضعیت کلی:** 🔄 **در حال پیاده‌سازی**
