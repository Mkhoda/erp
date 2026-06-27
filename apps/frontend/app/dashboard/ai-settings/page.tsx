"use client";
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cpu, CheckCircle2, XCircle, Loader2, Eye, EyeOff,
  Zap, Save, Trash2, Plus, RefreshCw, ExternalLink, ChevronDown,
} from "lucide-react";
import Modal from "../../components/ui/Modal";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

type Provider = {
  id: string;
  name: string;
  type: string;
  apiKey: string;
  apiUrl: string | null;
  model: string | null;
  isActive: boolean;
  config?: { safeMode?: boolean };
  createdAt: string;
};

type TestResult = { success: boolean; latencyMs: number; model?: string; provider?: string; details?: any; error?: string };

const PROVIDER_INFO: Record<string, { label: string; color: string; defaultUrl: string; docUrl: string; defaultModel: string; defaultApiKey?: string; noApiKey?: boolean }> = {
  agnes:      { label: "Agnes AI",            color: "#6366f1", defaultUrl: "https://apihub.agnes-ai.com/v1",                   docUrl: "https://agnes-ai.com/doc/overview",       defaultModel: "agnes-2.0-flash" },
  openai:     { label: "OpenAI",              color: "#10a37f", defaultUrl: "https://api.openai.com/v1",                        docUrl: "https://platform.openai.com/docs",        defaultModel: "gpt-4o" },
  anthropic:  { label: "Anthropic",           color: "#d97757", defaultUrl: "https://api.anthropic.com/v1",                     docUrl: "https://docs.anthropic.com",              defaultModel: "claude-sonnet-4-20250514" },
  gemini:     { label: "Google Gemini",       color: "#4285f4", defaultUrl: "https://generativelanguage.googleapis.com/v1beta", docUrl: "https://ai.google.dev/docs",              defaultModel: "gemini-pro" },
  deepseek:   { label: "DeepSeek",            color: "#4d6bfe", defaultUrl: "https://api.deepseek.com/v1",                      docUrl: "https://platform.deepseek.com/api-docs",  defaultModel: "deepseek-chat" },
  groq:       { label: "Groq",                color: "#f55036", defaultUrl: "https://api.groq.com/openai/v1",                   docUrl: "https://console.groq.com/docs",           defaultModel: "llama-3.3-70b-versatile" },
  openrouter: { label: "OpenRouter",          color: "#7c3aed", defaultUrl: "https://openrouter.ai/api/v1",                     docUrl: "https://openrouter.ai/docs",              defaultModel: "openai/gpt-4o-mini" },
  ollama:     { label: "Ollama (سرور داخلی)", color: "#ff6b35", defaultUrl: "http://192.168.30.13:11434/v1",                    docUrl: "",                                        defaultModel: "llama3",            defaultApiKey: "ollama", noApiKey: true },
  whisper:    { label: "Whisper (تبدیل صدا)", color: "#0ea5e9", defaultUrl: "http://192.168.30.13:8001",                        docUrl: "",                                        defaultModel: "",                  defaultApiKey: "-",      noApiKey: true },
  custom:     { label: "سفارشی",              color: "#6b7280", defaultUrl: "",                                                 docUrl: "",                                        defaultModel: "" },
};

const emptyForm = (type = "openai") => ({
  name:     PROVIDER_INFO[type]?.label || "",
  type,
  apiKey:   PROVIDER_INFO[type]?.defaultApiKey || "",
  apiUrl:   PROVIDER_INFO[type]?.defaultUrl || "",
  model:    PROVIDER_INFO[type]?.defaultModel || "",
  isActive: true,
  safeMode: false,
});

