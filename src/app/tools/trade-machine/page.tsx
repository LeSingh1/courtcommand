"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeftRight, Check, Plus, X, Loader2, ShieldAlert, BadgeCheck } from "lucide-react";
import { spring } from "@/lib/motion";
import { ToolShell, Insight } from "@/components/tool/ToolShell";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { getTool } from "@/lib/tools";
import { PLAYERS, TEAMS, playersByTeam } from "@/lib/data";
import { evaluateTrade, type TradeResult } from "@/lib/engine/teams";
import type { Player, Team } from "@/lib/types";

const teamOf = (abbr: string): Team => TEAMS.find((t) => t.abbr === abbr)!;
const r1 = (n: number) => Math.round(n * 10) / 10;
const sum = (ps: Player[], k: (p: Player) => number) => ps.reduce((a, p) => a + k(p), 0);

// 2K-style overall-rating tint
function ovrColor(o: number): string {
  if (o >= 90) return "#C9A14A";
  if (o >= 80) return "#5FA97E";
  if (o >= 72) return "#4E8FA8";
  return "#7E8CA0";
}

export default function TradeMachinePage() {
  const tool = getTool("trade-machine")!;
  const [teamA, setTeamA] = useState("LAL");
  const [teamB, setTeamB] = useState("GSW");
  const [outA, setOutA] = useState<string[]>([]);
  const [outB, setOutB] = useState<string[]>([]);

  const rosterA = useMemo(() => playersByTeam(teamA), [teamA]);
  const rosterB = useMemo(() => playersByTeam(teamB), [teamB]);
  const pa = useMemo(() => outA.map((id) => PLAYERS.find((p) => p.id === id)!).filter(Boolean), [outA]);
  const pb = useMemo(() => outB.map((id) => PLAYERS.find((p) => p.id === id)!).filter(Boolean), [outB]);

  const result: TradeResult | null = useMemo(() => {
    if (pa.length === 0 && pb.length === 0) return null;
    return evaluateTrade([
      { team: teamA, outgoing: pa, incoming: pb },
      { team: teamB, outgoing: pb, incoming: pa },
    ]);
  }, [teamA, teamB, pa, pb]);

  // per-side offense / defense swing (A receives pb, sends pa)
  const swing = {
    A: { off: r1(sum(pb, (p) => p.offImpact) - sum(pa, (p) => p.offImpact)), def: r1(sum(pb, (p) => p.defImpact) - sum(pa, (p) => p.defImpact)) },
    B: { off: r1(sum(pa, (p) => p.offImpact) - sum(pb, (p) => p.offImpact)), def: r1(sum(pa, (p) => p.defImpact) - sum(pb, (p) => p.defImpact)) },
  };

  const [analyzing, setAnalyzing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toggle = (side: "A" | "B", id: string) => {
    const [list, set] = side === "A" ? [outA, setOutA] : [outB, setOutB];
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
    const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    setAnalyzing(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAnalyzing(false), 380);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const tA = teamOf(teamA);
  const tB = teamOf(teamB);
  const outAmtA = r1(sum(pa, (p) => p.salary));
  const outAmtB = r1(sum(pb, (p) => p.salary));

  return (
    <ToolShell tool={tool}>
      {/* team panels */}
      <div className="relative grid gap-5 lg:grid-cols-2">
        <TeamPanel
          team={tA}
          setTeam={(t) => { setTeamA(t); setOutA([]); }}
          roster={rosterA}
          selected={outA}
          sends={pa}
          receives={pb}
          onToggle={(id) => toggle("A", id)}
          exclude={teamB}
        />
        <TeamPanel
          team={tB}
          setTeam={(t) => { setTeamB(t); setOutB([]); }}
          roster={rosterB}
          selected={outB}
          sends={pb}
          receives={pa}
          onToggle={(id) => toggle("B", id)}
          exclude={teamA}
        />
        {/* center swap node */}
        <div className="pointer-events-none absolute left-1/2 top-[120px] hidden -translate-x-1/2 lg:block">
          <div className="flex h-11 w-11 items-center justify-center border border-[var(--line-strong)] bg-[var(--bg)]">
            <ArrowLeftRight size={18} className="text-white/70" />
          </div>
        </div>
      </div>

      {/* salary balance meter */}
      {result && <BalanceBar tA={tA} tB={tB} outA={outAmtA} outB={outAmtB} />}

      {/* verdict + after-trade */}
      <div className="mt-6">
        <AnimatePresence mode="wait">
          {analyzing && result ? (
            <motion.div key="eval" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={spring.soft}>
              <div className="flex min-h-[140px] flex-col items-center justify-center gap-3 border border-[var(--line)] bg-[var(--surface)] text-center">
                <Loader2 size={22} className="animate-spin text-white/50" />
                <p className="kicker">Evaluating trade · CBA matching · apron caps</p>
              </div>
            </motion.div>
          ) : result ? (
            <motion.div
              key={`r-${result.legal}-${result.sides.map((s) => s.team.abbr + s.grade).join("")}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={spring.soft}
              className="space-y-5"
            >
              <VerdictBanner result={result} tA={tA} tB={tB} />
              <div className="grid gap-5 sm:grid-cols-2">
                <AfterTrade side={result.sides[0]} swing={swing.A} receives={pb} />
                <AfterTrade side={result.sides[1]} swing={swing.B} receives={pa} />
              </div>
              <Insight accent={tA.color}>
                {result.legal
                  ? `${result.sides[0].team.abbr} grades ${result.sides[0].grade} (${result.sides[0].note.toLowerCase()}), ${result.sides[1].team.abbr} grades ${result.sides[1].grade} (${result.sides[1].note.toLowerCase()}). The deal clears 2024 CBA salary matching and apron hard-caps as built.`
                  : `Not allowed yet — ${result.violations[0]} Adjust the outgoing salaries until the dollars line up.`}
              </Insight>
            </motion.div>
          ) : (
            <motion.div key="empty" className="enter" exit={{ opacity: 0, y: -8 }} transition={spring.soft}>
              <div className="flex min-h-[140px] items-center justify-center border border-dashed border-[var(--line-strong)] bg-[var(--surface)] px-6 text-center">
                <p className="max-w-md text-sm text-white/55">
                  Add players to each team&rsquo;s trade block. CourtCommand checks 2024 CBA salary matching and
                  apron hard-caps, then grades the haul for both front offices.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ToolShell>
  );
}

/* ---------------- Team panel (2K-style) ---------------- */
function TeamPanel({
  team,
  setTeam,
  roster,
  selected,
  sends,
  receives,
  onToggle,
  exclude,
}: {
  team: Team;
  setTeam: (t: string) => void;
  roster: Player[];
  selected: string[];
  sends: Player[];
  receives: Player[];
  onToggle: (id: string) => void;
  exclude: string;
}) {
  const c = team.color;
  return (
    <div className="relative overflow-hidden border border-[var(--line)] bg-[var(--surface)]">
      {/* color rail */}
      <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: c }} />
      {/* header */}
      <div className="relative overflow-hidden px-5 pb-4 pt-5" style={{ background: `${c}14` }}>
        <div className="pointer-events-none absolute -right-6 -top-8 opacity-[0.14]">
          <TeamLogo abbr={team.abbr} size={120} />
        </div>
        <div className="relative flex items-center gap-3">
          <TeamLogo abbr={team.abbr} size={42} />
          <div className="min-w-0 flex-1">
            <select
              value={team.abbr}
              onChange={(e) => setTeam(e.target.value)}
              aria-label="Select team"
              className="w-full cursor-pointer border border-[var(--line)] bg-[var(--bg)] px-2.5 py-1.5 text-sm font-semibold text-white outline-none"
            >
              {TEAMS.filter((t) => t.abbr !== exclude).map((t) => (
                <option key={t.abbr} value={t.abbr}>
                  {t.city} {t.name}
                </option>
              ))}
            </select>
            <div className="stat-num mt-1.5 flex items-center gap-2 text-[11px] text-white/55">
              <span className="font-semibold" style={{ color: c }}>{team.wins}-{team.losses}</span>
              <span className="text-white/25">·</span>
              <span>{team.conf}</span>
              <span className="text-white/25">·</span>
              <span>${r1(team.payroll)}M payroll</span>
            </div>
          </div>
        </div>
      </div>

      {/* trade block (what this team sends) */}
      <div className="border-y border-[var(--line)] bg-[var(--bg)]/40 px-5 py-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="kicker" style={{ color: c }}>Trade block</span>
          <span className="stat-num text-[11px] text-white/45">
            {sends.length ? `$${r1(sum(sends, (p) => p.salary))}M out` : "empty"}
          </span>
        </div>
        <div className="flex min-h-[34px] flex-wrap gap-1.5">
          <AnimatePresence mode="popLayout">
            {sends.length === 0 ? (
              <span className="self-center text-[11px] text-white/30">Add players from the roster below</span>
            ) : (
              sends.map((p) => (
                <motion.button
                  key={p.id}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={spring.snappy}
                  onClick={() => onToggle(p.id)}
                  className="group flex items-center gap-1.5 border px-2 py-1"
                  style={{ borderColor: `${c}55`, background: `${c}1a` }}
                >
                  <PlayerAvatar player={p} size={18} />
                  <span className="text-[12px] text-white/90">{p.name}</span>
                  <span className="stat-num text-[10px] text-white/45">${p.salary}M</span>
                  <X size={11} className="text-white/40 group-hover:text-white" />
                </motion.button>
              ))
            )}
          </AnimatePresence>
        </div>
        {receives.length > 0 && (
          <div className="mt-2 flex items-center gap-1.5 border-t border-[var(--line)] pt-2">
            <span className="kicker text-[#5FA97E]">Gets</span>
            <span className="truncate text-[11px] text-white/60">
              {receives.map((p) => p.name).join(", ")}
            </span>
          </div>
        )}
      </div>

      {/* roster */}
      <div className="no-scrollbar max-h-[300px] space-y-1 overflow-y-auto p-3">
        {roster.length === 0 && (
          <p className="py-6 text-center text-xs text-white/40">No tracked players for this team.</p>
        )}
        {roster.map((p) => {
          const sel = selected.includes(p.id);
          const ovr = Math.round(p.starPower);
          return (
            <button
              key={p.id}
              onClick={() => onToggle(p.id)}
              className="flex w-full cursor-pointer items-center gap-3 border px-2.5 py-2 text-left transition"
              style={{ borderColor: sel ? `${c}66` : "var(--line)", background: sel ? `${c}12` : "transparent" }}
            >
              <OvrBadge ovr={ovr} />
              <PlayerAvatar player={p} size={30} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-white/90">{p.name}</div>
                <div className="stat-num text-[11px] text-white/45">
                  {p.pos} · {p.age}y · {p.ppg} PPG
                </div>
              </div>
              <div className="stat-num shrink-0 text-right text-[12px] font-semibold text-white">
                ${p.salary}M
              </div>
              <div
                className="flex h-6 w-6 shrink-0 items-center justify-center border"
                style={{ borderColor: sel ? c : "var(--line-strong)", background: sel ? c : "transparent" }}
              >
                {sel ? <Check size={13} className="text-[#0a0a0b]" /> : <Plus size={13} className="text-white/35" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function OvrBadge({ ovr }: { ovr: number }) {
  const c = ovrColor(ovr);
  return (
    <div
      className="flex h-9 w-9 shrink-0 flex-col items-center justify-center border"
      style={{ borderColor: `${c}66`, background: `${c}14` }}
    >
      <span className="scoreboard text-base leading-none" style={{ color: c }}>{ovr}</span>
      <span className="text-[7px] uppercase tracking-wider text-white/40">ovr</span>
    </div>
  );
}

/* ---------------- Salary balance meter ---------------- */
function BalanceBar({ tA, tB, outA, outB }: { tA: Team; tB: Team; outA: number; outB: number }) {
  const span = Math.max(outA, outB, 1);
  const aPct = (outA / span) * 100;
  const bPct = (outB / span) * 100;
  const diff = r1(Math.abs(outA - outB));
  return (
    <div className="mt-5 border border-[var(--line)] bg-[var(--surface)] px-5 py-4">
      <div className="mb-2 flex items-center justify-between text-[11px]">
        <span className="stat-num font-semibold" style={{ color: tA.color }}>{tA.abbr} ${outA}M out</span>
        <span className="kicker">Salary balance{diff > 0 ? ` · $${diff}M apart` : " · even"}</span>
        <span className="stat-num font-semibold" style={{ color: tB.color }}>{tB.abbr} ${outB}M out</span>
      </div>
      <div className="flex h-2.5 items-center gap-px">
        <div className="flex flex-1 justify-end bg-white/[0.05]">
          <motion.div
            className="h-full"
            style={{ background: tA.color }}
            initial={{ width: 0 }}
            animate={{ width: `${aPct}%` }}
            transition={spring.soft}
          />
        </div>
        <div className="h-3.5 w-px bg-white/40" />
        <div className="flex flex-1 bg-white/[0.05]">
          <motion.div
            className="h-full"
            style={{ background: tB.color }}
            initial={{ width: 0 }}
            animate={{ width: `${bPct}%` }}
            transition={spring.soft}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------------- Verdict banner ---------------- */
function VerdictBanner({ result, tA, tB }: { result: TradeResult; tA: Team; tB: Team }) {
  const ok = result.legal;
  const color = ok ? "#5FA97E" : "#BF5B4E";
  return (
    <div
      className="relative flex flex-col gap-3 overflow-hidden border px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
      style={{ borderColor: `${color}55`, background: `${color}10` }}
    >
      <div className="flex items-center gap-3">
        {ok ? <BadgeCheck size={26} style={{ color }} /> : <ShieldAlert size={26} style={{ color }} />}
        <div>
          <div className="scoreboard text-2xl tracking-wide" style={{ color }}>
            {ok ? "TRADE ACCEPTED" : "NOT ALLOWED"}
          </div>
          <div className="text-xs text-white/55">
            {ok
              ? "Clears 2024 CBA salary matching & apron hard-caps"
              : result.violations[0]}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2.5 self-start sm:self-auto">
        <TeamLogo abbr={tA.abbr} size={26} />
        <ArrowLeftRight size={15} className="text-white/45" />
        <TeamLogo abbr={tB.abbr} size={26} />
      </div>
    </div>
  );
}

/* ---------------- After-trade summary ---------------- */
function AfterTrade({
  side,
  swing,
  receives,
}: {
  side: TradeResult["sides"][number];
  swing: { off: number; def: number };
  receives: Player[];
}) {
  const c = side.team.color;
  const gradeC = side.talentDelta > 5 ? "#5FA97E" : side.talentDelta < -5 ? "#BF5B4E" : "#C9A14A";
  return (
    <div className="relative overflow-hidden border border-[var(--line)] bg-[var(--surface)]">
      <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: c }} />
      <div className="flex items-center justify-between px-5 pb-3 pt-4">
        <div className="flex items-center gap-2.5">
          <TeamLogo abbr={side.team.abbr} size={28} />
          <div>
            <div className="text-sm font-semibold text-white">{side.team.city} {side.team.name}</div>
            <div className="stat-num text-[11px] text-white/45">{side.note}</div>
          </div>
        </div>
        <div
          className="flex h-12 w-12 flex-col items-center justify-center border"
          style={{ borderColor: `${gradeC}66`, background: `${gradeC}14` }}
        >
          <span className="scoreboard text-xl leading-none" style={{ color: gradeC }}>{side.grade}</span>
          <span className="text-[7px] uppercase tracking-wider text-white/40">grade</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-px border-y border-[var(--line)] bg-[var(--line)] text-center">
        <Cell label="New payroll" value={`$${side.newPayroll}M`} />
        <Cell label="Net salary" value={`${side.netSalary >= 0 ? "+" : ""}${side.netSalary}M`} />
        <Cell label="Apron" value={side.apronBand} />
      </div>

      <div className="space-y-2.5 px-5 py-4">
        <ImpactMeter label="Offense" delta={swing.off} />
        <ImpactMeter label="Defense" delta={swing.def} />
        {receives.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="kicker">Acquires</span>
            {receives.map((p) => (
              <span key={p.id} className="border border-[var(--line)] px-1.5 py-0.5 text-[11px] text-white/75">
                {p.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--surface)] px-2 py-2.5">
      <div className="text-[9px] uppercase tracking-wider text-white/40">{label}</div>
      <div className="stat-num mt-0.5 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function ImpactMeter({ label, delta }: { label: string; delta: number }) {
  const pos = delta >= 0;
  const color = pos ? "#5FA97E" : "#BF5B4E";
  const w = Math.min(50, Math.abs(delta) * 1.1);
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 text-xs text-white/60">{label}</span>
      <div className="relative h-2 flex-1 bg-white/[0.06]">
        <div className="absolute left-1/2 top-0 h-full w-px bg-white/20" />
        <motion.div
          className="absolute top-0 h-full"
          style={{ background: color, left: pos ? "50%" : `${50 - w}%` }}
          initial={{ width: 0 }}
          animate={{ width: `${w}%` }}
          transition={spring.soft}
        />
      </div>
      <span className="stat-num w-12 text-right text-xs font-semibold" style={{ color }}>
        {pos ? "+" : ""}{delta}
      </span>
    </div>
  );
}
