"use client";
import { motion } from "framer-motion";

const FEATURES = [
  { t:'مدیریت دارایی', d:'ثبت دارایی با بارکد/QR، تصاویر، وضعیت، دسته‌بندی و هزینه‌ها.'},
  { t:'واگذاری و مکان‌ها', d:'ساختمان، طبقه و اتاق؛ واگذاری به کاربر/بخش و بازگشت.'},
  { t:'گزارش‌گیری', d:'PDF/Excel و گزارش‌های مدیریتی با فیلترهای متنوع.'},
  { t:'مجوز صفحه‌ای', d:'دسترسی خواندن/نوشتن برای هر بخش روی صفحات سیستم.'},
  { t:'PWA و TWA', d:'نصب‌پذیر، آفلاین نسبی و تبدیل به APK با Bubblewrap.'},
  { t:'امنیت و نقش‌ها', d:'ADMIN / MANAGER / USER / EXPERT با JWT.'},
];

export default function Features(){
  return (
    <section className="mx-auto px-4 py-12 max-w-6xl">
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-6 font-bold text-theme-primary text-xl"
      >
        امکانات کلیدی
      </motion.h2>
      <div className="gap-4 grid md:grid-cols-3">
        {FEATURES.map((f,i)=> (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: i*0.05 }}
            viewport={{ once: true }}
            className="bg-theme-card backdrop-blur p-4 border border-theme rounded-xl"
          >
            <div className="mb-1 font-medium text-theme-primary">{f.t}</div>
            <div className="text-theme-secondary text-sm leading-relaxed">{f.d}</div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
