"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { ToolCard } from "@/components/ui/ToolCard";
import { TOOLS, CATEGORIES, categoryColor } from "@/lib/tools";
import { cn } from "@/lib/cn";

export default function ToolsPage() {
  const [cat, setCat] = useState<string>("All");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    return TOOLS.filter((t) => {
      const catOk = cat === "All" || t.category === cat;
      const qOk =
        !q.trim() ||
        t.name.toLowerCase().includes(q.toLowerCase()) ||
        t.tagline.toLowerCase().includes(q.toLowerCase()) ||
        t.keywords.some((k) => k.toLowerCase().includes(q.toLowerCase()));
      return catOk && qOk;
    });
  }, [cat, q]);

  return (
    <div className="mx-auto max-w-7xl px-5 pb-24 pt-28 sm:px-8">
      <div className="mb-3 eyebrow text-ember">The arsenal</div>
      <h1 className="display text-4xl text-white sm:text-5xl">All 30 tools</h1>
      <p className="mt-3 max-w-xl text-white/55">
        Browse the full CourtCommand suite, or hit{" "}
        <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-xs">⌘K</kbd> to
        route there by asking.
      </p>

      <div className="sticky top-16 z-20 mt-8 flex flex-col gap-3 rounded-none border border-white/[0.06] bg-ink-900/70 py-3 backdrop-blur-xl sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 rounded-none border border-white/10 bg-white/[0.04] px-3 py-2 sm:w-64">
          <Search size={15} className="text-white/40" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter tools…"
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35"
          />
        </div>
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {["All", ...CATEGORIES].map((c) => {
            const active = cat === c;
            const color = c === "All" ? "#E0561F" : categoryColor(c);
            return (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={cn(
                  "whitespace-nowrap border px-3.5 py-2 text-sm transition",
                  active ? "text-[#160600]" : "border-white/10 bg-white/[0.03] text-white/60 hover:text-white",
                )}
                style={active ? { background: color, borderColor: color } : undefined}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((t, i) => (
          <ToolCard key={t.slug} tool={t} index={i} />
        ))}
      </div>
      {filtered.length === 0 && (
        <div className="py-20 text-center text-white/40">No tools match “{q}”.</div>
      )}
    </div>
  );
}
