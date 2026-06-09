"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Zap, Crown } from "lucide-react";
import { spring } from "@/lib/motion";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { Badge, Segmented } from "@/components/ui/Controls";
import { Reveal } from "@/components/ui/Reveal";
import { AnalyzeOverlay, useAnalyze } from "@/components/ui/Analyze";
import { TrackRecord } from "@/components/ui/TrackRecord";
import { getTool, categoryColor } from "@/lib/tools";
import {
  simulateBracket,
  NCAA_FIELD,
  type NcaaTeam,
  type BracketGame,
} from "@/lib/engine/content";

const ROUND_NAMES = ["Round of 16", "Quarterfinals", "Semifinals", "Final"];

// Readable seed-chip foreground: dark ink on light team colors, white on dark.
function chipInk(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#0a0a0b" : "#ffffff";
}

function TeamRow({
  team,
  prob,
  isWinner,
  accent,
}: {
  team: NcaaTeam;
  prob: number;
  isWinner: boolean;
  accent: string;
}) {
  return (
    <div
      className="flex items-center gap-2 rounded-none px-2 py-1.5 transition"
      style={{
        background: isWinner ? `${accent}14` : "transparent",
        opacity: isWinner ? 1 : 0.5,
      }}
    >
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-none text-[9px] font-bold"
        style={{ background: team.color, color: chipInk(team.color) }}
      >
        {team.seed}
      </span>
      <span className="flex-1 truncate text-xs font-medium text-white/90">{team.name}</span>
      <span
        className="stat-num text-[11px] font-semibold"
        style={{ color: isWinner ? accent : "rgba(255,255,255,0.55)" }}
      >
        {prob}%
      </span>
    </div>
  );
}

type Emphasis = "balanced" | "efficiency" | "form";

const EMPHASIS_OPTIONS: { label: string; value: Emphasis }[] = [
  { label: "Balanced", value: "balanced" },
  { label: "Efficiency", value: "efficiency" },
  { label: "Recent form", value: "form" },
];

// Title-odds weighting per model emphasis — drives the ranked list ordering.
function titleScore(team: NcaaTeam, emphasis: Emphasis): number {
  if (emphasis === "efficiency") return team.eff + team.sos * 0.4;
  if (emphasis === "form") return team.form * 30 + team.eff * 0.5;
  return team.eff + team.sos * 0.4 + team.form * 12;
}

