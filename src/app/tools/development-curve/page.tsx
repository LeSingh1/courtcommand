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
                  <span className="h-2 w-4 rounded-none" style={{ background: `${ACCENT}30` }} /> Range (lo–hi)
                </span>
                <span className="stat-num">x-axis: age</span>
              </div>
            </Panel>

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
          <div className="kicker" style={{ color: "#E0561F" }}>Model track record</div>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            Per-season bars show how far the model&apos;s next-season scoring projection missed each player&apos;s actual PPG the following year — averaging about ±2.4 PPG — over a training set that has grown every season since 2003.
          </p>
        </div>
        <TrackRecord slug="development-curve" accent="#E0561F" />
      </div>
    </ToolShell>
  );
}
