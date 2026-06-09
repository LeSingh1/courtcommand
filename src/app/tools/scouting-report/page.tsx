"use client";

import { Suspense, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { Check, ClipboardList, X } from "lucide-react";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { PlayerPicker } from "@/components/ui/PlayerPicker";
import { RadarChart } from "@/components/ui/RadarChart";
import { Badge } from "@/components/ui/Controls";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { AnalyzeOverlay, useAnalyze } from "@/components/ui/Analyze";
import { getTool, categoryColor } from "@/lib/tools";
import { getPlayer, getPlayerByName } from "@/lib/data";
import { scoutingReport, type ScoutReport } from "@/lib/engine/players";
import { spring } from "@/lib/motion";
import type { Player } from "@/lib/types";

export default function ScoutingReportPage() {
  return (
    <Suspense fallback={null}>
      <ScoutingInner />
    </Suspense>
  );
}

function ScoutingInner() {
  const tool = getTool("scouting-report")!;
  const ACCENT = categoryColor(tool.category);
  const params = useSearchParams();
  const [player, setPlayer] = useState<Player | null>(null);
  const [report, setReport] = useState<ScoutReport | null>(null);
  const analyze = useAnalyze([
    "Pulling tape…",
    "Grading skills…",
    "Finding comps…",
    "Writing report…",
  ]);

  // initial default from ?a= or paolo
  useEffect(() => {
    const a = params.get("a");
    const p = (a && getPlayer(a)) || getPlayerByName("Paolo Banchero");
    if (p) setPlayer(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!player) {
      setReport(null);
      return;
    }
    analyze.run(() => setReport(scoutingReport(player.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);

  return (
    <ToolShell tool={tool}>
      <div className="mb-6 max-w-md">
        <PlayerPicker
          value={player}
          onChange={setPlayer}
          accent={ACCENT}
          placeholder="Scout any player…"
        />
      </div>

      {!player ? (
        <Panel className="flex min-h-[300px] flex-col items-center justify-center text-center">
          <ClipboardList size={40} className="mb-4" style={{ color: ACCENT }} />
          <p className="max-w-xs text-sm text-white/50">
            Pick a player and the scout auto-generates a one-page report: skill grades, strengths,
            weaknesses, role, a stylistic comp, and development priorities.
          </p>
        </Panel>
      ) : analyze.phase === "running" || !report ? (
        <AnalyzeOverlay steps={analyze.steps} stepIdx={analyze.stepIdx} accent={ACCENT} />
      ) : (
        <AnimatePresence mode="wait">
        <motion.div
          key={player.id}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={spring.soft}
          className="space-y-6"
        >
          {/* Header strip */}
          <Panel>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <PlayerAvatar player={player} size={56} />
                <div>
                  <div className="display text-xl text-white">{player.name}</div>
                  <div className="stat-num text-xs text-white/45">
                    {player.pos} · {player.age} yo · {player.ppg}/{player.rpg}/{player.apg}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge color={ACCENT}>{report.role}</Badge>
                <Badge color={ACCENT}>Comp: {report.comp}</Badge>
              </div>
            </div>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
            {/* Radar of grades */}
            <Panel title="Skill grades">
              <div className="flex justify-center">
                <RadarChart
                  axes={report.grades.map((g) => g.label)}
                  series={[
                    {
                      name: player.name,
                      color: ACCENT,
                      values: report.grades.map((g) => g.value),
                    },
                  ]}
                />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {report.grades.map((g) => (
                  <div
                    key={g.label}
                    className="flex items-center justify-between bg-white/[0.03] px-2.5 py-1.5"
                  >
                    <span className="text-[11px] text-white/55">{g.label}</span>
                    <span className="stat-num text-xs font-bold" style={{ color: ACCENT }}>
                      {Math.round(g.value)}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>

            {/* Strengths / weaknesses */}
            <div className="grid gap-6 sm:grid-cols-2">
              <Panel title="Strengths">
                <ul className="space-y-2.5">
                  {report.strengths.map((s) => (
                    <li key={s} className="flex items-start gap-2.5 text-sm text-white/75">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center bg-mint/15">
                        <Check size={11} className="text-mint" />
                      </span>
                      {s}
                    </li>
                  ))}
                </ul>
              </Panel>
              <Panel title="Weaknesses">
                <ul className="space-y-2.5">
                  {report.weaknesses.map((w) => (
                    <li key={w} className="flex items-start gap-2.5 text-sm text-white/75">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center bg-rose/15">
                        <X size={11} className="text-rose" />
                      </span>
                      {w}
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          </div>

          {/* Development priorities */}
          <Panel title="Development priorities">
            <ol className="space-y-2.5">
              {report.priorities.map((p, i) => (
                <li key={p} className="flex items-start gap-3 text-sm text-white/75">
                  <span
                    className="stat-num flex h-6 w-6 shrink-0 items-center justify-center text-xs font-bold"
                    style={{ background: `${ACCENT}1f`, color: ACCENT }}
                  >
                    {i + 1}
                  </span>
                  {p}
                </li>
              ))}
            </ol>
          </Panel>

          <Insight accent={ACCENT}>{report.summary}</Insight>
        </motion.div>
        </AnimatePresence>
      )}
    </ToolShell>
  );
}
