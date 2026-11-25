"use client";
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [done, setDone] = React.useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(code); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* */ }
  };
  return (
    <div className="my-3 rounded-xl overflow-hidden border border-slate-700/60 bg-slate-900 text-left" dir="ltr">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800/80 text-[11px] text-slate-300">
        <span className="font-mono">{lang || "code"}</span>
        <button onClick={copy} className="flex items-center gap-1 hover:text-white transition-colors">
          {done ? <><Check className="w-3 h-3 text-green-400" /> کپی شد</> : <><Copy className="w-3 h-3" /> کپی</>}
        </button>
      </div>
      <pre className="p-3 text-[12.5px] leading-relaxed overflow-x-auto text-slate-100 font-mono"><code>{code}</code></pre>
    </div>
  );
}

/** Safe Markdown (raw HTML is never rendered). Links open in a new tab; only http(s)/mailto/tel are kept. */
function MarkdownImpl({ text }: { text: string }) {
  return (
    <div className="text-sm leading-7 break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(u) => (/^(https?:|mailto:|tel:|#)/i.test(u) ? u : "")}
        components={{
          a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-blue-500 hover:underline break-all">{children}</a>,
          p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="list-disc ps-5 my-2 space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal ps-5 my-2 space-y-0.5">{children}</ol>,
          h1: ({ children }) => <h1 className="text-lg font-bold mt-4 mb-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-base font-bold mt-3 mb-1.5">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-bold mt-3 mb-1">{children}</h3>,
          blockquote: ({ children }) => <blockquote className="border-s-4 border-blue-400/60 ps-3 my-2 text-theme-secondary">{children}</blockquote>,
          hr: () => <hr className="my-3 border-theme" />,
          table: ({ children }) => <div className="my-3 overflow-x-auto rounded-lg border border-theme"><table className="w-full text-xs">{children}</table></div>,
          th: ({ children }) => <th className="bg-theme-hover px-3 py-1.5 text-start font-semibold border-b border-theme">{children}</th>,
          td: ({ children }) => <td className="px-3 py-1.5 border-b border-theme/60">{children}</td>,
          img: () => null,
          code: ({ className, children }) => {
            const lang = /language-(\w+)/.exec(className || "")?.[1];
            const code = String(children).replace(/\n$/, "");
            if (!lang && !code.includes("\n")) return <code className="bg-black/10 dark:bg-white/10 rounded px-1 py-0.5 text-[0.85em] font-mono" dir="ltr">{code}</code>;
            return <CodeBlock lang={lang || ""} code={code} />;
          },
          pre: ({ children }) => <>{children}</>,
        }}
      >{text}</ReactMarkdown>
    </div>
  );
}
export const Markdown = React.memo(MarkdownImpl);
