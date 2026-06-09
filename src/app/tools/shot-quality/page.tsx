"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crosshair, TrendingUp, TrendingDown } from "lucide-react";
import { spring } from "@/lib/motion";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { Gauge } from "@/components/ui/Gauge";
import { Segmented, Slider, Field } from "@/components/ui/Controls";
import { AnalyzeOverlay, useAnalyze } from "@/components/ui/Analyze";
import { CourtChart } from "@/components/ui/CourtChart";
import { getTool } from "@/lib/tools";
import { shotQuality, type ShotType, type ShotQualityResult } from "@/lib/engine/game";
import { gradeColor } from "@/lib/cn";

const SHOT_TYPES: { label: string; value: ShotType }[] = [
  { label: "Rim", value: "rim" },
  { label: "Floater", value: "floater" },
  { label: "Mid", value: "midrange" },
  { label: "Catch 3", value: "catch3" },
  { label: "Pull-up 3", value: "pullup3" },
  { label: "Stepback 3", value: "stepback3" },
];

const SHOT_POS: Record<ShotType, { x: number; y: number }> = {
  rim: { x: 250, y: 80 },
  floater: { x: 250, y: 150 },
  midrange: { x: 360, y: 175 },
  catch3: { x: 60, y: 95 },
  pullup3: { x: 250, y: 320 },
  stepback3: { x: 410, y: 245 },
};

export default function ShotQualityPage() {
  const tool = getTool("shot-quality")!;
  const [shotType, setShotType] = useState<ShotType>("catch3");
  const [defenderDist, setDefenderDist] = useState(5);
  const [shotClock, setShotClock] = useState(12);
  const [dribbles, setDribbles] = useState(0);
  const [touchTime, setTouchTime] = useState(2);
  const [result, setResult] = useState<ShotQualityResult | null>(null);
  const analyze = useAnalyze([
    "Locating shot on court…",
    "Modeling defender contest…",
    "Adjusting for clock & rhythm…",
    "Computing expected points…",
  ]);

  const run = () => {
    analyze.run(() => {
      setResult(
        shotQuality({
          shotType,
          defenderDist,
          shotClock,
          dribbles,
          touchTime,
          isCatchAndShoot: dribbles === 0,
          period: 1,
        }),
      );
    });
  };

  const pos = SHOT_POS[shotType];

  return (
    <ToolShell tool={tool}>
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Controls */}
        <Panel title="Shot inputs">
          <div className="space-y-5">
            <Field label="Shot type">
              <div className="flex flex-wrap gap-1.5">
                {SHOT_TYPES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setShotType(s.value)}
                    className="rounded-none px-3 py-1.5 text-xs font-medium transition"
                    style={
                      shotType === s.value
                        ? { background: tool.accent === "ember" ? "#E0561F" : "#E0561F", color: "#160600" }
                        : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)" }
                    }
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </Field>
            <Slider label="Defender distance" value={defenderDist} min={0} max={12} unit=" ft" onChange={setDefenderDist} />
            <Slider label="Shot clock" value={shotClock} min={1} max={24} unit=" s" onChange={setShotClock} />
            <Slider label="Dribbles before shot" value={dribbles} min={0} max={8} onChange={setDribbles} />
            <Slider label="Touch time" value={touchTime} min={0} max={8} unit=" s" onChange={setTouchTime} />
            <motion.button
              onClick={run}
              whileTap={{ scale: 0.96 }}
              transition={spring.snappy}
              className="btn-ember w-full rounded-none py-3 text-sm"
            >
              Grade this shot
            </motion.button>
          </div>
        </Panel>

        {/* Result */}
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
              <AnalyzeOverlay steps={analyze.steps} stepIdx={analyze.stepIdx} />
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
              <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
                <Panel className="flex flex-col items-center justify-center">
                  <Gauge value={result.qSQ} label="Shot Quality" color={gradeColor(result.qSQ)} suffix="" />
                  <div className="mt-3 text-center">
                    <div className="text-sm font-semibold text-white">{result.rating}</div>
                    <div className="stat-num mt-1 text-xs text-white/45">
                      {result.expFg}% expected · {result.expPoints} pts/shot
                    </div>
                  </div>
                </Panel>
                <Panel title="Quality drivers">
                  <div className="space-y-3">
                    {result.drivers.map((d) => {
                      const pos = d.impact >= 0;
                      return (
                        <div key={d.label} className="flex items-center gap-3">
                          <span className="flex-1 text-sm text-white/70">{d.label}</span>
                          <div className="flex w-32 items-center justify-center">
                            <div className="relative h-2 w-full rounded-full bg-white/[0.06]">
                              <div className="absolute left-1/2 top-0 h-full w-px bg-white/20" />
                              <div
                                className="absolute top-0 h-full rounded-full"
                                style={{
                                  background: pos ? "#5FA97E" : "#BF5B4E",
                                  width: `${Math.min(50, Math.abs(d.impact) * 400)}%`,
                                  left: pos ? "50%" : `${50 - Math.min(50, Math.abs(d.impact) * 400)}%`,
                                }}
                              />
                            </div>
                          </div>
                          <span
                            className="stat-num flex w-14 items-center justify-end gap-1 text-xs font-semibold"
                            style={{ color: pos ? "#5FA97E" : "#BF5B4E" }}
                          >
                            {pos ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                            {pos ? "+" : ""}
                            {(d.impact * 100).toFixed(1)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </Panel>
              </div>
              <Insight accent="#E0561F">
                A {result.rating.toLowerCase()} worth <b>{result.expPoints} expected points</b>. The
                biggest factor was <b>{result.drivers[0].label.toLowerCase()}</b>. League-average
                halfcourt shots sit near 1.04 pts/shot — this look {result.expPoints >= 1.04 ? "beats" : "trails"} that
                baseline.
              </Insight>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={spring.soft}
            >
              <Panel className="flex h-full min-h-[320px] flex-col items-center justify-center text-center">
                <div className="mb-4">
                  <Crosshair size={40} className="text-ember" />
                </div>
                <p className="max-w-xs text-sm text-white/50">
                  Set the shot context on the left and grade its expected value. The dot shows where the
                  attempt comes from.
                </p>
              </Panel>
            </motion.div>
          )}
          </AnimatePresence>

          <Panel title="Shot location">
            <CourtChart
              shots={[{ x: pos.x, y: pos.y, made: true, r: 9 }]}
              showShots
              height={300}
            />
          </Panel>
        </div>
      </div>
    </ToolShell>
  );
}
