"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Atom, AlertTriangle } from "lucide-react";
import { spring } from "@/lib/motion";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { PlayerPicker } from "@/components/ui/PlayerPicker";
import { Meter } from "@/components/ui/Meter";
import { Gauge } from "@/components/ui/Gauge";
import { Badge } from "@/components/ui/Controls";
import { Reveal } from "@/components/ui/Reveal";
import { TrackRecord } from "@/components/ui/TrackRecord";
import { getTool } from "@/lib/tools";
import { TEAMS, TEAM_MAP, playersByTeam } from "@/lib/data";
import { teamChemistry, best_team_matches, type ChemistryResult } from "@/lib/engine/teams";
import { gradeColor } from "@/lib/cn";
import type { Player } from "@/lib/types";

const ACCENT = "#2BD68B";

export default function TeamChemistryPage() {
  const tool = getTool("team-chemistry")!;
  const [player, setPlayer] = useState<Player | null>(null);
  const [team, setTeam] = useState("BOS");

  const result: ChemistryResult | null = useMemo(
    () => (player ? teamChemistry(player, team) : null),
    [player, team],
  );
  const bestFits = useMemo(() => (player ? best_team_matches(player) : []), [player]);

  // Brief analyzing beat whenever the fit inputs change, so the synchronous
  // result still surfaces a loading state like sibling tools.
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (!player) {
      setIsAnalyzing(false);
      return;
    }
    setIsAnalyzing(true);
    const id = window.setTimeout(() => setIsAnalyzing(false), 320);
    return () => window.clearTimeout(id);
  }, [player, team]);

  const roster = useMemo(
    () => playersByTeam(team).filter((p) => !player || p.id !== player.id),
    [team, player],
  );
  const tm = TEAM_MAP[team];

  return (
    <ToolShell tool={tool}>
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-1.5 text-xs font-medium text-white/60">Player</div>
          <PlayerPicker
            value={player}
            onChange={setPlayer}
            accent={ACCENT}
            placeholder="Pick a player to test fit…"
          />
        </div>
        <div>
          <div className="mb-1.5 text-xs font-medium text-white/60">Destination team</div>
          <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-[7px]">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold text-white"
              style={{ background: tm?.color }}
            >
              {tm?.abbr}
            </span>
            <select
              aria-label="Destination team"
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              className="flex-1 bg-transparent text-sm text-white outline-none"
            >
              {TEAMS.map((t) => (
                <option key={t.abbr} value={t.abbr} className="bg-ink-800">
                  {t.city} {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {!result ? (
        // Always-visible-on-load content: CSS entrance, never Framer-gated.
        <Panel className="enter flex min-h-[300px] flex-col items-center justify-center text-center">
          <Atom size={40} className="mb-4" style={{ color: ACCENT }} />
          <div className="kicker mb-2" style={{ color: ACCENT }}>
            Chemistry Simulator
          </div>
          <p className="max-w-sm text-sm text-white/50">
            Drop any player onto a roster and the Chemistry Simulator predicts fit from usage
            overlap, spacing, defense, and positional need against the current core.
          </p>
        </Panel>
      ) : (
      <AnimatePresence mode="wait">
      {isAnalyzing ? (
        <motion.div
          key="analyzing"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={spring.soft}
        >
          <Panel className="flex min-h-[300px] flex-col items-center justify-center text-center">
            <div className="flex items-center gap-3 text-sm text-[var(--text-muted)]">
              <span className="inline-block h-3 w-3 animate-pulse" style={{ background: ACCENT }} />
              Simulating fit…
            </div>
            <div className="mt-5 w-full max-w-sm space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-9 w-full animate-pulse" />
              ))}
            </div>
          </Panel>
        </motion.div>
      ) : (
        <motion.div
          key={`${player!.id}-${team}`}
          className="grid gap-6 lg:grid-cols-[300px_1fr]"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={spring.soft}
        >
          <Reveal>
            <Panel className="flex flex-col items-center justify-center text-center">
              <Gauge value={result.fit} label="Fit" color={gradeColor(result.fit)} />
              <div className="mt-4 flex items-center gap-2">
                <span className="text-sm text-white/55">Chemistry grade</span>
                <Badge color={gradeColor(result.fit)} soft={false}>
                  {result.grade}
                </Badge>
              </div>
              <p className="mt-3 text-xs text-white/45">
                {player!.name} → {tm?.city} {tm?.name}
              </p>
            </Panel>
          </Reveal>

          <div className="space-y-6">
            <Reveal delay={0.05}>
              <Panel title="Fit breakdown">
                <div className="space-y-4">
                  <Meter
                    label="Usage overlap"
                    valueLabel={`${result.usageOverlap}`}
                    value={result.usageOverlap}
                    color="#6B6E78"
                  />
                  <Meter
                    label="Spacing gain"
                    valueLabel={`${result.spacingGain}`}
                    value={result.spacingGain}
                    color="#2BD68B"
                  />
                  <Meter
                    label="Defense gain"
                    valueLabel={`${result.defenseGain}`}
                    value={result.defenseGain}
                    color="#D7BC6A"
                  />
                  <Meter
                    label="Positional need"
                    valueLabel={`${result.positionalNeed}`}
                    value={result.positionalNeed}
                    color="#00E07F"
                  />
                </div>
              </Panel>
            </Reveal>

            {result.red_flags.length > 0 && (
              <Reveal delay={0.08}>
                <Panel title="Red flags">
                  <ul className="space-y-2">
                    {result.red_flags.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-[#F4647D]">
                        <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </Panel>
              </Reveal>
            )}

            <Reveal delay={0.1}>
              <Insight accent={ACCENT}>
                <ul className="space-y-1.5">
                  {result.notes.map((n) => (
                    <li key={n}>· {n}</li>
                  ))}
                </ul>
              </Insight>
            </Reveal>

            {bestFits.length > 0 && (
              <Reveal delay={0.12}>
                <Panel title="Best fits around the league">
                  <p className="mb-3 text-[11px] text-white/40">
                    Every team scored with the same fit model — top five destinations for{" "}
                    {player!.name} (current team excluded).
                  </p>
                  <div className="space-y-2">
                    {bestFits.map((m, i) => (
                      <button
                        key={m.team.abbr}
                        onClick={() => setTeam(m.team.abbr)}
                        className="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-left transition hover:border-white/20"
                      >
                        <span className="stat-num w-5 text-xs text-white/35">{i + 1}</span>
                        <span
                          className="flex h-7 w-9 items-center justify-center rounded-lg text-[10px] font-bold text-white"
                          style={{ background: m.team.color }}
                        >
                          {m.team.abbr}
                        </span>
                        <span className="flex-1 truncate text-sm text-white/80">
                          {m.team.city} {m.team.name}
                        </span>
                        <span className="w-24">
                          <Meter value={m.fit} color={gradeColor(m.fit)} height={5} />
                        </span>
                        <span className="stat-num w-8 text-right text-sm font-semibold text-white">
                          {m.fit}
                        </span>
                        <Badge color={gradeColor(m.fit)}>{m.grade}</Badge>
                      </button>
                    ))}
                  </div>
                </Panel>
              </Reveal>
            )}

            {roster.length > 0 && (
              <Reveal delay={0.14}>
                <Panel title={`Current ${tm?.name} core`}>
                  <div className="flex flex-wrap gap-2">
                    {roster.map((p) => (
                      <span
                        key={p.id}
                        className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 py-1.5 text-xs text-white/75"
                      >
                        <span className="stat-num text-[10px] text-white/40">{p.pos}</span>
                        {p.name}
                      </span>
                    ))}
                  </div>
                </Panel>
              </Reveal>
            )}
          </div>
        </motion.div>
      )}
      </AnimatePresence>
      )}

      <div className="mt-8 space-y-3">
        <div>
          <div className="kicker" style={{ color: "#2BD68B" }}>Model track record</div>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            Each season since 2003, the player ratings behind the fit scoring are tested against what those players actually produced the following year — the bars show that year-over-year correlation (about r=0.89). Red flags are rule-based: stacked 28%+ usage, three-deep position groups, and a 3+ possession pace gap between the player's current team and the destination. The league-wide list runs the identical fit model on all 29 other teams.
          </p>
        </div>
        <TrackRecord slug="team-chemistry" accent="#2BD68B" />
      </div>
    </ToolShell>
  );
}
