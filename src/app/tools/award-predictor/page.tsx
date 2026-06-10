"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Award, Crown } from "lucide-react";
import { spring } from "@/lib/motion";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { Segmented, Badge } from "@/components/ui/Controls";
import { BarChart } from "@/components/ui/BarChart";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { TrackRecord } from "@/components/ui/TrackRecord";
import { getTool, categoryColor } from "@/lib/tools";
import { awardRace, type AwardKind } from "@/lib/engine/players";

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

export default function AwardPredictorPage() {
  const tool = getTool("award-predictor")!;
  const ACCENT = categoryColor(tool.category);
  const [kind, setKind] = useState<AwardKind>("MVP");
  const race = useMemo(() => awardRace(kind), [kind]);
  const leader = race[0];
  const runnerUp = race[1];
  const gap = leader && runnerUp ? leader.share - runnerUp.share : 0;

  return (
    <ToolShell tool={tool}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="eyebrow flex items-center gap-2" style={{ color: ACCENT }}>
          <Award size={15} /> {AWARD_FULL[kind]} race
        </div>
        <Segmented accent={ACCENT} value={kind} onChange={setKind} options={AWARDS} />
      </div>

      <AnimatePresence mode="wait">
      {leader ? (
        <motion.div
          key={kind}
          className="grid gap-6 lg:grid-cols-[360px_1fr]"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={spring.soft}
        >
          {/* frontrunner card */}
          <motion.div
            className="glass rounded-lg p-6"
            style={{ boxShadow: `inset 0 0 0 1px ${ACCENT}30` }}
            whileHover={{ y: -3 }}
            transition={spring.snappy}
          >
            <div className="flex items-center gap-2">
              <Crown size={18} style={{ color: ACCENT }} />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
                Frontrunner
              </span>
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
                <div className="mt-1 text-[10px] uppercase tracking-wide text-white/40">
                  Projected vote share
                </div>
              </div>
              <Badge color={ACCENT}>{leader.odds}% odds</Badge>
            </div>
          </motion.div>

          {/* field bar chart */}
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
        </motion.div>
      ) : (
        <motion.div
          key={`${kind}-empty`}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={spring.soft}
        >
          <Panel title={`${kind} candidate field`}>
            <div className="py-10 text-center text-sm text-white/45">
              No qualifying {AWARD_FULL[kind]} candidates in the current pool.
            </div>
          </Panel>
        </motion.div>
      )}
      </AnimatePresence>

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

      <div className="mt-8 space-y-3">
        <div>
          <div className="kicker" style={{ color: "#E9A23B" }}>Model track record</div>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            Pick a season since 2003 to compare the model&apos;s projected MVP vote share against
            the documented balloting, with a per-season table of its projected MVP versus the actual
            winner — it has called 17 of 23 since 2003, retrained on each year&apos;s added data.
          </p>
        </div>
        <TrackRecord slug="award-predictor" accent="#E9A23B" />
      </div>
    </ToolShell>
  );
}
