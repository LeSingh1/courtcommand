"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Dumbbell, Flame, Plus, Target, Clock } from "lucide-react";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { Slider, Field, Segmented, Badge } from "@/components/ui/Controls";
import { BarChart } from "@/components/ui/BarChart";
import { Meter } from "@/components/ui/Meter";
import { Reveal } from "@/components/ui/Reveal";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { getTool } from "@/lib/tools";
import { spring } from "@/lib/motion";
import {
  consistencyScore,
  skillBalance,
  trainingBadges,
  weeklySummary,
  BADGE_THRESHOLDS,
} from "@/lib/engine/betting";

const ACCENT = "#F4647D";
const TIME = "#41C7E0";

type SessionType = "Shooting" | "Conditioning" | "Strength" | "Skills";

interface Session {
  id: number;
  day: string;
  type: SessionType;
  reps: number;
  minutes: number;
}

const TYPE_COLOR: Record<SessionType, string> = {
  Shooting: "#D7BC6A",
  Conditioning: "#41C7E0",
  Strength: "#4D8DFF",
  Skills: "#4D8DFF",
};

interface RepBenchmark {
  label: string;
  reps: number;
  desc: string;
}

interface MinuteBenchmark {
  label: string;
  minutes: number;
  desc: string;
}

type BenchmarkEntry = RepBenchmark | MinuteBenchmark;

const BENCHMARKS: Record<SessionType, BenchmarkEntry[]> = {
  Shooting: [
    { label: "Elite shooter", reps: 500, desc: "500+ makes/session" },
    { label: "Program starter", reps: 300, desc: "300 makes — consistent volume" },
    { label: "Development level", reps: 150, desc: "150 makes — building habit" },
  ],
  Conditioning: [
    { label: "Pro fitness", minutes: 60, desc: "60+ min cardio sessions" },
    { label: "College ready", minutes: 40, desc: "40 min — baseline aerobic base" },
    { label: "Active recovery", minutes: 20, desc: "20 min — maintenance pace" },
  ],
  Strength: [
    { label: "High-volume lifter", reps: 100, desc: "100+ reps (compound sets)" },
    { label: "Balanced work", reps: 60, desc: "60 reps — strength + mobility" },
    { label: "Entry level", reps: 30, desc: "30 reps — foundation phase" },
  ],
  Skills: [
    { label: "Elite ball-handler", reps: 300, desc: "300+ reps — game-speed work" },
    { label: "Developing guard", reps: 160, desc: "160 reps — consistent skill reps" },
    { label: "Foundation", reps: 80, desc: "80 reps — learning movements" },
  ],
};

function getBenchmarkValue(b: BenchmarkEntry): number {
  return "reps" in b ? b.reps : b.minutes;
}

const SEED: Session[] = [
  { id: 1, day: "Mon", type: "Shooting", reps: 240, minutes: 55 },
  { id: 2, day: "Tue", type: "Conditioning", reps: 0, minutes: 40 },
  { id: 3, day: "Wed", type: "Skills", reps: 160, minutes: 50 },
  { id: 4, day: "Thu", type: "Strength", reps: 90, minutes: 45 },
  { id: 5, day: "Fri", type: "Shooting", reps: 300, minutes: 60 },
];

const REP_GOAL = 1000;
const MIN_GOAL = 300;

