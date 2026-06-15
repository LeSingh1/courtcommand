"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Award, Crown } from "lucide-react";
import { spring } from "@/lib/motion";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { Segmented, Badge } from "@/components/ui/Controls";
import { BarChart } from "@/components/ui/BarChart";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { Meter } from "@/components/ui/Meter";
import { TrackRecord } from "@/components/ui/TrackRecord";
import { getTool, categoryColor } from "@/lib/tools";
import { TEAM_MAP } from "@/lib/data";
import { awardRace, type AwardKind, type AwardRow } from "@/lib/engine/players";
import type { Player } from "@/lib/types";

const AWARDS: { label: string; value: AwardKind }[] = [
  { label: "MVP", value: "MVP" },
  { label: "DPOY", value: "DPOY" },
  { label: "ROTY", value: "ROTY" },
  { label: "6MOY", value: "6MOY" },
];

const AWARD_FULL: Record<AwardKind, string> = {
  MVP: "Most Valuable Player",
  DPOY: "Defensive Player of the Year",
  ROTY: "Rookie of the Year",
  "6MOY": "Sixth Man of the Year",
};

interface StatCol {
  label: string;
  value: (p: Player) => string;
}

function candidateCols(kind: AwardKind): StatCol[] {
  if (kind === "MVP")
    return [
      { label: "PPG", value: (p) => p.ppg.toFixed(1) },
      { label: "BPM", value: (p) => p.bpm.toFixed(1) },
      { label: "W", value: (p) => String(TEAM_MAP[p.team]?.wins ?? "—") },
    ];
  if (kind === "DPOY")
    return [
      { label: "BPG", value: (p) => p.bpg.toFixed(1) },
      { label: "SPG", value: (p) => p.spg.toFixed(1) },
      { label: "DI", value: (p) => p.defImpact.toFixed(0) },
    ];
  if (kind === "ROTY")
    return [
      { label: "PPG", value: (p) => p.ppg.toFixed(1) },
      { label: "Age", value: (p) => String(p.age) },
      { label: "Exp", value: (p) => String(p.exp) },
    ];
  return [
    { label: "PPG", value: (p) => p.ppg.toFixed(1) },
    { label: "MPG", value: (p) => p.mpg.toFixed(1) },
    { label: "PER", value: (p) => p.per.toFixed(1) },
  ];
}

interface Factor {
  label: string;
  value: number;
}

function leaderFactors(p: Player, kind: AwardKind): Factor[] {
  const wins = TEAM_MAP[p.team]?.wins ?? 41;

  if (kind === "MVP") {
    const perTerm = p.per * 0.002963;
    const bpmTerm = p.bpm * 0.004288;
    const winsTerm = wins * 0.00075;
    const ppgTerm = p.ppg * 0.001822;
    const tsTerm = p.tsp * 0.134659;
    const total = perTerm + bpmTerm + winsTerm + ppgTerm + tsTerm || 1;
    return [
      { label: "Scoring (PPG)", value: Math.round((ppgTerm / total) * 100) },
      { label: "Impact (BPM)", value: Math.round((bpmTerm / total) * 100) },
      { label: "Team wins", value: Math.round((winsTerm / total) * 100) },
      { label: "Efficiency (TS%)", value: Math.round((tsTerm / total) * 100) },
      { label: "Production (PER)", value: Math.round((perTerm / total) * 100) },
    ];
  }

  if (kind === "DPOY") {
    const diTerm = p.defImpact * 1.4;
    const bpgTerm = p.bpg * 9;
    const spgTerm = p.spg * 4;
    const rpgTerm = p.rpg * 0.4;
    const winsTerm = Math.max(0, wins - 45) * 0.12;
    const total = diTerm + bpgTerm + spgTerm + rpgTerm + winsTerm || 1;
    return [
      { label: "Def. Impact (DI)", value: Math.round((diTerm / total) * 100) },
      { label: "Blocks (BPG)", value: Math.round((bpgTerm / total) * 100) },
      { label: "Steals (SPG)", value: Math.round((spgTerm / total) * 100) },
      { label: "Rebounds (RPG)", value: Math.round((rpgTerm / total) * 100) },
      { label: "Team wins", value: Math.round((winsTerm / total) * 100) },
    ];
  }

  if (kind === "ROTY") {
    const perTerm = p.per;
    const ppgTerm = p.ppg * 0.6;
    const bpmTerm = Math.max(0, p.bpm) * 1.5;
    const total = perTerm + ppgTerm + bpmTerm || 1;
    return [
      { label: "Production (PER)", value: Math.round((perTerm / total) * 100) },
      { label: "Scoring (PPG)", value: Math.round((ppgTerm / total) * 100) },
      { label: "Impact (BPM)", value: Math.round((bpmTerm / total) * 100) },
    ];
  }

  const ppgTerm = p.ppg * 1.2;
  const perTerm = p.per * 0.5;
  const total = ppgTerm + perTerm || 1;
  return [
    { label: "Scoring (PPG)", value: Math.round((ppgTerm / total) * 100) },
    { label: "Productivity (PER)", value: Math.round((perTerm / total) * 100) },
  ];
}