export default function MarchMadnessPage() {
  const tool = getTool("march-madness")!;
  const ACCENT = categoryColor(tool.category);
  const [result, setResult] = useState<{ rounds: BracketGame[][]; champion: NcaaTeam } | null>(null);
  const [emphasis, setEmphasis] = useState<Emphasis>("balanced");
  const analyze = useAnalyze([
    "Seeding the field…",
    "Modeling matchups…",
    "Rolling possessions…",
    "Crowning a champion…",
  ]);

  const run = () => {
    analyze.run(() => setResult(simulateBracket(emphasis)));
  };

  const onEmphasis = (v: Emphasis) => {
    setEmphasis(v);
    if (result) setResult(simulateBracket(v));
  };

  const upsetCount = result?.rounds.flat().filter((g) => g.upset).length ?? 0;

  // Field ranked by title odds under the chosen model emphasis.
  const titleOdds = [...NCAA_FIELD]
    .map((t) => ({ team: t, score: titleScore(t, emphasis) }))
    .sort((a, b) => b.score - a.score);
  const oddsTotal = titleOdds.reduce((s, o) => s + o.score, 0);

  return (
    <ToolShell tool={tool}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Insight>
          {result ? (
            <>
              <b>{result.champion.name}</b> (#{result.champion.seed} seed) cuts down the nets in this
              simulation, surviving {result.rounds.length} rounds and {upsetCount} bracket-busting
              upset{upsetCount === 1 ? "" : "s"} along the way.
            </>
          ) : (
            <>
              Sixteen teams, one bracket. The model weighs net efficiency, strength of schedule,
              recent form, and seeding — then rolls the dance. Hit simulate to crown a champion.
            </>
          )}
        </Insight>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] text-white/55">Model emphasis</span>
            <Segmented
              options={EMPHASIS_OPTIONS}
              value={emphasis}
              onChange={onEmphasis}
              accent={ACCENT}
            />
          </div>
          <motion.button
            onClick={run}
            whileTap={{ scale: 0.96 }}
            transition={spring.snappy}
            className="rounded-none px-5 py-2.5 text-sm font-semibold transition"
            style={{ background: ACCENT, color: "#120802" }}
          >
            {result ? "Re-simulate Tournament" : "Simulate Tournament"}
          </motion.button>
        </div>
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
      ) : result ? (
        <motion.div
          key="result"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={spring.soft}
          className="space-y-6"
        >
          {/* champion banner */}
          <Reveal>
            <div
              className="glass relative flex flex-col items-center overflow-hidden rounded-none border px-6 py-8 text-center"
              style={{ borderColor: `${ACCENT}33` }}
            >
              <div>
                <Crown size={40} style={{ color: ACCENT }} />
              </div>
              <div className="eyebrow mt-3" style={{ color: ACCENT }}>
                National Champion
              </div>
              <div className="display mt-1 text-4xl text-white">{result.champion.name}</div>
              <div className="mt-2 flex items-center gap-2 text-xs text-white/55">
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-none text-[10px] font-bold"
                  style={{ background: result.champion.color, color: chipInk(result.champion.color) }}
                >
                  {result.champion.seed}
                </span>
                <span className="stat-num">
                  {result.champion.seed} seed · {result.champion.eff} net eff
                </span>
              </div>
            </div>
          </Reveal>

          {/* bracket rounds */}
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-4">
              {result.rounds.map((round, ri) => (
                <div key={ri} className="w-[230px] shrink-0">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="eyebrow" style={{ color: "rgba(255,255,255,0.55)" }}>
                      {ROUND_NAMES[ri] ?? `Round ${ri + 1}`}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {round.map((game, gi) => {
                      const aWins = game.winner.name === game.a.name;
                      return (
                        <Reveal key={gi} delay={gi * 0.05}>
                          <div
                            className="glass rounded-none border border-transparent p-2.5"
                            style={game.upset ? { borderColor: `${ACCENT}40` } : undefined}
                          >
                            <TeamRow team={game.a} prob={game.aProb} isWinner={aWins} accent={ACCENT} />
                            <div className="my-0.5 flex items-center justify-center">
                              <span className="text-[9px] uppercase tracking-widest text-white/35">
                                vs
                              </span>
                            </div>
                            <TeamRow team={game.b} prob={100 - game.aProb} isWinner={!aWins} accent={ACCENT} />
                            {game.upset && (
                              <div className="mt-2 flex justify-end">
                                <Badge color={ACCENT}>
                                  <Zap size={10} /> Upset
                                </Badge>
                              </div>
                            )}
                          </div>
                        </Reveal>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ranked title odds */}
          <Panel title="Title odds">
            <div className="space-y-1.5">
              {titleOdds.map((o, i) => {
                const pct = Math.round((o.score / oddsTotal) * 100);
                const isChamp = o.team.name === result.champion.name;
                return (
                  <div
                    key={o.team.name}
                    className="flex items-center gap-2.5 rounded-none px-2 py-1.5"
                    style={{ background: isChamp ? `${ACCENT}14` : "transparent" }}
                  >
                    <span className="stat-num w-6 shrink-0 text-[11px] text-white/45">
                      {i + 1}
                    </span>
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-none text-[9px] font-bold"
                      style={{ background: o.team.color, color: chipInk(o.team.color) }}
                    >
                      {o.team.seed}
                    </span>
                    <span className="flex-1 truncate text-xs font-medium text-white/90">
                      {o.team.name}
                    </span>
                    <span
                      className="stat-num text-[11px] font-semibold"
                      style={{ color: isChamp ? ACCENT : "rgba(255,255,255,0.55)" }}
                    >
                      {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          </Panel>
        </motion.div>
      ) : (
        <motion.div
          key="field"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={spring.soft}
        >
        <Panel title="The field">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {NCAA_FIELD.map((t, i) => (
              <Reveal key={t.name} delay={i * 0.03}>
                <div className="flex items-center gap-2.5 rounded-none border border-white/10 bg-white/[0.03] p-3">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-none text-xs font-bold"
                    style={{ background: t.color, color: chipInk(t.color) }}
                  >
                    {t.seed}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">{t.name}</div>
                    <div className="stat-num text-[10px] text-white/55">{t.eff} net eff</div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <div className="mt-5 flex items-center gap-2 text-xs text-white/55">
            <Trophy size={13} style={{ color: ACCENT }} />
            16 teams seeded 1–7. Press simulate to run the bracket end to end.
          </div>
        </Panel>
        </motion.div>
      )}
      </AnimatePresence>

      <div className="mt-8 space-y-3">
        <div>
          <div className="kicker" style={{ color: "#E0561F" }}>Model track record</div>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            The actual NCAA champion for every season since 2003 — from Syracuse in 2003 through
            the most recent title run — forming the historical ground truth the bracket simulation
            is trained on and validated against.
          </p>
        </div>
        <TrackRecord slug="march-madness" accent="#E0561F" />
      </div>
    </ToolShell>
  );
}
