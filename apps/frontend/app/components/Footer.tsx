"use client";
import { motion } from "framer-motion";
import Link from "next/link";

export default function Footer() {
  return (
    <motion.footer 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="bg-theme-card backdrop-blur-lg mt-auto border-t border-theme"
    >
      <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        <div className="py-8">
          <div className="gap-8 grid grid-cols-1 md:grid-cols-4">
            {/* Company Info */}
            <motion.div 
              className="col-span-1 md:col-span-2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <h3 className="mb-4 font-bold text-theme-primary text-xl">
                ارزش ERP
              </h3>
              <p className="text-theme-secondary leading-relaxed">
                سامانه جامع مدیریت منابع سازمانی با رویکرد مدرن و کاربرپسند
                برای بهبود فرآیندهای کسب‌وکار شما
              </p>
            </motion.div>

            {/* Quick Links */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <h4 className="mb-4 font-semibold text-gray-900 dark:text-white text-lg">
                لینک‌های سریع
              </h4>
              <ul className="space-y-2">
                {[
                  { href: "/about", label: "درباره ما" },
                  { href: "/services", label: "خدمات" },
                  { href: "/contact", label: "تماس با ما" },
                  { href: "/blog", label: "وبلاگ" }
                ].map((link, index) => (
                  <motion.li 
                    key={link.href}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.3 + index * 0.1 }}
                  >
                    <Link 
                      href={link.href}
                      className="text-gray-600 hover:text-blue-600 dark:hover:text-blue-400 dark:text-gray-300 transition-colors duration-200"
                    >
                      {link.label}
                    </Link>
                  </motion.li>
                ))}
              </ul>
            </motion.div>

            {/* Contact Info */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <h4 className="mb-4 font-semibold text-gray-900 dark:text-white text-lg">
                تماس با ما
              </h4>
              <div className="space-y-2 text-gray-600 dark:text-gray-300">
                <p>تهران، ایران</p>
                <p>info@arzesh-erp.com</p>
                <p>+98 21 1234 5678</p>
              </div>
            </motion.div>
          </div>

          {/* Bottom Bar */}
          <motion.div 
            className="mt-8 pt-6 border-gray-200/50 dark:border-gray-700/50 border-t"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <div className="flex md:flex-row flex-col justify-between items-center">
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                © {new Date().getFullYear()} ارزش ERP. تمامی حقوق محفوظ است.
              </p>
              <div className="flex space-x-6 space-x-reverse mt-4 md:mt-0">
                <Link 
                  href="/privacy" 
                  className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 dark:text-gray-400 text-sm transition-colors duration-200"
                >
                  حریم خصوصی
                </Link>
                <Link 
                  href="/terms" 
                  className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 dark:text-gray-400 text-sm transition-colors duration-200"
                >
                  شرایط استفاده
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.footer>
  );
}
