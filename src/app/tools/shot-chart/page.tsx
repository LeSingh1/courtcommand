"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { Target, Flame, Snowflake, Loader2 } from "lucide-react";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { PlayerPicker } from "@/components/ui/PlayerPicker";
import { CourtChart } from "@/components/ui/CourtChart";
import { Segmented, Badge } from "@/components/ui/Controls";
import { Reveal } from "@/components/ui/Reveal";
import { getTool } from "@/lib/tools";
import { PLAYERS, getPlayer } from "@/lib/data";
import {
  loadRealShots,
  realShotChart,
  shotPlayerIds,
  type RealShot,
} from "@/lib/data/shots";
import { spring } from "@/lib/motion";
import type { Player } from "@/lib/types";

const EMBER = "#E9A23B";

// Mirrors CourtChart.heatColor exactly (>=0.58, >=0.50, >=0.44, >=0.38, else).
const LEGEND = [
  { label: "Hot · 58%+ eFG", color: "#E9A23B" },
  { label: "Warm · 50–57%", color: "#CBB280" },
  { label: "Neutral · 44–49%", color: "#9FB07A" },
  { label: "Cool · 38–43%", color: "#8E96A4" },
  { label: "Cold · <38%", color: "#8A8273" },
];

export default function ShotChartPage() {
  return (
    <Suspense fallback={null}>
      <ShotChartInner />
    </Suspense>
  );
}

