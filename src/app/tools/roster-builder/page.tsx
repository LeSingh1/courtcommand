"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutGrid, Search, Check, AlertTriangle } from "lucide-react";
import { spring } from "@/lib/motion";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { Meter } from "@/components/ui/Meter";
import { Gauge } from "@/components/ui/Gauge";
import { Badge } from "@/components/ui/Controls";
import { Reveal } from "@/components/ui/Reveal";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { TrackRecord } from "@/components/ui/TrackRecord";
import { getTool } from "@/lib/tools";
import { PLAYERS, SALARY_CAP } from "@/lib/data";
import { scoreLineup, type LineupScore } from "@/lib/engine/teams";
import { contractBreakdown } from "@/lib/engine/value";
import { gradeColor, letterGrade, STEEL } from "@/lib/cn";

const ACCENT = "#2BD68B";

export default function RosterBuilderPage() {
  const tool = getTool("roster-builder")!;
  const [picks, setPicks] = useState<string[]>([]);
  const [q, setQ] = useState("");

  const roster = useMemo(
    () => picks.map((id) => PLAYERS.find((p) => p.id === id)!).filter(Boolean),
    [picks],
  );

  const payroll = useMemo(() => roster.reduce((a, p) => a + p.salary, 0), [roster]);
  const overCap = payroll > SALARY_CAP;

  const score: LineupScore | null = useMemo(
    () => (roster.length === 5 ? scoreLineup(roster) : null),
    [roster],
  );

  const breakdowns = useMemo(
    () => roster.map((p) => ({ player: p, value: contractBreakdown(p) })),
    [roster],
  );
  const avgBargain = useMemo(
    () =>
      breakdowns.length
        ? Math.round(breakdowns.reduce((a, b) => a + b.value.bargainScore, 0) / breakdowns.length)
        : 0,
    [breakdowns],
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = s
      ? PLAYERS.filter(
          (p) => p.name.toLowerCase().includes(s) || p.team.toLowerCase().includes(s),
        )
      : [...PLAYERS].sort((a, b) => b.starPower - a.starPower);
    return base.slice(0, 40);
  }, [q]);

  const toggle = (id: string) => {
    setPicks((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
  };

  return (
    <ToolShell tool={tool}>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* selection grid */}
        <div className="space-y-4">
          <Panel
            title="Free agents"
            right={
              <span className="stat-num text-xs text-white/45">{picks.length}/5 signed</span>
            }
          >
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5">
              <Search size={15} className="text-white/40" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search players…"
                aria-label="Search players"
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35"
              />
            </div>

            <div className="grid max-h-[460px] grid-cols-1 gap-2 overflow-auto pr-1 sm:grid-cols-2">
              {filtered.map((p) => {
                const sel = picks.includes(p.id);
                const disabled = !sel && picks.length >= 5;
                return (
                  <motion.button
                    key={p.id}
                    onClick={() => toggle(p.id)}
                    disabled={disabled}
                    whileTap={disabled ? undefined : { scale: 0.97 }}
                    transition={spring.snappy}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg border p-2.5 text-left transition focus-visible:border-white/40 focus-visible:outline-none disabled:cursor-default disabled:opacity-35"
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
                      {sel && <Check size={13} className="text-[#0a0c11]" />}
                    </div>
                    <PlayerAvatar player={p} size={28} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-white/85">{p.name}</div>
                      <div className="stat-num text-[10px] text-white/40">
                        {p.pos} · ${p.salary}M
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </Panel>
        </div>

        {/* GM dashboard */}
        <div className="space-y-4">
          <Reveal>
            <Panel title="Cap sheet">
              <div className="mb-2 flex items-end justify-between">
                <div>
                  <span className="stat-num text-3xl font-bold text-white">
                    ${payroll.toFixed(1)}M
                  </span>
                  <span className="stat-num ml-1.5 text-xs text-white/45">
                    / ${SALARY_CAP}M cap
                  </span>
                </div>
                {overCap ? (
                  <Badge color={gradeColor(0)} soft={false}>
                    <AlertTriangle size={11} /> Over cap
                  </Badge>
                ) : (
                  <Badge color={ACCENT}>${(SALARY_CAP - payroll).toFixed(1)}M room</Badge>
                )}
              </div>
              <Meter
                value={payroll}
                max={SALARY_CAP}
                color={overCap ? gradeColor(0) : ACCENT}
                height={12}
              />

              <div className="mt-4 space-y-1.5">
                {roster.length === 0 && (
                  <p className="py-3 text-center text-xs text-white/40">
                    Sign up to 5 players to build your roster.
                  </p>
                )}
                {roster.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5 text-xs"
                  >
                    <span className="flex min-w-0 items-center gap-2 text-white/80">
                      <PlayerAvatar player={p} size={24} />
                      <span className="truncate">
                        <span className="stat-num text-white/40">{p.pos}</span> {p.name}
                      </span>
                    </span>
                    <span className="stat-num shrink-0 text-white/55">${p.salary}M</span>
                  </div>
                ))}
              </div>
            </Panel>
          </Reveal>

          {breakdowns.length > 0 && (
            <Reveal delay={0.05}>
              <Panel
                title="Cap efficiency"
                right={
                  <span className="stat-num text-xs" style={{ color: gradeColor(avgBargain) }}>
                    avg bargain {avgBargain}
                  </span>
                }
              >
                <div className="space-y-3">
                  {breakdowns.map(({ player: p, value }) => (
                    <div key={p.id}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="truncate text-white/70">{p.name}</span>
                        <span className="stat-num text-white/40">
                          {value.productionPerDollar} prod/$M
                        </span>
                      </div>
                      <Meter
                        value={value.bargainScore}
                        color={gradeColor(value.bargainScore)}
                        height={6}
                      />
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-white/35">
                  Bargain score prices each signing&apos;s two-way production per salary dollar,
                  shaped by the age curve and games played — computed from real season stats.
                </p>
              </Panel>
            </Reveal>
          )}

          <AnimatePresence mode="wait">
          {score ? (
            <motion.div
              key="rating"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={spring.soft}
            >
              <Panel
                title="Roster rating"
                right={
                  <span
                    className="stat-num rounded-lg px-2 py-0.5 text-xs font-bold"
                    style={{
                      background: `${gradeColor(score.overall)}1f`,
                      color: gradeColor(score.overall),
                    }}
                  >
                    {letterGrade(score.overall)}
                  </span>
                }
              >
                <div className="flex justify-center">
                  <Gauge value={score.overall} label="Overall" color={gradeColor(score.overall)} />
                </div>
                <div className="mt-5 space-y-3.5">
                  <Meter label="Offense" valueLabel={`${score.scoring}`} value={score.scoring} color="#00E07F" />
                  <Meter label="Defense" valueLabel={`${score.defense}`} value={score.defense} color="#2BD68B" />
                  <Meter label="Playmaking" valueLabel={`${score.playmaking}`} value={score.playmaking} color="#D7BC6A" />
                  <Meter label="Spacing" valueLabel={`${score.spacing}`} value={score.spacing} color={STEEL} />
                  <Meter label="Balance" valueLabel={`${score.balance}`} value={score.balance} color="#F4647D" />
                </div>
              </Panel>
            </motion.div>
          ) : (
            <motion.div
              key="placeholder"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={spring.soft}
            >
              <Panel className="flex min-h-[180px] flex-col items-center justify-center text-center">
                <LayoutGrid size={32} className="mb-3" style={{ color: ACCENT }} />
                <p className="text-sm text-white/50">
                  {5 - roster.length} more {5 - roster.length === 1 ? "signing" : "signings"} to lock
                  your starting five.
                </p>
              </Panel>
            </motion.div>
          )}
          </AnimatePresence>

          {score && (
            <Reveal delay={0.1}>
              <Insight accent={ACCENT}>
                {overCap ? (
                  <>
                    Star-studded but <b>${(payroll - SALARY_CAP).toFixed(1)}M over the cap</b>. A real
                    GM would need a trade exception or to shed salary —{" "}
                  </>
                ) : (
                  <>
                    Built <b>${(SALARY_CAP - payroll).toFixed(1)}M under the cap</b> with flexibility to
                    spare —{" "}
                  </>
                )}
                this five grades{" "}
                <b>
                  {letterGrade(score.overall)} ({score.overall})
                </b>
                , {score.defense >= score.scoring ? "anchored on defense" : "leaning on offense"} with{" "}
                {score.balance >= 55 ? "clean role balance" : "some usage to untangle"}.
              </Insight>
            </Reveal>
          )}
        </div>
      </div>

      <div className="mt-8 space-y-3">
        <div>
          <div className="kicker" style={{ color: "#2BD68B" }}>Model track record</div>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            Each season since 2003, the player ratings behind the roster grades are checked against what those players produced the next year — the bars show that season-by-season correlation (about r=0.89).
          </p>
        </div>
        <TrackRecord slug="roster-builder" accent="#2BD68B" />
      </div>
    </ToolShell>
  );
}
