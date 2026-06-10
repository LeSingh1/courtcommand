"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gem } from "lucide-react";
import { spring, staggerParent, staggerItem } from "@/lib/motion";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { Slider, Badge } from "@/components/ui/Controls";
import { Meter } from "@/components/ui/Meter";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { TrackRecord } from "@/components/ui/TrackRecord";
import { getTool, categoryColor } from "@/lib/tools";
import { underratedBoard } from "@/lib/engine/players";
import { underratedWhy, UNDERRATED_USAGE_CAP, type UnderratedProfile } from "@/lib/engine/value";

export default function UnderratedPage() {
  const tool = getTool("underrated")!;
  const ACCENT = categoryColor(tool.category);
  const [maxSalary, setMaxSalary] = useState(25);
  const [analyzing, setAnalyzing] = useState(false);

  // High-usage featured options are excluded structurally — they cannot be
  // "underrated" no matter how cheap the deal looks.
  const board = useMemo(
    () => underratedBoard(maxSalary).filter((r) => r.player.usg < UNDERRATED_USAGE_CAP),
    [maxSalary],
  );
  const profiles = useMemo(
    () => new Map<string, UnderratedProfile>(board.map((r) => [r.player.id, underratedWhy(r.player)])),
    [board],
  );
  const top = board.slice(0, 3);
  const sleeper = board[0];
  const sleeperProfile = sleeper ? profiles.get(sleeper.player.id) : undefined;

  useEffect(() => {
    setAnalyzing(true);
    const t = setTimeout(() => setAnalyzing(false), 250);
    return () => clearTimeout(t);
  }, [maxSalary]);

  return (
    <ToolShell tool={tool}>
      <div className="mb-6 grid gap-6 lg:grid-cols-[320px_1fr]">
        <Panel title="Filter">
          <div className="space-y-5">
            <Slider
              label="Max salary"
              value={maxSalary}
              min={5}
              max={40}
              unit=" M$"
              accent={ACCENT}
              onChange={setMaxSalary}
            />
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-white/55">
              Showing <b className="text-white">{board.length}</b> players under{" "}
              <b style={{ color: ACCENT }}>${maxSalary}M</b>. Score blends true shooting, BPM, on-court
              net, cheapness, and low-usage &ldquo;under-the-radar&rdquo; value. Featured options at{" "}
              {UNDERRATED_USAGE_CAP}%+ usage are excluded structurally; thin samples are flagged.
            </div>
          </div>
        </Panel>

        <AnimatePresence mode="wait">
          <motion.div
            key={sleeper ? sleeper.player.id : "empty"}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={spring.soft}
          >
            {sleeper ? (
              <Insight accent={ACCENT}>
                <b>{sleeper.player.name}</b> is the top sleeper at this price — an underrated score of{" "}
                <b style={{ color: ACCENT }}>{sleeper.underratedScore}</b> on a ${sleeper.player.salary}M
                deal{sleeper.reasons.length ? `: ${sleeper.reasons.join(", ")}` : ""}. High output for a
                fraction of the noise.
              </Insight>
            ) : (
              <Insight accent={ACCENT}>No players fall under ${maxSalary}M — raise the cap.</Insight>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Hidden gem cards */}
      {analyzing ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass rounded-lg p-5">
              <div className="text-[10px] text-white/35">
                Scanning the cap sheet…
              </div>
              <div className="mt-3 h-10 w-2/3 bg-white/[0.04]" />
              <div className="mt-4 h-8 w-1/3 bg-white/[0.04]" />
              <div className="mt-3 flex gap-1.5">
                <div className="h-4 w-16 bg-white/[0.03]" />
                <div className="h-4 w-12 bg-white/[0.03]" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        top.length > 0 && (
        <motion.div
          key={maxSalary}
          className="mb-6 grid gap-4 sm:grid-cols-3"
          variants={staggerParent}
          initial="initial"
          animate="animate"
        >
          {top.map((r, i) => {
            return (
              <motion.div
                key={r.player.id}
                variants={staggerItem}
                whileHover={{ y: -3 }}
                transition={spring.snappy}
              >
                <div className="glass rounded-lg p-5">
                  <div className="flex items-center justify-between">
                    <span className="display text-4xl text-white/15">#{i + 1}</span>
                    <Gem size={20} style={{ color: ACCENT }} />
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <PlayerAvatar player={r.player} size={40} />
                    <span className="font-semibold text-white">{r.player.name}</span>
                  </div>
                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <div className="stat-num text-3xl font-bold" style={{ color: ACCENT }}>
                        {r.underratedScore}
                      </div>
                      <div className="text-[10px] text-white/40">
                        Underrated · ${r.player.salary}M
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {r.reasons.map((reason) => (
                      <span
                        key={reason}
                        className="rounded-lg px-2 py-0.5 text-[10px] font-medium"
                        style={{ background: `${ACCENT}1f`, color: ACCENT }}
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
        )
      )}

      {/* Why / fits / risks for the top sleeper */}
      {!analyzing && sleeper && sleeperProfile && (
        <div className="mb-6">
          <Panel title={`Why ${sleeper.player.name} is underrated`}>
            <div className="grid gap-6 lg:grid-cols-3">
              <div>
                <div className="kicker mb-2" style={{ color: ACCENT }}>
                  Why underrated
                </div>
                <ul className="space-y-1.5">
                  {sleeperProfile.whyUnderrated.map((w) => (
                    <li key={w} className="flex items-start gap-2 text-sm text-white/70">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: ACCENT }} />
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="kicker mb-2" style={{ color: ACCENT }}>
                  Ideal team fits
                </div>
                <div className="space-y-2">
                  {sleeperProfile.idealTeamFits.map((fit) => (
                    <div
                      key={fit.team.abbr}
                      className="flex items-start gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5"
                    >
                      <TeamLogo abbr={fit.team.abbr} size={26} />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white">
                          {fit.team.city} {fit.team.name}
                          <span className="stat-num ml-2 text-xs font-normal" style={{ color: ACCENT }}>
                            fit {fit.fitScore}
                          </span>
                        </div>
                        <div className="text-[11px] leading-snug text-white/50">
                          {fit.reasons.join("; ")}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="kicker mb-2" style={{ color: "#F4647D" }}>
                  Risk factors
                </div>
                <ul className="space-y-1.5">
                  {sleeperProfile.riskFactors.map((r) => (
                    <li key={r} className="flex items-start gap-2 text-sm text-white/70">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F4647D]" />
                      {r}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[11px] leading-relaxed text-white/35">
                  Team fits rank rosters by their three-point and defensive gaps (computed from real
                  per-team player stats) against what this player supplies.
                </p>
              </div>
            </div>
          </Panel>
        </div>
      )}

      <Panel title="Underrated rankings">
        {analyzing ? (
          <div className="space-y-2">
            <div className="text-[10px] text-white/35">
              Scanning the cap sheet…
            </div>
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
              >
                <div className="h-8 w-8 bg-white/[0.04]" />
                <div className="h-3 w-32 bg-white/[0.04]" />
                <div className="ml-auto h-3 w-12 bg-white/[0.03]" />
              </div>
            ))}
          </div>
        ) : (
        <div className="space-y-2">
          {board.map((r, i) => {
            return (
              <div
                key={r.player.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 transition hover:bg-white/[0.04]"
              >
                <span className="stat-num w-6 text-center text-sm text-white/35">{i + 1}</span>
                <PlayerAvatar player={r.player} size={32} />
                <div className="min-w-[120px]">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    {r.player.name}
                    {profiles.get(r.player.id)?.smallSample && (
                      <Badge color="#D7BC6A" className="text-[9px]">
                        small sample
                      </Badge>
                    )}
                  </div>
                  <div className="stat-num text-[11px] text-white/45">
                    {r.player.pos} · {r.player.archetype}
                  </div>
                </div>
                <div className="flex min-w-[160px] flex-1 items-center gap-2.5">
                  <div className="flex-1">
                    <Meter value={r.underratedScore} color={ACCENT} height={6} />
                  </div>
                  <span className="stat-num w-7 text-sm font-bold" style={{ color: ACCENT }}>
                    {r.underratedScore}
                  </span>
                </div>
                <div className="flex w-full flex-wrap gap-1.5 sm:w-auto">
                  {r.reasons.map((reason, ri) => (
                    <span
                      key={reason}
                      className={`rounded-lg border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-white/55 ${
                        ri === 0 ? "" : "hidden sm:inline-block"
                      }`}
                    >
                      {reason}
                    </span>
                  ))}
                </div>
                <span className="stat-num ml-auto text-xs font-semibold text-white/60">
                  ${r.player.salary}M
                </span>
              </div>
            );
          })}
        </div>
        )}
      </Panel>

      <div className="mt-8 space-y-3">
        <div>
          <div className="kicker" style={{ color: "#41C7E0" }}>Model track record</div>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            Each season since 2003, the bars show what share of the players the model flagged as the best value (high production, low pay) actually held or improved their production the next year — about 78% across the span.
          </p>
        </div>
        <TrackRecord slug="underrated" accent="#41C7E0" />
      </div>
    </ToolShell>
  );
}
