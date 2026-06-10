"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HeartPulse } from "lucide-react";
import { spring } from "@/lib/motion";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { PlayerPicker } from "@/components/ui/PlayerPicker";
import { Gauge } from "@/components/ui/Gauge";
import { Slider, Badge } from "@/components/ui/Controls";
import { Meter } from "@/components/ui/Meter";
import { TrackRecord } from "@/components/ui/TrackRecord";
import { getTool } from "@/lib/tools";
import { injuryRisk } from "@/lib/engine/players";
import { workloadRisk } from "@/lib/engine/value";
import { gradeColor, ACCENT_HEX } from "@/lib/cn";
import type { Player } from "@/lib/types";

const OVERALL_COLOR: Record<string, string> = {
  low: "#2BD68B",
  med: "#D7BC6A",
  high: "#F4647D",
};

const BAND_COLOR: Record<string, string> = {
  Low: "#2BD68B",
  Moderate: "#D7BC6A",
  Elevated: "#00E07F",
  High: "#F4647D",
};

export default function InjuryRiskPage() {
  const tool = getTool("injury-risk")!;
  const [player, setPlayer] = useState<Player | null>(null);
  const [restDays, setRestDays] = useState(1);
  const [b2b, setB2b] = useState(14);
  const [minutesLoad, setMinutesLoad] = useState(34);

  const result = useMemo(
    () => (player ? injuryRisk(player, { restDays, b2b, minutesLoad }) : null),
    [player, restDays, b2b, minutesLoad],
  );
  const workload = useMemo(() => (player ? workloadRisk(player) : null), [player]);

  // higher risk = redder: invert the 0-100 scale into gradeColor
  const riskColor = result ? gradeColor(100 - result.risk) : ACCENT_HEX;
  const bandColor = result ? BAND_COLOR[result.band] : ACCENT_HEX;

  return (
    <ToolShell tool={tool}>
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Controls */}
        <Panel title="Workload inputs">
          <div className="space-y-5">
            <PlayerPicker
              value={player}
              onChange={setPlayer}
              accent={ACCENT_HEX}
              placeholder="Pick a player to assess…"
            />
            <Slider label="Days of rest" value={restDays} min={0} max={3} unit=" d" accent={ACCENT_HEX} onChange={setRestDays} />
            <Slider label="Back-to-backs" value={b2b} min={0} max={25} unit=" B2B" accent={ACCENT_HEX} onChange={setB2b} />
            <Slider label="Minutes load" value={minutesLoad} min={24} max={40} unit=" mpg" accent={ACCENT_HEX} onChange={setMinutesLoad} />
            <p className="text-xs leading-relaxed text-white/40">
              Adjust the schedule context — fewer rest days, more B2Bs, and heavier minutes all push
              breakdown risk higher.
            </p>
          </div>
        </Panel>

        {/* Result */}
        <div className="space-y-6">
          <AnimatePresence mode="wait">
          {!player || !result ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={spring.soft}
            >
            <Panel className="flex h-full min-h-[320px] flex-col items-center justify-center text-center">
              <HeartPulse size={40} className="mb-4" style={{ color: ACCENT_HEX }} />
              <p className="max-w-xs text-sm text-white/50">
                Choose a player and dial in their schedule. The model blends age, minutes, missed
                games, rest, and frame load into a single breakdown-risk score.
              </p>
            </Panel>
            </motion.div>
          ) : (
            <motion.div
              key={player.id}
              className="space-y-6"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={spring.soft}
            >
              <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
                <Panel className="flex flex-col items-center justify-center">
                  <Gauge value={result.risk} label="Injury Risk" color={riskColor} suffix="" />
                  <div className="mt-3 text-center">
                    <Badge color={bandColor}>{result.band} risk</Badge>
                    <div className="stat-num mt-2 text-xs text-white/45">{player.name} · age {player.age}</div>
                  </div>
                </Panel>
                <Panel title="Risk factors">
                  <div className="space-y-4">
                    {result.factors.map((f) => (
                      <div key={f.label}>
                        <div className="mb-1.5 flex items-center justify-between text-xs">
                          <span className="text-white/70">{f.label}</span>
                          <span className="stat-num text-white/40">{f.note}</span>
                        </div>
                        <Meter value={f.value} color={gradeColor(100 - f.value)} height={7} />
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
              <Insight>
                <b>{player.name}</b> grades as a <b>{result.band.toLowerCase()}-risk</b> profile at{" "}
                <b>{result.risk}/100</b> under this schedule. {result.recommendation}
              </Insight>

              {workload && (
                <Panel
                  title="Season workload profile"
                  right={
                    <Badge color={OVERALL_COLOR[workload.overall]}>
                      {workload.overall} workload
                    </Badge>
                  }
                >
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-4">
                      {[
                        { label: "Minutes vs age-adjusted line", value: workload.workloadScore },
                        { label: "Age factor", value: workload.ageFactor },
                        { label: "Usage spike vs role", value: workload.recentSpike },
                        { label: "Games missed", value: workload.missedGamesFactor },
                      ].map((f) => (
                        <div key={f.label}>
                          <div className="mb-1.5 flex items-center justify-between text-xs">
                            <span className="text-white/70">{f.label}</span>
                            <span className="stat-num text-white/40">{f.value}</span>
                          </div>
                          <Meter value={f.value} color={gradeColor(100 - f.value)} height={7} />
                        </div>
                      ))}
                    </div>
                    <div className="space-y-4">
                      <div>
                        <div className="kicker mb-2" style={{ color: OVERALL_COLOR[workload.overall] }}>
                          Contributing factors
                        </div>
                        <ul className="space-y-1.5">
                          {workload.contributingFactors.map((f) => (
                            <li key={f} className="flex items-start gap-2 text-sm text-white/70">
                              <span
                                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                                style={{ background: OVERALL_COLOR[workload.overall] }}
                              />
                              {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <div className="kicker mb-2" style={{ color: "#2BD68B" }}>
                          Recommendations
                        </div>
                        <ul className="space-y-1.5">
                          {workload.recommendations.map((r) => (
                            <li key={r} className="flex items-start gap-2 text-sm text-white/70">
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2BD68B]" />
                              {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <p className="text-[11px] leading-relaxed text-white/35">
                        Workload accounting from schedule-visible inputs only (minutes, age, games
                        played, usage) — nothing here is a medical assessment.
                      </p>
                    </div>
                  </div>
                </Panel>
              )}
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </div>

      <div className="mt-8 space-y-3">
        <div>
          <div className="kicker" style={{ color: "#00E07F" }}>Model track record</div>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            Each season since 2003, the bars show how close the workload model's projected availability came to the games players actually logged the following year — within about 14 games on average.
          </p>
        </div>
        <TrackRecord slug="injury-risk" accent="#00E07F" />
      </div>
    </ToolShell>
  );
}
