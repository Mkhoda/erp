"use client";
import { motion } from 'framer-motion';
import Image from 'next/image';
import React from 'react';
import Link from 'next/link';

const posts = [
  { 
    id: 1,
    title: '۵ مزیت اصلی ERP مدرن', 
    excerpt: 'بررسی مزایای کلیدی سیستم‌های ERP مدرن و تاثیر آن‌ها بر بهبود فرآیندهای سازمانی',
    img: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?q=80&w=1200&auto=format&fit=crop',
    category: 'تکنولوژی',
    readTime: '۵ دقیقه',
    date: '۱۴۰۳/۰۸/۱۵',
    author: 'تیم ارزش'
  },
  { 
    id: 2,
    title: 'راهنمای انتخاب سیستم مناسب', 
    excerpt: 'نکات مهم برای انتخاب بهترین سیستم ERP متناسب با نیازهای کسب‌وکار شما',
    img: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?q=80&w=1200&auto=format&fit=crop',
    category: 'راهنمای خرید',
    readTime: '۸ دقیقه',
    date: '۱۴۰۳/۰۸/۱۰',
    author: 'محمد احمدی'
  },
  { 
    id: 3,
    title: 'چگونه بهره‌وری را افزایش دهیم؟', 
    excerpt: 'روش‌های عملی برای بهبود بهره‌وری سازمانی با استفاده از ابزارهای مدیریت',
    img: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1200&auto=format&fit=crop',
    category: 'مدیریت',
    readTime: '۶ دقیقه',
    date: '۱۴۰۳/۰۸/۰۵',
    author: 'فاطمه رضایی'
  },
  {
    id: 4,
    title: 'مهاجرت داده‌ها: بهترین روش‌ها',
    excerpt: 'راهنمای جامع برای انتقال ایمن و موثر داده‌ها از سیستم‌های قدیمی به ERP جدید',
    img: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=1200&auto=format&fit=crop',
    category: 'تکنولوژی',
    readTime: '۱۰ دقیقه',
    date: '۱۴۰۳/۰۷/۲۸',
    author: 'علی حسینی'
  },
  {
    id: 5,
    title: 'امنیت در سیستم‌های ERP',
    excerpt: 'نکات مهم برای حفاظت از داده‌های حساس و پیاده‌سازی امنیت چندلایه',
    img: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?q=80&w=1200&auto=format&fit=crop',
    category: 'امنیت',
    readTime: '۷ دقیقه',
    date: '۱۴۰۳/۰۷/۲۰',
    author: 'سارا کریمی'
  },
  {
    id: 6,
    title: 'آینده هوش مصنوعی در ERP',
    excerpt: 'بررسی روندهای آینده و نقش هوش مصنوعی در تحول سیستم‌های مدیریت منابع سازمان',
    img: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=1200&auto=format&fit=crop',
    category: 'نوآوری',
    readTime: '۹ دقیقه',
    date: '۱۴۰۳/۰۷/۱۵',
    author: 'حسن موسوی'
  }
];

const categories = ['همه', 'تکنولوژی', 'راهنمای خرید', 'مدیریت', 'امنیت', 'نوآوری'];

