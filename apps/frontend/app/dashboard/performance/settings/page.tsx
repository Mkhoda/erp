"use client";
// Admin panel for the performance score. Everything on it answers "what happens if I change this?":
// how the total is built (formula + weight chart), what each indicator does to the real data
// (coverage, average, distribution), and — live, as you edit — how scores and levels would move.
import React from "react";
import Link from "next/link";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from "recharts";
import { ArrowRight, BookOpen, ChevronDown, Info, Loader2, RotateCcw, Save, Trophy, TriangleAlert } from "lucide-react";
import { pageTitle } from "../../../../lib/branding";
import { readError } from "../../../../lib/http";
import { useToast } from "../../../components/ui/Toast";
import { useConfirm } from "../../../components/ui/ConfirmDialog";
import DateRangeFilter, { presetRange } from "../../../components/ui/DateRangeFilter";
import SearchSelect from "../../../components/ui/SearchSelect";
import { faNum, useChartTheme, TooltipBox } from "../../../components/charts/ChartKit";
import { faDate } from "../../../components/work-log/meta";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
const COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#7c5cd6", "#14a3b8", "#8a8f98", "#c24d4d"];
const GRADES = [["EXCELLENT", "عالی", "#1baf7a"], ["GOOD", "خوب", "#2a78d6"], ["FAIR", "متوسط", "#eda100"], ["POOR", "ضعیف", "#d95555"]] as const;
const KIND = {
  score: { title: "شاخص‌های اصلی", sub: "امتیاز پایه را می‌سازند", cls: "text-blue-600 dark:text-blue-400", edge: "border-r-blue-500", help: "هر شاخص برای هر نفر عددی بین ۰ و ۱۰۰ می‌دهد؛ امتیاز پایه میانگین وزنی این عددهاست. وزن بیشتر یعنی اثر بیشتر. فردی که برای شاخصی داده ندارد (مثلاً کارمند ساعتی در وقت‌شناسی) از آن شاخص کنار گذاشته می‌شود و وزن بقیه به همان نسبت بیشتر می‌شود." },
  bonus: { title: "پاداش‌ها", sub: "امتیاز اضافه می‌کنند", cls: "text-green-600 dark:text-green-400", edge: "border-r-green-500", help: "پس از محاسبه‌ی امتیاز پایه، به ازای هر مورد (ساعت، روز، وظیفه…) چند امتیاز اضافه می‌شود. هر پاداش سقف خودش را دارد و مجموع همه‌ی پاداش‌ها هم از «سقف کل پاداش» بیشتر نمی‌شود." },
  penalty: { title: "کسورات", sub: "امتیاز کم می‌کنند", cls: "text-red-600 dark:text-red-400", edge: "border-r-red-500", help: "پس از محاسبه‌ی امتیاز پایه، به ازای هر مورد بد (غیبت، تاخیر، گزارش ثبت‌نشده…) چند امتیاز کم می‌شود. هر کسر سقف خودش را دارد و مجموع همه‌ی کسورات هم از «سقف کل کسورات» بیشتر نمی‌شود." },
} as const;
type Cfg = { indicators: Record<string, { enabled: boolean; weight: number; points: number; cap: number; params: Record<string, number> }>; general: Record<string, number> };

