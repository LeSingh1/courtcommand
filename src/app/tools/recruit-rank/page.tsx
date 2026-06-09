"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GraduationCap, Star } from "lucide-react";
import { spring } from "@/lib/motion";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { Slider, Field, TextInput, Segmented } from "@/components/ui/Controls";
import { Gauge } from "@/components/ui/Gauge";
import { RadarChart } from "@/components/ui/RadarChart";
import { Reveal } from "@/components/ui/Reveal";
import { AnalyzeOverlay, useAnalyze } from "@/components/ui/Analyze";
import { getTool } from "@/lib/tools";
import { recruitRank, type RecruitInput, type RecruitResult } from "@/lib/engine/content";
import { letterGrade } from "@/lib/cn";

const GOLD = "#C9A14A";
const POSITIONS = ["PG", "SG", "SF", "PF", "C"] as const;

function heightLabel(inches: number) {
  const ft = Math.floor(inches / 12);
  const inch = inches % 12;
  return `${ft}'${inch}"`;
}

export default function RecruitRankPage() {
  const tool = getTool("recruit-rank")!;
  const [name, setName] = useState("Jalen Carter");
  const [ppg, setPpg] = useState(22);
  const [rpg, setRpg] = useState(7);
  const [apg, setApg] = useState(5);
  const [heightIn, setHeightIn] = useState(78);
  const [position, setPosition] = useState<string>("SG");
  const [level, setLevel] = useState<RecruitInput["level"]>("Varsity");
  const [result, setResult] = useState<RecruitResult | null>(null);

  const analyze = useAnalyze([
    "Verifying stats…",
    "Comparing to prospects…",
    "Projecting upside…",
    "Writing report…",
  ]);

  const run = () => {
    analyze.run(() => {
      setResult(
        recruitRank({
          name: name.trim() || "Unnamed Prospect",
          ppg,
          rpg,
          apg,
          heightIn,
          position,
          level,
        }),
      );
    });
  };

  return (
    <ToolShell tool={tool}>
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Profile form */}
        <Panel title="Prospect profile">
          <div className="space-y-5">
            <Field label="Player name">
              <TextInput value={name} onChange={setName} placeholder="First Last" />
            </Field>
            <Slider label="Points per game" value={ppg} min={0} max={40} unit=" ppg" onChange={setPpg} accent={GOLD} />
            <Slider label="Rebounds per game" value={rpg} min={0} max={20} unit=" rpg" onChange={setRpg} accent={GOLD} />
            <Slider label="Assists per game" value={apg} min={0} max={15} unit=" apg" onChange={setApg} accent={GOLD} />
            <Slider
              label={`Height — ${heightLabel(heightIn)}`}
              value={heightIn}
              min={66}
              max={86}
              unit='"'
              onChange={setHeightIn}
              accent={GOLD}
            />
            <Field label="Position">
              <div className="flex flex-wrap gap-1.5">
                {POSITIONS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPosition(p)}
                    className="rounded-none px-3 py-1.5 text-xs font-medium transition"
                    style={
                      position === p
                        ? { background: GOLD, color: "#160600" }
                        : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)" }
                    }
                  >
                    {p}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Competition level">
              <Segmented
                accent={GOLD}
                value={level}
                onChange={setLevel}
                options={[
                  { label: "Varsity", value: "Varsity" },
                  { label: "AAU", value: "AAU" },
                  { label: "Prep", value: "Prep" },
                ]}
              />
            </Field>
            <motion.button
              onClick={run}
              whileTap={{ scale: 0.96 }}
              transition={spring.snappy}
              className="w-full rounded-none py-3 text-sm font-semibold transition"
              style={{ background: GOLD, color: "#160600" }}
            >
              Generate profile
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
              <AnalyzeOverlay steps={analyze.steps} stepIdx={analyze.stepIdx} accent={GOLD} />
            </motion.div>
          ) : result ? (
            <motion.div
              key="result"
              className="space-y-6"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={spring.soft}
            >
              {/* Recruiting card */}
              <Reveal>
                <div className="glass relative overflow-hidden rounded-none p-6">
                  <div className="relative grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
                    <div className="flex flex-col items-center">
                      <Gauge value={result.grade} color={GOLD} label="Grade" />
                      <div className="mt-2 stat-num text-sm font-semibold" style={{ color: GOLD }}>
                        {letterGrade(result.grade)}
                      </div>
                    </div>
                    <div>
                      <div className="eyebrow mb-1" style={{ color: GOLD }}>
                        {position} · {heightLabel(heightIn)} · {level}
                      </div>
                      <h2 className="display text-3xl text-white">{name.trim() || "Unnamed Prospect"}</h2>
                      <div className="mt-3 flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <span key={i}>
                            <Star
                              size={26}
                              strokeWidth={1.5}
                              style={{
                                color: GOLD,
                                fill: i < result.stars ? GOLD : "transparent",
                                opacity: i < result.stars ? 1 : 0.3,
                              }}
                            />
                          </span>
                        ))}
                        <span className="ml-2 stat-num text-sm text-white/55">{result.stars}-star</span>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <span
                          className="stat-num rounded-full px-3 py-1 text-xs font-bold"
                          style={{ background: `${GOLD}1f`, color: GOLD, border: `1px solid ${GOLD}33` }}
                        >
                          #{result.nationalRank} nationally
                        </span>
                        <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs text-white/70">
                          Comp: {result.comp}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Reveal>

              <div className="grid gap-6 md:grid-cols-2">
                <Panel title="Attribute profile" className="flex flex-col items-center">
                  <RadarChart
                    axes={result.attributes.map((a) => a.label)}
                    series={[
                      {
                        name: name.trim() || "Prospect",
                        color: GOLD,
                        values: result.attributes.map((a) => a.value),
                      },
                    ]}
                  />
                </Panel>
                <Panel title="Attribute breakdown">
                  <div className="space-y-3">
                    {result.attributes.map((a, i) => (
                      <Reveal key={a.label} delay={i * 0.05}>
                        <div className="flex items-center gap-3">
                          <span className="w-24 shrink-0 text-xs text-white/60">{a.label}</span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${a.value}%`, background: GOLD }}
                            />
                          </div>
                          <span className="stat-num w-8 text-right text-xs font-semibold text-white/80">
                            {Math.round(a.value)}
                          </span>
                        </div>
                      </Reveal>
                    ))}
                  </div>
                </Panel>
              </div>

              <Insight accent={GOLD}>{result.report}</Insight>
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
                <GraduationCap size={40} style={{ color: GOLD }} />
              </div>
              <p className="max-w-xs text-sm text-white/50">
                Fill in the prospect&apos;s stats, height, position, and level, then generate a
                recruiting-grade profile with star rating, national rank, and a scouting report.
              </p>
            </Panel>
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </div>
    </ToolShell>
  );
}