export default function BlogPage() {
  const [selectedCategory, setSelectedCategory] = React.useState('همه');
  const [searchTerm, setSearchTerm] = React.useState('');

  React.useEffect(() => {
    document.title = 'وبلاگ | ارزش ERP';
  }, []);

  const filteredPosts = posts.filter(post => {
    const matchesCategory = selectedCategory === 'همه' || post.category === selectedCategory;
    const matchesSearch = post.title.includes(searchTerm) || post.excerpt.includes(searchTerm);
    return matchesCategory && matchesSearch;
  });

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
              وبلاگ ارزش
            </h1>
            <p className="mx-auto max-w-3xl text-theme-secondary text-xl leading-relaxed">
              آخرین اخبار، راهنماها و بینش‌های عمیق از دنیای سیستم‌های مدیریت منابع سازمان
            </p>
          </motion.div>
        </div>
      </section>

      {/* Search and Filter */}
      <section className="py-8">
        <div className="mx-auto px-6 max-w-7xl">
          <div className="flex md:flex-row flex-col justify-between items-center gap-4 mb-8">
            <div className="flex items-center gap-2 bg-theme-card p-1 border border-theme rounded-xl">
              <input
                type="text"
                placeholder="جستجو در مقالات..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 bg-transparent px-4 py-2 border-none outline-none min-w-[250px] text-sm"
              />
              <svg className="w-5 h-5 text-theme-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    selectedCategory === category
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'bg-theme-card text-theme-secondary hover:bg-theme-hover border border-theme'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Blog Posts Grid */}
      <section className="pb-16">
        <div className="mx-auto px-6 max-w-7xl">
          <div className="gap-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {filteredPosts.map((post, index) => (
              <motion.article
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                className="group bg-theme-card shadow-lg hover:shadow-2xl backdrop-blur-sm border border-theme rounded-2xl overflow-hidden transition-all duration-300"
              >
                <div className="relative h-48 overflow-hidden">
                  <Image 
                    src={post.img} 
                    alt={post.title} 
                    width={400} 
                    height={300} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                  <div className="top-4 right-4 absolute bg-blue-600 px-3 py-1 rounded-full font-medium text-white text-xs">
                    {post.category}
                  </div>
                </div>
                
                <div className="p-6">
                  <div className="flex items-center gap-4 mb-3 text-theme-muted text-xs">
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {post.date}
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {post.readTime}
                    </span>
                  </div>
                  
                  <h3 className="mb-3 font-bold text-theme-primary dark:group-hover:text-blue-400 group-hover:text-blue-600 text-xl line-clamp-2 transition-colors">
                    {post.title}
                  </h3>
                  
                  <p className="mb-4 text-theme-secondary line-clamp-3 leading-relaxed">
                    {post.excerpt}
                  </p>
                  
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="flex justify-center items-center bg-gradient-to-br from-blue-500 to-purple-600 rounded-full w-8 h-8">
                        <span className="font-medium text-white text-sm">{post.author.charAt(0)}</span>
                      </div>
                      <span className="text-gray-600 dark:text-gray-400 text-sm">{post.author}</span>
                    </div>
                    
                    <Link href={`/blog/${post.id}`} className="group flex items-center gap-1 font-medium text-blue-600 hover:text-blue-700 dark:hover:text-blue-300 dark:text-blue-400 text-sm">
                      ادامه مطلب
                      <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </Link>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
          
          {filteredPosts.length === 0 && (
            <div className="py-12 text-center">
              <svg className="mx-auto mb-4 w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 7.962 0 0112 15c-2.34 0-4.29-1.262-5.517-2.34l-1.24.24a11.04 11.04 0 01-.776 5.986C4.467 19.906 5.61 21 7.056 21H16.94c1.447 0 2.59-1.094 2.59-2.444a11.04 11.04 0 01-.776-5.986l-1.24-.24z" />
              </svg>
              <h3 className="mb-2 font-semibold text-gray-600 dark:text-gray-400 text-xl">مقاله‌ای یافت نشد</h3>
              <p className="text-gray-500 dark:text-gray-500">لطفاً عبارت جستجو یا دسته‌بندی را تغییر دهید</p>
            </div>
          )}
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="bg-gradient-to-r from-blue-600 dark:from-blue-800 to-purple-600 dark:to-purple-800 py-16">
        <div className="mx-auto px-6 max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h2 className="mb-6 font-bold text-white text-3xl md:text-4xl">
              با آخرین مقالات همراه باشید
            </h2>
            <p className="mb-8 text-blue-100 text-xl">
              اشتراک در خبرنامه و دریافت آخرین مطالب و راهنماهای ERP
            </p>
            <div className="flex sm:flex-row flex-col justify-center gap-4 mx-auto max-w-md">
              <input
                type="email"
                placeholder="ایمیل شما"
                className="flex-1 px-4 py-3 border-none rounded-xl outline-none text-gray-900"
              />
              <button className="bg-white hover:bg-gray-50 shadow-lg px-6 py-3 rounded-xl font-semibold text-blue-600 transition-colors">
                اشتراک
              </button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
