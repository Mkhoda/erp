"use client";
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cpu, CheckCircle2, XCircle, Loader2, Eye, EyeOff,
  Zap, Save, Trash2, Plus, RefreshCw, ExternalLink,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

type Provider = {
  id: string;
  name: string;
  type: string;
  apiKey: string;
  apiUrl: string | null;
  model: string | null;
  isActive: boolean;
  createdAt: string;
};

type TestResult = {
  success: boolean;
  latencyMs: number;
  model?: string;
  provider?: string;
  details?: any;
  error?: string;
  statusCode?: number;
};

const PROVIDER_INFO: Record<string, { label: string; color: string; defaultUrl: string; docUrl: string; defaultModel: string }> = {
  agnes:     { label: "Agnes AI",      color: "#6366f1", defaultUrl: "https://apihub.agnes-ai.com/v1",   docUrl: "https://agnes-ai.com/doc/overview", defaultModel: "agnes-2.0-flash" },
  openai:    { label: "OpenAI",        color: "#10a37f", defaultUrl: "https://api.openai.com/v1",        docUrl: "https://platform.openai.com/docs", defaultModel: "gpt-4o" },
  anthropic: { label: "Anthropic",     color: "#d97757", defaultUrl: "https://api.anthropic.com/v1",     docUrl: "https://docs.anthropic.com", defaultModel: "claude-sonnet-4-20250514" },
  gemini:    { label: "Google Gemini", color: "#4285f4", defaultUrl: "https://generativelanguage.googleapis.com/v1beta", docUrl: "https://ai.google.dev/docs", defaultModel: "gemini-pro" },
  deepseek:  { label: "DeepSeek",      color: "#4d6bfe", defaultUrl: "https://api.deepseek.com/v1",      docUrl: "https://platform.deepseek.com/api-docs", defaultModel: "deepseek-chat" },
  groq:      { label: "Groq",          color: "#f55036", defaultUrl: "https://api.groq.com/openai/v1",   docUrl: "https://console.groq.com/docs", defaultModel: "llama-3.3-70b-versatile" },
  custom:    { label: "سفارشی",        color: "#6b7280", defaultUrl: "",                                  docUrl: "", defaultModel: "" },
};

