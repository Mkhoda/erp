"use client";
import { motion } from 'framer-motion';
import Image from 'next/image';
import React from 'react';

export default function ServicesPage() {
  React.useEffect(() => {
    document.title = 'خدمات | ارزش ERP';
  }, []);

  const services = [
    { 
      title: 'مشاوره و استقرار', 
      description: 'ارائه مشاوره تخصصی برای انتخاب و پیاده‌سازی سیستم ERP مناسب با نیازهای سازمان شما',
      img: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?q=80&w=1200&auto=format&fit=crop',
      features: ['تحلیل نیازسنجی', 'طراحی معماری سیستم', 'راهبری پروژه', 'آموزش کاربران'],
      icon: '🎯'
    },
    { 
      title: 'تحلیل و توسعه', 
      description: 'توسعه ماژول‌های اختصاصی و سفارشی‌سازی سیستم بر اساس فرآیندهای منحصربه‌فرد سازمان',
      img: 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?q=80&w=1200&auto=format&fit=crop',
      features: ['تحلیل فرآیندها', 'توسعه ماژول‌ها', 'یکپارچه‌سازی', 'تست و کیفیت‌سنجی'],
      icon: '⚡'
    },
    { 
      title: 'آموزش و پشتیبانی', 
      description: 'آموزش جامع کاربران و ارائه پشتیبانی مستمر برای تضمین بهره‌وری مطلوب از سیستم',
      img: 'https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?q=80&w=1200&auto=format&fit=crop',
      features: ['آموزش حضوری و مجازی', 'تهیه مستندات', 'پشتیبانی ۲۴/۷', 'به‌روزرسانی مستمر'],
      icon: '🎓'
    },
    {
      title: 'مهاجرت داده',
      description: 'انتقال ایمن و دقیق داده‌های موجود از سیستم‌های قدیمی به سیستم ERP جدید',
      img: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=1200&auto=format&fit=crop',
      features: ['تحلیل داده‌ها', 'پاکسازی اطلاعات', 'انتقال مطمئن', 'تست صحت داده‌ها'],
      icon: '🔄'
    },
    {
      title: 'گزارش‌گیری هوشمند',
      description: 'طراحی و توسعه گزارش‌های تحلیلی و داشبوردهای مدیریتی برای تصمیم‌گیری بهتر',
      img: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=1200&auto=format&fit=crop',
      features: ['داشبورد تعاملی', 'گزارش‌های بصری', 'تحلیل داده‌ها', 'هشدارهای هوشمند'],
      icon: '📊'
    },
    {
      title: 'امنیت و بک‌آپ',
      description: 'پیاده‌سازی راهکارهای امنیتی پیشرفته و سیستم پشتیبان‌گیری مطمئن از داده‌ها',
      img: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?q=80&w=1200&auto=format&fit=crop',
      features: ['رمزنگاری داده‌ها', 'کنترل دسترسی', 'بک‌آپ خودکار', 'بازیابی اضطراری'],
      icon: '🛡️'
    }
  ];

  return (
    <div className="bg-gradient-to-br from-blue-50 dark:from-gray-900 via-white dark:via-gray-800 to-indigo-50 dark:to-gray-900 min-h-screen">
      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 dark:from-blue-800/30 to-purple-600/20 dark:to-purple-800/30"></div>
        <div className="relative mx-auto px-6 max-w-7xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 mb-6 font-bold text-transparent text-5xl md:text-6xl">
              خدمات ما
            </h1>
            <p className="mx-auto max-w-3xl text-gray-600 dark:text-gray-300 text-xl leading-relaxed">
              ما مجموعه کاملی از خدمات ERP را ارائه می‌دهیم تا کسب‌وکار شما را به سطح جدیدی از کارایی و موفقیت برسانیم
            </p>
          </motion.div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-16">
        <div className="mx-auto px-6 max-w-7xl">
          <div className="gap-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {services.map((service, index) => (
              <motion.div
                key={service.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                className="group bg-white/80 dark:bg-gray-800/80 shadow-lg hover:shadow-2xl backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden transition-all duration-300"
              >
                <div className="relative h-48 overflow-hidden">
                  <Image 
                    src={service.img} 
                    alt={service.title} 
                    width={400} 
                    height={300} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                  <div className="top-4 right-4 absolute flex justify-center items-center bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-full w-12 h-12 text-3xl">
                    {service.icon}
                  </div>
                </div>
                
                <div className="p-6">
                  <h3 className="mb-3 font-bold text-gray-900 dark:group-hover:text-blue-400 dark:text-white group-hover:text-blue-600 text-xl transition-colors">
                    {service.title}
                  </h3>
                  <p className="mb-4 text-gray-600 dark:text-gray-300 leading-relaxed">
                    {service.description}
                  </p>
                  
                  <div className="space-y-2">
                    <h4 className="font-semibold text-gray-900 dark:text-white text-sm">ویژگی‌های کلیدی:</h4>
                    <ul className="space-y-1">
                      {service.features.map((feature, idx) => (
                        <li key={idx} className="flex items-center text-gray-600 dark:text-gray-300 text-sm">
                          <svg className="flex-shrink-0 ml-2 w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-blue-600 dark:from-blue-800 to-purple-600 dark:to-purple-800 py-16">
        <div className="mx-auto px-6 max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h2 className="mb-6 font-bold text-white text-3xl md:text-4xl">
              آماده شروع همکاری هستید؟
            </h2>
            <p className="mb-8 text-blue-100 text-xl">
              با تیم متخصص ما تماس بگیرید و رایگان مشاوره دریافت کنید
            </p>
            <div className="flex sm:flex-row flex-col justify-center gap-4">
              <button className="bg-white hover:bg-gray-50 shadow-lg px-8 py-3 rounded-xl font-semibold text-blue-600 transition-colors">
                مشاوره رایگان
              </button>
              <button className="hover:bg-white/10 px-8 py-3 border-2 border-white rounded-xl font-semibold text-white transition-colors">
                مشاهده نمونه کارها
              </button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
