"use client";
import React from "react";

export default function GlassyBackground() {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div className="-z-10 fixed inset-0 overflow-hidden pointer-events-none">
      {/* Base clean gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50 dark:from-gray-900 via-white dark:via-gray-800 to-blue-50 dark:to-gray-900" />
      
      {/* Glass bullet patterns with advanced blur and fade */}
      <div className="absolute inset-0 opacity-30 dark:opacity-15" 
           style={{
             backgroundImage: `
               radial-gradient(circle at 2px 2px, rgba(59, 130, 246, 0.4) 1.5px, transparent 1.5px),
               radial-gradient(circle at 2px 2px, rgba(147, 197, 253, 0.2) 1px, transparent 1px)
             `,
             backgroundSize: '40px 40px, 20px 20px',
             backgroundPosition: '0 0, 10px 10px',
             filter: 'blur(0.5px)',
             maskImage: 'radial-gradient(ellipse 80% 60% at center, black 20%, rgba(0,0,0,0.6) 60%, transparent 100%)',
             WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at center, black 20%, rgba(0,0,0,0.6) 60%, transparent 100%)'
           }} />
      
      {/* Glass overlay layer with frosted effect */}
      <div className="absolute inset-0 opacity-20 dark:opacity-8" 
           style={{
             backgroundImage: `
               radial-gradient(circle at 1px 1px, rgba(99, 102, 241, 0.6) 1px, transparent 0)
             `,
             backgroundSize: '60px 60px',
             backgroundPosition: '30px 30px',
             filter: 'blur(1px)',
             backdropFilter: 'blur(2px)',
             maskImage: 'radial-gradient(ellipse 70% 50% at center, black 30%, rgba(0,0,0,0.4) 70%, transparent 90%)',
             WebkitMaskImage: 'radial-gradient(ellipse 70% 50% at center, black 30%, rgba(0,0,0,0.4) 70%, transparent 90%)'
           }} />

      {/* Subtle animated glass dots */}
      <div className="absolute inset-0 opacity-15 dark:opacity-6 animate-pulse" 
           style={{
             backgroundImage: `
               radial-gradient(circle at 2px 2px, rgba(168, 85, 247, 0.5) 1px, transparent 0),
               radial-gradient(circle at 1px 1px, rgba(34, 197, 94, 0.3) 0.5px, transparent 0)
             `,
             backgroundSize: '80px 80px, 120px 120px',
             backgroundPosition: '40px 40px, 60px 60px',
             filter: 'blur(1.5px)',
             maskImage: 'radial-gradient(ellipse 60% 40% at center, black 40%, rgba(0,0,0,0.3) 80%, transparent 100%)',
             WebkitMaskImage: 'radial-gradient(ellipse 60% 40% at center, black 40%, rgba(0,0,0,0.3) 80%, transparent 100%)'
           }} />

      {/* Floating glass particles */}
      <div className="absolute inset-0 opacity-10 dark:opacity-4 animate-[fadeFloat_20s_ease-in-out_infinite]" 
           style={{
             backgroundImage: `
               radial-gradient(circle at 1px 1px, rgba(236, 72, 153, 0.6) 1.5px, transparent 0),
               radial-gradient(circle at 1px 1px, rgba(251, 191, 36, 0.4) 1px, transparent 0)
             `,
             backgroundSize: '100px 100px, 150px 150px',
             backgroundPosition: '50px 50px, 75px 75px',
             filter: 'blur(2px)',
             maskImage: 'radial-gradient(circle at center, black 50%, rgba(0,0,0,0.2) 90%, transparent 100%)',
             WebkitMaskImage: 'radial-gradient(circle at center, black 50%, rgba(0,0,0,0.2) 90%, transparent 100%)'
           }} />

      {/* Redesigned floating blobs with glass effect */}
      <div
        className="-top-20 -left-20 absolute opacity-30 dark:opacity-15 blur-3xl rounded-full w-96 h-96 animate-[float_25s_ease-in-out_infinite] mix-blend-normal"
        style={{ 
          background: "radial-gradient(circle at 40% 40%, rgba(59, 130, 246, 0.3), rgba(147, 197, 253, 0.15) 70%, transparent 100%)",
          animationDelay: '0s',
          filter: 'blur(40px) saturate(150%)'
        }}
      />
      <div
        className="top-16 left-1/2 absolute opacity-25 dark:opacity-12 blur-3xl rounded-full w-[28rem] h-[28rem] -translate-x-1/2 animate-[float_30s_ease-in-out_infinite] mix-blend-normal"
        style={{ 
          background: "radial-gradient(circle at 50% 50%, rgba(168, 85, 247, 0.25), rgba(196, 181, 253, 0.12) 70%, transparent 100%)",
          animationDelay: '-5s',
          filter: 'blur(45px) saturate(140%)'
        }}
      />
      <div
        className="-bottom-16 left-16 absolute opacity-28 dark:opacity-14 blur-3xl rounded-full w-80 h-80 animate-[float_28s_ease-in-out_infinite] mix-blend-normal"
        style={{ 
          background: "radial-gradient(circle at 60% 40%, rgba(34, 197, 94, 0.28), rgba(134, 239, 172, 0.14) 70%, transparent 100%)",
          animationDelay: '-10s',
          filter: 'blur(35px) saturate(130%)'
        }}
      />
      <div
        className="top-12 right-8 absolute opacity-25 dark:opacity-12 blur-3xl rounded-full w-72 h-72 animate-[float_22s_ease-in-out_infinite] mix-blend-normal"
        style={{ 
          background: "radial-gradient(circle at 40% 60%, rgba(236, 72, 153, 0.25), rgba(251, 207, 232, 0.12) 70%, transparent 100%)",
          animationDelay: '-15s',
          filter: 'blur(38px) saturate(145%)'
        }}
      />
      <div
        className="right-1/4 bottom-20 absolute opacity-22 dark:opacity-11 blur-3xl rounded-full w-[32rem] h-[32rem] animate-[float_35s_ease-in-out_infinite] mix-blend-normal"
        style={{ 
          background: "radial-gradient(circle at 50% 50%, rgba(251, 191, 36, 0.22), rgba(254, 240, 138, 0.11) 70%, transparent 100%)",
          animationDelay: '-20s',
          filter: 'blur(50px) saturate(135%)'
        }}
      />

      {/* Glass overlay for extra depth */}
      <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.08]" 
           style={{
             background: 'radial-gradient(ellipse at center, transparent 30%, rgba(59, 130, 246, 0.05) 70%, rgba(59, 130, 246, 0.1) 100%)',
             backdropFilter: 'blur(1px)'
           }} />
    </div>
  );
}