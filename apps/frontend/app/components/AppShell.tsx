"use client";
import React from "react";
import { motion } from "framer-motion";
import ClientProviders from "@/components/ClientProviders";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PWAInstaller from "./PWAInstaller";
import GlassyBackground from "@/components/GlassyBackground";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ClientProviders>
      <GlassyBackground />
      <div className="relative flex flex-col min-h-screen text-gray-900 dark:text-gray-100">
        <Navbar />
        <motion.main 
          className="flex-1"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          {children}
        </motion.main>
        <Footer />
        <PWAInstaller />
      </div>
    </ClientProviders>
  );
}