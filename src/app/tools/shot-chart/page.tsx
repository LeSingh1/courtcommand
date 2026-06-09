"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { Target, Flame, Snowflake } from "lucide-react";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { PlayerPicker } from "@/components/ui/PlayerPicker";
import { CourtChart } from "@/components/ui/CourtChart";
import { Segmented, Badge } from "@/components/ui/Controls";
import { Reveal } from "@/components/ui/Reveal";
import { getTool } from "@/lib/tools";
import { getPlayer, getPlayerByName } from "@/lib/data";
import { shotChart } from "@/lib/engine/game";
import { spring } from "@/lib/motion";
import type { Player } from "@/lib/types";

const EMBER = "#E0561F";

// Mirrors CourtChart.heatColor exactly (>=0.58, >=0.50, >=0.44, >=0.38, else).
// Keep these thresholds/colors in sync with that component's heatColor map.
const LEGEND = [
  { label: "Hot · 58%+ eFG", color: "#E0561F" },
  { label: "Warm · 50–57%", color: "#C9A14A" },
  { label: "Neutral · 44–49%", color: "#9FB07A" },
  { label: "Cool · 38–43%", color: "#8E96A4" },
  { label: "Cold · <38%", color: "#7E8CA0" },
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
  const [player, setPlayer] = useState<Player | null>(() => getPlayerByName("Stephen Curry") ?? null);
  const [view, setView] = useState<"shots" | "zones">("shots");
  // The default Curry chart is always-visible on first load; never gate it behind a
  // Framer mount animation. Only animate the entrance on subsequent player swaps.
  const firstRender = useRef(true);

  useEffect(() => {
    const a = params.get("a");
    if (a) {
      const p = getPlayer(a);
      if (p) setPlayer(p);
    }
  }, [params]);

  const chart = useMemo(() => (player ? shotChart(player) : null), [player]);

  const { best, worst, made, total } = useMemo(() => {
    if (!chart) return { best: null, worst: null, made: 0, total: 0 };
    const ranked = [...chart.zones].sort((a, b) => b.efg - a.efg);
    const m = chart.shots.filter((s) => s.made).length;
    return { best: ranked[0], worst: ranked[ranked.length - 1], made: m, total: chart.shots.length };
  }, [chart]);

  // First paint = the default (Curry) chart. Render it immediately visible via CSS
  // (.enter ends visible, survives Framer not hydrating). Animate only later swaps.
  const isFirstMount = firstRender.current;
  firstRender.current = false;

  return (
    <ToolShell tool={tool}>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full max-w-md">
          <PlayerPicker value={player} onChange={setPlayer} accent={EMBER} placeholder="Pick a player to map…" />
        </div>
        <Segmented
          accent={EMBER}
          value={view}
          onChange={setView}
          options={[
            { label: "Shots", value: "shots" },
            { label: "Hot Zones", value: "zones" },
          ]}
        />
      </div>

      <AnimatePresence mode="wait">
      {!player || !chart ? (
        <Panel className="flex min-h-[320px] flex-col items-center justify-center text-center">
          <Target size={40} className="mb-4 text-ember" />
          <p className="max-w-xs text-sm text-white/50">
            Choose any player to plot every attempt on the floor — flip to Hot Zones for an
            efficiency heatmap by area.
          </p>
        </Panel>
      ) : (
        <motion.div
          key={player.id}
          initial={isFirstMount ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={spring.soft}
          className={`grid gap-6 lg:grid-cols-[1fr_320px]${isFirstMount ? " enter" : ""}`}
        >
          <Panel
            title={view === "shots" ? "Shot distribution" : "Zone efficiency (eFG%)"}
            right={
              <span className="stat-num text-xs text-white/45">
                {made}/{total} makes · {total ? Math.round((made / total) * 100) : 0}%
              </span>
            }
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={view}
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
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#E0561F" }} /> Make
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full border"
                      style={{ borderColor: "#7E8CA0", background: "transparent" }}
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
                    <div className="flex items-center justify-between rounded-none border border-[#E0561F33] bg-[#E0561F0f] p-3">
                      <div className="flex items-center gap-2.5">
                        <Flame size={16} className="text-ember" />
                        <div>
                          <div className="text-sm font-semibold text-white">{best.label}</div>
                          <div className="text-[11px] text-white/45">Hottest spot</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="stat-num text-lg font-bold text-ember">{Math.round(best.efg * 100)}%</div>
                        <div className="stat-num text-[10px] text-white/40">{Math.round(best.freq * 100)}% freq</div>
                      </div>
                    </div>
                  </Reveal>
                  <Reveal delay={0.06}>
                    <div className="flex items-center justify-between rounded-none border border-[#7E8CA033] bg-[#7E8CA00f] p-3">
                      <div className="flex items-center gap-2.5">
                        <Snowflake size={16} className="text-cyan" />
                        <div>
                          <div className="text-sm font-semibold text-white">{worst.label}</div>
                          <div className="text-[11px] text-white/45">Coldest spot</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="stat-num text-lg font-bold text-cyan">{Math.round(worst.efg * 100)}%</div>
                        <div className="stat-num text-[10px] text-white/40">{Math.round(worst.freq * 100)}% freq</div>
                      </div>
                    </div>
                  </Reveal>
                </div>
              </Panel>
            )}

            <div className="flex flex-wrap gap-1.5">
              <Badge color={EMBER}>{player.archetype}</Badge>
              <Badge color="#7E8CA0">{Math.round(player.shotThree * 100)}% 3PA share</Badge>
              <Badge color="#C9A14A">{Math.round(player.shotRim * 100)}% rim share</Badge>
            </div>
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      {best && worst && player && (
        <div className="mt-6">
          <Insight accent={EMBER}>
            <b>{player.name}</b> is most lethal from the <b>{best.label.toLowerCase()}</b>, hitting{" "}
            <b>{Math.round(best.efg * 100)}% eFG</b> there on {Math.round(best.freq * 100)}% of his volume.
            Defenses should run him off that spot first — his coldest look is the {worst.label.toLowerCase()}
            {` at ${Math.round(worst.efg * 100)}%`}.
          </Insight>
        </div>
      )}
    </ToolShell>
  );
}
