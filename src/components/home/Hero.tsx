"use client";

import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { useCommandBar } from "@/components/command/CommandBarProvider";
import { clutchBoard } from "@/lib/engine/players";
import { PLAYERS } from "@/lib/data";
import { Enter } from "@/components/ui/Reveal";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { TeamLogo } from "@/components/ui/TeamLogo";

export function Hero() {
  const { open } = useCommandBar();
  const board = clutchBoard().slice(0, 7);

  return (
    <section className="mx-auto max-w-7xl px-5 pb-16 pt-32 sm:px-8 sm:pt-40">
      <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
        {/* Left: editorial headline */}
        <div>
          <Enter delay={0.05}>
            <div className="kicker mb-6 flex items-center gap-3">
              <span className="sweep-in h-px w-8 bg-[var(--accent)]" style={{ animationDelay: "0.35s" }} />
              NBA Intelligence · Thirty Instruments
            </div>
          </Enter>

          <Enter delay={0.12}>
            <h1 className="display text-[clamp(2.7rem,6.8vw,5.2rem)] text-[var(--text)]">
              The basketball
              <br />
              <span className="display-italic text-[var(--accent)]">intelligence</span> terminal.
            </h1>
          </Enter>

          <Enter delay={0.2}>
            <p className="mt-7 max-w-xl text-base leading-relaxed text-[var(--text-muted)]">
              Shot quality, statistical comparables, cap-legal trades, lineup optimization, clutch
              ratings — thirty rigorous instruments for reading the modern NBA, powered by models
              trained on two decades of basketball.
            </p>
          </Enter>

          <Enter delay={0.28}>
            <button
              onClick={open}
              className="mt-9 flex w-full max-w-xl items-center gap-3 border border-[var(--line-strong)] bg-[var(--surface)] px-4 py-3.5 text-left transition-colors hover:border-[var(--accent)]"
            >
              <Search size={17} className="shrink-0 text-[var(--text-faint)]" strokeWidth={1.75} />
              <span className="flex-1 truncate text-sm text-[var(--text-muted)]">
                Search a player, ask a question, or run a command
              </span>
              <kbd className="hidden items-center gap-1 border border-[var(--line)] px-2 py-1 text-[11px] text-[var(--text-faint)] sm:flex">
                ⌘K
              </kbd>
            </button>
          </Enter>

          <Enter delay={0.34}>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href="/tools"
                className="btn-accent inline-flex items-center gap-2 px-6 py-3 text-sm"
              >
                Browse all 30 tools
                <ArrowRight size={15} strokeWidth={2} />
              </Link>
              <Link
                href="/tools/shot-quality"
                className="btn-ghost inline-flex items-center gap-2 px-6 py-3 text-sm"
              >
                Open Shot Quality
              </Link>
            </div>
          </Enter>

          <Enter delay={0.42}>
            <dl className="mt-12 grid max-w-xl grid-cols-2 border-t border-[var(--line)] sm:grid-cols-4">
              {[
                { k: "30", l: "Instruments" },
                { k: String(PLAYERS.length), l: "Players" },
                { k: "30", l: "Teams" },
                { k: "Live", l: "ESPN data" },
              ].map((s) => (
                <div
                  key={s.l}
                  className="border-b border-r border-[var(--line)] px-4 py-4 last:border-r-0"
                >
                  <dt className="scoreboard text-3xl text-[var(--text)]">{s.k}</dt>
                  <dd className="mt-1 text-[11px] uppercase tracking-wider text-[var(--text-faint)]">
                    {s.l}
                  </dd>
                </div>
              ))}
            </dl>
          </Enter>
        </div>

        {/* Right: live data board */}
        <Enter delay={0.24} className="self-start">
          <div className="border border-[var(--line)] bg-[var(--surface)]">
            <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3.5">
              <span className="text-sm font-semibold text-[var(--text)]">Clutch Index</span>
              <span className="kicker flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 bg-[var(--accent)]" />
                Live · top 7
              </span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--text-faint)]">
                  <th className="py-2 pl-5 font-medium">#</th>
                  <th className="py-2 font-medium">Player</th>
                  <th className="py-2 font-medium">Tm</th>
                  <th className="py-2 pr-5 text-right font-medium">Rtg</th>
                </tr>
              </thead>
              <tbody>
                {board.map((r, i) => (
                  <tr
                    key={r.player.id}
                    className="border-t border-[var(--line)] transition-colors hover:bg-[var(--surface-2)]"
                  >
                    <td className="scoreboard py-2 pl-5 text-base text-[var(--text-faint)]">{i + 1}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-2.5">
                        <PlayerAvatar player={r.player} size={28} />
                        <span className="text-[var(--text)]">{r.player.name}</span>
                      </div>
                    </td>
                    <td className="py-2">
                      <TeamLogo abbr={r.player.team} size={20} />
                    </td>
                    <td className="scoreboard py-2 pr-5 text-right text-lg text-[var(--text)]">
                      {r.clutchScore}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Link
              href="/tools/clutch"
              className="group flex items-center justify-between border-t border-[var(--line)] px-5 py-3 text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--accent)]"
            >
              <span className="link-underline">Open the Clutch Dashboard</span>
              <ArrowRight
                size={14}
                strokeWidth={2}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          </div>
        </Enter>
      </div>
    </section>
  );
}
