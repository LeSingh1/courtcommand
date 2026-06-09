"use client";

import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import {
  trackRecord,
  type AwardSeason,
  type ProjSeason,
  type SeriesSeason,
} from "@/lib/model/backtests";

/**
 * Model track record — what the model predicted each season vs what really
 * happened, back to 2003, plus the real per-season training history that shows
 * the model learning. Self-contained: pass the tool slug. CSS-driven (reliable,
 * always visible, reduced-motion safe).
 */
function fmtAccuracy(tr: NonNullable<ReturnType<typeof trackRecord>>): string {
  const a = tr.accuracy;
  if (a == null) return "";
  if (tr.kind === "projection") return `±${a}`;
  if (tr.kind === "series") {
    if (tr.unit === "corr") return (a / 100).toFixed(2);
    if (tr.unit === "games") return a.toFixed(1);
    return `${a}%`;
  }
  return `${a}%`;
}

export function TrackRecord({ slug, accent = "#E0561F" }: { slug: string; accent?: string }) {
  const tr = trackRecord(slug);
  if (!tr) return null;

  return (
    <div className="border border-[var(--line)] bg-[var(--surface)]">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
        <div className="flex items-center gap-3">
          <span
            className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: accent, border: `1px solid ${accent}40`, background: `${accent}10` }}
          >
            <span className="inline-block h-1.5 w-1.5" style={{ background: accent }} />
            Model track record
          </span>
          <span className="text-sm text-[var(--text-muted)]">{tr.headline}</span>
        </div>
        {tr.accuracy != null && (
          <div className="text-right">
            <div className="scoreboard text-2xl" style={{ color: accent }}>
              {fmtAccuracy(tr)}
            </div>
            <div className="kicker">{tr.metric}</div>
          </div>
        )}
      </div>

      <div className="space-y-5 p-5">
        {/* training history — the model's data growing 2003 → now */}
        <HistoryBars tr={tr} accent={accent} />

        {tr.kind === "awards" && tr.races && tr.seasons && (
          <AwardsView races={tr.races} seasons={tr.seasons as AwardSeason[]} accent={accent} />
        )}
        {tr.kind === "projection" && tr.seasons && (
          <ProjectionView seasons={tr.seasons as ProjSeason[]} accent={accent} />
        )}
        {tr.kind === "series" && tr.seasons && (
          <SeriesView
            seasons={tr.seasons as SeriesSeason[]}
            accent={accent}
            label={tr.seriesLabel ?? "Model validation by season"}
            betterHigh={tr.betterHigh ?? true}
            unit={tr.unit ?? "corr"}
          />
        )}
        {tr.kind === "calibration" && tr.calibration && (
          <CalibrationView buckets={tr.calibration} accent={accent} />
        )}
        {(tr.kind === "champions" || tr.kind === "ncaa") && tr.champions && (
          <ChampionsView champions={tr.champions} accent={accent} league={tr.league ?? "NBA"} />
        )}

        <div className="border-t border-[var(--line)] pt-3 text-[11px] text-[var(--text-faint)]">
          {tr.method} · trained on {tr.trainedOn} · {tr.span}
        </div>
      </div>
    </div>
  );
}

function HistoryBars({ tr, accent }: { tr: NonNullable<ReturnType<typeof trackRecord>>; accent: string }) {
  const max = Math.max(...tr.history.map((h) => h.rows), 1);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="kicker">Training data by season</span>
        <span className="stat-num text-[11px] text-[var(--text-faint)]">
          {tr.history.at(-1)?.players} players · {tr.span}
        </span>
      </div>
      <div className="flex h-16 items-end gap-[3px]">
        {tr.history.map((h) => (
          <div key={h.year} className="group relative flex-1" title={`${h.season}: ${h.rows} seasons`}>
            <div
              className="w-full grow-x"
              style={{ height: `${Math.max(3, (h.rows / max) * 100)}%`, background: accent, opacity: 0.55, transformOrigin: "bottom" }}
            />
          </div>
        ))}
      </div>
      <div className="stat-num mt-1 flex justify-between text-[10px] text-[var(--text-faint)]">
        <span>{tr.history[0]?.season}</span>
        <span>the model&rsquo;s history — real data deepens each year</span>
        <span>{tr.history.at(-1)?.season}</span>
      </div>
    </div>
  );
}