export default function AiSettingsPage() {
  const [providers, setProviders]     = React.useState<Provider[]>([]);
  const [loading, setLoading]         = React.useState(true);
  const [modal, setModal]             = React.useState<null | { mode: "create" | "edit"; provider?: Provider }>(null);
  const [testResults, setTestResults] = React.useState<Record<string, TestResult>>({});
  const [testing, setTesting]         = React.useState<Record<string, boolean>>({});
  const [form, setForm]               = React.useState(emptyForm());
  const [showKey, setShowKey]         = React.useState(false);
  const [saving, setSaving]           = React.useState(false);
  const [saveMsg, setSaveMsg]         = React.useState<string | null>(null);

  const token = () => localStorage.getItem("token") || "";
  const h = () => ({ Authorization: `Bearer ${token()}`, "Content-Type": "application/json" });

  const fetchProviders = async () => {
    try {
      const res = await fetch(`${API}/ai-settings/providers`, { headers: h() });
      if (res.ok) setProviders(await res.json());
    } catch { /* silent */ } finally { setLoading(false); }
  };

  React.useEffect(() => { fetchProviders(); }, []);

  const openCreate = () => {
    setForm(emptyForm("openai"));
    setShowKey(false);
    setSaveMsg(null);
    setModal({ mode: "create" });
  };

  const openEdit = (p: Provider) => {
    setForm({ name: p.name, type: p.type, apiKey: p.apiKey, apiUrl: p.apiUrl || "", model: p.model || "", isActive: p.isActive, safeMode: p.config?.safeMode ?? false });
    setShowKey(false);
    setSaveMsg(null);
    setModal({ mode: "edit", provider: p });
  };

  const onTypeChange = (type: string) => {
    setForm(f => {
      const prev = emptyForm(f.type);
      return {
        ...f,
        type,
        name:   f.name   === prev.name   ? (PROVIDER_INFO[type]?.label        || "") : f.name,
        apiUrl: f.apiUrl === prev.apiUrl  ? (PROVIDER_INFO[type]?.defaultUrl   || "") : f.apiUrl,
        model:  f.model  === prev.model   ? (PROVIDER_INFO[type]?.defaultModel || "") : f.model,
        apiKey: f.apiKey === prev.apiKey  ? (PROVIDER_INFO[type]?.defaultApiKey || "") : f.apiKey,
      };
    });
  };

  const handleSave = async () => {
    setSaving(true); setSaveMsg(null);
    try {
      const body = JSON.stringify({ ...form, config: { safeMode: form.safeMode } });
      const isEdit = modal?.mode === "edit" && modal.provider;
      const res = await fetch(
        isEdit ? `${API}/ai-settings/providers/${modal!.provider!.id}` : `${API}/ai-settings/providers`,
        { method: isEdit ? "PUT" : "POST", headers: h(), body },
      );
      if (res.ok) {
        setSaveMsg("ذخیره شد ✓");
        await fetchProviders();
        setTimeout(() => { setModal(null); setSaveMsg(null); }, 900);
      } else {
        const err = await res.json().catch(() => ({}));
        setSaveMsg(err.message || "خطا در ذخیره‌سازی");
      }
    } catch { setSaveMsg("خطا در ارتباط با سرور"); }
    finally { setSaving(false); }
  };

  const handleTest = async (id: string) => {
    setTesting(prev => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`${API}/ai-settings/providers/${id}/test`, { method: "POST", headers: h() });
      const result = await res.json();
      setTestResults(prev => ({ ...prev, [id]: result }));
    } catch {
      setTestResults(prev => ({ ...prev, [id]: { success: false, latencyMs: 0, error: "خطا در ارتباط" } }));
    } finally { setTesting(prev => ({ ...prev, [id]: false })); }
  };

  const handleToggle = async (id: string) => {
    const res = await fetch(`${API}/ai-settings/providers/${id}/toggle`, { method: "PATCH", headers: h() });
    if (res.ok) fetchProviders();
  };

  const handleDelete = async (p: Provider) => {
    if (!confirm(`حذف "${p.name}"؟`)) return;
    await fetch(`${API}/ai-settings/providers/${p.id}`, { method: "DELETE", headers: h() });
    fetchProviders();
  };

  const typeColor = (type: string) => PROVIDER_INFO[type]?.color || "#6b7280";
  const typeLabel = (type: string) => PROVIDER_INFO[type]?.label || type;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="flex items-center gap-2 font-bold text-theme-primary text-xl">
            <Cpu className="w-5 h-5 text-blue-600" />
            تنظیمات هوش مصنوعی
          </h1>
          <p className="mt-1 text-theme-muted text-sm">مدیریت مدل‌های هوش مصنوعی — هر مدل می‌تواند نام سفارشی داشته باشد</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl text-white text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          افزودن مدل
        </button>
      </div>

      {/* Provider list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-theme-card p-4 border border-theme rounded-2xl animate-pulse">
              <div className="flex items-center gap-3">
                <div className="bg-theme-hover rounded-xl w-10 h-10" />
                <div className="space-y-2 flex-1">
                  <div className="bg-theme-hover rounded w-32 h-3" />
                  <div className="bg-theme-hover rounded w-24 h-2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : providers.length === 0 ? (
        <div className="py-16 border border-dashed border-theme rounded-2xl text-center text-theme-muted">
          <Cpu className="mx-auto mb-3 w-10 h-10 opacity-30" />
          <p className="text-sm">هیچ مدلی تنظیم نشده</p>
          <button onClick={openCreate} className="mt-3 text-blue-500 hover:text-blue-600 text-sm underline">افزودن اولین مدل</button>
        </div>
      ) : (
        <div className="space-y-3">
          {providers.map(p => {
            const info  = PROVIDER_INFO[p.type];
            const test  = testResults[p.id];
            const isTesting = testing[p.id];
            return (
              <motion.div
                key={p.id}
                layout
                className={`bg-theme-card border rounded-2xl p-4 transition-all ${p.isActive ? "border-green-300 dark:border-green-800" : "border-theme"}`}
              >
                <div className="flex flex-wrap justify-between items-center gap-3">
                  {/* Left: icon + name */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="flex-shrink-0 flex justify-center items-center rounded-xl w-10 h-10 font-bold text-white text-xs"
                      style={{ backgroundColor: typeColor(p.type) }}
                    >
                      {typeLabel(p.type).substring(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-theme-primary text-sm truncate">{p.name}</div>
                      <div className="flex items-center gap-2 text-xs text-theme-muted mt-0.5">
                        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium text-white" style={{ backgroundColor: typeColor(p.type) }}>{typeLabel(p.type)}</span>
                        {p.model && <span className="font-mono">{p.model}</span>}
                        {p.config?.safeMode && <span className="text-green-600">• حالت ایمن</span>}
                      </div>
                    </div>
                  </div>

                  {/* Right: status + actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleToggle(p.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                        p.isActive
                          ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${p.isActive ? "bg-green-500" : "bg-gray-400"}`} />
                      {p.isActive ? "فعال" : "غیرفعال"}
                    </button>

                    <button
                      onClick={() => handleTest(p.id)}
                      disabled={isTesting}
                      className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-2.5 py-1.5 rounded-xl text-white text-xs transition-colors"
                    >
                      {isTesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                      تست
                    </button>

                    <button
                      onClick={() => openEdit(p)}
                      className="flex items-center gap-1 bg-theme-hover hover:bg-blue-50 dark:hover:bg-blue-950/30 px-2.5 py-1.5 rounded-xl text-theme-secondary hover:text-blue-600 text-xs transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" />
                      ویرایش
                    </button>

                    <button
                      onClick={() => handleDelete(p)}
                      className="p-1.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 text-theme-muted hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    {info?.docUrl && (
                      <a href={info.docUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-xl text-theme-muted hover:text-blue-500 transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Test result */}
                <AnimatePresence>
                  {test && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className={`mt-3 p-3 rounded-xl text-xs ${
                        test.success
                          ? "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800"
                          : "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        {test.success ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <XCircle className="w-3.5 h-3.5 text-red-600" />}
                        <span className={test.success ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}>
                          {test.success ? "اتصال موفق" : "اتصال ناموفق"}
                        </span>
                        <span className="text-theme-muted mr-2">
                          {test.latencyMs ? `${test.latencyMs}ms` : ""}
                          {test.details?.modelsAvailable ? ` · ${test.details.modelsAvailable} مدل` : ""}
                          {test.error ? ` · ${test.error}` : ""}
                        </span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create / Edit modal */}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.mode === "create" ? "افزودن مدل هوش مصنوعی" : `ویرایش: ${modal?.provider?.name || ""}`}
        size="md"
        footer={<>
          <button onClick={() => setModal(null)} className="btn-theme-secondary text-sm">انصراف</button>
          <button
            onClick={handleSave}
            disabled={saving || (modal?.mode === "create" && !form.apiKey && !PROVIDER_INFO[form.type]?.noApiKey)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-xl text-white text-sm transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            ذخیره
          </button>
        </>}
      >
        <div className="space-y-4">
          {modal?.mode === "create" && (
            <div>
              <label className="block mb-1.5 font-medium text-theme-secondary text-xs">نوع ارائه‌دهنده</label>
              <div className="relative">
                <select value={form.type} onChange={e => onTypeChange(e.target.value)} className="select-theme text-sm appearance-none">
                  {Object.entries(PROVIDER_INFO).map(([t, info]) => <option key={t} value={t}>{info.label}</option>)}
                </select>
                <ChevronDown className="top-1/2 left-3 absolute w-4 h-4 text-theme-muted -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          )}
          <div>
            <label className="block mb-1.5 font-medium text-theme-secondary text-xs">نام سفارشی (نمایشی در گفتگو و گزارش‌ها)</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-theme text-sm" placeholder="مثلاً GPT-4o سریع، Claude هوشمند، ..." />
          </div>
          <div>
            <label className="block mb-1.5 font-medium text-theme-secondary text-xs">شناسه مدل (Model ID)</label>
            <input type="text" value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} className="input-theme text-sm font-mono" placeholder={PROVIDER_INFO[form.type]?.defaultModel || ""} />
          </div>
          <div>
            <label className="block mb-1.5 font-medium text-theme-secondary text-xs">کلید API</label>
            {PROVIDER_INFO[form.type]?.noApiKey ? (
              <p className="text-xs text-theme-muted bg-theme-hover px-3 py-2 rounded-xl">
                این سرویس روی شبکه داخلی است و نیاز به کلید API ندارد.
              </p>
            ) : (
              <div className="relative">
                <input type={showKey ? "text" : "password"} value={form.apiKey} onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))} className="input-theme text-sm font-mono pl-10" placeholder={modal?.mode === "edit" ? "خالی بذار = تغییر نده" : "sk-..."} />
                <button type="button" onClick={() => setShowKey(v => !v)} className="top-1/2 left-3 absolute text-theme-muted -translate-y-1/2">
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            )}
          </div>
          <div>
            <label className="block mb-1.5 font-medium text-theme-secondary text-xs">آدرس API (اختیاری)</label>
            <input type="text" value={form.apiUrl} onChange={e => setForm(f => ({ ...f, apiUrl: e.target.value }))} className="input-theme text-sm font-mono" placeholder={PROVIDER_INFO[form.type]?.defaultUrl || ""} />
          </div>
          <div className="flex flex-col gap-2 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="rounded accent-blue-600 w-4 h-4" />
              <span className="text-sm text-theme-secondary">فعال — کاربران می‌توانند از این مدل استفاده کنند</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.safeMode} onChange={e => setForm(f => ({ ...f, safeMode: e.target.checked }))} className="rounded accent-green-600 w-4 h-4" />
              <span className="text-sm text-theme-secondary">حالت ایمن (Safe Mode) — فیلتر محتوای مضر</span>
            </label>
          </div>
          {saveMsg && <div className={`text-sm text-center ${saveMsg.includes("✓") ? "text-green-600" : "text-red-500"}`}>{saveMsg}</div>}
        </div>
      </Modal>
    </div>
  );
}
