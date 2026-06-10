"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LineChart as LineChartIcon } from "lucide-react";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { PlayerPicker } from "@/components/ui/PlayerPicker";
import { LineChart } from "@/components/ui/LineChart";
import { Badge } from "@/components/ui/Controls";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { TrackRecord } from "@/components/ui/TrackRecord";
import { getTool, categoryColor } from "@/lib/tools";
import { developmentCurve } from "@/lib/engine/players";
import { projectSeasons } from "@/lib/engine/value";
import { getPlayer, getPlayerByName } from "@/lib/data";
import { spring } from "@/lib/motion";
import type { Player } from "@/lib/types";

export default function DevelopmentCurvePage() {
  const tool = getTool("development-curve")!;
  const ACCENT = categoryColor(tool.category);
  const [player, setPlayer] = useState<Player | null>(getPlayerByName("Victor Wembanyama") ?? null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  useEffect(() => {
    if (!player) return;
    setIsAnalyzing(true);
    const t = setTimeout(() => setIsAnalyzing(false), 500);
    return () => clearTimeout(t);
  }, [player]);

  const result = useMemo(() => (player ? developmentCurve(player.id) : null), [player]);
  const projection = useMemo(() => (player ? projectSeasons(player, 3) : null), [player]);

  const now = result?.curve[0];
  const peak = result ? result.curve.find((c) => c.age === result.peakAge) : undefined;

  return (
    <ToolShell tool={tool}>
      <div className="mb-6 max-w-md">
        <PlayerPicker
          value={player}
          onChange={setPlayer}
          accent={ACCENT}
          placeholder="Pick a player to project…"
        />
      </div>

      <AnimatePresence mode="wait">
      {!player || !result ? (
        <Panel className="flex min-h-[300px] flex-col items-center justify-center text-center">
          <LineChartIcon size={40} className="mb-4" style={{ color: ACCENT }} />
          <p className="max-w-xs text-sm text-white/50">
            Choose a player and project their PER trajectory across the next six seasons, with an
            uncertainty band, a peak-age marker, and a veteran comp.
          </p>
        </Panel>
      ) : isAnalyzing ? (
        <Panel title="Projecting trajectory…">
          <div className="flex items-center gap-3 py-2 text-sm text-[var(--text-muted)]">
            <span className="inline-block h-3 w-3 animate-pulse" style={{ background: ACCENT }} />
            Projecting {player.name}&apos;s development curve…
          </div>
          <div className="mt-4 space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-9 w-full animate-pulse bg-white/[0.04]" />
            ))}
          </div>
        </Panel>
      ) : (
        <motion.div
          key={player.id}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={spring.soft}
          className="grid gap-6 lg:grid-cols-[1fr_340px]"
        >
          <div className="space-y-6">
            <Panel title="Projected development curve">
              <LineChart
                series={[{ name: "Projected PER", color: ACCENT, points: result.curve.map((c) => c.proj) }]}
                band={{
                  lo: result.curve.map((c) => c.lo),
                  hi: result.curve.map((c) => c.hi),
                  color: ACCENT,
                }}
                labels={result.curve.map((c) => String(c.age))}
                yLabel="PER"
                height={240}
              />
              <div className="mt-3 flex items-center justify-center gap-4 text-[11px] text-white/45">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: ACCENT }} /> Projected PER
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-4 rounded-lg" style={{ background: `${ACCENT}30` }} /> Range (lo–hi)
                </span>
                <span className="stat-num">x-axis: age</span>
              </div>
            </Panel>

            {projection && (
              <Panel title="Three-season projection bands">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wide text-white/40">
                        <th className="py-2 pl-2 font-medium">Season</th>
                        <th className="py-2 text-right font-medium">Worst PPG</th>
                        <th className="py-2 text-right font-medium">Expected PPG</th>
                        <th className="py-2 text-right font-medium">Best PPG</th>
                        <th className="py-2 pr-2 text-right font-medium">Composite</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projection.seasons.map((s) => (
                        <tr key={s.season} className="border-b border-white/[0.04]">
                          <td className="stat-num py-2.5 pl-2 text-white/65">
                            +{s.season} (age {s.age})
                          </td>
                          <td className="stat-num py-2.5 text-right text-[#C98A78]">
                            {s.worst.ppg}
                          </td>
                          <td className="stat-num py-2.5 text-right font-semibold" style={{ color: ACCENT }}>
                            {s.expected.ppg}
                          </td>
                          <td className="stat-num py-2.5 text-right text-[#A3B79A]">{s.best.ppg}</td>
                          <td className="stat-num py-2.5 pr-2 text-right text-white/55">
                            {s.worst.composite}–{s.best.composite}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-white/35">
                  Bands come from an age curve peaking at 27, an efficiency-trend proxy (true
                  shooting vs league), and role-expansion headroom — uncertainty widens with horizon
                  and youth. Deterministic, computed from real season stats.
                </p>
              </Panel>
            )}

            <div className="enter grid gap-4 sm:grid-cols-3">
              <Panel className="text-center">
                <div className="stat-num display text-3xl" style={{ color: ACCENT }}>
                  {result.peakAge}
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-wide text-white/40">Peak age</div>
                {peak && (
                  <div className="stat-num mt-1 text-xs text-white/50">~{peak.proj} PER projected</div>
                )}
              </Panel>
              <Panel className="text-center">
                <div className="stat-num display text-3xl text-white">{now?.proj}</div>
                <div className="mt-1 text-[10px] uppercase tracking-wide text-white/40">
                  Now (age {player.age})
                </div>
                <div className="stat-num mt-1 text-xs text-white/50">current PER</div>
              </Panel>
              <Panel className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-1.5 text-[10px] uppercase tracking-wide text-white/40">Ceiling</div>
                <Badge color={ACCENT}>{result.ceiling}</Badge>
              </Panel>
            </div>
          </div>

          <div className="space-y-6">
            <Panel title="Veteran comp">
              {result.comp ? (
                <div className="flex items-center gap-3">
                  <PlayerAvatar player={result.comp} size={48} />
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-white">{result.comp.name}</div>
                    <div className="stat-num text-xs text-white/45">
                      {result.comp.pos} · age {result.comp.age} · {result.comp.archetype}
                    </div>
                    <div className="stat-num mt-0.5 text-xs text-white/40">
                      {result.comp.ppg}/{result.comp.rpg}/{result.comp.apg} · {result.comp.per} PER
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-white/45">
                  No close veteran archetype match — a relatively unique developmental profile.
                </p>
              )}
            </Panel>

            {projection && (
              <Panel title="Comparable age paths">
                <div className="space-y-2.5">
                  {projection.comparablePlayers.map((c) => (
                    <div key={c.id} className="flex items-center gap-2.5">
                      <PlayerAvatar player={c} size={32} />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white">{c.name}</div>
                        <div className="stat-num text-[11px] text-white/45">
                          {c.pos} · age {c.age} · {c.archetype}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 space-y-3 border-t border-white/[0.06] pt-3">
                  <div>
                    <div className="kicker mb-1.5" style={{ color: "#A3B79A" }}>
                      Growth drivers
                    </div>
                    <ul className="space-y-1">
                      {projection.growthDrivers.map((g) => (
                        <li key={g} className="flex items-start gap-2 text-xs text-white/65">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#A3B79A]" />
                          {g}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="kicker mb-1.5" style={{ color: "#C98A78" }}>
                      Risk factors
                    </div>
                    <ul className="space-y-1">
                      {projection.riskFactors.map((r) => (
                        <li key={r} className="flex items-start gap-2 text-xs text-white/65">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#C98A78]" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Panel>
            )}

            <Insight accent={ACCENT}>
              <b>{player.name}</b> ({player.age}) projects to peak around <b>age {result.peakAge}</b> at roughly{" "}
              <b>{peak?.proj} PER</b>, with a <b>{result.ceiling.toLowerCase()}</b> outcome on the table.
              {result.comp ? (
                <>
                  {" "}
                  The closest stylistic blueprint is <b>{result.comp.name}</b>.
                </>
              ) : null}
            </Insight>
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      <div className="mt-8 space-y-3">
        <div>
          <div className="kicker" style={{ color: "#E9A23B" }}>Model track record</div>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            Per-season bars show how far the model&apos;s next-season scoring projection missed each player&apos;s actual PPG the following year — averaging about ±2.4 PPG — over a training set that has grown every season since 2003.
          </p>
        </div>
        <TrackRecord slug="development-curve" accent="#E9A23B" />
      </div>
    </ToolShell>
  );
}
