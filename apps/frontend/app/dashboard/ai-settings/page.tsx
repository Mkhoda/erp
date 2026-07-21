"use client";
import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Cpu, BarChart3, Shield } from "lucide-react";
import { pageTitle } from "../../../lib/branding";
import SettingsTab from "./SettingsTab";
import UsageTab from "./UsageTab";
import QuotaTab from "./QuotaTab";

const TABS = [
  { id: "settings", label: "تنظیمات AI", icon: Cpu },
  { id: "usage", label: "مصرف AI", icon: BarChart3 },
  { id: "quota", label: "سقف توکن", icon: Shield },
] as const;
type TabId = (typeof TABS)[number]["id"];

function AiHubContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (TABS.find(t => t.id === searchParams.get("tab"))?.id ?? "settings") as TabId;
  const [tab, setTab] = React.useState<TabId>(initialTab);

  React.useEffect(() => {
    const label = TABS.find(t => t.id === tab)?.label ?? "هوش مصنوعی";
    document.title = pageTitle(label);
  }, [tab]);

  const changeTab = (t: TabId) => {
    setTab(t);
    router.replace(t === "settings" ? "/dashboard/ai-settings" : `/dashboard/ai-settings?tab=${t}`);
  };

  return (
    <div dir="rtl" className="space-y-4">
      <div className="flex gap-1 bg-theme-secondary border border-theme p-1 rounded-xl w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => changeTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id ? "bg-theme-card text-theme-primary shadow-sm" : "text-theme-muted hover:text-theme-secondary"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "settings" && <SettingsTab />}
      {tab === "usage" && <UsageTab />}
      {tab === "quota" && <QuotaTab />}
    </div>
  );
}

export default function AiHubPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full text-theme-muted text-sm">در حال بارگذاری...</div>}>
      <AiHubContent />
    </Suspense>
  );
}
