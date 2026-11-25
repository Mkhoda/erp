"use client";
// Admin panel for the performance score: every indicator can be switched on/off and tuned
// (weight / points / cap / thresholds). Generated from the server's catalog, with a live preview
// of how the ranking would change before saving.
import React from "react";
import Link from "next/link";
import { ArrowRight, Eye, Loader2, RotateCcw, Save, Trophy, TriangleAlert } from "lucide-react";
import { pageTitle } from "../../../../lib/branding";
import { readError } from "../../../../lib/http";
import { useToast } from "../../../components/ui/Toast";
import { useConfirm } from "../../../components/ui/ConfirmDialog";
import DateRangeFilter, { presetRange } from "../../../components/ui/DateRangeFilter";
import { faNum } from "../../../components/charts/ChartKit";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
const KIND: Record<string, { title: string; hint: string; cls: string }> = {
  score: { title: "شاخص‌های اصلی", hint: "هر کدام امتیاز ۰ تا ۱۰۰ می‌گیرند و با وزن میانگین‌گیری می‌شوند. فردی که برای یک شاخص داده ندارد، از آن کنار گذاشته می‌شود و وزن بقیه بیشتر می‌شود.", cls: "text-blue-600" },
  bonus: { title: "پاداش‌ها (امتیاز مثبت)", hint: "به امتیاز پایه اضافه می‌شوند؛ هر کدام تا سقف خودش و همه با هم تا «سقف کل پاداش».", cls: "text-green-600" },
  penalty: { title: "کسورات (امتیاز منفی)", hint: "از امتیاز پایه کم می‌شوند؛ هر کدام تا سقف خودش و همه با هم تا «سقف کل کسورات».", cls: "text-red-600" },
};
type Cfg = { indicators: Record<string, { enabled: boolean; weight: number; points: number; cap: number; params: Record<string, number> }>; general: Record<string, number> };