export default function AiSettingsPage() {
  const [providers, setProviders] = React.useState<Provider[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editingType, setEditingType] = React.useState<string | null>(null);
  const [testResults, setTestResults] = React.useState<Record<string, TestResult>>({});
  const [testing, setTesting] = React.useState<Record<string, boolean>>({});

  // Form state
  const [form, setForm] = React.useState({
    name: "",
    type: "openai",
    apiKey: "",
    apiUrl: "",
    model: "",
    isActive: true,
    safeMode: false,
  });
  const [showKey, setShowKey] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saveMsg, setSaveMsg] = React.useState<string | null>(null);

  // Fetch providers
  const fetchProviders = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/ai-settings/providers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProviders(data);
      }
    } catch (err) {
      console.error("Failed to load providers:", err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchProviders();
  }, []);

  // Start editing a provider type
  const startEdit = (type: string) => {
    const existing = providers.find(p => p.type === type);
    setEditingType(type);
    setForm({
      name: existing?.name || PROVIDER_INFO[type]?.label || type,
      type,
      apiKey: existing?.apiKey || "",
      apiUrl: existing?.apiUrl || PROVIDER_INFO[type]?.defaultUrl || "",
      model: existing?.model || PROVIDER_INFO[type]?.defaultModel || "",
      isActive: existing?.isActive ?? true,
      safeMode: (existing as any)?.config?.safeMode ?? false,
    });
    setShowKey(false);
    setSaveMsg(null);
  };

  // Save provider
  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/ai-settings/providers`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...form, config: { safeMode: form.safeMode } }),
      });
      if (res.ok) {
        setSaveMsg("ذخیره شد ✓");
        await fetchProviders();
        setTimeout(() => { setEditingType(null); setSaveMsg(null); }, 1200);
      } else {
        const err = await res.json().catch(() => ({}));
        setSaveMsg(err.message || "خطا در ذخیره‌سازی");
      }
    } catch {
      setSaveMsg("خطا در ارتباط با سرور");
    } finally {
      setSaving(false);
    }
  };

  // Test connection
  const handleTest = async (type: string) => {
    setTesting(prev => ({ ...prev, [type]: true }));
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/ai-settings/providers/${type}/test`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json();
      setTestResults(prev => ({ ...prev, [type]: result }));
    } catch {
      setTestResults(prev => ({
        ...prev,
        [type]: { success: false, latencyMs: 0, error: "خطا در ارتباط با سرور" },
      }));
    } finally {
      setTesting(prev => ({ ...prev, [type]: false }));
    }
  };

  // Toggle active
  const handleToggle = async (type: string) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/ai-settings/providers/${type}/toggle`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) await fetchProviders();
    } catch (err) { console.error("Toggle failed:", err); }
  };

  // Delete provider
  const handleDelete = async (type: string) => {
    if (!confirm(`آیا از حذف ${PROVIDER_INFO[type]?.label || type} اطمینان دارید؟`)) return;
    try {
      const token = localStorage.getItem("token");
      await fetch(`${API}/ai-settings/providers/${type}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchProviders();
      if (editingType === type) setEditingType(null);
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 font-bold text-theme-primary text-xl">
          <Cpu className="w-5 h-5 text-blue-600" />
          تنظیمات هوش مصنوعی
        </h1>
        <p className="mt-1 text-theme-muted text-sm">
          مدیریت ارائه‌دهندگان هوش مصنوعی و تست اتصال
        </p>
      </div>

      {/* Provider cards */}
      <div className="gap-4 grid grid-cols-1 md:grid-cols-2">
        {Object.entries(PROVIDER_INFO).map(([type, info]) => {
          const provider = providers.find(p => p.type === type);
          const isEditing = editingType === type;
          const test = testResults[type];
          const isTesting = testing[type];

          return (
            <motion.div
              key={type}
              layout
              className={`relative bg-theme-card border rounded-2xl p-5 transition-all ${
                provider?.isActive
                  ? "border-green-300 dark:border-green-800"
                  : "border-theme"
              }`}
            >
              {/* Header */}
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="flex justify-center items-center rounded-xl w-10 h-10 font-bold text-white text-sm"
                    style={{ backgroundColor: info.color }}
                  >
                    {info.label.substring(0, 2)}
                  </div>
                  <div>
                    <div className="font-semibold text-theme-primary text-sm">{info.label}</div>
                    {provider ? (
                      <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 text-xs">
                        <CheckCircle2 className="w-3 h-3" />
                        پیکربندی شده
                      </div>
                    ) : (
                      <div className="text-theme-muted text-xs">تنظیم نشده</div>
                    )}
                  </div>
                </div>

                {/* Toggle active/inactive */}
                {provider && (
                  <button
                    onClick={() => handleToggle(type)}
                    title={provider.isActive ? "غیرفعال کردن" : "فعال کردن"}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                      provider.isActive
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-200 dark:hover:bg-green-900/50"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${provider.isActive ? "bg-green-500" : "bg-gray-400"}`} />
                    {provider.isActive ? "فعال" : "غیرفعال"}
                  </button>
                )}
              </div>

              {/* Provider info */}
              {provider && (
                <div className="space-y-1.5 mb-4 text-theme-secondary text-xs">
                  <div className="flex justify-between">
                    <span>مدل پیش‌فرض:</span>
                    <span className="font-mono">{provider.model || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>کلید API:</span>
                    <span className="font-mono text-[11px]">{provider.apiKey}</span>
                  </div>
                  {provider.apiUrl && (
                    <div className="flex justify-between">
                      <span>آدرس API:</span>
                      <span className="max-w-40 font-mono text-[10px] truncate">{provider.apiUrl}</span>
                    </div>
                  )}
                  {(provider as any).config?.safeMode && (
                    <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      <span>حالت ایمن فعال</span>
                    </div>
                  )}
                </div>
              )}

              {/* Test result */}
              <AnimatePresence>
                {test && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className={`mb-4 p-3 rounded-xl text-xs ${
                      test.success
                        ? "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800"
                        : "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      {test.success ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-red-600" />
                      )}
                      <span className={test.success ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}>
                        {test.success ? "اتصال موفق" : "اتصال ناموفق"}
                      </span>
                    </div>
                    <div className="text-theme-muted">
                      {test.latencyMs && `زمان پاسخ: ${test.latencyMs}ms`}
                      {test.details?.modelsAvailable && ` · ${test.details.modelsAvailable} مدل موجود`}
                      {test.error && ` · ${test.error}`}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => startEdit(type)}
                  className="flex items-center gap-1.5 bg-theme-hover hover:bg-blue-50 dark:hover:bg-blue-950/30 px-3 py-2 rounded-xl text-theme-secondary hover:text-blue-600 text-xs transition-colors"
                >
                  {provider ? <RefreshCw className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                  {provider ? "ویرایش" : "افزودن"}
                </button>
                {provider && (
                  <>
                    <button
                      onClick={() => handleTest(type)}
                      disabled={isTesting}
                      className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-3 py-2 rounded-xl text-white text-xs transition-colors"
                    >
                      {isTesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                      تست اتصال
                    </button>
                    <button
                      onClick={() => handleDelete(type)}
                      className="flex items-center gap-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 px-2 py-2 rounded-xl text-theme-muted hover:text-red-600 text-xs transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>

              {/* Doc link */}
              {info.docUrl && (
                <a
                  href={info.docUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="top-5 left-5 absolute flex items-center gap-1 text-[11px] text-theme-muted hover:text-blue-500 transition-colors"
                >
                  مستندات
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Edit modal */}
      <AnimatePresence>
        {editingType && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="z-40 fixed inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setEditingType(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="top-auto md:top-1/2 bottom-4 z-50 fixed inset-x-4 md:inset-y-auto bg-theme-card shadow-2xl mx-auto p-6 border border-theme rounded-2xl max-w-lg md:-translate-y-1/2"
            >
              <h2 className="flex items-center gap-2 mb-5 font-bold text-theme-primary text-lg">
                <Cpu className="w-5 h-5" style={{ color: PROVIDER_INFO[editingType]?.color }} />
                تنظیم {PROVIDER_INFO[editingType]?.label}
              </h2>

              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block mb-1 font-medium text-theme-primary text-xs">نام نمایشی</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="bg-theme-primary px-4 py-2.5 border border-theme focus:border-blue-500 rounded-xl outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 w-full text-theme-primary text-sm transition-all"
                    placeholder="مثلاً GPT-4o"
                  />
                </div>

                {/* API Key */}
                <div>
                  <label className="block mb-1 font-medium text-theme-primary text-xs">کلید API</label>
                  <div className="relative">
                    <input
                      type={showKey ? "text" : "password"}
                      value={form.apiKey}
                      onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))}
                      className="bg-theme-primary px-4 py-2.5 pl-10 border border-theme focus:border-blue-500 rounded-xl outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 w-full font-mono text-theme-primary text-sm transition-all"
                      placeholder="sk-..."
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(v => !v)}
                      className="top-1/2 left-3 absolute text-theme-muted -translate-y-1/2"
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* API URL */}
                <div>
                  <label className="block mb-1 font-medium text-theme-primary text-xs">آدرس API (اختیاری)</label>
                  <input
                    type="url"
                    value={form.apiUrl}
                    onChange={e => setForm(f => ({ ...f, apiUrl: e.target.value }))}
                    className="bg-theme-primary px-4 py-2.5 border border-theme focus:border-blue-500 rounded-xl outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 w-full font-mono text-theme-primary text-sm transition-all"
                    placeholder={PROVIDER_INFO[editingType]?.defaultUrl}
                  />
                </div>

                {/* Model */}
                <div>
                  <label className="block mb-1 font-medium text-theme-primary text-xs">مدل پیش‌فرض (اختیاری)</label>
                  <input
                    type="text"
                    value={form.model}
                    onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                    className="bg-theme-primary px-4 py-2.5 border border-theme focus:border-blue-500 rounded-xl outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 w-full font-mono text-theme-primary text-sm transition-all"
                    placeholder={PROVIDER_INFO[editingType]?.defaultModel || ""}
                  />
                </div>

                {/* Toggles */}
                <div className="flex gap-6 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="rounded accent-blue-600 w-4 h-4" />
                    <span className="text-sm text-theme-secondary">فعال (کاربران می‌توانند استفاده کنند)</span>
                  </label>
                </div>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.safeMode} onChange={e => setForm(f => ({ ...f, safeMode: e.target.checked }))} className="rounded accent-green-600 w-4 h-4" />
                    <span className="text-sm text-theme-secondary">حالت ایمن (Safe Mode) — فیلتر محتوا</span>
                  </label>
                </div>
              </div>

              {/* Save message */}
              {saveMsg && (
                <div className={`mt-3 text-sm text-center ${saveMsg.includes("✓") ? "text-green-600" : "text-red-500"}`}>
                  {saveMsg}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 mt-5">
                <button
                  onClick={() => setEditingType(null)}
                  className="bg-theme-hover hover:bg-red-50 dark:hover:bg-red-950/30 px-4 py-2 rounded-xl text-theme-secondary hover:text-red-600 text-sm transition-colors"
                >
                  انصراف
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.apiKey}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-xl text-white text-sm transition-colors"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  ذخیره
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Loading skeleton */}
      {loading && (
        <div className="gap-4 grid grid-cols-1 md:grid-cols-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-theme-card p-5 border border-theme rounded-2xl animate-pulse">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-theme-hover rounded-xl w-10 h-10" />
                <div className="space-y-1.5">
                  <div className="bg-theme-hover rounded w-20 h-3" />
                  <div className="bg-theme-hover rounded w-16 h-2" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="bg-theme-hover rounded w-full h-2" />
                <div className="bg-theme-hover rounded w-3/4 h-2" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