export default function TrainingTrackerPage() {
  const tool = getTool("training-tracker")!;
  const [sessions, setSessions] = useState<Session[]>([...SEED].reverse());
  const [type, setType] = useState<SessionType>("Shooting");
  const [reps, setReps] = useState(150);
  const [minutes, setMinutes] = useState(45);
  const [nextId, setNextId] = useState(6);
  const [saving, setSaving] = useState(false);

  const totalReps = useMemo(() => sessions.reduce((a, s) => a + s.reps, 0), [sessions]);
  const totalMinutes = useMemo(() => sessions.reduce((a, s) => a + s.minutes, 0), [sessions]);
  const activeDays = useMemo(() => new Set(sessions.map((s) => s.day)).size, [sessions]);
  const consistency = useMemo(() => consistencyScore(sessions), [sessions]);
  const balance = useMemo(() => skillBalance(sessions), [sessions]);
  const badges = useMemo(() => trainingBadges(sessions), [sessions]);
  const summary = useMemo(() => weeklySummary(sessions), [sessions]);

  const recent = useMemo(() => [...sessions].slice(0, 6).reverse(), [sessions]);

  const currentBenchmarks = BENCHMARKS[type];
  const benchmarkMax = Math.max(...currentBenchmarks.map(getBenchmarkValue));
  const userValue = type === "Conditioning" ? minutes : reps;

  const highlightedTier = useMemo(() => {
    let best: BenchmarkEntry | null = null;
    for (const b of currentBenchmarks) {
      const val = getBenchmarkValue(b);
      if (userValue >= val) {
        if (!best || val > getBenchmarkValue(best)) best = b;
      }
    }
    return best;
  }, [currentBenchmarks, userValue]);

  const addSession = () => {
    if (saving) return;
    setSaving(true);
    const day = new Date().toLocaleDateString("en-US", { weekday: "short" });
    window.setTimeout(() => {
      setSessions((prev) => [{ id: nextId, day, type, reps, minutes }, ...prev]);
      setNextId((n) => n + 1);
      setSaving(false);
    }, 300);
  };

  return (
    <ToolShell tool={tool}>
      {/* Top stat strip */}
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Reveal>
          <div className="glass rounded-lg p-5">
            <div className="flex items-center gap-2 text-white/55">
              <Flame size={16} style={{ color: ACCENT }} />
              <span className="text-xs">Active days</span>
            </div>
            <AnimatedNumber value={activeDays} className="scoreboard mt-2 block text-5xl" />
            <p className="mt-1 text-xs text-white/45">
              Distinct days logged this week — {consistency}% consistency.
            </p>
          </div>
        </Reveal>
        <Reveal delay={0.06}>
          <div className="glass rounded-lg p-5">
            <div className="flex items-center gap-2 text-white/55">
              <Target size={16} style={{ color: "#D7BC6A" }} />
              <span className="text-xs">Total reps</span>
            </div>
            <span style={{ color: "#D7BC6A" }}>
              <AnimatedNumber value={totalReps} className="scoreboard mt-2 block text-5xl" />
            </span>
            <p className="mt-1 text-xs text-white/45">Makes & finishes across all sessions.</p>
          </div>
        </Reveal>
        <Reveal delay={0.12}>
          <div className="glass rounded-lg p-5">
            <div className="flex items-center gap-2 text-white/55">
              <Clock size={16} style={{ color: TIME }} />
              <span className="text-xs">Total minutes</span>
            </div>
            <span style={{ color: TIME }}>
              <AnimatedNumber value={totalMinutes} suffix=" min" className="scoreboard mt-2 block text-5xl" />
            </span>
            <p className="mt-1 text-xs text-white/45">Time in the gym this week.</p>
          </div>
        </Reveal>
        <Reveal delay={0.18}>
          <div className="glass rounded-lg p-5">
            <div className="flex items-center gap-2 text-white/55">
              <Flame size={16} style={{ color: ACCENT }} />
              <span className="text-xs">Current streak</span>
            </div>
            <span style={{ color: ACCENT }}>
              <AnimatedNumber value={activeDays} className="scoreboard mt-2 block text-5xl" />
            </span>
            <p className="mt-1 text-xs text-white/45">Consecutive active days this week.</p>
          </div>
        </Reveal>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* Add session form */}
        <div className="space-y-6">
          <Panel title="Log a session">
            <div className="space-y-5">
              <Field label="Session type">
                <Segmented
                  accent={ACCENT}
                  value={type}
                  onChange={setType}
                  options={[
                    { label: "Shooting", value: "Shooting" },
                    { label: "Conditioning", value: "Conditioning" },
                    { label: "Strength", value: "Strength" },
                    { label: "Skills", value: "Skills" },
                  ]}
                />
              </Field>
              <Slider label="Reps / makes" value={reps} min={0} max={500} step={10} onChange={setReps} accent={ACCENT} />
              <Slider label="Minutes" value={minutes} min={0} max={180} step={5} unit=" min" onChange={setMinutes} accent={ACCENT} />
              <motion.button
                onClick={addSession}
                disabled={saving}
                whileTap={{ scale: 0.96 }}
                transition={spring.snappy}
                className="flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold transition cursor-pointer hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                style={{ background: ACCENT, color: "#15080f" }}
              >
                {saving ? (
                  <>
                    <Dumbbell size={16} className="animate-spin" /> Logging…
                  </>
                ) : (
                  <>
                    <Plus size={16} /> Add session
                  </>
                )}
              </motion.button>
            </div>
          </Panel>

          <Panel title="Weekly goals">
            <div className="space-y-5">
              <div>
                <Meter
                  value={totalReps}
                  max={REP_GOAL}
                  color={ACCENT}
                  label="1,000 makes this week"
                  valueLabel={`${totalReps} / ${REP_GOAL}`}
                />
                <p className="mt-1.5 text-[11px] text-white/40">
                  {totalReps >= REP_GOAL
                    ? "Goal smashed — log a stretch goal."
                    : `${REP_GOAL - totalReps} makes to go.`}
                </p>
              </div>
              <div>
                <Meter
                  value={totalMinutes}
                  max={MIN_GOAL}
                  color={TIME}
                  label="300 minutes of work"
                  valueLabel={`${totalMinutes} / ${MIN_GOAL}`}
                />
                <p className="mt-1.5 text-[11px] text-white/40">
                  {totalMinutes >= MIN_GOAL
                    ? "On pace — recovery matters too."
                    : `${MIN_GOAL - totalMinutes} minutes left this week.`}
                </p>
              </div>
            </div>
          </Panel>

          <Panel title="Type benchmarks">
            <div className="space-y-3">
              {currentBenchmarks.map((b) => {
                const val = getBenchmarkValue(b);
                const barPct = (val / benchmarkMax) * 100;
                const isHighlighted =
                  highlightedTier !== null && getBenchmarkValue(highlightedTier) === val;
                const color = TYPE_COLOR[type];
                return (
                  <div
                    key={b.label}
                    className="rounded-md border px-3 py-2.5 transition-colors"
                    style={{
                      borderColor: isHighlighted ? `${color}99` : "rgba(255,255,255,0.06)",
                      background: isHighlighted ? `${color}0d` : "transparent",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 flex-shrink-0 rounded-full"
                        style={{ background: color }}
                      />
                      <span className="text-xs font-semibold text-white/80">{b.label}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-white/45">{b.desc}</p>
                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${barPct}%`, background: `${color}66` }}
                      />
                    </div>
                  </div>
                );
              })}
              <p className="pt-1 text-[11px] text-white/35">
                {type === "Conditioning" ? "Minutes" : "Reps"} from current session inputs.
                {highlightedTier
                  ? ` You meet "${highlightedTier.label}".`
                  : " Log more to reach a tier."}
              </p>
            </div>
          </Panel>
        </div>

        {/* Charts + log */}
        <div className="space-y-6">
          <Panel title="Reps by session">
            {sessions.length === 0 ? (
              <div className="py-10 text-center text-sm text-[var(--text-faint)]">
                No sessions logged yet — add your first session on the left.
              </div>
            ) : (
              <BarChart
                bars={recent.map((s) => ({
                  label: `${s.day} · ${s.type.slice(0, 4)}`,
                  value: s.reps,
                  color: TYPE_COLOR[s.type],
                }))}
              />
            )}
          </Panel>

          <Panel title="Consistency & balance">
            <div className="space-y-5">
              <div>
                <Meter
                  value={consistency}
                  max={100}
                  color={ACCENT}
                  label="Consistency — active days / 7"
                  valueLabel={`${activeDays} / 7 days · ${consistency}%`}
                />
                <p className="mt-1.5 text-[11px] text-white/40">
                  Same-day double sessions count once — this tracks showing up.
                </p>
              </div>
              <div>
                <Meter
                  value={balance}
                  max={100}
                  color="#4D8DFF"
                  label="Skill balance — spread of minutes across session types"
                  valueLabel={`${balance} / 100`}
                />
                <p className="mt-1.5 text-[11px] text-white/40">
                  100 means minutes split evenly across shooting, conditioning, strength, and skills.
                </p>
              </div>
              <div>
                <div className="mb-2 text-xs font-medium text-white/60">Badges</div>
                <div className="flex flex-wrap gap-2">
                  {badges.map((b) => (
                    <div
                      key={b.id}
                      className="rounded-lg border px-3 py-2"
                      style={{
                        borderColor: b.earned ? `${ACCENT}66` : "rgba(255,255,255,0.08)",
                        opacity: b.earned ? 1 : 0.55,
                      }}
                    >
                      <div
                        className="text-xs font-semibold"
                        style={{ color: b.earned ? ACCENT : "rgba(255,255,255,0.6)" }}
                      >
                        {b.label} {b.earned ? "· earned" : ""}
                      </div>
                      <div className="mt-0.5 text-[10px] text-white/45">
                        {b.threshold} — {b.detail}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Panel>

          <Insight accent={ACCENT}>
            {summary}{" "}
            {totalReps >= REP_GOAL
              ? "You hit the weekly makes goal — set a new ceiling."
              : `Stay locked in — ${REP_GOAL - totalReps} makes from the weekly goal.`}
          </Insight>

          <Panel title="Session log">
            {sessions.length === 0 ? (
              <div className="py-10 text-center text-sm text-[var(--text-faint)]">
                No sessions logged yet — add your first session on the left.
              </div>
            ) : (
            <div className="space-y-2">
              {sessions.map((s) => (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={spring.soft}
                  className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="stat-num w-8 text-xs font-semibold text-white/40">{s.day}</span>
                    <Badge color={TYPE_COLOR[s.type]}>{s.type}</Badge>
                  </div>
                  <div className="flex items-center gap-5 stat-num text-xs text-white/65">
                    <span>
                      <b className="text-white/90">{s.reps}</b> reps
                    </span>
                    <span>
                      <b className="text-white/90">{s.minutes}</b> min
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
            )}
          </Panel>
        </div>
      </div>

      <div className="mt-8 space-y-3">
        <div>
          <div className="kicker" style={{ color: "#F4647D" }}>Data &amp; method</div>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            This is a personal planning tool: every chart and total is computed directly from the
            sessions you log above — volume by type, weekly load, and balance across shooting,
            conditioning, strength, and skills. Consistency is distinct active days divided by 7;
            skill balance is the normalized entropy of minutes across the four session types (100
            = perfectly even); badges unlock at fixed thresholds (
            {BADGE_THRESHOLDS.volumeReps.toLocaleString()} weekly reps, {BADGE_THRESHOLDS.streakDays}{" "}
            active days, {BADGE_THRESHOLDS.balanceScore}+ balance). There is no external dataset or
            prediction model involved; it organizes your own inputs into a readable training
            picture.
          </p>
        </div>
      </div>
    </ToolShell>
  );
}
