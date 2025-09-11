"use client";
import { motion } from "framer-motion";

const STATS = [
  { kpi: '+12%', label: 'کاهش خواب سرمایه دارایی' },
  { kpi: '35%', label: 'افزایش سرعت واگذاری' },
  { kpi: '99.9%', label: 'دسترس‌پذیری سرویس' },
  { kpi: '5 دقیقه', label: 'زمان استقرار در سازمان' },
];

export default function Stats(){
  return (
    <section className="mx-auto px-4 py-12 max-w-6xl">
      <div className="bg-gradient-to-tr from-blue-50 to-indigo-50 p-6 border rounded-2xl">
        <div className="gap-4 grid grid-cols-2 md:grid-cols-4">
          {STATS.map((s,i)=> (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i*0.05 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <div className="font-extrabold text-blue-700 text-2xl">{s.kpi}</div>
              <div className="mt-1 text-gray-600 text-xs">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