function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className={`relative shrink-0 w-10 h-6 rounded-full transition-colors ${on ? "bg-blue-600" : "bg-slate-400/50"}`}>
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? "right-0.5" : "right-[1.125rem]"}`} />
    </button>
  );
}
const Num = ({ v, on, min = 0, max = 100, step = 1, w = "!w-20" }: { v: number; on: (n: number) => void; min?: number; max?: number; step?: number; w?: string }) => (
  <input type="number" dir="ltr" min={min} max={max} step={step} value={Number.isFinite(v) ? v : ""} onChange={e => on(e.target.value === "" ? NaN : +e.target.value)} className={`input-theme text-sm ${w} py-1`} />
);

export default function PerformanceSettingsPage() {
  React.useEffect(() => { document.title = pageTitle("شاخص‌های امتیاز عملکرد"); }, []);
  const toast = useToast();
  const { confirm, Dialog } = useConfirm();
  const h = React.useMemo(() => ({ Authorization: `Bearer ${typeof window !== "undefined" ? localStorage.getItem("token") : ""}`, "Content-Type": "application/json" }), []);
  const [catalog, setCatalog] = React.useState<any[]>([]);
  const [defaults, setDefaults] = React.useState<Cfg | null>(null);
  const [saved, setSaved] = React.useState<string>("");
  const [cfg, setCfg] = React.useState<Cfg | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [range, setRange] = React.useState(() => presetRange("month"));
  const [preview, setPreview] = React.useState<any>(null);
  const [previewing, setPreviewing] = React.useState(false);

  React.useEffect(() => {
    fetch(`${API}/performance/settings`, { headers: h }).then(async r => { if (!r.ok) throw new Error(await readError(r, "خطا در دریافت تنظیمات")); return r.json(); })
      .then(d => { setCatalog(d.catalog); setDefaults(d.defaults); setCfg(d.config); setSaved(JSON.stringify(d.config)); })
      .catch(e => toast.error(e.message)).finally(() => setLoading(false));
    // eslint-disable-next-line
  }, [h]);

  const dirty = !!cfg && JSON.stringify(cfg) !== saved;
  React.useEffect(() => { setPreview(null); }, [cfg, range]);
  const clean = (c: Cfg): Cfg => JSON.parse(JSON.stringify(c, (_k, v) => (typeof v === "number" && !Number.isFinite(v) ? 0 : v)));

  const setInd = (key: string, patch: any) => setCfg(c => c && { ...c, indicators: { ...c.indicators, [key]: { ...c.indicators[key], ...patch } } });
  const setParam = (key: string, p: string, v: number) => setCfg(c => c && { ...c, indicators: { ...c.indicators, [key]: { ...c.indicators[key], params: { ...c.indicators[key].params, [p]: v } } } });
  const setGen = (k: string, v: number) => setCfg(c => c && { ...c, general: { ...c.general, [k]: v } });

  async function runPreview() {
    if (!cfg) return;
    setPreviewing(true);
    try {
      const res = await fetch(`${API}/performance/preview`, { method: "POST", headers: h, body: JSON.stringify({ config: clean(cfg), from: range.from, to: range.to }) });
      if (!res.ok) { toast.error(await readError(res, "پیش‌نمایش ناموفق بود")); return; }
      setPreview(await res.json());
    } finally { setPreviewing(false); }
  }
  async function save() {
    if (!cfg) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/performance/settings`, { method: "PATCH", headers: h, body: JSON.stringify({ config: clean(cfg) }) });
      if (!res.ok) { toast.error(await readError(res, "ذخیره ناموفق بود")); return; }
      const d = await res.json(); setCfg(d.config); setSaved(JSON.stringify(d.config));
      toast.success("تنظیمات ذخیره شد و از همین حالا اعمال می‌شود");
    } finally { setSaving(false); }
  }
  async function reset() {
    if (!defaults || !(await confirm("بازگشت به پیش‌فرض", "همه‌ی شاخص‌ها و مقادیر به حالت پیش‌فرض برمی‌گردند (تا وقتی ذخیره نکنید اعمال نمی‌شود).", "warning"))) return;
    setCfg(JSON.parse(JSON.stringify(defaults)));
  }

  if (loading || !cfg) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>;
  const on = (k: string) => cfg.indicators[k].enabled;
  const weightSum = catalog.filter(d => d.kind === "score" && on(d.key)).reduce((s, d) => s + (cfg.indicators[d.key].weight || 0), 0);
  const g = cfg.general;
  const gradeBad = !(g.excellent >= g.good && g.good >= g.fair);
  const diff = (preview?.rows || []).map((r: any) => ({ ...r, delta: r.score == null || r.currentScore == null ? null : Math.round((r.score - r.currentScore) * 10) / 10 }));
  const changed = diff.filter((r: any) => r.delta !== 0).sort((a: any, b: any) => Math.abs(b.delta ?? 99) - Math.abs(a.delta ?? 99));

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-5" dir="rtl">
      {Dialog}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center"><Trophy className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-xl font-bold text-theme-primary">شاخص‌های امتیاز عملکرد</h1>
            <p className="text-sm text-theme-muted">هر شاخص را روشن یا خاموش و وزن، امتیاز و آستانه‌ی آن را تنظیم کنید</p>
          </div>
        </div>
        <Link href="/dashboard/performance" className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline">جدول امتیازها <ArrowRight className="w-4 h-4 rotate-180" /></Link>
      </div>

      <div className="sticky top-0 z-20 -mx-1 px-3 py-2.5 rounded-xl bg-theme-card border border-theme shadow-sm flex flex-wrap items-center gap-2">
        <span className={`text-xs ${dirty ? "text-amber-600" : "text-theme-muted"}`}>{dirty ? "تغییرات ذخیره‌نشده دارید" : "همه‌ی تغییرات ذخیره شده"}</span>
        <div className="mr-auto flex flex-wrap items-center gap-2">
          <button onClick={reset} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg border border-theme text-theme-primary hover:bg-theme-hover"><RotateCcw className="w-4 h-4" /> پیش‌فرض</button>
          <button onClick={() => { setCfg(JSON.parse(saved)); }} disabled={!dirty} className="text-sm px-3 py-1.5 rounded-lg border border-theme text-theme-primary disabled:opacity-40">لغو تغییرات</button>
          <button onClick={save} disabled={!dirty || saving || gradeBad} className="btn-theme-primary text-sm flex items-center gap-1 disabled:opacity-50">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} ذخیره</button>
        </div>
      </div>

      {(["score", "bonus", "penalty"] as const).map(kind => (
        <section key={kind} className="space-y-2">
          <div><h2 className={`text-sm font-bold ${KIND[kind].cls}`}>{KIND[kind].title}</h2><p className="text-xs text-theme-muted">{KIND[kind].hint}</p></div>
          <div className="space-y-2">
            {catalog.filter(d => d.kind === kind).map(d => {
              const c = cfg.indicators[d.key];
              const clash = c.enabled && (d.overlaps || []).filter((k: string) => on(k)).map((k: string) => catalog.find(x => x.key === k)?.label).filter(Boolean);
              return (
                <div key={d.key} className={`bg-theme-card border rounded-xl p-3 ${c.enabled ? "border-theme" : "border-theme opacity-70"}`}>
                  <div className="flex items-start gap-3">
                    <Switch on={c.enabled} onChange={v => setInd(d.key, { enabled: v })} />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2"><span className="font-medium text-theme-primary text-sm">{d.label}</span><span className="text-[10px] px-1.5 py-0.5 rounded bg-theme-secondary text-theme-muted">{d.group}</span></div>
                      <p className="text-xs text-theme-muted mt-0.5">{d.description}</p>
                    </div>
                  </div>
                  {c.enabled && (
                    <div className="mt-2 mr-[3.25rem] flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-theme-secondary">
                      {kind === "score" && <label className="flex items-center gap-1.5">وزن <Num v={c.weight} on={v => setInd(d.key, { weight: v })} /><span className="text-theme-muted">({weightSum ? faNum(Math.round((c.weight / weightSum) * 100)) : "۰"}٪ از امتیاز پایه)</span></label>}
                      {kind !== "score" && <>
                        <label className="flex items-center gap-1.5">{kind === "bonus" ? "+" : "−"} <Num v={c.points} step={0.1} on={v => setInd(d.key, { points: v })} /> امتیاز به ازای هر {d.unit}</label>
                        <label className="flex items-center gap-1.5">حداکثر <Num v={c.cap} step={0.5} on={v => setInd(d.key, { cap: v })} /> امتیاز</label>
                      </>}
                      {(d.params || []).map((p: any) => (
                        <label key={p.key} className="flex items-center gap-1.5">{p.label} <Num v={c.params[p.key]} min={p.min} max={p.max} step={p.step} on={v => setParam(d.key, p.key, v)} /> {p.unit}</label>
                      ))}
                    </div>
                  )}
                  {clash && clash.length > 0 && <p className="mt-2 mr-[3.25rem] flex items-start gap-1 text-[11px] text-amber-600"><TriangleAlert className="w-3.5 h-3.5 shrink-0" /> همزمان با «{clash.join("، ")}» روشن است و ممکن است یک مورد دوبار حساب شود.</p>}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-theme-primary">تنظیمات کلی</h2>
        <div className="bg-theme-card border border-theme rounded-xl p-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-theme-secondary">
          <label className="flex items-center justify-between gap-2">سقف کل پاداش‌ها <span className="flex items-center gap-1"><Num v={g.maxBonus} on={v => setGen("maxBonus", v)} /> امتیاز</span></label>
          <label className="flex items-center justify-between gap-2">سقف کل کسورات <span className="flex items-center gap-1"><Num v={g.maxPenalty} on={v => setGen("maxPenalty", v)} /> امتیاز</span></label>
          <label className="flex items-center justify-between gap-2" title="کمتر از این تعداد روز کاری در بازه، امتیاز محاسبه نمی‌شود (۰ = بدون محدودیت)">حداقل روز کاری برای امتیازدهی <span className="flex items-center gap-1"><Num v={g.minWorkingDays} max={366} on={v => setGen("minWorkingDays", v)} /> روز</span></label>
          <div />
          {([["excellent", "عالی از"], ["good", "خوب از"], ["fair", "متوسط از"]] as const).map(([k, l]) => (
            <label key={k} className="flex items-center justify-between gap-2">{l} <span className="flex items-center gap-1"><Num v={g[k]} on={v => setGen(k, v)} /> امتیاز</span></label>
          ))}
        </div>
        {gradeBad && <p className="text-xs text-red-600">آستانه‌ها باید به ترتیب عالی ≥ خوب ≥ متوسط باشند.</p>}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-theme-primary">پیش‌نمایش اثر تغییرات</h2>
        <div className="bg-theme-card border border-theme rounded-xl p-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <DateRangeFilter value={range} onChange={setRange} />
            <button onClick={runPreview} disabled={previewing} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg bg-theme-primary border border-theme text-theme-primary hover:bg-theme-hover disabled:opacity-50">{previewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />} محاسبه با تنظیمات فعلی صفحه</button>
          </div>
          {preview && (
            <div className="overflow-x-auto max-h-96 overflow-y-auto border border-theme rounded-lg">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-theme-card"><tr className="text-theme-muted text-xs border-b border-theme"><th className="text-right py-2 px-2 font-medium">نام</th><th className="text-right font-medium">دپارتمان</th><th className="font-medium">امتیاز فعلی</th><th className="font-medium">امتیاز جدید</th><th className="font-medium">تغییر</th><th className="font-medium">رتبه فعلی ← جدید</th></tr></thead>
                <tbody>
                  {changed.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-theme-muted">با این تنظیمات امتیاز هیچ‌کس تغییر نمی‌کند</td></tr>}
                  {changed.map((r: any) => (
                    <tr key={r.userId} className="border-b border-theme/40">
                      <td className="py-1.5 px-2 text-theme-primary whitespace-nowrap">{r.name}</td><td className="text-theme-muted whitespace-nowrap">{r.department || "—"}</td>
                      <td className="text-center">{r.currentScore == null ? "—" : faNum(Math.round(r.currentScore))}</td><td className="text-center font-medium text-theme-primary">{r.score == null ? "—" : faNum(Math.round(r.score))}</td>
                      <td className={`text-center ${r.delta == null ? "" : r.delta > 0 ? "text-green-600" : "text-red-600"}`} dir="ltr">{r.delta == null ? "—" : `${r.delta > 0 ? "+" : ""}${faNum(r.delta)}`}</td>
                      <td className="text-center text-xs text-theme-muted">{r.currentRank ? faNum(r.currentRank) : "—"} ← {r.rank ? faNum(r.rank) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {preview && <p className="text-[11px] text-theme-muted">{faNum(changed.length)} نفر از {faNum(diff.length)} نفر تغییر می‌کنند. این فقط پیش‌نمایش است و تا «ذخیره» نزنید چیزی عوض نمی‌شود.</p>}
        </div>
      </section>
    </div>
  );
}