function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${on ? "bg-blue-600" : "bg-slate-400/50"}`}>
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? "right-0.5" : "right-[1.375rem]"}`} />
    </button>
  );
}
const Num = ({ v, on, min = 0, max = 100, step = 1, w = "!w-20" }: { v: number; on: (n: number) => void; min?: number; max?: number; step?: number; w?: string }) => (
  <input type="number" dir="ltr" min={min} max={max} step={step} value={Number.isFinite(v) ? v : ""} onChange={e => on(e.target.value === "" ? NaN : +e.target.value)} className={`input-theme text-sm ${w} py-1 text-center`} />
);
const Field = ({ label, hint, children }: { label: React.ReactNode; hint?: string; children: React.ReactNode }) => (
  <label className="flex flex-col gap-1 min-w-36">
    <span className="text-[11px] font-medium text-theme-secondary">{label}</span>
    {children}
    {hint && <span className="text-[10px] leading-snug text-theme-muted max-w-56">{hint}</span>}
  </label>
);
const Section = ({ n, title, sub, children }: { n: string; title: string; sub?: string; children: React.ReactNode }) => (
  <section className="space-y-3">
    <div className="flex items-center gap-2.5"><span className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-600 text-sm font-extrabold flex items-center justify-center">{n}</span><div><h2 className="text-base font-bold text-theme-primary leading-tight">{title}</h2>{sub && <p className="text-xs text-theme-muted">{sub}</p>}</div></div>
    {children}
  </section>
);
const Block = ({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) => <div className="bg-theme-card border border-theme rounded-2xl p-4"><div className="text-sm font-semibold text-theme-primary">{title}</div>{sub && <div className="text-[11px] text-theme-muted mb-2">{sub}</div>}{children}</div>;

// Plain-language formula for one indicator.
function howText(d: any): string {
  const f: Record<string, string> = {
    report: "برای هر روزی که گزارش الزامی بوده: ثبت به‌موقع = ۱ روز کامل، ثبت با تأخیر = بخشی از یک روز (طبق «ارزش گزارش با تأخیر»)، ثبت‌نشده = ۰. امتیاز = جمع این‌ها ÷ تعداد روزهای الزامی × ۱۰۰. روزهای تعطیل/مرخصی و روزهای قبل از شروع ثبت عملکرد شمرده نمی‌شوند.",
    coverage: "زمان ثبت‌شده در «عملکرد من» ÷ کارکرد حضور در همان روزها. وقتی به درصد هدف برسد امتیاز ۱۰۰ است؛ کمتر از آن به نسبت کم می‌شود.",
    taskDeadline: "وظیفه‌های مهلت‌دار که مهلتشان در بازه سررسید شده: انجام‌شده تا مهلت = ۱، انجام با تأخیر = بخشی از ۱، انجام‌نشده = ۰. امتیاز = جمع ÷ تعداد وظایف × ۱۰۰. اگر وظیفه‌ی سررسیدشده‌ای نباشد این شاخص برای فرد حساب نمی‌شود.",
    punctuality: "از روزهایی که فرد حضور داشته، سهم روزهایی که تاخیر و تعجیلش از «مقدار قابل چشم‌پوشی» بیشتر نبوده. کارکنان ساعتی حساب نمی‌شوند.",
    attendance: "از روزهای کاری، سهم روزهایی که فرد نه مرخصی داشته و نه غیبت. مرخصی ساعتی به‌صورت کسری از روز کسر می‌شود. ماموریت و دورکاری مرخصی نیست.",
    workHours: "از ساعت موظفی فرد در بازه، سهمی که بدون کسری کارکرد پر شده: (کارکرد عادی) ÷ (کارکرد عادی + کسری). کارکنان ساعتی حساب نمی‌شوند.",
    tickets: "تیکت‌هایی که در بازه برای دپارتمان‌های فرد ثبت شده: سهم آن‌هایی که در مهلت SLA پاسخ داده و حل شده‌اند. تأخیر برای همه‌ی اعضا و مدیران کارتابل آن دپارتمان منفی است.",
    ticketResolve: "از تیکت‌هایی که به خود فرد ارجاع شده و در بازه حل شده یا از مهلتشان گذشته: سهم آن‌هایی که تا مهلت حل شده‌اند.",
    ticketFirstResponse: "از تیکت‌های ارجاع‌شده به فرد که باید پاسخ اول می‌گرفتند: سهم آن‌هایی که پاسخ اولشان در مهلت SLA دپارتمان بوده.",
  };
  if (f[d.key]) return f[d.key];
  return d.kind === "bonus"
    ? `به ازای هر ${d.unit} که شرط «${d.label}» برقرار باشد، امتیاز تعیین‌شده اضافه می‌شود تا سقف همین مورد. ${d.description}`
    : `به ازای هر ${d.unit} که «${d.label}» رخ داده باشد، امتیاز تعیین‌شده کم می‌شود تا سقف همین مورد. ${d.description}`;
}

export default function PerformanceSettingsPage() {
  React.useEffect(() => { document.title = pageTitle("شاخص‌های امتیاز عملکرد"); }, []);
  const toast = useToast();
  const { confirm, Dialog } = useConfirm();
  const { ink } = useChartTheme();
  const h = React.useMemo(() => ({ Authorization: `Bearer ${typeof window !== "undefined" ? localStorage.getItem("token") : ""}`, "Content-Type": "application/json" }), []);
  const [catalog, setCatalog] = React.useState<any[]>([]);
  const [defaults, setDefaults] = React.useState<Cfg | null>(null);
  const [saved, setSaved] = React.useState("");
  const [cfg, setCfg] = React.useState<Cfg | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [range, setRange] = React.useState(() => presetRange("month"));
  const [pv, setPv] = React.useState<any>(null);
  const [pvLoading, setPvLoading] = React.useState(false);
  const [sampleId, setSampleId] = React.useState("");
  const [open, setOpen] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    fetch(`${API}/performance/settings`, { headers: h }).then(async r => { if (!r.ok) throw new Error(await readError(r, "خطا در دریافت تنظیمات")); return r.json(); })
      .then(d => { setCatalog(d.catalog); setDefaults(d.defaults); setCfg(d.config); setSaved(JSON.stringify(d.config)); })
      .catch(e => toast.error(e.message)).finally(() => setLoading(false));
    // eslint-disable-next-line
  }, [h]);

  const clean = (c: Cfg): Cfg => JSON.parse(JSON.stringify(c, (_k, v) => (typeof v === "number" && !Number.isFinite(v) ? 0 : v)));
  const dirty = !!cfg && JSON.stringify(cfg) !== saved;

  // Live impact: re-run the scoring with the draft config shortly after every edit.
  const reqId = React.useRef(0);
  React.useEffect(() => {
    if (!cfg) return;
    const id = ++reqId.current;
    setPvLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/performance/preview`, { method: "POST", headers: h, body: JSON.stringify({ config: clean(cfg), from: range.from, to: range.to }) });
        if (id !== reqId.current) return;
        if (!res.ok) { toast.error(await readError(res, "پیش‌نمایش ناموفق بود")); return; }
        setPv(await res.json());
      } finally { if (id === reqId.current) setPvLoading(false); }
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [cfg, range, h]);

  const setInd = (key: string, patch: any) => setCfg(c => c && { ...c, indicators: { ...c.indicators, [key]: { ...c.indicators[key], ...patch } } });
  const setParam = (key: string, p: string, v: number) => setCfg(c => c && { ...c, indicators: { ...c.indicators, [key]: { ...c.indicators[key], params: { ...c.indicators[key].params, [p]: v } } } });
  const setGen = (k: string, v: number) => setCfg(c => c && { ...c, general: { ...c.general, [k]: v } });

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
  const g = cfg.general;
  const on = (k: string) => cfg.indicators[k].enabled;
  const scoreAll = catalog.filter(d => d.kind === "score");
  const colorOf = (key: string) => COLORS[scoreAll.findIndex(d => d.key === key) % COLORS.length];
  const baseOn = scoreAll.filter(d => on(d.key) && (cfg.indicators[d.key].weight || 0) > 0);
  const weightSum = baseOn.reduce((s, d) => s + (cfg.indicators[d.key].weight || 0), 0);
  const gradeBad = !(g.excellent >= g.good && g.good >= g.fair);
  const stats = pv?.stats || {};
  const rows: any[] = pv?.rows || [];
  const scored = rows.filter(r => r.score != null);
  const avgNew = scored.length ? scored.reduce((s, r) => s + r.score, 0) / scored.length : null;
  const sc = rows.filter(r => r.currentScore != null);
  const avgCur = sc.length ? sc.reduce((s, r) => s + r.currentScore, 0) / sc.length : null;
  const movers = rows.filter(r => r.score != null && r.currentScore != null && Math.abs(r.score - r.currentScore) >= 0.1).map(r => ({ ...r, delta: Math.round((r.score - r.currentScore) * 10) / 10 })).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const hist = Array.from({ length: 10 }, (_, i) => ({ name: `${faNum(i * 10)}–${faNum(i === 9 ? 100 : i * 10 + 9)}`, cur: sc.filter(r => Math.min(9, Math.floor(r.currentScore / 10)) === i).length, now: scored.filter(r => Math.min(9, Math.floor(r.score / 10)) === i).length }));
  const gradeData = GRADES.map(([k, l]) => ({ name: l, cur: rows.filter(r => r.currentGrade === k).length, now: rows.filter(r => r.grade === k).length }));
  const sample = rows.find(r => r.userId === sampleId && r.score != null) || scored[0];
  const sampleW = sample ? baseOn.filter(d => sample.items?.[d.key]?.value != null).reduce((s, d) => s + cfg.indicators[d.key].weight, 0) : 0;

  const tip = (props: any) => <TooltipBox {...props} fmt={(v: number) => `${faNum(v)} نفر`} />;
  const dual = (data: any[]) => (
    <div dir="ltr" style={{ height: 210 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 0 }} barCategoryGap={6}>
          <CartesianGrid vertical={false} stroke={ink.grid} />
          <XAxis dataKey="name" reversed tick={{ fill: ink.muted, fontSize: 10 }} axisLine={{ stroke: ink.axis }} tickLine={false} interval={0} />
          <YAxis orientation="right" width={30} allowDecimals={false} tick={{ fill: ink.muted, fontSize: 10 }} tickFormatter={v => faNum(v)} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: ink.grid, opacity: 0.4 }} content={tip} />
          <Bar dataKey="cur" name="تنظیمات ذخیره‌شده" fill="#9aa0aa" radius={[3, 3, 0, 0]} maxBarSize={16} isAnimationActive={false} />
          <Bar dataKey="now" name="با تنظیمات این صفحه" fill="#2a78d6" radius={[3, 3, 0, 0]} maxBarSize={16} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-8" dir="rtl">
      {Dialog}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20"><Trophy className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-xl font-bold text-theme-primary">شاخص‌های امتیاز عملکرد</h1>
            <p className="text-sm text-theme-muted">تعیین کنید امتیاز هر نفر از چه چیزهایی و با چه ارزشی ساخته شود</p>
          </div>
        </div>
        <Link href="/dashboard/performance" className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline">جدول امتیازها <ArrowRight className="w-4 h-4 rotate-180" /></Link>
      </div>

      <div className="sticky top-0 z-20 px-3 py-2.5 rounded-xl bg-theme-card/95 backdrop-blur border border-theme shadow-sm flex flex-wrap items-center gap-2">
        <span className={`flex items-center gap-1.5 text-xs ${dirty ? "text-amber-600" : "text-theme-muted"}`}><span className={`w-2 h-2 rounded-full ${dirty ? "bg-amber-500 animate-pulse" : "bg-green-500"}`} />{dirty ? "تغییرات ذخیره‌نشده — نمودارهای پایین همین حالا اثر آن را نشان می‌دهند" : "همه‌ی تغییرات ذخیره شده"}</span>
        <div className="mr-auto flex flex-wrap items-center gap-2">
          <button onClick={reset} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg border border-theme text-theme-primary hover:bg-theme-hover"><RotateCcw className="w-4 h-4" /> پیش‌فرض</button>
          <button onClick={() => setCfg(JSON.parse(saved))} disabled={!dirty} className="text-sm px-3 py-1.5 rounded-lg border border-theme text-theme-primary disabled:opacity-40">لغو تغییرات</button>
          <button onClick={save} disabled={!dirty || saving || gradeBad} className="btn-theme-primary text-sm flex items-center gap-1 disabled:opacity-50">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} ذخیره و اعمال</button>
        </div>
      </div>

      {/* 1 — how the total is built */}
      <Section n="۱" title="امتیاز کل از چه چیزی ساخته می‌شود؟" sub="فرمول، و سهم هر شاخص اصلی از امتیاز پایه">
        <div className="bg-theme-card border border-theme rounded-2xl p-4 space-y-4">
          <div className="flex flex-wrap items-stretch justify-center gap-2 text-center">
            {[
              { t: "امتیاز پایه", s: `میانگین وزنی ${faNum(baseOn.length)} شاخص اصلی`, v: "۰ تا ۱۰۰", c: "border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-300" },
              { op: "+" },
              { t: "پاداش‌ها", s: `${faNum(catalog.filter(d => d.kind === "bonus" && on(d.key)).length)} مورد روشن`, v: `تا +${faNum(g.maxBonus)}`, c: "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-300" },
              { op: "−" },
              { t: "کسورات", s: `${faNum(catalog.filter(d => d.kind === "penalty" && on(d.key)).length)} مورد روشن`, v: `تا −${faNum(g.maxPenalty)}`, c: "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-300" },
              { op: "=" },
              { t: "امتیاز کل", s: "همیشه بین ۰ و ۱۰۰", v: "رتبه و سطح", c: "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300" },
            ].map((x: any, i) => x.op
              ? <div key={i} className="self-center text-2xl font-light text-theme-muted px-1">{x.op}</div>
              : <div key={i} className={`border rounded-xl px-4 py-2.5 min-w-36 ${x.c}`}><div className="text-xs font-bold">{x.t}</div><div className="text-lg font-extrabold leading-tight my-0.5">{x.v}</div><div className="text-[10px] opacity-80">{x.s}</div></div>)}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[14rem_1fr] gap-4 items-center">
            <div dir="ltr" className="relative mx-auto" style={{ width: 200, height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={baseOn.map(d => ({ name: d.label, value: cfg.indicators[d.key].weight, key: d.key }))} dataKey="value" innerRadius={62} outerRadius={92} paddingAngle={2} stroke="none" isAnimationActive={false}>
                  {baseOn.map(d => <Cell key={d.key} fill={colorOf(d.key)} />)}
                </Pie></PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"><span className="text-2xl font-extrabold text-theme-primary">{faNum(baseOn.length)}</span><span className="text-[11px] text-theme-muted">شاخص اصلی</span></div>
            </div>
            <div className="space-y-1.5">
              {baseOn.length === 0 && <p className="text-sm text-red-600">هیچ شاخص اصلی روشن نیست.</p>}
              {[...baseOn].sort((a, b) => cfg.indicators[b.key].weight - cfg.indicators[a.key].weight).map(d => {
                const p = weightSum ? (cfg.indicators[d.key].weight / weightSum) * 100 : 0;
                return (
                  <div key={d.key} className="flex items-center gap-2 text-sm">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: colorOf(d.key) }} />
                    <span className="w-40 shrink-0 truncate text-theme-primary" title={d.label}>{d.label}</span>
                    <div className="flex-1 h-2.5 rounded-full bg-theme-secondary overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${p}%`, background: colorOf(d.key) }} /></div>
                    <span className="w-28 text-left text-xs text-theme-secondary" dir="ltr">{faNum(Math.round(p))}٪ <span className="text-theme-muted">(وزن {faNum(cfg.indicators[d.key].weight)})</span></span>
                  </div>
                );
              })}
              <p className="text-[11px] text-theme-muted pt-1">سهم هر شاخص = وزن آن ÷ جمع وزن‌های شاخص‌های روشن. اگر فردی برای شاخصی داده نداشته باشد، سهم آن بین بقیه تقسیم می‌شود.</p>
            </div>
          </div>
        </div>
      </Section>

      {/* 2 — live impact */}
      <Section n="۲" title="اثر تنظیمات روی افراد (زنده)" sub="با هر تغییر، امتیاز همه‌ی افراد با تنظیمات این صفحه دوباره محاسبه و با تنظیمات ذخیره‌شده مقایسه می‌شود">
        <div className="flex flex-wrap items-center gap-2">
          <DateRangeFilter value={range} onChange={setRange} />
          {pvLoading && <span className="flex items-center gap-1 text-xs text-theme-muted"><Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" /> در حال محاسبه…</span>}
          {pv && <span className="text-[11px] text-theme-muted">بازه: {faDate(pv.from)} تا {faDate(pv.to)}</span>}
        </div>
        {!pv ? <div className="flex items-center justify-center h-40 bg-theme-card border border-theme rounded-2xl"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div> : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              {[
                ["میانگین امتیاز", avgNew == null ? "—" : faNum(Math.round(avgNew * 10) / 10), avgCur == null || avgNew == null ? "" : `قبل: ${faNum(Math.round(avgCur * 10) / 10)} (${avgNew - avgCur >= 0 ? "+" : "−"}${faNum(Math.round(Math.abs(avgNew - avgCur) * 10) / 10)})`],
                ["دارای امتیاز", faNum(scored.length), `از ${faNum(rows.length)} نفر · قبل: ${faNum(sc.length)}`],
                ["امتیازشان تغییر می‌کند", faNum(movers.length), "نفر با تغییر ۰٫۱ امتیاز یا بیشتر"],
                ["بیشترین تغییر", movers[0] ? `${movers[0].delta > 0 ? "+" : "−"}${faNum(Math.abs(movers[0].delta))}` : "—", movers[0]?.name || ""],
              ].map(([l, v, s]) => <div key={l} className="bg-theme-card border border-theme rounded-2xl px-4 py-3"><div className="text-xs text-theme-muted">{l}</div><div className="text-2xl font-extrabold text-theme-primary mt-0.5 text-right" dir="ltr">{v}</div><div className="text-[11px] text-theme-muted mt-0.5 truncate">{s}</div></div>)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <Block title="توزیع امتیاز افراد" sub="تعداد افراد در هر بازه‌ی امتیاز — خاکستری: تنظیمات ذخیره‌شده، آبی: تنظیمات این صفحه">{dual(hist)}</Block>
              <Block title="تعداد افراد در هر سطح" sub="با آستانه‌های همان تنظیمات (عالی / خوب / متوسط / ضعیف)">{dual(gradeData)}</Block>
            </div>

            <div className="bg-theme-card border border-theme rounded-2xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><div className="text-sm font-semibold text-theme-primary flex items-center gap-1.5"><BookOpen className="w-4 h-4 text-amber-500" /> نمونه‌ی محاسبه‌ی گام‌به‌گام</div><div className="text-[11px] text-theme-muted">یک نفر را انتخاب کنید تا ببینید امتیازش دقیقاً چطور به دست آمده</div></div>
                <div className="w-56"><SearchSelect options={scored.map(r => ({ id: r.userId, name: r.name }))} value={sample?.userId || ""} onChange={setSampleId} placeholder="انتخاب فرد" /></div>
              </div>
              {!sample ? <p className="text-sm text-theme-muted">کسی با امتیاز در این بازه نیست.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-[11px] text-theme-muted border-b border-theme"><th className="text-right py-1.5 font-medium">گام</th><th className="text-right font-medium">وضعیت این فرد</th><th className="font-medium">مقدار</th><th className="font-medium">وزن</th><th className="font-medium">سهم در امتیاز</th></tr></thead>
                    <tbody>
                      {baseOn.map(d => { const it = sample.items?.[d.key]; const w = cfg.indicators[d.key].weight; const has = it?.value != null; return (
                        <tr key={d.key} className="border-b border-theme/40">
                          <td className="py-1.5"><span className="inline-block w-2 h-2 rounded-sm ml-1.5" style={{ background: colorOf(d.key) }} />{d.label}</td>
                          <td className="text-xs text-theme-muted">{it?.text}</td>
                          <td className="text-center">{has ? faNum(Math.round(it.value)) : <span className="text-theme-muted text-xs">کنار گذاشته شد</span>}</td>
                          <td className="text-center text-theme-muted">{has ? faNum(w) : "—"}</td>
                          <td className="text-center font-medium text-theme-primary" dir="ltr">{has && sampleW ? faNum(Math.round(((it.value * w) / sampleW) * 10) / 10) : "—"}</td>
                        </tr>); })}
                      <tr className="bg-blue-500/5"><td className="py-2 font-semibold text-theme-primary" colSpan={4}>امتیاز پایه <span className="text-[11px] font-normal text-theme-muted">(جمع سهم‌ها)</span></td><td className="text-center font-bold text-blue-600" dir="ltr">{sample.base == null ? "—" : faNum(sample.base)}</td></tr>
                      {catalog.filter(d => d.kind === "bonus" && on(d.key) && (sample.items?.[d.key]?.points || 0) > 0).map(d => <tr key={d.key} className="border-b border-theme/40"><td className="py-1.5 text-green-700 dark:text-green-300">+ {d.label}</td><td className="text-xs text-theme-muted" colSpan={3}>{sample.items[d.key].text}</td><td className="text-center text-green-600" dir="ltr">+{faNum(sample.items[d.key].points)}</td></tr>)}
                      {g.maxBonus > 0 && sample.bonus >= g.maxBonus && <tr><td colSpan={5} className="text-[11px] text-amber-600 py-1">مجموع پاداش‌ها به سقف کل ({faNum(g.maxBonus)}) رسید.</td></tr>}
                      {catalog.filter(d => d.kind === "penalty" && on(d.key) && (sample.items?.[d.key]?.points || 0) > 0).map(d => <tr key={d.key} className="border-b border-theme/40"><td className="py-1.5 text-red-700 dark:text-red-300">− {d.label}</td><td className="text-xs text-theme-muted" colSpan={3}>{sample.items[d.key].text}</td><td className="text-center text-red-600" dir="ltr">−{faNum(sample.items[d.key].points)}</td></tr>)}
                      {g.maxPenalty > 0 && sample.penalty >= g.maxPenalty && <tr><td colSpan={5} className="text-[11px] text-amber-600 py-1">مجموع کسورات به سقف کل ({faNum(g.maxPenalty)}) رسید.</td></tr>}
                      <tr className="bg-amber-500/10"><td className="py-2 font-bold text-theme-primary" colSpan={4}>امتیاز کل <span className="text-[11px] font-normal text-theme-muted">(پایه + پاداش {faNum(sample.bonus)} − کسورات {faNum(sample.penalty)})</span></td><td className="text-center text-lg font-extrabold text-amber-600" dir="ltr">{faNum(Math.round(sample.score))}</td></tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {movers.length > 0 && (
              <details className="bg-theme-card border border-theme rounded-2xl">
                <summary className="px-4 py-3 text-sm font-semibold text-theme-primary cursor-pointer select-none">چه کسانی بیشترین تغییر را می‌کنند؟ ({faNum(movers.length)} نفر)</summary>
                <div className="px-4 pb-3 max-h-80 overflow-auto"><table className="w-full text-sm"><thead className="sticky top-0 bg-theme-card"><tr className="text-[11px] text-theme-muted border-b border-theme"><th className="text-right py-1.5 font-medium">نام</th><th className="text-right font-medium">دپارتمان</th><th className="font-medium">فعلی</th><th className="font-medium">جدید</th><th className="font-medium">تغییر</th><th className="font-medium">رتبه</th></tr></thead><tbody>
                  {movers.slice(0, 40).map(r => <tr key={r.userId} className="border-b border-theme/40"><td className="py-1.5 text-theme-primary whitespace-nowrap">{r.name}</td><td className="text-theme-muted whitespace-nowrap">{r.department || "—"}</td><td className="text-center">{faNum(Math.round(r.currentScore))}</td><td className="text-center font-medium text-theme-primary">{faNum(Math.round(r.score))}</td><td className={`text-center font-semibold ${r.delta > 0 ? "text-green-600" : "text-red-600"}`} dir="ltr">{r.delta > 0 ? "+" : "−"}{faNum(Math.abs(r.delta))}</td><td className="text-center text-xs text-theme-muted">{r.currentRank ? faNum(r.currentRank) : "—"} ← {r.rank ? faNum(r.rank) : "—"}</td></tr>)}
                </tbody></table></div>
              </details>
            )}
          </>
        )}
      </Section>

      {/* 3 — the indicators */}
      <Section n="۳" title="شاخص‌ها" sub="هر شاخص را روشن یا خاموش و ارزش‌گذاری کنید؛ کنار هر کدام می‌بینید روی داده‌ی واقعی چه می‌کند">
        {(["score", "bonus", "penalty"] as const).map(kind => (
          <div key={kind} className="space-y-2">
            <div className="flex items-start gap-2 bg-theme-secondary/40 rounded-xl px-3 py-2">
              <Info className={`w-4 h-4 mt-0.5 shrink-0 ${KIND[kind].cls}`} />
              <div><div className={`text-sm font-bold ${KIND[kind].cls}`}>{KIND[kind].title} <span className="text-xs font-normal text-theme-muted">— {KIND[kind].sub}</span></div><p className="text-[11px] leading-relaxed text-theme-secondary">{KIND[kind].help}</p></div>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {catalog.filter(d => d.kind === kind).map(d => {
                const c = cfg.indicators[d.key];
                const st = stats[d.key];
                const clash = c.enabled ? (d.overlaps || []).filter((k: string) => on(k)).map((k: string) => catalog.find(x => x.key === k)?.label).filter(Boolean) : [];
                const share = kind === "score" && c.enabled && weightSum ? Math.round((c.weight / weightSum) * 100) : 0;
                const maxH = Math.max(1, ...(st?.hist || [1]));
                return (
                  <div key={d.key} className={`bg-theme-card border border-theme border-r-4 rounded-2xl p-3.5 transition-opacity ${KIND[kind].edge} ${c.enabled ? "" : "opacity-60"}`}>
                    <div className="flex items-start gap-3">
                      <Switch on={c.enabled} onChange={v => setInd(d.key, { enabled: v })} />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-theme-primary text-sm">{d.label}</span><span className="text-[10px] px-1.5 py-0.5 rounded-md bg-theme-secondary text-theme-muted">{d.group}</span>{kind === "score" && c.enabled && <span className="text-[10px] px-1.5 py-0.5 rounded-md text-white" style={{ background: colorOf(d.key) }}>{faNum(share)}٪ از امتیاز پایه</span>}</div>
                        <p className="text-xs text-theme-muted mt-1 leading-relaxed">{d.description}</p>
                      </div>
                    </div>

                    {c.enabled && (
                      <div className="mt-3 space-y-3">
                        <div className="flex flex-wrap items-start gap-x-5 gap-y-3 bg-theme-secondary/30 rounded-xl p-3">
                          {kind === "score" && <Field label="وزن" hint={`هر چه بیشتر، اثر این شاخص در امتیاز پایه بیشتر. الان ${faNum(share)}٪ از امتیاز پایه است (جمع وزن‌ها ${faNum(weightSum)}).`}><Num v={c.weight} on={v => setInd(d.key, { weight: v })} /></Field>}
                          {kind !== "score" && <>
                            <Field label={`امتیاز به ازای هر ${d.unit}`} hint={`${kind === "bonus" ? "اضافه" : "کم"} می‌شود. مثلاً ۳ ${d.unit} = ${faNum(Math.round(c.points * 3 * 100) / 100)} امتیاز.`}><Num v={c.points} step={0.1} on={v => setInd(d.key, { points: v })} /></Field>
                            <Field label="سقف این مورد (امتیاز)" hint={`حتی با تعداد خیلی زیاد، بیشتر از این ${kind === "bonus" ? "اضافه" : "کم"} نمی‌شود.`}><Num v={c.cap} step={0.5} on={v => setInd(d.key, { cap: v })} /></Field>
                          </>}
                          {(d.params || []).map((p: any) => <Field key={p.key} label={`${p.label} (${p.unit})`} hint={`بین ${faNum(p.min)} و ${faNum(p.max)}؛ پیش‌فرض ${faNum(p.default)}`}><Num v={c.params[p.key]} min={p.min} max={p.max} step={p.step} w="!w-24" on={v => setParam(d.key, p.key, v)} /></Field>)}
                        </div>

                        {st && (kind === "score" ? (
                          <div className="flex items-end gap-4">
                            <div dir="ltr" className="flex items-end gap-1 h-12 shrink-0" title="تعداد افراد در بازه‌های ۰–۲۰ تا ۸۰–۱۰۰">
                              {(st.hist || []).map((n: number, i: number) => <div key={i} className="flex flex-col items-center gap-0.5"><div className="w-5 rounded-t" style={{ height: `${Math.max(2, (n / maxH) * 38)}px`, background: ["#d95555", "#eda100", "#eda100", "#2a78d6", "#1baf7a"][i], opacity: n ? 1 : 0.25 }} /><span className="text-[8px] text-theme-muted">{faNum(i * 20)}</span></div>)}
                            </div>
                            <div className="text-xs text-theme-secondary leading-relaxed">
                              <div>برای <b className="text-theme-primary">{faNum(st.withData ?? 0)}</b> از {faNum(pv?.people ?? 0)} نفر قابل محاسبه است{(st.withData ?? 0) < (pv?.people ?? 0) ? <span className="text-theme-muted"> (بقیه داده ندارند و کنار گذاشته می‌شوند)</span> : null}</div>
                              <div>میانگین: <b className="text-theme-primary">{st.avg == null ? "—" : faNum(st.avg)}</b></div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-theme-secondary">
                            {(st.affected ?? 0) === 0 ? <span className="text-theme-muted">در این بازه برای هیچ‌کس اتفاق نمی‌افتد.</span> : <>برای <b className="text-theme-primary">{faNum(st.affected ?? 0)}</b> نفر {kind === "bonus" ? "پاداش" : "کسر"} اعمال می‌شود — میانگین <b className={kind === "bonus" ? "text-green-600" : "text-red-600"}>{faNum(st.avg ?? 0)}</b> امتیاز برای هر نفر.</>}
                          </div>
                        ))}
                      </div>
                    )}
                    {clash.length > 0 && <p className="mt-2 flex items-start gap-1 text-[11px] text-amber-600"><TriangleAlert className="w-3.5 h-3.5 shrink-0" /> همزمان با «{clash.join("، ")}» روشن است و ممکن است یک موضوع دوبار حساب شود.</p>}
                    <button type="button" onClick={() => setOpen(o => ({ ...o, [d.key]: !o[d.key] }))} className="mt-2 flex items-center gap-1 text-[11px] text-theme-muted hover:text-theme-primary"><ChevronDown className={`w-3 h-3 transition-transform ${open[d.key] ? "rotate-180" : ""}`} /> چطور حساب می‌شود؟</button>
                    {open[d.key] && <div className="mt-1.5 text-[11px] leading-relaxed text-theme-secondary bg-theme-secondary/30 rounded-lg px-3 py-2">{howText(d)}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </Section>

      {/* 4 — general */}
      <Section n="۴" title="تنظیمات کلی" sub="سقف‌ها، حداقل داده و آستانه‌ی سطح‌ها">
        <div className="bg-theme-card border border-theme rounded-2xl p-4 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="سقف کل پاداش‌ها (امتیاز)" hint="مجموع همه‌ی پاداش‌های یک نفر از این مقدار بیشتر نمی‌شود، حتی اگر چند پاداش با هم فعال شوند."><Num v={g.maxBonus} on={v => setGen("maxBonus", v)} /></Field>
            <Field label="سقف کل کسورات (امتیاز)" hint="مجموع همه‌ی کسورات یک نفر از این مقدار بیشتر نمی‌شود؛ برای اینکه چند کسر هم‌پوشان امتیاز را یک‌باره صفر نکنند."><Num v={g.maxPenalty} on={v => setGen("maxPenalty", v)} /></Field>
            <Field label="حداقل تعداد شاخص اصلی دارای داده" hint="فردی که کمتر از این تعداد شاخص برایش قابل محاسبه باشد (مثلاً نگهبان بدون گزارش و تیکت) «بدون امتیاز» می‌شود، نه ۱۰۰ و نه ۰."><Num v={g.minIndicators} min={1} max={20} on={v => setGen("minIndicators", v)} /></Field>
            <Field label="حداقل روز کاری در بازه" hint="اگر فردی در بازه کمتر از این تعداد روز کاری داشته، امتیاز نمی‌گیرد (۰ = بدون محدودیت). برای بازه‌های کوتاه یا افراد تازه‌وارد مفید است."><Num v={g.minWorkingDays} max={366} on={v => setGen("minWorkingDays", v)} /></Field>
          </div>
          <div>
            <div className="text-sm font-semibold text-theme-primary mb-1">آستانه‌ی سطح‌ها</div>
            <p className="text-[11px] text-theme-muted mb-2">امتیاز کل هر نفر با این آستانه‌ها به یکی از چهار سطح می‌رسد. باید عالی ≥ خوب ≥ متوسط باشد.</p>
            <div className="flex h-7 rounded-lg overflow-hidden text-[10px] font-bold text-white mb-3" dir="ltr">
              {([[g.fair, "#d95555", "ضعیف"], [g.good - g.fair, "#eda100", "متوسط"], [g.excellent - g.good, "#2a78d6", "خوب"], [100 - g.excellent, "#1baf7a", "عالی"]] as Array<[number, string, string]>).map(([w, c, l], i) => <div key={i} className="flex items-center justify-center" style={{ width: `${Math.max(0, w)}%`, background: c }}>{w >= 8 ? l : ""}</div>)}
            </div>
            <div className="flex flex-wrap gap-5">
              <Field label="«متوسط» از امتیاز"><Num v={g.fair} on={v => setGen("fair", v)} /></Field>
              <Field label="«خوب» از امتیاز"><Num v={g.good} on={v => setGen("good", v)} /></Field>
              <Field label="«عالی» از امتیاز"><Num v={g.excellent} on={v => setGen("excellent", v)} /></Field>
            </div>
            {gradeBad && <p className="text-xs text-red-600 mt-2">آستانه‌ها باید به ترتیب عالی ≥ خوب ≥ متوسط باشند.</p>}
          </div>
        </div>
      </Section>
    </div>
  );
}
