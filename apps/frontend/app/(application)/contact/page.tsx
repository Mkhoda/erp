"use client";
import React from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { Mail, Phone, MapPin, Clock, Send, MessageCircle, Headphones } from 'lucide-react';

export default function ContactPage() {
  React.useEffect(() => {
    document.title = 'تماس با ما | Arzesh ERP';
  }, []);

  const [formData, setFormData] = React.useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission
    console.log('Form submitted:', formData);
  };

  const contactInfo = [
    {
      icon: Phone,
      title: 'تلفن تماس',
      value: '۰۲۱-۱۲۳۴۵۶۷۸',
      description: 'پاسخگویی در ساعات اداری'
    },
    {
      icon: Mail,
      title: 'ایمیل',
      value: 'info@arzesh-erp.com',
      description: 'پشتیبانی ۲۴ ساعته'
    },
    {
      icon: MapPin,
      title: 'آدرس',
      value: 'تهران، خیابان ولیعصر',
      description: 'دفتر مرکزی'
    },
    {
      icon: Clock,
      title: 'ساعات کاری',
      value: '۸:۰۰ تا ۱۷:۰۰',
      description: 'شنبه تا چهارشنبه'
    }
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-green-600/10 dark:from-green-500/20 to-blue-600/10 dark:to-blue-500/20"></div>
        <div className="relative mx-auto px-4 max-w-6xl">
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="mb-12 text-center"
          >
            <h1 className="mb-6 font-bold text-gray-900 dark:text-gray-100 text-4xl md:text-5xl">
              ارتباط با <span className="bg-clip-text bg-gradient-to-r from-green-600 to-blue-600 text-transparent">ما</span>
            </h1>
            <p className="mx-auto max-w-3xl text-gray-600 dark:text-gray-400 text-xl">
              با تیم متخصص ما در تماس باشید. ما آماده پاسخگویی به سوالات و ارائه مشاوره به شما هستیم.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <section className="mx-auto px-4 py-16 max-w-6xl">
        <div className="gap-12 grid lg:grid-cols-3">
          {/* Contact Info */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-8"
            >
              <div>
                <h2 className="mb-4 font-bold text-gray-900 dark:text-gray-100 text-2xl">
                  راه‌های تماس
                </h2>
                <p className="mb-8 text-gray-600 dark:text-gray-400">
                  از طریق راه‌های زیر می‌تونید با ما در ارتباط باشید
                </p>
              </div>

              <div className="space-y-6">
                {contactInfo.map((info, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-start gap-4 bg-white/70 dark:bg-gray-900/70 shadow-sm hover:shadow-md backdrop-blur-sm p-4 border border-gray-200/50 dark:border-gray-700/50 rounded-xl transition-shadow"
                  >
                    <div className="bg-gradient-to-br from-green-500 to-blue-500 p-3 rounded-lg">
                      <info.icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="mb-1 font-semibold text-gray-900 dark:text-gray-100">
                        {info.title}
                      </h3>
                      <p className="mb-1 font-medium text-gray-900 dark:text-gray-100">
                        {info.value}
                      </p>
                      <p className="text-gray-600 dark:text-gray-400 text-sm">
                        {info.description}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Quick Contact Buttons */}
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  تماس سریع
                </h3>
                <div className="flex flex-col gap-3">
                  <button className="flex items-center gap-3 bg-green-600 hover:bg-green-700 px-4 py-3 rounded-lg text-white transition-colors">
                    <MessageCircle className="w-4 h-4" />
                    چت آنلاین
                  </button>
                  <button className="flex items-center gap-3 bg-blue-600 hover:bg-blue-700 px-4 py-3 rounded-lg text-white transition-colors">
                    <Headphones className="w-4 h-4" />
                    درخواست تماس
                  </button>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="bg-white/70 dark:bg-gray-900/70 shadow-sm backdrop-blur-sm p-8 border border-gray-200/50 dark:border-gray-700/50 rounded-xl">
                <div className="mb-8">
                  <h2 className="mb-2 font-bold text-gray-900 dark:text-gray-100 text-2xl">
                    پیام خود را ارسال کنید
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    فرم زیر را پر کنید تا در اسرع وقت با شما تماس بگیریم
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="gap-6 grid md:grid-cols-2">
                    <div>
                      <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300 text-sm">
                        نام و نام خانوادگی *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border border-gray-200 dark:border-gray-700 focus:border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 w-full text-gray-900 dark:text-gray-100 transition-colors placeholder-gray-500 dark:placeholder-gray-400"
                        placeholder="نام خود را وارد کنید"
                      />
                    </div>
                    <div>
                      <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300 text-sm">
                        شماره تلفن
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border border-gray-200 dark:border-gray-700 focus:border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 w-full text-gray-900 dark:text-gray-100 transition-colors placeholder-gray-500 dark:placeholder-gray-400"
                        placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300 text-sm">
                      ایمیل *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border border-gray-200 dark:border-gray-700 focus:border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 w-full text-gray-900 dark:text-gray-100 transition-colors placeholder-gray-500 dark:placeholder-gray-400"
                      placeholder="your@email.com"
                    />
                  </div>

                  <div>
                    <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300 text-sm">
                      موضوع
                    </label>
                    <select
                      value={formData.subject}
                      onChange={(e) => setFormData({...formData, subject: e.target.value})}
                      className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border border-gray-200 dark:border-gray-700 focus:border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 w-full text-gray-900 dark:text-gray-100 transition-colors"
                    >
                      <option value="">موضوع را انتخاب کنید</option>
                      <option value="support">پشتیبانی فنی</option>
                      <option value="sales">فروش و مشاوره</option>
                      <option value="demo">درخواست دمو</option>
                      <option value="partnership">همکاری</option>
                      <option value="other">سایر</option>
                    </select>
                  </div>

                  <div>
                    <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300 text-sm">
                      پیام *
                    </label>
                    <textarea
                      required
                      rows={6}
                      value={formData.message}
                      onChange={(e) => setFormData({...formData, message: e.target.value})}
                      className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border border-gray-200 dark:border-gray-700 focus:border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 w-full text-gray-900 dark:text-gray-100 transition-colors resize-none placeholder-gray-500 dark:placeholder-gray-400"
                      placeholder="پیام خود را بنویسید..."
                    />
                  </div>

                  <button
                    type="submit"
                    className="flex justify-center items-center gap-2 bg-gradient-to-r from-green-600 hover:from-green-700 to-blue-600 hover:to-blue-700 shadow-lg hover:shadow-xl px-6 py-4 rounded-lg w-full font-medium text-white transition-all duration-200"
                  >
                    <Send className="w-5 h-5" />
                    ارسال پیام
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-gradient-to-r from-gray-50/50 dark:from-gray-950/50 to-blue-50/50 dark:to-blue-950/50 py-16">
        <div className="mx-auto px-4 max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12 text-center"
          >
            <h2 className="mb-4 font-bold text-gray-900 dark:text-gray-100 text-3xl">
              سوالات <span className="text-blue-600 dark:text-blue-400">متداول</span>
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              پاسخ سوالات رایج در اینجا آمده است
            </p>
          </motion.div>

          <div className="space-y-4">
            {[
              {
                question: 'چه مدت زمان برای پیاده‌سازی سیستم نیاز است؟',
                answer: 'بسته به پیچیدگی پروژه، معمولاً بین ۲ تا ۸ هفته زمان نیاز است.'
              },
              {
                question: 'آیا امکان شخصی‌سازی سیستم وجود دارد؟',
                answer: 'بله، سیستم ما کاملاً قابل انطباق با نیازهای خاص سازمان شما است.'
              },
              {
                question: 'آیا پشتیبانی فنی ارائه می‌شود؟',
                answer: 'بله، ما پشتیبانی فنی ۲۴ ساعته و آموزش کامل کاربران را ارائه می‌دهیم.'
              }
            ].map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm p-6 border border-gray-200/50 dark:border-gray-700/50 rounded-lg"
              >
                <h3 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">
                  {faq.question}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {faq.answer}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