function ShotChartInner() {
  const tool = getTool("shot-chart")!;
  const params = useSearchParams();
  const [shots, setShots] = useState<RealShot[] | null>(null);
  const [view, setView] = useState<"shots" | "zones">("shots");
  const [periodKey, setPeriodKey] = useState<"0" | "1" | "2" | "3" | "4" | "5">("0");
  const [player, setPlayer] = useState<Player | null>(null);
  const period = parseInt(periodKey, 10); // 0 = full game, 5 = any OT
  const windowLabel = period === 0 ? "" : period >= 5 ? "OT" : `Q${period}`;

  useEffect(() => {
    let alive = true;
    loadRealShots().then((d) => alive && setShots(d));
    return () => {
      alive = false;
    };
  }, []);

  // Players who actually took playoff shots, ranked by scoring for the picker.
  const pool = useMemo(() => {
    if (!shots) return [] as Player[];
    const ids = shotPlayerIds(shots, 8);
    return PLAYERS.filter((p) => p.espnId != null && ids.has(p.espnId)).sort((a, b) => b.ppg - a.ppg);
  }, [shots]);

  // Default to the top playoff scorer; honor a ?a= deep link when it points to a
  // player who actually has playoff shots.
  useEffect(() => {
    if (!pool.length) return;
    const a = params.get("a");
    const linked = a ? getPlayer(a) : null;
    if (linked && pool.some((p) => p.id === linked.id)) setPlayer(linked);
    else if (!player) setPlayer(pool[0]);
  }, [pool, params, player]);

  const chart = useMemo(
    () =>
      shots && player?.espnId != null
        ? realShotChart(shots, player.espnId, period ? { period } : {})
        : null,
    [shots, player, period],
  );

  const { best, worst } = useMemo(() => {
    if (!chart) return { best: null, worst: null };
    const ranked = chart.zones.filter((z) => z.att >= 2).sort((a, b) => b.efg - a.efg);
    return { best: ranked[0] ?? null, worst: ranked[ranked.length - 1] ?? null };
  }, [chart]);

  if (!shots) {
    return (
      <ToolShell tool={tool}>
        <Panel className="flex min-h-[360px] flex-col items-center justify-center gap-3 text-center">
          <Loader2 size={22} className="animate-spin text-[var(--text-faint)]" />
          <p className="text-sm text-white/50">Loading every playoff shot…</p>
        </Panel>
      </ToolShell>
    );
  }

  return (
    <ToolShell tool={tool}>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full max-w-md">
          <PlayerPicker
            value={player}
            onChange={setPlayer}
            pool={pool}
            accent={EMBER}
            placeholder="Pick a playoff player to map…"
          />
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <Segmented
            accent={EMBER}
            value={view}
            onChange={setView}
            options={[
              { label: "Shots", value: "shots" },
              { label: "Hot Zones", value: "zones" },
            ]}
          />
          <Segmented
            accent={EMBER}
            value={periodKey}
            onChange={setPeriodKey}
            options={[
              { label: "Full game", value: "0" },
              { label: "Q1", value: "1" },
              { label: "Q2", value: "2" },
              { label: "Q3", value: "3" },
              { label: "Q4", value: "4" },
              { label: "OT", value: "5" },
            ]}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!player || !chart ? (
          <Panel className="flex min-h-[320px] flex-col items-center justify-center text-center">
            <Target size={40} className="mb-4 text-ember" />
            <p className="max-w-xs text-sm text-white/50">
              {player
                ? period
                  ? `No ${windowLabel} attempts for ${player.name} in the 2026 playoff data — switch back to the full game.`
                  : `No 2026 playoff shot data for ${player.name}. Pick a player from this year's postseason field.`
                : "Choose a playoff player to plot every real attempt on the floor — flip to Hot Zones for an efficiency heatmap by area."}
            </p>
          </Panel>
        ) : (
          <motion.div
            key={player.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={spring.soft}
            className="grid gap-6 lg:grid-cols-[1fr_320px]"
          >
            <Panel
              title={
                (view === "shots" ? "Playoff shot distribution" : "Zone efficiency (eFG%)") +
                (period ? ` · ${windowLabel} only` : "")
              }
              right={
                <span className="stat-num text-xs text-white/45">
                  {chart.made}/{chart.total} makes · {chart.total ? Math.round((chart.made / chart.total) * 100) : 0}%
                </span>
              }
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${view}-${periodKey}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <CourtChart
                    shots={view === "shots" ? chart.shots : undefined}
                    zones={view === "zones" ? chart.zones : undefined}
                    showShots={view === "shots"}
                    height={420}
                  />
                </motion.div>
              </AnimatePresence>
              <div className="mt-3 border-t border-white/[0.06] pt-2.5 text-[11px] leading-relaxed text-white/55">
                <span className="stat-num text-white/80">
                  Shot diet: {Math.round(chart.diet.rim * 100)}% rim · {Math.round(chart.diet.mid * 100)}% mid ·{" "}
                  {Math.round(chart.diet.three * 100)}% three
                </span>{" "}
                — {chart.diet.note}
              </div>
            </Panel>

            <div className="space-y-6">
              <Panel title="Heat legend">
                <div className="space-y-2.5">
                  {LEGEND.map((l) => (
                    <div key={l.label} className="flex items-center gap-2.5 text-xs text-white/65">
                      <span className="h-3 w-3 shrink-0" style={{ background: l.color }} />
                      {l.label}
                    </div>
                  ))}
                </div>
                {view === "shots" && (
                  <div className="mt-4 flex items-center gap-4 border-t border-white/[0.06] pt-3 text-[11px] text-white/50">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#E9A23B" }} /> Make
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span
                        className="h-2.5 w-2.5 rounded-full border"
                        style={{ borderColor: "#8A8273", background: "transparent" }}
                      />{" "}
                      Miss
                    </span>
                  </div>
                )}
              </Panel>

              {best && worst && (
                <Panel title="Best & worst zones">
                  <div className="space-y-3">
                    <Reveal>
                      <div className="flex items-center justify-between rounded-lg border border-[#E9A23B33] bg-[#E9A23B0f] p-3">
                        <div className="flex items-center gap-2.5">
                          <Flame size={16} className="text-ember" />
                          <div>
                            <div className="text-sm font-semibold text-white">{best.label}</div>
                            <div className="text-[11px] text-white/45">Hottest spot</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="stat-num text-lg font-bold text-ember">{Math.round(best.efg * 100)}%</div>
                          <div className="stat-num text-[10px] text-white/40">{best.att} att</div>
                        </div>
                      </div>
                    </Reveal>
                    <Reveal delay={0.06}>
                      <div className="flex items-center justify-between rounded-lg border border-[#8A827333] bg-[#8A82730f] p-3">
                        <div className="flex items-center gap-2.5">
                          <Snowflake size={16} className="text-cyan" />
                          <div>
                            <div className="text-sm font-semibold text-white">{worst.label}</div>
                            <div className="text-[11px] text-white/45">Coldest spot</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="stat-num text-lg font-bold text-cyan">{Math.round(worst.efg * 100)}%</div>
                          <div className="stat-num text-[10px] text-white/40">{worst.att} att</div>
                        </div>
                      </div>
                    </Reveal>
                  </div>
                </Panel>
              )}

              <div className="flex flex-wrap gap-1.5">
                <Badge color={EMBER}>{player.archetype}</Badge>
                <Badge color="#8A8273">{Math.round(player.shotThree * 100)}% 3PA share</Badge>
                <Badge color="#CBB280">{Math.round(player.shotRim * 100)}% rim share</Badge>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {best && worst && player && (
        <div className="mt-6">
          <Insight accent={EMBER}>
            In the 2026 playoffs{period ? <> (<b>{windowLabel}</b> only)</> : null}, <b>{player.name}</b>{" "}
            is most lethal from the <b>{best.label}</b>, hitting <b>{Math.round(best.efg * 100)}% eFG</b>{" "}
            there on {best.att} attempts. His coldest look is the {worst.label}
            {` at ${Math.round(worst.efg * 100)}%`}.
          </Insight>
        </div>
      )}

      <div className="mt-8 space-y-3">
        <div>
          <div className="kicker" style={{ color: "#CBB280" }}>
            Data &amp; method
          </div>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            Every dot is a real attempt from the 2026 playoffs, plotted at its true court coordinates
            from the play-by-play. Hot Zones bucket those shots into floor areas and show the real
            eFG% (counting threes as 1.5 makes) and shot share in each — no simulated or estimated
            attempts. The quarter control restricts both the player&rsquo;s shots and the league
            comparison to that period (OT = any overtime). Shot diet counts rim as inside 8 ft and
            mid as any non-three from 8 ft out; the league-relative note compares against the full
            playoff shot pool under the same filter.
          </p>
        </div>
      </div>
    </ToolShell>
  );
}