/* ---------------- Awards: vote distribution + hit table ---------------- */
function AwardsView({ races, seasons, accent }: { races: { year: number; season: string; candidates: { name: string; modelShare: number; actualShare: number }[] }[]; seasons: AwardSeason[]; accent: string }) {
  const recent = useMemo(() => races.slice().sort((a, b) => b.year - a.year), [races]);
  const [year, setYear] = useState<number>(recent[0]?.year ?? 0);
  const race = recent.find((r) => r.year === year) ?? recent[0];
  const hits = seasons.filter((s) => s.correct).length;

  return (
    <div className="space-y-4">
      {/* vote distribution */}
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="kicker">MVP vote share — model vs actual</span>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            aria-label="Season"
            className="cursor-pointer border border-[var(--line)] bg-[var(--bg)] px-2 py-1 text-[11px] text-white outline-none"
          >
            {recent.map((r) => (
              <option key={r.year} value={r.year}>{r.season}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2.5">
          {race?.candidates.map((c, i) => (
            <div key={c.name}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-white/85">
                  {i === 0 && <span style={{ color: accent }}>★ </span>}
                  {c.name}
                </span>
                <span className="stat-num text-[var(--text-faint)]">
                  model {Math.round(c.modelShare * 100)}% · actual {Math.round(c.actualShare * 100)}%
                </span>
              </div>
              <div className="space-y-1">
                <Bar value={c.modelShare} color={accent} label="model" />
                <Bar value={c.actualShare} color="#5FA97E" label="actual" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* per-year predicted vs actual */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="kicker">Predicted MVP vs reality</span>
          <span className="stat-num text-[11px]" style={{ color: accent }}>{hits}/{seasons.length} correct</span>
        </div>
        <div className="no-scrollbar max-h-44 overflow-y-auto">
          <table className="w-full text-xs">
            <tbody>
              {seasons.slice().sort((a, b) => b.year - a.year).map((s) => (
                <tr key={s.year} className="border-b border-[var(--line)]">
                  <td className="stat-num py-1.5 pr-2 text-[var(--text-faint)]">{s.season}</td>
                  <td className="py-1.5 pr-2 text-white/80">{s.predicted}</td>
                  <td className="py-1.5 pr-2 text-[var(--text-muted)]">{s.actual}</td>
                  <td className="py-1.5 text-right">
                    {s.correct ? (
                      <Check size={13} className="ml-auto" style={{ color: "#5FA97E" }} />
                    ) : (
                      <X size={13} className="ml-auto" style={{ color: "#BF5B4E" }} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Projection: MAE per season ---------------- */
function ProjectionView({ seasons, accent }: { seasons: ProjSeason[]; accent: string }) {
  const max = Math.max(...seasons.map((s) => s.mae), 1);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="kicker">Projection error by season (PPG, lower is better)</span>
      </div>
      <div className="flex h-24 items-end gap-1">
        {seasons.map((s) => (
          <div key={s.year} className="group relative flex-1" title={`${s.season}: ±${s.mae} PPG (n=${s.n})`}>
            <div className="w-full grow-x" style={{ height: `${(s.mae / max) * 100}%`, background: accent, opacity: 0.6, transformOrigin: "bottom" }} />
          </div>
        ))}
      </div>
      <div className="stat-num mt-1 flex justify-between text-[10px] text-[var(--text-faint)]">
        <span>{seasons[0]?.season}</span>
        <span>{seasons.at(-1)?.season}</span>
      </div>
    </div>
  );
}

/* ---------------- Series: predicted vs actual, season by season ---------------- */
function SeriesView({ seasons, accent, label, betterHigh, unit }: { seasons: SeriesSeason[]; accent: string; label: string; betterHigh: boolean; unit: string }) {
  const max = Math.max(...seasons.map((s) => Math.abs(s.value)), 0.001);
  const fmtVal = (v: number) => (unit === "corr" ? v.toFixed(2) : unit === "games" ? `${v.toFixed(1)}g` : `${Math.round(v)}%`);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="kicker">{label}</span>
        <span className="stat-num text-[11px] text-[var(--text-faint)]">{betterHigh ? "higher is better" : "lower is better"}</span>
      </div>
      <div className="flex h-24 items-end gap-1">
        {seasons.map((s) => (
          <div key={s.year} className="group relative flex-1" title={`${s.season}: ${fmtVal(s.value)} (n=${s.n})`}>
            <div
              className="grow-x w-full"
              style={{ height: `${Math.max(4, (Math.abs(s.value) / max) * 100)}%`, background: accent, opacity: 0.6, transformOrigin: "bottom" }}
            />
          </div>
        ))}
      </div>
      <div className="stat-num mt-1 flex justify-between text-[10px] text-[var(--text-faint)]">
        <span>{seasons[0]?.season}</span>
        <span>real predicted-vs-actual, each season</span>
        <span>{seasons.at(-1)?.season}</span>
      </div>
    </div>
  );
}

/* ---------------- Calibration: observed vs predicted ---------------- */
function CalibrationView({ buckets, accent }: { buckets: { bucket: string; observed: number; predicted: number; n: number }[]; accent: string }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="kicker">Calibration — predicted vs observed make%</span>
        <span className="stat-num text-[11px] text-[var(--text-faint)]">
          {buckets.reduce((a, b) => a + b.n, 0)} real shots
        </span>
      </div>
      <div className="space-y-2.5">
        {buckets.map((b) => (
          <div key={b.bucket}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-white/85">{b.bucket}</span>
              <span className="stat-num text-[var(--text-faint)]">
                model {Math.round(b.predicted * 100)}% · observed {Math.round(b.observed * 100)}%
              </span>
            </div>
            <Bar value={b.predicted} color={accent} label="model" />
            <Bar value={b.observed} color="#5FA97E" label="observed" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Champions timeline ---------------- */
function ChampionsView({ champions, accent, league = "NBA" }: { champions: Record<string, string>; accent: string; league?: string }) {
  const years = Object.keys(champions).map(Number).sort((a, b) => b - a);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="kicker">Real {league} champion, every season since 2003</span>
      </div>
      <div className="no-scrollbar grid max-h-44 grid-cols-2 gap-x-4 gap-y-1 overflow-y-auto sm:grid-cols-3">
        {years.map((y) => (
          <div key={y} className="flex items-center gap-2 border-b border-[var(--line)] py-1 text-xs">
            <span className="stat-num w-9 text-[var(--text-faint)]">'{String(y).slice(2)}</span>
            <span className="inline-block h-1.5 w-1.5 shrink-0" style={{ background: accent }} />
            <span className="truncate text-white/80">{champions[String(y)]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Bar({ value, color, label }: { value: number; color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-[9px] uppercase tracking-wider text-[var(--text-faint)]">{label}</span>
      <div className="h-2 flex-1 bg-white/[0.06]">
        <div className="grow-x h-full" style={{ width: `${Math.min(100, value * 100)}%`, background: color, transformOrigin: "left" }} />
      </div>
    </div>
  );
}
