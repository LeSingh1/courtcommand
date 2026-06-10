"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeftRight, Check, Plus, X, Loader2, ShieldAlert, BadgeCheck, GripVertical, Ticket } from "lucide-react";
import { spring } from "@/lib/motion";
import { ToolShell, Insight } from "@/components/tool/ToolShell";
import { Segmented } from "@/components/ui/Controls";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { TrackRecord } from "@/components/ui/TrackRecord";
import { getTool } from "@/lib/tools";
import { PLAYERS, TEAMS, playersByTeam } from "@/lib/data";
import { evaluateTrade, pickLabel, DRAFT_BASE_YEAR, type TradeResult, type TradePick } from "@/lib/engine/teams";
import type { Player, Team } from "@/lib/types";

const teamOf = (abbr: string): Team => TEAMS.find((t) => t.abbr === abbr)!;
const playerOf = (id: string): Player | undefined => PLAYERS.find((p) => p.id === id);
const r1 = (n: number) => Math.round(n * 10) / 10;
const sum = (ps: Player[], k: (p: Player) => number) => ps.reduce((a, p) => a + k(p), 0);

function ovrColor(o: number): string {
  if (o >= 90) return "#D7BC6A";
  if (o >= 80) return "#4D8DFF";
  if (o >= 72) return "#41C7E0";
  return "#6B6E78";
}

// one traded player: who, from where, to where
interface PoolEntry {
  id: string;
  from: string;
  to: string;
}

// one traded pick: which draft slot, from where, to where
interface PickEntry {
  key: string; // `${from}:${year}:r${round}` — a team owns one pick per round per year
  from: string;
  to: string;
  pick: TradePick;
}

const PICK_YEARS = [0, 1, 2, 3].map((n) => DRAFT_BASE_YEAR + n);

const DEFAULT_TEAMS = ["LAL", "GSW", "BOS", "NYK"];

