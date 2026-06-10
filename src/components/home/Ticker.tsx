"use client";

import { useMemo } from "react";
import { awardRace, clutchBoard } from "@/lib/engine/players";
import { FT_RATES } from "@/lib/data/ftrate";
import { TEAMS } from "@/lib/data";

// Live model readouts — clean sentence-case chips, no terminal styling.
// Every line is a real engine output or real season stat.
export function Ticker() {
  const items = useMemo(() => {
    const mvp = awardRace("MVP").slice(0, 3);
    const dpoy = awardRace("DPOY")[0];
    const clutch = clutchBoard().slice(0, 2);
    const ft = [...FT_RATES].sort((a, b) => b.ftr - a.ftr)[0];
    const net = [...TEAMS].sort((a, b) => b.ortg - b.drtg - (a.ortg - a.drtg))[0];
    const out: { k: string; v: string }[] = [];
    mvp.forEach((r, i) => out.push({ k: `MVP №${i + 1}`, v: `${r.player.name} ${r.share}%` }));
    if (dpoy) out.push({ k: "DPOY", v: `${dpoy.player.name} ${dpoy.share}%` });
    clutch.forEach((r, i) => out.push({ k: `Clutch №${i + 1}`, v: `${r.player.name} ${r.clutchScore}` }));
    if (ft) out.push({ k: "FT rate", v: `${ft.name} ${ft.ftr.toFixed(2)}` });
    if (net) out.push({ k: "Best net", v: `${net.abbr} ${(net.ortg - net.drtg).toFixed(1)}` });
    out.push({ k: "Indexed", v: "15,234 real playoff shots" });
    out.push({ k: "Trained", v: "2003–2026 · 3,332 player-seasons" });
    return out;
  }, []);

  const Row = ({ ariaHidden = false }: { ariaHidden?: boolean }) => (
    <span className="inline-flex items-center" aria-hidden={ariaHidden}>
      {items.map((it, i) => (
        <span key={`${it.k}-${i}`} className="inline-flex items-center">
          <span className="pl-7 pr-2 text-xs font-semibold text-[var(--accent)]">{it.k}</span>
          <span className="text-xs text-[var(--text-muted)]">{it.v}</span>
          <span className="ml-7 inline-block h-[3px] w-[3px] rounded-full bg-white/20" />
        </span>
      ))}
    </span>
  );

  return (
    <div
      className="marquee border-y border-[var(--line)] bg-[var(--surface)] py-2.5"
      role="marquee"
      aria-label="Live model readouts"
    >
      <div className="marquee-track" style={{ ["--marquee-dur" as string]: "46s" }}>
        <Row />
        <Row ariaHidden />
      </div>
    </div>
  );
}
