"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Check, Plus, Zap, Star } from "lucide-react";
import { spring } from "@/lib/motion";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { Meter } from "@/components/ui/Meter";
import { Gauge } from "@/components/ui/Gauge";
import { Reveal } from "@/components/ui/Reveal";
import { AnalyzeOverlay, useAnalyze } from "@/components/ui/Analyze";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { TrackRecord } from "@/components/ui/TrackRecord";
import { getTool } from "@/lib/tools";
import { PLAYERS, TEAMS, playersByTeam } from "@/lib/data";
import { bestLineup, scoreLineup, type LineupScore } from "@/lib/engine/teams";
import { gradeColor, letterGrade } from "@/lib/cn";
import type { Player } from "@/lib/types";

const ACCENT = "#5FA97E";

export default function LineupOptimizerPage() {
  const tool = getTool("lineup-optimizer")!;
  const [team, setTeam] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [optimized, setOptimized] = useState<LineupScore | null>(null);

  const analyze = useAnalyze([
    "Loading candidate pool…",
    "Modeling spacing & usage overlap…",
    "Maximizing two-way fit…",
    "Locking the optimal five…",
  ]);

  const pool: Player[] = useMemo(() => {
    if (team) return playersByTeam(team);
    if (selected.length > 0)
      return selected.map((id) => PLAYERS.find((p) => p.id === id)!).filter(Boolean);
    return PLAYERS;
  }, [team, selected]);

  // live custom-5 score (only when exactly 5 manually chosen and no team filter)
  const customFive = useMemo(
    () => selected.map((id) => PLAYERS.find((p) => p.id === id)!).filter(Boolean),
    [selected],
  );
  const liveScore: LineupScore | null = useMemo(
    () => (customFive.length === 5 ? scoreLineup(customFive) : null),
    [customFive],
  );

  const toggle = (id: string) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    setTeam("");
  };

  const optimize = () => {
    const usePool = team ? playersByTeam(team) : PLAYERS;
    analyze.run(() => setOptimized(bestLineup(usePool)));
  };

  // what's shown in the stats panel: live custom-5 takes priority, else optimized
  const shown = liveScore ?? optimized;

  return (
    <ToolShell tool={tool}>
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* candidate builder */}
        <div className="space-y-4">
          <Panel title="Candidate pool">
            <div className="mb-4">
              <select
                aria-label="Filter candidate pool by team"
                value={team}
                onChange={(e) => {
                  setTeam(e.target.value);
                  setSelected([]);
                  setOptimized(null);
                }}
                className="w-full cursor-pointer rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none"
              >
                <option value="" className="bg-ink-800">
                  All tracked players ({PLAYERS.length})
                </option>
                {TEAMS.map((t) => (
                  <option key={t.abbr} value={t.abbr} className="bg-ink-800">
                    {t.city} {t.name}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-[11px] text-white/40">
                Pick a team to auto-fill its roster, or hand-select candidates below. Choose exactly
                5 to score a custom unit live.
              </p>
            </div>

            <div className="max-h-[420px] space-y-1.5 overflow-auto pr-1">
              {PLAYERS.map((p) => {
                const sel = selected.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => toggle(p.id)}
                    aria-pressed={sel}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg border p-2 text-left transition"
                    style={{
                      borderColor: sel ? `${ACCENT}66` : "rgba(255,255,255,0.06)",
                      background: sel ? `${ACCENT}12` : "transparent",
                    }}
                  >
                    <div
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border"
                      style={{
                        borderColor: sel ? ACCENT : "rgba(255,255,255,0.2)",
                        background: sel ? ACCENT : "transparent",
                      }}
                    >
                      {sel ? (
                        <Check size={13} className="text-[#0a0c11]" />
                      ) : (
                        <Plus size={12} className="text-white/30" />
                      )}
                    </div>
                    <PlayerAvatar player={p} size={28} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-white/85">{p.name}</div>
                      <div className="stat-num flex items-center gap-1 text-[10px] text-white/40">
                        {p.pos} · {p.ppg} PPG · <Star size={9} /> {p.starPower}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Panel>

          <motion.button
            onClick={optimize}
            disabled={pool.length < 5}
            whileTap={{ scale: 0.96 }}
            transition={spring.snappy}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-[#0a0c11] transition disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: ACCENT }}
          >
            <Zap size={16} />
            Optimize lineup
          </motion.button>
          {customFive.length > 0 && customFive.length !== 5 && (
            <p className="text-center text-[11px] text-white/45">
              {customFive.length > 5
                ? `Trim to 5 to score a live custom unit (${customFive.length} selected)`
                : `${customFive.length}/5 selected for a live custom unit`}
            </p>
          )}
        </div>

        {/* results */}
        <div className="space-y-6">
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
          ) : !shown ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={spring.soft}
            >
              <Panel className="flex min-h-[300px] flex-col items-center justify-center text-center">
                <Users size={40} className="mb-4" style={{ color: ACCENT }} />
                <p className="max-w-sm text-sm text-white/50">
                  Optimize a pool to surface the best 5-man unit, or hand-pick exactly five players to
                  score a custom lineup live across spacing, defense, scoring, playmaking, and balance.
                </p>
              </Panel>
            </motion.div>
          ) : (
            <motion.div
              key={`result-${liveScore ? "live" : "opt"}-${shown.five.map((p) => p.id).join("-")}`}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={spring.soft}
              className="space-y-6"
            >
              <Reveal>
                <Panel
                  title={liveScore ? "Custom five (live)" : "Optimal five"}
                  right={
                    <span
                      className="stat-num rounded-lg px-2 py-0.5 text-xs font-bold"
                      style={{
                        background: `${gradeColor(shown.overall)}1f`,
                        color: gradeColor(shown.overall),
                      }}
                    >
                      {letterGrade(shown.overall)}
                    </span>
                  }
                >
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {shown.five.map((p, i) => {
                      return (
                        <Reveal key={p.id} delay={i * 0.06}>
                          <div className="flex items-center gap-3 rounded-lg border border-white/[0.07] bg-white/[0.02] p-3">
                            <PlayerAvatar player={p} size={40} />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold text-white">
                                {p.name}
                              </div>
                              <div className="stat-num text-[11px] text-white/45">
                                {p.pos} · {p.ppg}/{p.rpg}/{p.apg}
                              </div>
                            </div>
                          </div>
                        </Reveal>
                      );
                    })}
                  </div>
                </Panel>
              </Reveal>

              <div className="grid gap-6 sm:grid-cols-[1fr_200px]">
                <Reveal>
                  <Panel title="Unit profile">
                    <div className="space-y-4">
                      <Meter
                        label="Spacing"
                        valueLabel={`${shown.spacing}`}
                        value={shown.spacing}
                        color="#7E8CA0"
                      />
                      <Meter
                        label="Defense"
                        valueLabel={`${shown.defense}`}
                        value={shown.defense}
                        color="#5FA97E"
                      />
                      <Meter
                        label="Scoring"
                        valueLabel={`${shown.scoring}`}
                        value={shown.scoring}
                        color="#E0561F"
                      />
                      <Meter
                        label="Playmaking"
                        valueLabel={`${shown.playmaking}`}
                        value={shown.playmaking}
                        color="#C9A14A"
                      />
                      <Meter
                        label="Balance"
                        valueLabel={`${shown.balance}`}
                        value={shown.balance}
                        color="#BF5B4E"
                      />
                    </div>
                  </Panel>
                </Reveal>

                <Reveal delay={0.08}>
                  <Panel className="flex flex-col items-center justify-center">
                    <Gauge value={shown.overall} label="Overall" color={gradeColor(shown.overall)} />
                  </Panel>
                </Reveal>
              </div>

              <Insight accent={ACCENT}>
                This unit grades{" "}
                <b>
                  {letterGrade(shown.overall)} ({shown.overall})
                </b>{" "}
                overall —{" "}
                {shown.defense >= shown.scoring
                  ? "built on a defensive backbone"
                  : "tilted toward firepower"}{" "}
                with{" "}
                {shown.spacing >= 60
                  ? "comfortable floor spacing"
                  : "spacing that could get cramped"}
                {shown.balance < 50 ? " and real usage overlap to manage." : " and clean role balance."}
              </Insight>
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </div>

      <div className="mt-8 space-y-3">
        <div>
          <div className="kicker" style={{ color: "#5FA97E" }}>Model track record</div>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            Each season since 2003, the player-impact ratings behind the lineup scoring are checked against what those players produced the next year — the bars show that season-by-season correlation (about r=0.89).
          </p>
        </div>
        <TrackRecord slug="lineup-optimizer" accent="#5FA97E" />
      </div>
    </ToolShell>
  );
}