export default function AwardPredictorPage() {
  const tool = getTool("award-predictor")!;
  const ACCENT = categoryColor(tool.category);
  const [kind, setKind] = useState<AwardKind>("MVP");
  const race = useMemo(() => awardRace(kind), [kind]);
  const leader = race[0];
  const runnerUp = race[1];
  const gap = leader && runnerUp ? leader.share - runnerUp.share : 0;
  const cols = useMemo(() => candidateCols(kind), [kind]);
  const factors = useMemo(
    () => (leader ? leaderFactors(leader.player, kind) : []),
    [leader, kind],
  );

  return (
    <ToolShell tool={tool}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="eyebrow flex items-center gap-2" style={{ color: ACCENT }}>
          <Award size={15} /> {AWARD_FULL[kind]} race
        </div>
        <Segmented accent={ACCENT} value={kind} onChange={setKind} options={AWARDS} />
      </div>

      {leader ? (
        <div key={kind} className="enter grid gap-6 lg:grid-cols-[360px_1fr]">
          <motion.div
            className="glass rounded-lg p-6"
            style={{ boxShadow: `inset 0 0 0 1px ${ACCENT}30` }}
            whileHover={{ y: -3 }}
            transition={spring.snappy}
          >
            <div className="flex items-center gap-2">
              <Crown size={18} style={{ color: ACCENT }} />
              <span className="text-[11px] font-semibold text-white/55">Frontrunner</span>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <PlayerAvatar player={leader.player} size={56} />
              <div className="min-w-0">
                <div className="truncate text-lg font-semibold text-white">{leader.player.name}</div>
                <div className="stat-num text-xs text-white/45">
                  {leader.player.pos} · {leader.player.ppg}/{leader.player.rpg}/{leader.player.apg}
                </div>
              </div>
            </div>
            <div className="mt-6 flex items-end justify-between">
              <div>
                <div className="display text-5xl" style={{ color: ACCENT }}>
                  <AnimatedNumber value={leader.share} decimals={0} suffix="%" />
                </div>
                <div className="mt-1 text-[10px] text-white/40">Projected vote share</div>
              </div>
              <Badge color={ACCENT}>{leader.odds}% odds</Badge>
            </div>
          </motion.div>

          <Panel title={`${kind} candidate field`}>
            <BarChart
              bars={race.map((r, i) => ({
                label: r.player.name,
                value: r.share,
                color: ACCENT,
                sub: i === 0 ? "lead" : `${r.player.team}`,
              }))}
              unit="%"
            />
          </Panel>
        </div>
      ) : (
        <div key={`${kind}-empty`} className="enter">
          <Panel title={`${kind} candidate field`}>
            <div className="py-10 text-center text-sm text-white/45">
              No qualifying {AWARD_FULL[kind]} candidates in the current pool.
            </div>
          </Panel>
        </div>
      )}

      {leader && runnerUp && (
        <div className="mt-6">
          <Insight accent={ACCENT}>
            {gap <= 0 ? (
              <>
                <b>{leader.player.name}</b> leads the {kind} race at <b>{leader.share}%</b> of the
                projected vote — but it is a dead heat with <b>{runnerUp.player.name}</b> (
                {runnerUp.share}%). Either could take it on a strong finishing kick.
              </>
            ) : (
              <>
                <b>{leader.player.name}</b> is the clear {kind} favorite at <b>{leader.share}%</b> of
                the projected vote — a <b>{gap}-point</b> cushion over <b>{runnerUp.player.name}</b> (
                {runnerUp.share}%).{" "}
                {gap >= 12
                  ? "Barring a collapse, this is shaping up as a runaway."
                  : "Close enough that a strong finishing kick could flip the race."}
              </>
            )}
          </Insight>
        </div>
      )}

      {leader && factors.length > 0 && (
        <div className="mt-6">
          <Panel title={`Why ${leader.player.name} is leading`}>
            <div className="mb-3 text-xs text-[var(--text-faint)]">
              Factor weight breakdown — share of total model score
            </div>
            <BarChart
              bars={factors.map((f) => ({
                label: f.label,
                value: f.value,
                color: ACCENT,
              }))}
              unit="%"
              max={100}
            />
          </Panel>
        </div>
      )}

      {race.length > 0 && (
        <div className="mt-6">
          <Panel title="Full candidate field">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--line)] text-left text-[var(--text-faint)]">
                    <th className="pb-2 pr-3 font-medium w-8">#</th>
                    <th className="pb-2 pr-4 font-medium">Player</th>
                    <th className="pb-2 pr-4 font-medium">Team</th>
                    {cols.map((c) => (
                      <th key={c.label} className="pb-2 pr-4 font-medium text-right">
                        {c.label}
                      </th>
                    ))}
                    <th className="pb-2 pr-4 font-medium text-right">Share%</th>
                    <th className="pb-2 font-medium min-w-[100px]">Vote meter</th>
                  </tr>
                </thead>
                <tbody>
                  {race.map((row: AwardRow, i) => (
                    <tr
                      key={row.player.id}
                      className="border-b border-[var(--line)] last:border-0 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-2.5 pr-3">
                        <span
                          className="display text-sm"
                          style={{ color: i === 0 ? ACCENT : "var(--text-faint)" }}
                        >
                          {i + 1}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2">
                          <PlayerAvatar player={row.player} size={26} rounded />
                          <span className="font-medium text-[var(--text)] whitespace-nowrap">
                            {row.player.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-1.5">
                          <TeamLogo abbr={row.player.team} size={16} />
                          <span className="text-[var(--text-muted)]">{row.player.team}</span>
                        </div>
                      </td>
                      {cols.map((c) => (
                        <td key={c.label} className="py-2.5 pr-4 text-right">
                          <span className="stat-num text-[var(--text)]">{c.value(row.player)}</span>
                        </td>
                      ))}
                      <td className="py-2.5 pr-4 text-right">
                        <span
                          className="stat-num font-semibold"
                          style={{ color: i === 0 ? ACCENT : "var(--text)" }}
                        >
                          {row.share}%
                        </span>
                      </td>
                      <td className="py-2.5">
                        <Meter
                          value={row.share}
                          max={race[0]?.share ?? 100}
                          color={i === 0 ? ACCENT : `${ACCENT}70`}
                          height={5}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}

      <div className="mt-8 space-y-3">
        <div>
          <div className="kicker" style={{ color: "#4D8DFF" }}>Model track record</div>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            Pick a season since 2003 to compare the model&apos;s projected MVP vote share against
            the documented balloting, with a per-season table of its projected MVP versus the actual
            winner — it has called 17 of 23 since 2003, retrained on each year&apos;s added data.
          </p>
        </div>
        <TrackRecord slug="award-predictor" accent="#4D8DFF" />
      </div>
    </ToolShell>
  );
}
