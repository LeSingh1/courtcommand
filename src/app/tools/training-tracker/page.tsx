"use client";

import { useMemo, useState } from "react";
import { Dumbbell, Flame, Plus, Target, Clock } from "lucide-react";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { Slider, Field, Segmented, Badge } from "@/components/ui/Controls";
import { BarChart } from "@/components/ui/BarChart";
import { Meter } from "@/components/ui/Meter";
import { Reveal } from "@/components/ui/Reveal";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { getTool } from "@/lib/tools";

const MINT = "#5FA97E";

type SessionType = "Shooting" | "Conditioning" | "Strength" | "Skills";

interface Session {
  id: number;
  day: string;
  type: SessionType;
  reps: number;
  minutes: number;
}

const TYPE_COLOR: Record<SessionType, string> = {
  Shooting: "#C9A14A",
  Conditioning: "#7E8CA0",
  Strength: "#E0561F",
  Skills: "#5FA97E",
};

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

  const totalReps = useMemo(() => sessions.reduce((a, s) => a + s.reps, 0), [sessions]);
  const totalMinutes = useMemo(() => sessions.reduce((a, s) => a + s.minutes, 0), [sessions]);
  const streak = sessions.length; // consecutive logged days

  const recent = useMemo(() => [...sessions].slice(0, 6).reverse(), [sessions]);

  const addSession = () => {
    const day = `S${nextId}`;
    setSessions((prev) => [{ id: nextId, day, type, reps, minutes }, ...prev]);
    setNextId((n) => n + 1);
  };

  return (
    <ToolShell tool={tool}>
      {/* Top stat strip */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Reveal>
          <div className="glass rounded-none p-5">
            <div className="flex items-center gap-2 text-white/55">
              <Flame size={16} style={{ color: MINT }} />
              <span className="text-xs uppercase tracking-wide">Day streak</span>
            </div>
            <AnimatedNumber value={streak} className="stat-num mt-2 block text-4xl font-bold" />
            <p className="mt-1 text-xs text-white/45">Keep the chain alive — log every day.</p>
          </div>
        </Reveal>
        <Reveal delay={0.06}>
          <div className="glass rounded-none p-5">
            <div className="flex items-center gap-2 text-white/55">
              <Target size={16} style={{ color: "#C9A14A" }} />
              <span className="text-xs uppercase tracking-wide">Total reps</span>
            </div>
            <span style={{ color: "#C9A14A" }}>
              <AnimatedNumber value={totalReps} className="stat-num mt-2 block text-4xl font-bold" />
            </span>
            <p className="mt-1 text-xs text-white/45">Makes & finishes across all sessions.</p>
          </div>
        </Reveal>
        <Reveal delay={0.12}>
          <div className="glass rounded-none p-5">
            <div className="flex items-center gap-2 text-white/55">
              <Clock size={16} style={{ color: "#7E8CA0" }} />
              <span className="text-xs uppercase tracking-wide">Total minutes</span>
            </div>
            <span style={{ color: "#7E8CA0" }}>
              <AnimatedNumber value={totalMinutes} suffix=" min" className="stat-num mt-2 block text-4xl font-bold" />
            </span>
            <p className="mt-1 text-xs text-white/45">Time in the gym this week.</p>
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
                  accent={MINT}
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
              <Slider label="Reps / makes" value={reps} min={0} max={500} step={10} onChange={setReps} accent={MINT} />
              <Slider label="Minutes" value={minutes} min={0} max={180} step={5} unit=" min" onChange={setMinutes} accent={MINT} />
              <button
                onClick={addSession}
                className="flex w-full items-center justify-center gap-2 rounded-none py-3 text-sm font-semibold transition"
                style={{ background: MINT, color: "#04130c" }}
              >
                <Plus size={16} /> Add session
              </button>
            </div>
          </Panel>

          <Panel title="Weekly goals">
            <div className="space-y-5">
              <div>
                <Meter
                  value={totalReps}
                  max={REP_GOAL}
                  color={MINT}
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
                  color="#7E8CA0"
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
        </div>

        {/* Charts + log */}
        <div className="space-y-6">
          <Panel title="Reps by session">
            <BarChart
              bars={recent.map((s) => ({
                label: `${s.day} · ${s.type.slice(0, 4)}`,
                value: s.reps,
                color: TYPE_COLOR[s.type],
              }))}
            />
          </Panel>

          <Insight accent={MINT}>
            You&apos;re on a <b>{streak}-day streak</b> with <b>{totalReps.toLocaleString()} total reps</b>{" "}
            logged. {totalReps >= REP_GOAL ? "You hit the weekly makes goal — set a new ceiling." : `Stay locked in — ${REP_GOAL - totalReps} makes from the weekly goal.`}
          </Insight>

          <Panel title="Session log">
            <div className="space-y-2">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-none border border-white/[0.06] bg-white/[0.02] px-4 py-3"
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
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </ToolShell>
  );
}
