"use client";
import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Target, Users, Award, Lightbulb, HeartHandshake, Rocket } from 'lucide-react';

export default function AboutPage() {
  React.useEffect(() => {
    document.title = 'درباره ما | Arzesh ERP';
  }, []);

  const values = [
    {
      icon: Target,
      title: 'هدفمندی',
      description: 'تمرکز بر نیازهای واقعی کسب‌وکار شما'
    },
    {
      icon: Users,
      title: 'تیم‌گرایی',
      description: 'همکاری نزدیک با تیم شما برای بهترین نتایج'
    },
    {
      icon: Award,
      title: 'کیفیت',
      description: 'ارائه بالاترین استانداردهای کیفی در محصولات'
    },
    {
      icon: Lightbulb,
      title: 'نوآوری',
      description: 'استفاده از جدیدترین تکنولوژی‌ها و روش‌ها'
    },
    {
      icon: HeartHandshake,
      title: 'اعتماد',
      description: 'بنای کار ما بر پایه اعتماد و شفافیت است'
    },
    {
      icon: Rocket,
      title: 'رشد',
      description: 'کمک به رشد و توسعه کسب‌وکار شما'
    }
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 dark:from-blue-500/20 to-purple-600/10 dark:to-purple-500/20"></div>
        <div className="relative mx-auto px-4 max-w-6xl">
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="mb-12 text-center"
          >
            <h1 className="mb-6 font-bold text-theme-primary text-4xl md:text-5xl">
              درباره <span className="bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 text-transparent">ارزش ERP</span>
            </h1>
            <p className="mx-auto max-w-3xl text-theme-secondary text-xl leading-relaxed">
              ما با تمرکز بر سادگی، کارایی و زیبایی، راهکارهای یکپارچه مدیریت منابع سازمانی ارائه می‌دهیم
              که به رشد و موفقیت کسب‌وکار شما کمک می‌کند.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <section className="mx-auto px-4 py-16 max-w-6xl">
        <div className="items-center gap-12 grid lg:grid-cols-2 mb-20">
          <motion.div 
            initial={{ opacity: 0, x: -30 }} 
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl rotate-3 transform"></div>
              <Image 
                src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=1200&auto=format&fit=crop" 
                alt="تیم ارزش ERP" 
                width={1200} 
                height={800} 
                className="relative shadow-2xl rounded-2xl w-full"
              />
            </div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, x: 30 }} 
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-6"
          >
            <h2 className="font-bold text-theme-primary text-3xl">
              تیمی متعهد به <span className="text-blue-600 dark:text-blue-400">تعالی</span>
            </h2>
            <div className="space-y-4 text-theme-secondary leading-relaxed">
              <p>
                تیم ما از متخصصان مجرب حوزه نرم‌افزار، مدیریت و کسب‌وکار تشکیل شده است که با تجربه 
                سال‌ها کار در صنایع مختلف، درک عمیقی از چالش‌های سازمان‌ها دارند.
              </p>
              <p>
                ما معتقدیم که هر سازمان منحصر به فرد است و نیازهای خاص خود را دارد. به همین دلیل، 
                راهکارهای ما قابل انطباق و شخصی‌سازی هستند تا بهترین پاسخ را به نیازهای شما ارائه دهند.
              </p>
              <p>
                هدف ما فراتر از ارائه یک نرم‌افزار است؛ ما می‌خواهیم شریک راه شما در مسیر رشد و 
                دیجیتال شدن کسب‌وکارتان باشیم.
              </p>
            </div>
          </motion.div>
        </div>

        {/* Values Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mb-12 text-center"
        >
          <h2 className="mb-4 font-bold text-theme-primary text-3xl">
            ارزش‌های <span className="text-purple-600 dark:text-purple-400">ما</span>
          </h2>
          <p className="mx-auto max-w-2xl text-theme-secondary">
            اصول و باورهایی که ما را در مسیر ارائه بهترین خدمات راهنمایی می‌کند
          </p>
        </motion.div>

        <div className="gap-8 grid md:grid-cols-2 lg:grid-cols-3">
          {values.map((value, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 * index }}
              className="group bg-theme-card shadow-sm hover:shadow-lg backdrop-blur-sm p-6 border border-theme rounded-xl hover:scale-[1.02] transition-all duration-300"
            >
              <div className="text-center">
                <div className="inline-flex justify-center items-center bg-gradient-to-br from-blue-500 to-purple-500 mb-4 rounded-xl w-16 h-16 group-hover:scale-110 transition-transform">
                  <value.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="mb-3 font-bold text-theme-primary text-xl">
                  {value.title}
                </h3>
                <p className="text-theme-secondary leading-relaxed">
                  {value.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Mission Section */}
      <section className="bg-gradient-to-r from-blue-50/50 dark:from-blue-950/50 to-purple-50/50 dark:to-purple-950/50 py-16">
        <div className="mx-auto px-4 max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="mb-6 font-bold text-theme-primary text-3xl">
              مأموریت <span className="text-blue-600 dark:text-blue-400">ما</span>
            </h2>
            <p className="mb-8 text-theme-secondary text-lg leading-relaxed">
              هدف ما ایجاد پلی میان تکنولوژی پیشرفته و نیازهای واقعی کسب‌وکارها است. 
              ما می‌خواهیم با ارائه راهکارهای هوشمند و کاربرپسند، به سازمان‌ها کمک کنیم 
              تا منابع خود را بهینه مدیریت کرده و بر روی آنچه که واقعاً اهمیت دارد متمرکز شوند.
            </p>
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg hover:shadow-xl px-6 py-3 rounded-lg font-medium text-white transition-shadow">
              <HeartHandshake className="w-5 h-5" />
              با ما همراه باشید
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
