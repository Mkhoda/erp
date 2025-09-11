"use client";
import { motion } from "framer-motion";
import Link from "next/link";

const POSTS = [
  { id:'a', title:'۱۰ نکته برای مدیریت چرخه عمر دارایی', excerpt:'چطور از خرید تا بازنشستگی دارایی را قابل ردیابی و بهینه نگه داریم.', tag:'مدیریت دارایی', date:'۱۴۰۴/۰۶/۱۰' },
  { id:'b', title:'حاکمیت داده در ERP سبک‌وزن', excerpt:'رویکردی عملی برای اعتبار، امنیت و دسترسی داده.', tag:'حاکمیت داده', date:'۱۴۰۴/۰۶/۰۵' },
  { id:'c', title:'اتوماسیون فرآیند واگذاری', excerpt:'کاهش خطای انسانی و تسریع جریان کاری با فرم‌های ساده.', tag:'اتوماسیون', date:'۱۴۰۴/۰۵/۲۸' },
];

export default function BlogPreview(){
  return (
    <section className="mx-auto px-4 py-12 max-w-6xl">
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-bold text-xl">وبلاگ</h2>
        <Link href="#" className="text-blue-600 text-sm">مشاهده همه</Link>
      </div>
      <div className="gap-4 grid md:grid-cols-3">
        {POSTS.map((p,i)=> (
          <motion.article
            key={p.id}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: i*0.05 }}
            viewport={{ once: true }}
            className="bg-white p-4 border rounded-xl"
          >
            <div className="flex items-center gap-2 text-gray-500 text-xs">
              <span className="bg-blue-50 px-2 py-0.5 rounded text-blue-700">{p.tag}</span>
              <span>•</span>
              <time>{p.date}</time>
            </div>
            <h3 className="mt-2 font-semibold">{p.title}</h3>
            <p className="mt-1 text-gray-600 text-sm leading-relaxed">{p.excerpt}</p>
            <Link href="#" className="inline-block mt-3 text-blue-600 text-sm">ادامه مطلب</Link>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
