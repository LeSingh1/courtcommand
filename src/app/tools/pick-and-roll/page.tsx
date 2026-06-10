"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Workflow } from "lucide-react";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { PlayerPicker } from "@/components/ui/PlayerPicker";
import { Meter } from "@/components/ui/Meter";
import { Badge } from "@/components/ui/Controls";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Reveal } from "@/components/ui/Reveal";
import { TrackRecord } from "@/components/ui/TrackRecord";
import { getTool } from "@/lib/tools";
import { getPlayer, getPlayerByName } from "@/lib/data";
import { pickAndRoll, type PnRResult } from "@/lib/engine/teams";
import { gradeColor } from "@/lib/cn";
import { spring } from "@/lib/motion";
import type { Player } from "@/lib/types";

const ACCENT = "#4D8DFF";
const LEAGUE_AVG = 1.0;
// Mirrors the engine's clamp(turnoverRate, 6, 22) ceiling in pickAndRoll().
const TURNOVER_CEILING = 22;

export default function PickAndRollPage() {
  const tool = getTool("pick-and-roll")!;
  const [handler, setHandler] = useState<Player | null>(() => getPlayerByName("Luka Doncic") ?? null);
  const [roller, setRoller] = useState<Player | null>(null);

  const result: PnRResult | null = useMemo(
    () => (handler && roller ? pickAndRoll(handler, roller) : null),
    [handler, roller],
  );

  const [phase, setPhase] = useState<"idle" | "analyzing" | "ready">("idle");
  useEffect(() => {
    if (!result) {
      setPhase("idle");
      return;
    }
    setPhase("analyzing");
    const t = setTimeout(() => setPhase("ready"), 650);
    return () => clearTimeout(t);
  }, [result]);

  return (
    <ToolShell tool={tool}>
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-1.5 text-xs font-medium text-white/60">Ball-handler</div>
          <PlayerPicker
            value={handler}
            onChange={setHandler}
            accent={ACCENT}
            exclude={roller ? [roller.id] : []}
            placeholder="Pick the ball-handler…"
          />
        </div>
        <div>
          <div className="mb-1.5 text-xs font-medium text-white/60">Roll-man</div>
          <PlayerPicker
            value={roller}
            onChange={setRoller}
            accent="#6B6E78"
            exclude={handler ? [handler.id] : []}
            placeholder="Pick the roll-man…"
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
      {!result ? (
        <motion.div
          key="idle"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={spring.soft}
        >
          <Panel className="flex min-h-[300px] flex-col items-center justify-center text-center">
            <Workflow size={40} className="mb-4" style={{ color: ACCENT }} />
            <p className="max-w-sm text-sm text-white/50">
              Pair a ball-handler with a roll-man and the analyzer grades the two-man game by points
              per possession, turnover rate, shot quality, and fouls drawn.
            </p>
          </Panel>
        </motion.div>
      ) : phase === "analyzing" ? (
        <motion.div
          key="analyzing"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={spring.soft}
        >
          <Panel className="min-h-[300px]">
            <div className="flex items-center gap-3 border-b border-[var(--line)] pb-3">
              <Workflow size={18} className="animate-pulse" style={{ color: ACCENT }} />
              <span className="text-xs font-semibold text-[var(--text-muted)]">
                Grading the two-man game…
              </span>
            </div>
            <div className="mt-5 space-y-4">
              {["Handler creation", "Roll-man finishing", "Spacing gravity", "Ball security"].map(
                (label) => (
                  <div key={label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--text-faint)]">{label}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden bg-[rgba(255,255,255,0.06)]">
                      <div className="h-full w-1/3 animate-pulse bg-white/15" />
                    </div>
                  </div>
                ),
              )}
            </div>
          </Panel>
        </motion.div>
      ) : (
        <motion.div
          key={`${handler!.id}-${roller!.id}`}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={spring.soft}
          className="grid gap-6 lg:grid-cols-[1fr_320px]"
        >
          <div className="space-y-6">
            <Reveal>
              <Panel
                title="Possession efficiency"
                right={
                  <Badge color={gradeColor((result.ppp - 0.78) * 180 + 20)} soft={false}>
                    {result.grade}
                  </Badge>
                }
              >
                <div className="flex flex-wrap items-end gap-6">
                  <div>
                    <AnimatedNumber
                      value={result.ppp}
                      decimals={2}
                      className="stat-num text-6xl font-bold"
                    />
                    <div className="mt-1 text-[11px] text-white/45">
                      Points per possession
                    </div>
                  </div>
                  <div className="flex-1 pb-1">
                    <Meter
                      value={result.ppp}
                      max={1.4}
                      color={gradeColor((result.ppp - 0.78) * 180 + 20)}
                      height={10}
                    />
                    <div className="mt-1.5 flex justify-between text-[10px] text-white/35">
                      <span>0.80</span>
                      <span>league avg {LEAGUE_AVG.toFixed(2)}</span>
                      <span>1.40</span>
                    </div>
                  </div>
                </div>
              </Panel>
            </Reveal>

            <Reveal delay={0.06}>
              <Panel title="What drives it">
                <div className="space-y-4">
                  {result.breakdown.map((b) => (
                    <Meter
                      key={b.label}
                      label={b.label}
                      valueLabel={`${Math.round(b.value)}`}
                      value={b.value}
                      color={b.color}
                    />
                  ))}
                </div>
                <div className="mt-4 space-y-4 border-t border-[var(--line)] pt-4">
                  <Meter
                    label="Lob threat"
                    valueLabel={`${result.lob_rate}`}
                    value={result.lob_rate}
                    color={ACCENT}
                  />
                  <Meter
                    label="Short-roll game"
                    valueLabel={`${result.short_roll_efficiency}`}
                    value={result.short_roll_efficiency}
                    color="#D7BC6A"
                  />
                  <p className="text-[11px] leading-relaxed text-white/40">
                    Lob threat = the roll-man's rim share scaled by the handler's assist volume;
                    short-roll game = the roll-man's passing, mid-range touch, and finishing — both
                    0-100 proxies computed from the same season stats as everything else here.
                  </p>
                </div>
              </Panel>
            </Reveal>

            <Reveal delay={0.08}>
              <Insight accent="#D7BC6A">{result.tactical_explanation}</Insight>
            </Reveal>

            <Reveal delay={0.1}>
              <Insight accent={ACCENT}>
                <b>
                  {handler!.name} → {roller!.name}
                </b>{" "}
                projects to{" "}
                <b>{result.ppp.toFixed(2)} PPP</b> —{" "}
                {result.ppp >= LEAGUE_AVG ? (
                  <>
                    <b>{Math.round((result.ppp - LEAGUE_AVG) * 100)} points</b> per 100 possessions
                    above the ~1.00 league-average PnR. Elite, defenses have to load up.
                  </>
                ) : (
                  <>
                    <b>{Math.round((LEAGUE_AVG - result.ppp) * 100)} points</b> per 100 below the
                    ~1.00 league average — a serviceable action, not a primary one.
                  </>
                )}
              </Insight>
            </Reveal>
          </div>

          <Reveal delay={0.04}>
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              <StatCard
                label="Turnover rate"
                value={result.turnoverRate}
                suffix="%"
                decimals={1}
                color={result.turnoverRate <= 12 ? "#4D8DFF" : "#F4647D"}
                invert
              />
              <StatCard
                label="Shot quality"
                value={result.shotQuality}
                color={gradeColor(result.shotQuality)}
              />
              <StatCard
                label="Fouls drawn / 100"
                value={result.foulsDrawn}
                decimals={1}
                color="#D7BC6A"
              />
            </div>
          </Reveal>
        </motion.div>
      )}
      </AnimatePresence>

      <div className="mt-8 space-y-3">
        <div>
          <div className="kicker" style={{ color: "#4D8DFF" }}>Model track record</div>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">Each season since 2003, the playmaking and finishing ratings behind these grades are tested against what those players produced the following year — the bars show that year-over-year correlation (about r=0.89).</p>
        </div>
        <TrackRecord slug="pick-and-roll" accent="#4D8DFF" />
      </div>
    </ToolShell>
  );
}

function StatCard({
  label,
  value,
  suffix = "",
  decimals = 0,
  color,
  invert,
}: {
  label: string;
  value: number;
  suffix?: string;
  decimals?: number;
  color: string;
  invert?: boolean;
}) {
  return (
    <div className="border border-[var(--line)] bg-[var(--surface)] p-5 transition-colors duration-200 hover:border-[var(--line-strong)]">
      <div className="text-[10px] text-white/45">{label}</div>
      <AnimatedNumber
        value={value}
        decimals={decimals}
        suffix={suffix}
        className="stat-num mt-1 block text-3xl font-bold"
      />
      <div className="mt-3">
        <Meter
          // Inverted (turnover) meters fill more as the rate worsens; keep a
          // small floor so the worst case (engine clamp ceiling) still shows a
          // sliver instead of an empty "no data" bar.
          value={invert ? Math.max(2, TURNOVER_CEILING + 2 - value) : value}
          max={invert ? TURNOVER_CEILING + 2 : 100}
          color={color}
          height={6}
        />
      </div>
    </div>
  );
}
