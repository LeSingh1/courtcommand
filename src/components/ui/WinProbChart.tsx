"use client";

import { useMemo, useRef, useState } from "react";
import { TEAM_MAP } from "@/lib/data";
import { TeamLogo } from "@/components/ui/TeamLogo";
import type { GameWpSeries, WpPoint } from "@/lib/data/pbp";

// ESPN-Gamecast-style win probability chart:
//   · x-axis is real game time with quarter gridlines (OTs appended)
//   · the area splits at the 50% line — home team's color fills the top half,
//     away team's the bottom, so whoever is favored "owns" the paint
//   · hover/touch scrubber with a tooltip: period + clock, real score, event
//     type, and both teams' live win probability
//   · diamond markers on the three biggest swings
const W = 760;
const PAD_L = 30;
const PAD_R = 10;
const PAD_T = 10;
const PAD_B = 24;

function fmtClock(c: number): string {
  return `${Math.floor(c / 60)}:${String(c % 60).padStart(2, "0")}`;
}
function periodLabel(p: number): string {
  return p > 4 ? `OT${p - 4}` : `Q${p}`;
}

// Team colors can be near-black; lighten anything too dark to read on the
// chart's dark field.
function readableTeamColor(abbr: string, fallback: string): string {
  const hex = TEAM_MAP[abbr]?.color ?? fallback;
  const h = hex.replace("#", "");
  if (h.length !== 6) return fallback;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (lum >= 0.16) return hex;
  const mix = (c: number) => Math.round(c + (255 - c) * 0.45);
  return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

export function WinProbChart({ series, height = 280 }: { series: GameWpSeries; height?: number }) {
  const [home, away] = series.teams;
  const homeColor = readableTeamColor(home, "#4D8DFF");
  const awayColor = readableTeamColor(away, "#8E96A4");
  const wrap = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<WpPoint | null>(null);

  const H = height;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const { total, boundaries } = useMemo(() => {
    const lastP = series.points.at(-1)?.period ?? 4;
    const tot = lastP <= 4 ? 2880 : 2880 + (lastP - 4) * 300;
    const b: { at: number; label: string }[] = [];
    for (let q = 1; q <= 4; q++) b.push({ at: (q - 1) * 720, label: `Q${q}` });
    for (let ot = 5; ot <= lastP; ot++) b.push({ at: 2880 + (ot - 5) * 300, label: `OT${ot - 4}` });
    return { total: tot, boundaries: b };
  }, [series]);

  const x = (elapsed: number) => PAD_L + (elapsed / total) * innerW;
  const y = (wp: number) => PAD_T + (1 - wp / 100) * innerH;
  const midY = y(50);

  const linePath = useMemo(
    () => series.points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.elapsed).toFixed(1)},${y(p.wp).toFixed(1)}`).join(""),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series, total, H],
  );
  const areaPath = useMemo(() => {
    const first = series.points[0];
    const last = series.points.at(-1)!;
    return `${linePath}L${x(last.elapsed).toFixed(1)},${midY.toFixed(1)}L${x(first.elapsed).toFixed(1)},${midY.toFixed(1)}Z`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linePath]);

  const onMove = (e: React.PointerEvent) => {
    const rect = wrap.current?.getBoundingClientRect();
    if (!rect) return;
    const vx = ((e.clientX - rect.left) / rect.width) * W;
    const elapsed = ((vx - PAD_L) / innerW) * total;
    // nearest point by elapsed (points are time-sorted)
    let lo = 0;
    let hi = series.points.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (series.points[mid].elapsed < elapsed) lo = mid + 1;
      else hi = mid;
    }
    const cand = series.points[lo];
    const prev = series.points[Math.max(0, lo - 1)];
    setHover(Math.abs(prev.elapsed - elapsed) < Math.abs(cand.elapsed - elapsed) ? prev : cand);
  };

  const KIND: Record<WpPoint["kind"], string> = {
    s: "Field goal",
    f: "Free throw",
    o: "Turnover",
    e: "Play",
  };

  const tooltipLeftPct = hover ? (x(hover.elapsed) / W) * 100 : 0;

  return (
    <div ref={wrap} className="relative select-none" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
      {/* team chips on the two halves */}
      <div className="pointer-events-none absolute left-9 top-2 z-10 flex items-center gap-1.5">
        <TeamLogo abbr={home} size={16} />
        <span className="text-xs font-semibold" style={{ color: homeColor }}>
          {home}
        </span>
      </div>
      <div className="pointer-events-none absolute bottom-8 left-9 z-10 flex items-center gap-1.5">
        <TeamLogo abbr={away} size={16} />
        <span className="text-xs font-semibold" style={{ color: awayColor }}>
          {away}
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${home} win probability across the game`}>
        <defs>
          <clipPath id="wp-top">
            <rect x={PAD_L} y={PAD_T} width={innerW} height={midY - PAD_T} />
          </clipPath>
          <clipPath id="wp-bottom">
            <rect x={PAD_L} y={midY} width={innerW} height={PAD_T + innerH - midY} />
          </clipPath>
        </defs>

        {/* quarter gridlines + segment labels */}
        {boundaries.map((b, i) => {
          const next = boundaries[i + 1]?.at ?? total;
          return (
            <g key={b.label}>
              {b.at > 0 && (
                <line x1={x(b.at)} y1={PAD_T} x2={x(b.at)} y2={PAD_T + innerH} stroke="rgba(255,255,255,0.09)" strokeWidth={1} />
              )}
              <text
                x={x((b.at + next) / 2)}
                y={H - 7}
                textAnchor="middle"
                fontSize={11}
                fill="rgba(255,255,255,0.42)"
                fontFamily="var(--font-sans)"
              >
                {b.label}
              </text>
            </g>
          );
        })}

        {/* y labels */}
        {[100, 50, 0].map((v) => (
          <text
            key={v}
            x={PAD_L - 6}
            y={y(v) + 4}
            textAnchor="end"
            fontSize={10}
            fill="rgba(255,255,255,0.35)"
            fontFamily="var(--font-mono)"
          >
            {v === 0 ? "100" : v}
          </text>
        ))}

        {/* split area fills — home owns the top half, away the bottom */}
        <path d={areaPath} fill={homeColor} opacity={0.34} clipPath="url(#wp-top)" />
        {/* bottom half: fill the inverse region (between line and midline, below it) */}
        <path d={areaPath} fill={awayColor} opacity={0.30} clipPath="url(#wp-bottom)" />

        {/* 50% midline */}
        <line x1={PAD_L} y1={midY} x2={PAD_L + innerW} y2={midY} stroke="rgba(255,255,255,0.22)" strokeWidth={1} strokeDasharray="4 4" />

        {/* WP line */}
        <path d={linePath} fill="none" stroke="rgba(244,244,245,0.92)" strokeWidth={1.6} pathLength={1} className="wp-draw" />

        {/* biggest-swing markers */}
        {series.swings.map((s) => {
          const pt = series.points[s.index];
          if (!pt) return null;
          return (
            <g key={s.index} transform={`translate(${x(pt.elapsed)},${y(pt.wp)})`}>
              <rect x={-3.4} y={-3.4} width={6.8} height={6.8} transform="rotate(45)" fill="#4D8DFF" stroke="#0a0a0b" strokeWidth={1} />
            </g>
          );
        })}

        {/* scrubber */}
        {hover && (
          <g>
            <line x1={x(hover.elapsed)} y1={PAD_T} x2={x(hover.elapsed)} y2={PAD_T + innerH} stroke="rgba(255,255,255,0.35)" strokeWidth={1} />
            <circle cx={x(hover.elapsed)} cy={y(hover.wp)} r={4} fill={hover.wp >= 50 ? homeColor : awayColor} stroke="#0a0a0b" strokeWidth={1.5} />
          </g>
        )}
      </svg>

      {/* tooltip */}
      {hover && (
        <div
          className="pointer-events-none absolute top-1 z-20 w-44 rounded-lg border border-[var(--line-strong)] bg-[var(--surface-2)] px-3 py-2 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.7)]"
          style={{
            left: `clamp(0%, calc(${tooltipLeftPct}% - 88px), calc(100% - 176px))`,
          }}
        >
          <div className="flex items-center justify-between text-[11px] text-[var(--text-faint)]">
            <span>
              {periodLabel(hover.period)} {fmtClock(hover.clockSec)}
            </span>
            <span>{KIND[hover.kind]}</span>
          </div>
          <div className="stat-num mt-1 text-sm font-semibold text-[var(--text)]">
            {away} {hover.a} – {hover.h} {home}
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px]">
            <span style={{ color: homeColor }}>
              {home} {hover.wp.toFixed(1)}%
            </span>
            <span style={{ color: awayColor }}>
              {away} {(100 - hover.wp).toFixed(1)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