export default function TradeMachinePage() {
  const tool = getTool("trade-machine")!;
  const [count, setCount] = useState<2 | 3 | 4>(2);
  const [teams, setTeams] = useState<string[]>(["LAL", "GSW"]);
  const [pool, setPool] = useState<PoolEntry[]>([]);
  const [pickPool, setPickPool] = useState<PickEntry[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const pulse = () => {
    const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    setAnalyzing(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAnalyzing(false), 360);
  };

  const setCountN = (n: 2 | 3 | 4) => {
    setCount(n);
    setTeams((prev) => {
      const next = [...prev];
      while (next.length < n) next.push(DEFAULT_TEAMS.find((t) => !next.includes(t))!);
      next.length = n;
      setPool((p) => p.filter((e) => next.includes(e.from) && next.includes(e.to)));
      setPickPool((p) => p.filter((e) => next.includes(e.from) && next.includes(e.to)));
      return next;
    });
  };

  const setTeamAt = (i: number, abbr: string) => {
    setTeams((prev) => {
      const old = prev[i];
      const next = [...prev];
      next[i] = abbr;
      setPool((p) => p.filter((e) => e.from !== old && e.to !== old));
      setPickPool((p) => p.filter((e) => e.from !== old && e.to !== old));
      return next;
    });
  };

  const addToPool = (id: string, from: string, to: string) => {
    if (from === to) return;
    setPool((p) => {
      const without = p.filter((e) => e.id !== id);
      return [...without, { id, from, to }];
    });
    pulse();
  };
  const removeFromPool = (id: string) => { setPool((p) => p.filter((e) => e.id !== id)); pulse(); };
  const setDest = (id: string, to: string) => { setPool((p) => p.map((e) => (e.id === id ? { ...e, to } : e))); pulse(); };

  // click-to-add sends to the next team in the ring
  const nextTeam = (from: string) => {
    const i = teams.indexOf(from);
    return teams[(i + 1) % teams.length];
  };
  const toggle = (id: string, from: string) => {
    if (pool.some((e) => e.id === id)) removeFromPool(id);
    else addToPool(id, from, nextTeam(from));
  };

  // picks: attach to the next team in the ring; one pick per round per year per team
  const addPick = (from: string, pick: TradePick) => {
    const key = `${from}:${pick.year}:r${pick.round}`;
    setPickPool((p) => [...p.filter((e) => e.key !== key), { key, from, to: nextTeam(from), pick }]);
    pulse();
  };
  const removePick = (key: string) => { setPickPool((p) => p.filter((e) => e.key !== key)); pulse(); };
  const setPickDest = (key: string, to: string) => { setPickPool((p) => p.map((e) => (e.key === key ? { ...e, to } : e))); pulse(); };

  const result: TradeResult | null = useMemo(() => {
    if (pool.length === 0 && pickPool.length === 0) return null;
    const sides = teams.map((t) => ({
      team: t,
      outgoing: pool.filter((e) => e.from === t).map((e) => playerOf(e.id)!).filter(Boolean),
      incoming: pool.filter((e) => e.to === t).map((e) => playerOf(e.id)!).filter(Boolean),
      picks: pickPool.filter((e) => e.from === t).map((e) => e.pick),
      picksIn: pickPool.filter((e) => e.to === t).map((e) => e.pick),
    }));
    return evaluateTrade(sides);
  }, [teams, pool, pickPool]);

  const gridCols = count === 2 ? "lg:grid-cols-2" : count === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2";

  return (
    <ToolShell tool={tool}>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="kicker">Teams</span>
        <Segmented
          accent={teamOf(teams[0]).color}
          value={String(count)}
          onChange={(v) => setCountN(Number(v) as 2 | 3 | 4)}
          options={[
            { label: "2-team", value: "2" },
            { label: "3-team", value: "3" },
            { label: "4-team", value: "4" },
          ]}
        />
        <span className="hidden items-center gap-1.5 text-xs text-[var(--text-faint)] sm:flex">
          <GripVertical size={13} /> Drag a player onto another team — or tap to send
        </span>
      </div>

      <div className={`grid gap-5 ${gridCols}`}>
        {teams.map((abbr, i) => {
          const team = teamOf(abbr);
          const outgoing = pool.filter((e) => e.from === abbr);
          const incoming = pool.filter((e) => e.to === abbr).map((e) => playerOf(e.id)!).filter(Boolean);
          return (
            <TeamPanel
              key={`${abbr}-${i}`}
              team={team}
              teams={teams}
              roster={playersByTeam(abbr)}
              outgoing={outgoing}
              incoming={incoming}
              outgoingPicks={pickPool.filter((e) => e.from === abbr)}
              incomingPicks={pickPool.filter((e) => e.to === abbr)}
              onToggle={(id) => toggle(id, abbr)}
              onDrop={(id, from) => from !== abbr && addToPool(id, from, abbr)}
              onDest={setDest}
              onRemove={removeFromPool}
              onAddPick={(pick) => addPick(abbr, pick)}
              onRemovePick={removePick}
              onPickDest={setPickDest}
              onTeamChange={(t) => setTeamAt(i, t)}
              exclude={teams}
            />
          );
        })}
      </div>

      <div className="mt-6">
        <AnimatePresence mode="wait">
          {analyzing && result ? (
            <motion.div key="eval" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={spring.soft}>
              <div className="flex min-h-[130px] flex-col items-center justify-center gap-3 border border-[var(--line)] bg-[var(--surface)] text-center">
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
              <VerdictBanner result={result} teams={teams} />
              <div className={`grid gap-5 ${count >= 3 ? "lg:grid-cols-3" : "sm:grid-cols-2"}`}>
                {result.sides.map((s) => (
                  <AfterTrade
                    key={s.team.abbr}
                    side={s}
                    receives={pool.filter((e) => e.to === s.team.abbr).map((e) => playerOf(e.id)!).filter(Boolean)}
                    sends={pool.filter((e) => e.from === s.team.abbr).map((e) => playerOf(e.id)!).filter(Boolean)}
                  />
                ))}
              </div>
              <Insight accent={teamOf(teams[0]).color}>
                {result.legal
                  ? `${result.sides.length}-team deal clears 2024 CBA salary matching and apron hard-caps as built. ${result.sides
                      .map((s) => `${s.team.abbr} ${s.grade}`)
                      .join(", ")}.`
                  : `Not allowed yet — ${result.violations[0]} Adjust the outgoing salaries until the dollars line up.`}
              </Insight>
            </motion.div>
          ) : (
            <motion.div key="empty" className="enter" exit={{ opacity: 0, y: -8 }} transition={spring.soft}>
              <div className="flex min-h-[130px] items-center justify-center border border-dashed border-[var(--line-strong)] bg-[var(--surface)] px-6 text-center">
                <p className="max-w-md text-sm text-white/55">
                  Drag players onto another team (or tap to send), and attach draft picks from each trade block.
                  CourtCommand checks 2024 CBA salary matching, apron hard-caps, and a 4-player outgoing limit per
                  team, then grades the haul — including pick value, aging-contract risk, and post-trade
                  positional fit — for each front office.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-8 space-y-3">
        <div>
          <div className="kicker" style={{ color: "#4D8DFF" }}>Model track record</div>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">Each season since 2003, the player-rating model these deals are graded on is tested against what players actually produced the next year — the bars show that year-over-year correlation (about r=0.89). Contract risk is an estimate: it projects remaining years on age-30+ deals from player age, since contract-length data isn't ingested. Pick value is a flat deterministic estimate (unprotected 1st = 9, protected 1st = 6, 2nd = 2.5, with a small premium for the next two drafts) — it doesn't project where a pick will land. Fit is positional balance of the post-trade roster (100 = even across all five spots).</p>
        </div>
        <TrackRecord slug="trade-machine" accent="#4D8DFF" />
      </div>
    </ToolShell>
  );
}

/* ---------------- Team panel ---------------- */
function TeamPanel({
  team,
  teams,
  roster,
  outgoing,
  incoming,
  outgoingPicks,
  incomingPicks,
  onToggle,
  onDrop,
  onDest,
  onRemove,
  onAddPick,
  onRemovePick,
  onPickDest,
  onTeamChange,
  exclude,
}: {
  team: Team;
  teams: string[];
  roster: Player[];
  outgoing: PoolEntry[];
  incoming: Player[];
  outgoingPicks: PickEntry[];
  incomingPicks: PickEntry[];
  onToggle: (id: string) => void;
  onDrop: (id: string, from: string) => void;
  onDest: (id: string, to: string) => void;
  onRemove: (id: string) => void;
  onAddPick: (pick: TradePick) => void;
  onRemovePick: (key: string) => void;
  onPickDest: (key: string, to: string) => void;
  onTeamChange: (t: string) => void;
  exclude: string[];
}) {
  const c = team.color;
  const [hover, setHover] = useState(false);
  const outIds = new Set(outgoing.map((e) => e.id));
  const outSalary = r1(sum(outgoing.map((e) => playerOf(e.id)!).filter(Boolean), (p) => p.salary));
  const hasOut = outgoing.length > 0 || outgoingPicks.length > 0;

  return (
    <div
      data-team={team.abbr}
      className="relative overflow-hidden border bg-[var(--surface)] transition-colors"
      style={{ borderColor: hover ? c : "var(--line)" }}
    >
      <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: c }} />
      <div className="relative overflow-hidden px-4 pb-3.5 pt-4" style={{ background: `${c}14` }}>
        <div className="pointer-events-none absolute -right-6 -top-8 opacity-[0.13]">
          <TeamLogo abbr={team.abbr} size={110} />
        </div>
        <div className="relative flex items-center gap-2.5">
          <TeamLogo abbr={team.abbr} size={38} />
          <div className="min-w-0 flex-1">
            <select
              value={team.abbr}
              onChange={(e) => onTeamChange(e.target.value)}
              aria-label="Select team"
              className="w-full cursor-pointer border border-[var(--line)] bg-[var(--bg)] px-2.5 py-1.5 text-sm font-semibold text-white outline-none"
            >
              {TEAMS.filter((t) => t.abbr === team.abbr || !exclude.includes(t.abbr)).map((t) => (
                <option key={t.abbr} value={t.abbr}>{t.city} {t.name}</option>
              ))}
            </select>
            <div className="stat-num mt-1 flex items-center gap-1.5 text-[11px] text-white/55">
              <span className="font-semibold" style={{ color: c }}>{team.wins}-{team.losses}</span>
              <span className="text-white/25">·</span>
              <span>{team.conf}</span>
              <span className="text-white/25">·</span>
              <span>${r1(team.payroll)}M</span>
            </div>
          </div>
        </div>
      </div>

      {/* drop zone: trade block */}
      <div
        onDragOver={(e) => { e.preventDefault(); setHover(true); }}
        onDragLeave={() => setHover(false)}
        onDrop={(e) => {
          e.preventDefault();
          setHover(false);
          const id = e.dataTransfer.getData("playerId");
          const from = e.dataTransfer.getData("fromTeam");
          if (id && from) onDrop(id, from);
        }}
        className="border-y px-4 py-3"
        style={{ borderColor: "var(--line)", background: hover ? `${c}14` : "transparent" }}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="kicker" style={{ color: c }}>Trade block</span>
          <span className="stat-num text-[11px] text-white/45">{hasOut ? `$${outSalary}M out` : "drop here"}</span>
        </div>
        <div className="flex min-h-[34px] flex-wrap gap-1.5">
          <AnimatePresence mode="popLayout">
            {!hasOut ? (
              <span className="self-center text-[11px] text-white/30">Drag or tap players to trade them away</span>
            ) : (
              [
                ...outgoing.map((e) => {
                  const p = playerOf(e.id)!;
                  return (
                    <motion.div
                      key={e.id}
                      layout
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={spring.snappy}
                      className="flex items-center gap-1.5 border px-1.5 py-1"
                      style={{ borderColor: `${c}55`, background: `${c}1a` }}
                    >
                      <PlayerAvatar player={p} size={18} />
                      <span className="text-[12px] text-white/90">{p.name}</span>
                      {teams.length > 2 && (
                        <select
                          value={e.to}
                          onChange={(ev) => onDest(e.id, ev.target.value)}
                          aria-label="Destination team"
                          className="cursor-pointer border border-[var(--line)] bg-[var(--bg)] px-1 py-0.5 text-[10px] text-white outline-none"
                        >
                          {teams.filter((t) => t !== e.from).map((t) => (
                            <option key={t} value={t}>→ {t}</option>
                          ))}
                        </select>
                      )}
                      <button onClick={() => onRemove(e.id)} aria-label="Remove" className="text-white/40 hover:text-white">
                        <X size={11} />
                      </button>
                    </motion.div>
                  );
                }),
                ...outgoingPicks.map((e) => (
                  <motion.div
                    key={e.key}
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={spring.snappy}
                    className="flex items-center gap-1.5 border px-1.5 py-1"
                    style={{ borderColor: `${c}55`, background: `${c}1a` }}
                  >
                    <Ticket size={13} style={{ color: c }} />
                    <span className="text-[12px] text-white/90">{pickLabel(e.pick)}</span>
                    {teams.length > 2 && (
                      <select
                        value={e.to}
                        onChange={(ev) => onPickDest(e.key, ev.target.value)}
                        aria-label="Destination team"
                        className="cursor-pointer border border-[var(--line)] bg-[var(--bg)] px-1 py-0.5 text-[10px] text-white outline-none"
                      >
                        {teams.filter((t) => t !== e.from).map((t) => (
                          <option key={t} value={t}>→ {t}</option>
                        ))}
                      </select>
                    )}
                    <button onClick={() => onRemovePick(e.key)} aria-label="Remove pick" className="text-white/40 hover:text-white">
                      <X size={11} />
                    </button>
                  </motion.div>
                )),
              ]
            )}
          </AnimatePresence>
        </div>
        <AddPick
          accent={c}
          attached={new Set(outgoingPicks.map((e) => `${e.pick.year}:r${e.pick.round}`))}
          onAdd={onAddPick}
        />
        {(incoming.length > 0 || incomingPicks.length > 0) && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-[var(--line)] pt-2">
            <span className="kicker text-[#4D8DFF]">Gets</span>
            {incoming.map((p) => (
              <span key={p.id} className="flex items-center gap-1 text-[11px] text-white/70">
                <PlayerAvatar player={p} size={14} /> {p.name}
              </span>
            ))}
            {incomingPicks.map((e) => (
              <span key={e.key} className="flex items-center gap-1 text-[11px] text-white/70">
                <Ticket size={13} className="text-white/45" /> {pickLabel(e.pick)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* roster (draggable) */}
      <div className="no-scrollbar max-h-[290px] space-y-1 overflow-y-auto p-3">
        {roster.length === 0 && <p className="py-6 text-center text-xs text-white/40">No tracked players.</p>}
        {roster.map((p) => {
          const sel = outIds.has(p.id);
          const ovr = Math.round(p.starPower);
          return (
            <button
              key={p.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("playerId", p.id);
                e.dataTransfer.setData("fromTeam", team.abbr);
                e.dataTransfer.effectAllowed = "move";
              }}
              onClick={() => onToggle(p.id)}
              className="flex w-full cursor-grab items-center gap-3 border px-2.5 py-2 text-left transition hover:border-[var(--line-strong)] active:cursor-grabbing"
              style={{ borderColor: sel ? `${c}66` : "var(--line)", background: sel ? `${c}12` : "transparent" }}
            >
              <OvrBadge ovr={ovr} />
              <PlayerAvatar player={p} size={30} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-white/90">{p.name}</div>
                <div className="stat-num text-[11px] text-white/45">{p.pos} · {p.age}y · {p.ppg} PPG</div>
              </div>
              <div className="stat-num shrink-0 text-[12px] font-semibold text-white">${p.salary}M</div>
              <div className="flex h-6 w-6 shrink-0 items-center justify-center border" style={{ borderColor: sel ? c : "var(--line-strong)", background: sel ? c : "transparent" }}>
                {sel ? <Check size={13} className="text-[#0a0a0b]" /> : <Plus size={13} className="text-white/35" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Add pick ---------------- */
function AddPick({
  accent,
  attached,
  onAdd,
}: {
  accent: string;
  attached: Set<string>;
  onAdd: (pick: TradePick) => void;
}) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(PICK_YEARS[0]);
  const [round, setRound] = useState<1 | 2>(1);
  const [prot, setProt] = useState(false);

  const sel = (active: boolean) => ({
    borderColor: active ? accent : "var(--line)",
    background: active ? `${accent}1a` : "transparent",
    color: active ? "#fff" : "rgba(255,255,255,0.55)",
  });
  const onBlock = attached.has(`${year}:r${round}`);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 flex items-center gap-1.5 border border-dashed border-[var(--line-strong)] px-2 py-1 text-[11px] text-white/55 transition hover:text-white"
      >
        <Ticket size={12} /> Add pick
      </button>
    );
  }
  return (
    <div className="mt-2 space-y-2 border border-[var(--line)] bg-[var(--bg)] p-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="w-12 text-[11px] text-white/45">Draft</span>
        {PICK_YEARS.map((y) => (
          <button key={y} onClick={() => setYear(y)} className="stat-num border px-2 py-1 text-[11px]" style={sel(year === y)}>
            {y}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="w-12 text-[11px] text-white/45">Round</span>
        <button onClick={() => setRound(1)} className="border px-2 py-1 text-[11px]" style={sel(round === 1)}>
          1st
        </button>
        <button onClick={() => setRound(2)} className="border px-2 py-1 text-[11px]" style={sel(round === 2)}>
          2nd
        </button>
        <button onClick={() => setProt((v) => !v)} className="ml-1 flex items-center gap-1 border px-2 py-1 text-[11px]" style={sel(prot)}>
          {prot && <Check size={11} />} Protected
        </button>
      </div>
      <div className="flex items-center gap-1.5 pt-0.5">
        <button
          onClick={() => {
            onAdd({ year, round, ...(prot ? { protected: true } : {}) });
            setProt(false);
            setOpen(false);
          }}
          className="border px-2.5 py-1 text-[11px] font-semibold text-white"
          style={{ borderColor: accent, background: `${accent}26` }}
        >
          {onBlock ? "Update pick" : "Attach pick"}
        </button>
        <button onClick={() => setOpen(false)} className="border border-[var(--line)] px-2.5 py-1 text-[11px] text-white/55 hover:text-white">
          Cancel
        </button>
      </div>
    </div>
  );
}

function OvrBadge({ ovr }: { ovr: number }) {
  const c = ovrColor(ovr);
  return (
    <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center border" style={{ borderColor: `${c}66`, background: `${c}14` }}>
      <span className="scoreboard text-base leading-none" style={{ color: c }}>{ovr}</span>
      <span className="text-[7px] text-white/40">ovr</span>
    </div>
  );
}

/* ---------------- Verdict banner ---------------- */
function VerdictBanner({ result, teams }: { result: TradeResult; teams: string[] }) {
  const ok = result.legal;
  const color = ok ? "#4D8DFF" : "#F4647D";
  return (
    <div className="relative flex flex-col gap-3 overflow-hidden border px-5 py-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: `${color}55`, background: `${color}10` }}>
      <div className="flex items-center gap-3">
        {ok ? <BadgeCheck size={26} style={{ color }} /> : <ShieldAlert size={26} style={{ color }} />}
        <div>
          <div className="scoreboard text-2xl tracking-wide" style={{ color }}>{ok ? "TRADE ACCEPTED" : "NOT ALLOWED"}</div>
          <div className="text-xs text-white/55">{ok ? `${teams.length}-team deal clears 2024 CBA matching & apron hard-caps` : result.violations[0]}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 self-start sm:self-auto">
        {teams.map((t, i) => (
          <span key={t} className="flex items-center gap-2">
            {i > 0 && <ArrowLeftRight size={13} className="text-white/40" />}
            <TeamLogo abbr={t} size={24} />
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------------- After-trade summary ---------------- */
function AfterTrade({
  side,
  receives,
  sends,
}: {
  side: TradeResult["sides"][number];
  receives: Player[];
  sends: Player[];
}) {
  const c = side.team.color;
  const gradeC = side.talentDelta > 5 ? "#4D8DFF" : side.talentDelta < -5 ? "#F4647D" : "#D7BC6A";
  const offDelta = r1(sum(receives, (p) => p.offImpact) - sum(sends, (p) => p.offImpact));
  const defDelta = r1(sum(receives, (p) => p.defImpact) - sum(sends, (p) => p.defImpact));
  return (
    <div className="relative overflow-hidden border border-[var(--line)] bg-[var(--surface)]">
      <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: c }} />
      <div className="flex items-center justify-between px-4 pb-3 pt-4">
        <div className="flex items-center gap-2.5">
          <TeamLogo abbr={side.team.abbr} size={26} />
          <div>
            <div className="text-sm font-semibold text-white">{side.team.abbr}</div>
            <div className="stat-num text-[11px] text-white/45">{side.note}</div>
          </div>
        </div>
        <div className="flex h-11 w-11 flex-col items-center justify-center border" style={{ borderColor: `${gradeC}66`, background: `${gradeC}14` }}>
          <span className="scoreboard text-lg leading-none" style={{ color: gradeC }}>{side.grade}</span>
          <span className="text-[7px] text-white/40">grade</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-px border-y border-[var(--line)] bg-[var(--line)] text-center">
        <Cell label="Payroll" value={`$${side.newPayroll}M`} />
        <Cell label="Net" value={`${side.netSalary >= 0 ? "+" : ""}${side.netSalary}M`} />
        <Cell label="Apron" value={side.apronBand} />
      </div>
      {side.failure_reasons.length > 0 && (
        <div className="space-y-1 border-b border-[var(--line)] bg-[#F4647D]/[0.07] px-4 py-2.5">
          {side.failure_reasons.map((r) => (
            <div key={r} className="flex items-start gap-1.5 text-[11px] text-[#F4647D]">
              <ShieldAlert size={12} className="mt-0.5 shrink-0" />
              <span>{r}</span>
            </div>
          ))}
        </div>
      )}
      <div className="space-y-2.5 px-4 py-3.5">
        <ImpactMeter label="Offense" delta={offDelta} />
        <ImpactMeter label="Defense" delta={defDelta} />
        <FitRow score={side.roster_fit_score} delta={side.roster_fit_delta} />
        <ContractRiskRow risk={side.contract_risk} />
        {(receives.length > 0 || side.picks_in.length > 0) && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="kicker">Acquires</span>
            {receives.map((p) => (
              <span key={p.id} className="border border-[var(--line)] px-1.5 py-0.5 text-[11px] text-white/75">{p.name}</span>
            ))}
            {side.picks_in.map((label, i) => (
              <span key={`${label}-${i}`} className="flex items-center gap-1 border border-[var(--line)] px-1.5 py-0.5 text-[11px] text-white/75">
                <Ticket size={11} className="text-white/45" /> {label}
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
      <div className="text-[9px] text-white/40">{label}</div>
      <div className="stat-num mt-0.5 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

// Post-trade positional balance (0-100) with the change vs the current roster.
function FitRow({ score, delta }: { score: number; delta: number }) {
  const deltaC = delta > 0 ? "#4D8DFF" : delta < 0 ? "#F4647D" : "#6B6E78";
  return (
    <div className="flex items-center gap-3">
      <span className="w-14 text-xs text-white/60">Fit</span>
      <div className="relative h-2 flex-1 bg-white/[0.06]">
        <motion.div
          className="absolute top-0 h-full"
          style={{ background: "#6B6E78" }}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={spring.soft}
        />
      </div>
      <span className="stat-num w-12 text-right text-xs font-semibold text-white">
        {score}
        <span className="ml-1" style={{ color: deltaC }}>
          {delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : "±0"}
        </span>
      </span>
    </div>
  );
}

const RISK_COLOR: Record<string, string> = { Low: "#4D8DFF", Med: "#D7BC6A", High: "#F4647D" };

function ContractRiskRow({ risk }: { risk: TradeResult["sides"][number]["contract_risk"] }) {
  const c = RISK_COLOR[risk.level];
  return (
    <div className="flex items-start gap-2 border-t border-[var(--line)] pt-2.5">
      <span
        className="mt-0.5 shrink-0 rounded-lg px-1.5 py-0.5 text-[10px] font-semibold"
        style={{ background: `${c}1f`, color: c, border: `1px solid ${c}33` }}
      >
        {risk.level} risk
      </span>
      <span className="text-[11px] leading-snug text-white/55">{risk.why}</span>
    </div>
  );
}

function ImpactMeter({ label, delta }: { label: string; delta: number }) {
  const pos = delta >= 0;
  const color = pos ? "#4D8DFF" : "#F4647D";
  const w = Math.min(50, Math.abs(delta) * 1.1);
  return (
    <div className="flex items-center gap-3">
      <span className="w-14 text-xs text-white/60">{label}</span>
      <div className="relative h-2 flex-1 bg-white/[0.06]">
        <div className="absolute left-1/2 top-0 h-full w-px bg-white/20" />
        <motion.div className="absolute top-0 h-full" style={{ background: color, left: pos ? "50%" : `${50 - w}%` }} initial={{ width: 0 }} animate={{ width: `${w}%` }} transition={spring.soft} />
      </div>
      <span className="stat-num w-12 text-right text-xs font-semibold" style={{ color }}>{pos ? "+" : ""}{delta}</span>
    </div>
  );
}
