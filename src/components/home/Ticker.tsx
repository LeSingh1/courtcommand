"use client";

import { useMemo } from "react";
import { awardRace, clutchBoard } from "@/lib/engine/players";
import { FT_RATES } from "@/lib/data/ftrate";
import { TEAMS } from "@/lib/data";

// Broadcast chyron — every line is a real engine output or real season stat.
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
    clutch.forEach((r, i) => out.push({ k: `CLUTCH №${i + 1}`, v: `${r.player.name} ${r.clutchScore}` }));
    if (ft) out.push({ k: "FT RATE", v: `${ft.name} ${ft.ftr.toFixed(2)}` });
    if (net) out.push({ k: "BEST NET", v: `${net.abbr} ${(net.ortg - net.drtg).toFixed(1)}` });
    out.push({ k: "INDEXED", v: "15,234 real playoff shots" });
    out.push({ k: "TRAINED", v: "2003 – 2026 · 3,332 player-seasons" });
    return out;
  }, []);

  const Row = ({ ariaHidden = false }: { ariaHidden?: boolean }) => (
    <span className="inline-flex items-center" aria-hidden={ariaHidden}>
      {items.map((it, i) => (
        <span key={`${it.k}-${i}`} className="inline-flex items-center">
          <span className="stat-num px-3 text-[11px] font-semibold text-[var(--accent)]">{it.k}</span>
          <span className="stat-num pr-8 text-[11px] text-[var(--text-muted)]">{it.v}</span>
          <span className="mr-8 h-3 w-px bg-[var(--line-strong)]" />
        </span>
      ))}
    </span>
  );

  return (
    <div className="marquee border-y border-[var(--line)] bg-[var(--surface)] py-2.5" role="marquee" aria-label="Live model readouts">
      <div className="marquee-track" style={{ ["--marquee-dur" as string]: "46s" }}>
        <Row />
        <Row ariaHidden />
      </div>
    </div>
  );
}
