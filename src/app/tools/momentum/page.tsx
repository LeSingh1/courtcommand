"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, Timer, Flame } from "lucide-react";
import { spring } from "@/lib/motion";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { Segmented } from "@/components/ui/Controls";
import { LineChart } from "@/components/ui/LineChart";
import { Reveal } from "@/components/ui/Reveal";
import { AnalyzeOverlay, useAnalyze } from "@/components/ui/Analyze";
import { getTool } from "@/lib/tools";
import { momentumGame, type MomentumEvent } from "@/lib/engine/teams";

const ACCENT = "#E0561F";
const CYAN = "#7E8CA0";

type GameResult = {
  events: MomentumEvent[];
  runs: { team: string; pts: number; at: number }[];
};

const SEEDS: Record<string, number> = { "Game 1": 7, "Game 2": 13, "Game 3": 21 };

export default function MomentumPage() {
  const tool = getTool("momentum")!;
  const [game, setGame] = useState<keyof typeof SEEDS>("Game 1");
  const [result, setResult] = useState<GameResult | null>(null);

  const analyze = useAnalyze([
    "Loading play-by-play feed…",
    "Detecting scoring runs…",
    "Flagging timeout swings…",
    "Charting momentum…",
  ]);

  const replay = () => {
    analyze.run(() => setResult(momentumGame(SEEDS[game])));
  };

  const swingEvents = useMemo(
    () => (result ? result.events.filter((e) => e.event) : []),
    [result],
  );

  const biggest = useMemo(() => {
    if (!result || result.runs.length === 0) return null;
    return [...result.runs].sort((a, b) => b.pts - a.pts)[0];
  }, [result]);

  const finalMargin = result ? result.events[result.events.length - 1].margin : 0;

  return (
    <ToolShell tool={tool}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Segmented
          accent={ACCENT}
          value={game}
          onChange={(v) => {
            setGame(v);
            setResult(null);
          }}
          options={Object.keys(SEEDS).map((g) => ({ label: g, value: g as keyof typeof SEEDS }))}
        />
        <motion.button
          onClick={replay}
          whileTap={{ scale: 0.96 }}
          transition={spring.snappy}
          className="flex items-center gap-2 rounded-none px-4 py-2.5 text-sm font-semibold text-[#0a0c11] transition"
          style={{ background: ACCENT }}
        >
          <TrendingUp size={16} />
          Replay game
        </motion.button>
      </div>

      <AnimatePresence mode="wait">
      {analyze.phase === "running" ? (
        <motion.div
          key="running"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={spring.soft}
        >
          <AnalyzeOverlay steps={analyze.steps} stepIdx={analyze.stepIdx} accent={ACCENT} />
        </motion.div>
      ) : !result ? (
        <motion.div
          key="empty"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={spring.soft}
        >
        <Panel className="flex min-h-[300px] flex-col items-center justify-center text-center">
          <TrendingUp size={40} className="mb-4" style={{ color: ACCENT }} />
          <p className="max-w-sm text-sm text-white/50">
            Pick a game and replay it. The Momentum Tracker charts the HOME margin minute-by-minute
            and flags every scoring run and timeout swing along the way.
          </p>
        </Panel>
        </motion.div>
      ) : (
        <motion.div
          key={`result-${game}`}
          className="grid gap-6 lg:grid-cols-[1fr_340px]"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={spring.soft}
        >
          <div className="space-y-6">
            <Reveal>
              <Panel
                title="Margin timeline"
                right={
                  <span className="stat-num text-xs text-white/50">
                    Final:{" "}
                    <span style={{ color: finalMargin >= 0 ? ACCENT : CYAN }}>
                      {finalMargin >= 0 ? "HOME +" : "AWAY +"}
                      {Math.abs(finalMargin)}
                    </span>
                  </span>
                }
              >
                <div className="relative">
                  <LineChart
                    height={240}
                    yMin={-20}
                    yMax={20}
                    series={[
                      {
                        name: "Margin",
                        color: ACCENT,
                        points: result.events.map((e) => e.margin),
                      },
                    ]}
                    labels={result.events.map((e) =>
                      e.minute % 6 === 0 ? `${e.minute}'` : "",
                    )}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-white/40">
                  <span>Above the line = HOME ahead</span>
                  <span>48-minute regulation</span>
                </div>
              </Panel>
            </Reveal>

            {biggest && (
              <Reveal delay={0.06}>
                <Insight accent={ACCENT}>
                  Biggest swing of the night: a{" "}
                  <b>
                    {biggest.pts}-point {biggest.team === "HOME" ? "HOME" : "AWAY"} surge
                  </b>{" "}
                  at the {biggest.at}:00 mark. {result.runs.length} momentum runs total — the kind of
                  variance that decides {Math.abs(finalMargin) <= 6 ? "a tight one" : "the night"}.
                </Insight>
              </Reveal>
            )}
          </div>

          <Reveal delay={0.04}>
            <Panel title="Momentum timeline">
              <div className="space-y-2.5">
                {swingEvents.length === 0 && (
                  <p className="py-6 text-center text-xs text-white/40">No major swings logged.</p>
                )}
                {swingEvents.map((e, i) => {
                  const isRun = e.type === "run";
                  const home =
                    result.runs.find((r) => r.at === e.minute)?.team === "HOME";
                  const clr = !isRun ? "#C9A14A" : home ? ACCENT : CYAN;
                  return (
                    <div
                      key={`${e.minute}-${i}`}
                      className="flex items-start gap-3 rounded-none border border-white/[0.06] bg-white/[0.02] p-3"
                    >
                      <div
                        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-none"
                        style={{ background: `${clr}1f` }}
                      >
                        {isRun ? (
                          <Flame size={14} style={{ color: clr }} />
                        ) : (
                          <Timer size={14} style={{ color: clr }} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm text-white/85">{e.event}</span>
                          <span className="stat-num shrink-0 text-[11px] text-white/40">
                            {e.minute}:00
                          </span>
                        </div>
                        <div
                          className="stat-num mt-0.5 text-[11px]"
                          style={{ color: isRun ? clr : "rgba(255,255,255,0.4)" }}
                        >
                          {isRun ? (home ? "HOME run" : "AWAY run") : "Stoppage"} · margin{" "}
                          {e.margin >= 0 ? "+" : ""}
                          {e.margin}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          </Reveal>
        </motion.div>
      )}
      </AnimatePresence>
    </ToolShell>
  );
}
