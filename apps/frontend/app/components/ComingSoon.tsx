"use client";
import React from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

type Props = {
  title: string;
  description: string;
  icon: React.ElementType;
  color?: string;
};

export default function ComingSoon({ title, description, icon: Icon, color = "blue" }: Props) {
  const colorMap: Record<string, string> = {
    blue: "from-blue-600 to-blue-700",
    purple: "from-purple-600 to-violet-700",
    green: "from-green-600 to-emerald-700",
    amber: "from-amber-500 to-orange-600",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4"
      dir="rtl"
    >
      {/* Glow */}
      <div className="relative mb-8">
        <div className={`absolute inset-0 bg-gradient-to-br ${colorMap[color] || colorMap.blue} rounded-3xl blur-2xl opacity-20 scale-150`} />
        <div className={`relative w-20 h-20 rounded-3xl bg-gradient-to-br ${colorMap[color] || colorMap.blue} flex items-center justify-center shadow-2xl`}>
          <Icon className="w-9 h-9 text-white" />
        </div>
      </div>

      <h1 className="text-2xl font-bold text-theme-primary mb-3">{title}</h1>
      <p className="text-theme-muted text-sm max-w-md leading-relaxed mb-8">{description}</p>

      <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40">
        <Sparkles className="w-3.5 h-3.5 text-blue-500" />
        <span className="text-xs font-medium text-blue-600 dark:text-blue-400">در حال توسعه — به‌زودی</span>
      </div>
    </motion.div>
  );
}
