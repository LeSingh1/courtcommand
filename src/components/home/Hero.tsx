"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowRight, Search } from "lucide-react";
import { useCommandBar } from "@/components/command/CommandBarProvider";
import { PLAYERS } from "@/lib/data";

// The 3D shot-field is browser-only; the hero reads perfectly without it.
const Hero3D = dynamic(() => import("./Hero3D"), { ssr: false, loading: () => null });

const STATS = [
  { k: "30", l: "Instruments" },
  { k: "15,234", l: "Real playoff shots" },
  { k: "", l: "Players indexed" }, // filled at render with live count
  { k: "23", l: "Seasons of training" },
];

export function Hero() {
  const { open } = useCommandBar();

  return (
    <section className="relative overflow-hidden">
      {/* Real 2026 playoff shots, sculpted — every dot and arc is a real attempt. */}
      <Hero3D className="absolute inset-0 opacity-75 [mask-image:linear-gradient(to_bottom,black_70%,transparent)] lg:left-[12%] lg:opacity-100" />

      <div className="relative mx-auto max-w-7xl px-5 pb-10 pt-32 sm:px-8 sm:pt-40 lg:pt-44">
        <div className="kicker enter mb-7 flex items-center gap-3" style={{ animationDelay: "0.9s" }}>
          <span className="blink inline-block h-1.5 w-1.5 bg-[var(--accent)]" />
          Live render · 436 real playoff shots in orbit
        </div>

        <h1 className="display text-[clamp(3.1rem,9vw,7.2rem)] text-[var(--text)]">
          <span className="mask-line">
            <span style={{ ["--d" as string]: "0.05s" }}>The basketball</span>
          </span>
          <span className="mask-line">
            <span style={{ ["--d" as string]: "0.16s" }}>
              <em className="display-italic text-[var(--accent)]">intelligence</em> terminal.
            </span>
          </span>
        </h1>

        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-end">
          <div>
            <p className="enter max-w-xl text-base leading-relaxed text-[var(--text-muted)]" style={{ animationDelay: "0.45s" }}>
              Shot quality, statistical comparables, cap-legal trades, lineup optimization, clutch
              ratings — thirty rigorous instruments for reading the modern NBA, trained on two
              decades of real basketball.
            </p>

            <div className="enter mt-8 flex flex-wrap items-center gap-3" style={{ animationDelay: "0.55s" }}>
              <Link href="/tools" className="btn-accent inline-flex items-center gap-2 px-7 py-3.5 text-sm">
                Browse all 30 tools
                <ArrowRight size={15} strokeWidth={2} />
              </Link>
              <Link href="/tools/shot-quality" className="btn-ghost inline-flex items-center gap-2 px-6 py-3.5 text-sm">
                Open Shot Quality
              </Link>
            </div>
          </div>

          <button
            onClick={open}
            className="enter group flex items-center gap-3 rounded-2xl border border-[var(--line-strong)] bg-[var(--surface)] px-4 py-4 text-left transition-colors hover:border-[var(--accent)]"
            style={{ animationDelay: "0.65s" }}
          >
            <Search size={17} className="shrink-0 text-[var(--text-faint)] transition-colors group-hover:text-[var(--accent)]" strokeWidth={1.75} />
            <span className="flex-1 truncate text-sm text-[var(--text-muted)]">
              Search a player, ask a question, run a command
            </span>
            <kbd className="hidden items-center gap-1 border border-[var(--line)] px-2 py-1 text-[11px] text-[var(--text-faint)] sm:flex">
              ⌘K
            </kbd>
          </button>
        </div>

        <dl className="enter mt-16 grid grid-cols-2 border-t border-[var(--line)] sm:grid-cols-4" style={{ animationDelay: "0.8s" }}>
          {STATS.map((s) => (
            <div key={s.l} className="border-b border-r border-[var(--line)] px-4 py-5 last:border-r-0 sm:border-b-0">
              <dt className="scoreboard text-4xl text-[var(--text)]">{s.k || String(PLAYERS.length)}</dt>
              <dd className="mt-1.5 text-[11px] uppercase tracking-wider text-[var(--text-faint)]">{s.l}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
