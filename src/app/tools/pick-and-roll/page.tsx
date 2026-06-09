"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Workflow } from "lucide-react";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { PlayerPicker } from "@/components/ui/PlayerPicker";
import { Meter } from "@/components/ui/Meter";
import { Badge } from "@/components/ui/Controls";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Reveal } from "@/components/ui/Reveal";
import { getTool } from "@/lib/tools";
import { getPlayer, getPlayerByName } from "@/lib/data";
import { pickAndRoll, type PnRResult } from "@/lib/engine/teams";
import { gradeColor } from "@/lib/cn";
import { spring } from "@/lib/motion";
import type { Player } from "@/lib/types";

const ACCENT = "#E0561F";
const LEAGUE_AVG = 1.0;

export default function PickAndRollPage() {
  const tool = getTool("pick-and-roll")!;
  const [handler, setHandler] = useState<Player | null>(() => getPlayerByName("Luka Doncic") ?? null);
  const [roller, setRoller] = useState<Player | null>(null);

  const result: PnRResult | null = useMemo(
    () => (handler && roller ? pickAndRoll(handler, roller) : null),
    [handler, roller],
  );

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
            accent="#7E8CA0"
            exclude={handler ? [handler.id] : []}
            placeholder="Pick the roll-man…"
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
      {!result ? (
        <Panel className="flex min-h-[300px] flex-col items-center justify-center text-center">
          <Workflow size={40} className="mb-4" style={{ color: ACCENT }} />
          <p className="max-w-sm text-sm text-white/50">
            Pair a ball-handler with a roll-man and the analyzer grades the two-man game by points
            per possession, turnover rate, shot quality, and fouls drawn.
          </p>
        </Panel>
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
                    <div className="mt-1 text-[11px] uppercase tracking-widest text-white/45">
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
              </Panel>
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
                color={result.turnoverRate <= 12 ? "#5FA97E" : "#BF5B4E"}
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
                color="#C9A14A"
              />
            </div>
          </Reveal>
        </motion.div>
      )}
      </AnimatePresence>
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
    <div className="glass rounded-none p-5">
      <div className="text-[10px] uppercase tracking-widest text-white/45">{label}</div>
      <AnimatedNumber
        value={value}
        decimals={decimals}
        suffix={suffix}
        className="stat-num mt-1 block text-3xl font-bold"
      />
      <div className="mt-3">
        <Meter
          value={invert ? 22 - value : value}
          max={invert ? 22 : 100}
          color={color}
          height={6}
        />
      </div>
    </div>
  );
}
