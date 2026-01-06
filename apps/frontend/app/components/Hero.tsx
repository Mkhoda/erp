"use client";
import { motion } from "framer-motion";
import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative mx-auto px-4 pt-24 pb-16 max-w-6xl overflow-hidden">
      <div className="-z-10 absolute inset-0"/>
      <div className="items-center gap-10 grid md:grid-cols-2">
        <div className="space-y-6">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="font-extrabold text-blue-600 dark:text-blue-400 text-3xl md:text-5xl leading-tight tracking-tight"
          >
            ارزش ERP — مدیریت یکپارچه سازمان شما
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            viewport={{ once: true }}
            className="text-theme-secondary md:text-lg leading-relaxed"
          >
            از مدیریت دارایی‌ها و واگذاری‌ها تا منابع انسانی و مجوزهای صفحه‌ای. وب‌اپلیکیشن مدرن، نصب‌پذیر (PWA) و قابل تبدیل به APK.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            className="flex flex-wrap gap-3"
          >
            <Link 
              href="/dashboard" 
              className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 px-5 py-2.5 rounded-lg font-medium text-white text-sm hover:scale-105 transition-all duration-200 transform"
            >
              رفتن به داشبورد
            </Link>
            <Link 
              href="/signin" 
              className="hover:bg-theme-hover px-5 py-2.5 border border-theme rounded-lg font-medium text-theme-primary text-sm transition-all duration-200"
            >
              ورود
            </Link>
            <Link 
              href="/signup" 
              className="hover:bg-theme-hover px-5 py-2.5 border border-theme rounded-lg font-medium text-theme-primary text-sm transition-all duration-200"
            >
              ثبت‌نام
            </Link>
          </motion.div>
          <motion.ul
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
            className="flex flex-wrap gap-3 text-theme-secondary text-xs"
          >
            {["PWA/TWA نصب‌پذیر","گزارش‌گیری PDF/Excel","تقویم جلالی","دسترسی نقش‌محور"].map((t,i)=> (
              <motion.li 
                key={i} 
                variants={{ hidden:{opacity:0,y:10}, show:{opacity:1,y:0}}} 
                className="bg-theme-card hover:bg-theme-hover backdrop-blur px-3 py-1.5 border border-theme rounded-full transition-all duration-200"
              >
                {t}
              </motion.li>
            ))}
          </motion.ul>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          viewport={{ once: true }}
          className="md:justify-self-end"
        >
          <div className="bg-theme-card shadow-xl dark:shadow-gray-900/20 backdrop-blur p-6 border border-theme rounded-2xl w-full max-w-md">
            <div className="relative bg-gradient-to-tr from-blue-100 dark:from-blue-900/30 to-indigo-100 dark:to-indigo-900/30 rounded-xl h-48 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-transparent to-blue-200/30 dark:to-blue-800/30" />
            </div>
            <div className="gap-3 grid grid-cols-3 mt-4 text-theme-primary text-xs text-center">
              {['دارایی‌ها','کاربران','دسترسی‌ها'].map((t,i)=>(
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.4 + i * 0.1 }}
                  viewport={{ once: true }}
                  className="bg-theme-secondary hover:bg-theme-hover p-3 border border-theme rounded-lg transition-colors duration-200"
                >
                  {t}
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
