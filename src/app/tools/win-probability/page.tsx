"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Activity } from "lucide-react";
import { staggerParent, staggerItem, spring } from "@/lib/motion";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { Slider, Segmented, Field } from "@/components/ui/Controls";
import { Meter } from "@/components/ui/Meter";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { LineChart } from "@/components/ui/LineChart";
import { getTool } from "@/lib/tools";
import { winProbability, winProbCurve } from "@/lib/engine/game";

const CYAN = "#7E8CA0";

const STRENGTHS: { label: string; value: string }[] = [
  { label: "Underdog", value: "-4" },
  { label: "Even", value: "0" },
  { label: "Favorite", value: "4" },
];

function fmtClock(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function WinProbabilityPage() {
  const tool = getTool("win-probability")!;
  const [margin, setMargin] = useState(3);
  const [secondsLeft, setSecondsLeft] = useState(360);
  const [homeStrengthStr, setHomeStrengthStr] = useState("0");
  const [homeHasBall, setHomeHasBall] = useState(true);

  const homeStrength = Number(homeStrengthStr);

  const wp = useMemo(
    () => winProbability({ margin, secondsLeft, homeHasBall, homeStrength }),
    [margin, secondsLeft, homeHasBall, homeStrength],
  );

  const curve = useMemo(() => winProbCurve(homeStrength), [homeStrength]);
  const labels = curve.t.map((m) => (m % 12 === 0 ? `${m}'` : ""));

  return (
    <ToolShell tool={tool}>
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Controls */}
        <Panel title="Game state">
          <div className="space-y-5">
            <Slider label="Home margin" value={margin} min={-20} max={20} accent={CYAN} onChange={setMargin} />
            <div>
              <Slider
                label="Time left"
                value={secondsLeft}
                min={0}
                max={2880}
                step={30}
                accent={CYAN}
                onChange={setSecondsLeft}
              />
              <div className="stat-num mt-1 text-right text-[11px] text-white/40">
                {fmtClock(secondsLeft)} remaining
              </div>
            </div>
            <Field label="Home team strength">
              <Segmented
                accent={CYAN}
                value={homeStrengthStr}
                onChange={setHomeStrengthStr}
                options={STRENGTHS}
              />
            </Field>
            <Field label="Possession">
              <Segmented
                accent={CYAN}
                value={homeHasBall ? "home" : "away"}
                onChange={(v) => setHomeHasBall(v === "home")}
                options={[
                  { label: "Home has ball", value: "home" },
                  { label: "Away has ball", value: "away" },
                ]}
              />
            </Field>
          </div>
        </Panel>

        {/* Result */}
        <div className="space-y-6">
          <Panel>
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <div className="eyebrow mb-1" style={{ color: CYAN }}>
                Home Win Probability
              </div>
              <div className="display text-6xl" style={{ color: CYAN }}>
                <AnimatedNumber value={wp} decimals={1} suffix="%" />
              </div>
              <div className="stat-num mt-1 text-xs text-white/45">
                Away {(100 - wp).toFixed(1)}% · {homeHasBall ? "home" : "away"} ball · {fmtClock(secondsLeft)} left
              </div>
              <div className="mt-5 w-full max-w-md">
                <Meter value={wp} color={CYAN} height={10} />
                <div className="mt-1.5 flex justify-between text-[10px] uppercase tracking-wide text-white/35">
                  <span>Away</span>
                  <span>Home</span>
                </div>
              </div>
            </div>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
            <Panel title="Full-game WP curve">
              <LineChart
                series={[{ name: "Home", color: CYAN, points: curve.home }]}
                labels={labels}
                yMin={0}
                yMax={100}
                yLabel="Home WP %"
                height={220}
              />
            </Panel>
            <Panel title="Game events">
              <motion.div
                className="space-y-2.5"
                variants={staggerParent}
                initial="initial"
                animate="animate"
              >
                {curve.events.map((e) => (
                  <motion.div
                    key={e.t}
                    variants={staggerItem}
                    whileHover={{ y: -3 }}
                    transition={spring.snappy}
                    className="flex items-center gap-2.5 rounded-none border border-white/[0.07] bg-white/[0.03] px-3 py-2"
                  >
                    <span
                      className="stat-num flex h-6 w-9 shrink-0 items-center justify-center rounded text-[10px] font-bold"
                      style={{ background: `${CYAN}1f`, color: CYAN }}
                    >
                      {e.t}'
                    </span>
                    <span className="text-xs text-white/70">{e.label}</span>
                  </motion.div>
                ))}
                <div className="stat-num pt-1 text-[11px] text-white/40">
                  Final-minute home WP: {curve.home[curve.home.length - 1]}%
                </div>
              </motion.div>
            </Panel>
          </div>

          <Insight accent={CYAN}>
            With a <b>{margin >= 0 ? "+" : ""}{margin}</b> margin and <b>{fmtClock(secondsLeft)}</b> left, the
            home side projects to <b>{wp.toFixed(1)}%</b>.{" "}
            {homeHasBall ? "Holding possession adds late-game leverage." : "The away team controls the next possession."}{" "}
            {Math.abs(margin) <= 3 && secondsLeft <= 300
              ? "This is firmly clutch territory — every possession swings the odds."
              : "Time and margin still leave room for swings."}
          </Insight>
        </div>
      </div>
    </ToolShell>
  );
}
