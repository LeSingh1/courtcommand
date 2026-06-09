"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight, Check, X, Plus } from "lucide-react";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { getTool } from "@/lib/tools";
import { PLAYERS, TEAMS, playersByTeam } from "@/lib/data";
import { evaluateTrade, type TradeResult } from "@/lib/engine/teams";
import { gradeColor } from "@/lib/cn";
import type { Player } from "@/lib/types";

export default function TradeMachinePage() {
  const tool = getTool("trade-machine")!;
  const [teamA, setTeamA] = useState("LAL");
  const [teamB, setTeamB] = useState("GSW");
  const [outA, setOutA] = useState<string[]>([]);
  const [outB, setOutB] = useState<string[]>([]);

  const rosterA = useMemo(() => playersByTeam(teamA), [teamA]);
  const rosterB = useMemo(() => playersByTeam(teamB), [teamB]);

  const result: TradeResult | null = useMemo(() => {
    if (outA.length === 0 && outB.length === 0) return null;
    const pa = outA.map((id) => PLAYERS.find((p) => p.id === id)!).filter(Boolean);
    const pb = outB.map((id) => PLAYERS.find((p) => p.id === id)!).filter(Boolean);
    return evaluateTrade([
      { team: teamA, outgoing: pa, incoming: pb },
      { team: teamB, outgoing: pb, incoming: pa },
    ]);
  }, [teamA, teamB, outA, outB]);

  const toggle = (side: "A" | "B", id: string) => {
    const [list, set] = side === "A" ? [outA, setOutA] : [outB, setOutB];
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  return (
    <ToolShell tool={tool}>
      <div className="grid gap-6 lg:grid-cols-2">
        <TeamColumn
          team={teamA}
          setTeam={(t) => {
            setTeamA(t);
            setOutA([]);
          }}
          roster={rosterA}
          selected={outA}
          onToggle={(id) => toggle("A", id)}
          accent="#E0561F"
          exclude={teamB}
        />
        <TeamColumn
          team={teamB}
          setTeam={(t) => {
            setTeamB(t);
            setOutB([]);
          }}
          roster={rosterB}
          selected={outB}
          onToggle={(id) => toggle("B", id)}
          accent="#7E8CA0"
          exclude={teamA}
        />
      </div>

      <div className="my-6 flex items-center justify-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
          <ArrowLeftRight size={20} className="text-white/60" />
        </div>
      </div>

      {result ? (
        <div className="space-y-6">
          <div
            className="flex items-center gap-3 rounded-none border p-4"
            style={{
              borderColor: result.legal ? "#5FA97E55" : "#BF5B4E55",
              background: result.legal ? "#5FA97E0f" : "#BF5B4E0f",
            }}
          >
            {result.legal ? (
              <Check size={22} className="text-mint" />
            ) : (
              <X size={22} className="text-rose" />
            )}
            <div>
              <div className="font-semibold text-white">
                {result.legal ? "Trade is salary-cap legal" : "Trade fails cap rules"}
              </div>
              {!result.legal && (
                <ul className="mt-1 space-y-0.5 text-sm text-white/55">
                  {result.violations.map((v) => (
                    <li key={v}>· {v}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {result.sides.map((s) => (
              <Panel key={s.team.abbr} title={`${s.team.city} ${s.team.name}`}>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Stat label="Salary out" value={`$${s.out}M`} />
                  <Stat label="Salary in" value={`$${s.in}M`} />
                  <Stat label="New payroll" value={`$${s.newPayroll}M`} />
                  <Stat label="Apron band" value={s.apronBand} />
                </div>
                <div className="mt-4 flex items-center justify-between rounded-none bg-white/[0.03] p-3">
                  <div>
                    <div className="text-xs text-white/45">Roster impact</div>
                    <div className="text-sm text-white/80">{s.note}</div>
                  </div>
                  <div
                    className="stat-num rounded-none px-3 py-1.5 text-lg font-bold"
                    style={{
                      background: `${gradeColor(50 + s.talentDelta)}1f`,
                      color: gradeColor(50 + s.talentDelta),
                    }}
                  >
                    {s.grade}
                  </div>
                </div>
              </Panel>
            ))}
          </div>
        </div>
      ) : (
        <Panel className="flex min-h-[160px] items-center justify-center text-center">
          <p className="max-w-sm text-sm text-white/50">
            Select players from each side to build a trade. CourtCommand checks 2024 CBA salary
            matching, apron hard-caps, and grades the roster impact for both teams.
          </p>
        </Panel>
      )}
    </ToolShell>
  );
}

function TeamColumn({
  team,
  setTeam,
  roster,
  selected,
  onToggle,
  accent,
  exclude,
}: {
  team: string;
  setTeam: (t: string) => void;
  roster: Player[];
  selected: string[];
  onToggle: (id: string) => void;
  accent: string;
  exclude: string;
}) {
  return (
    <Panel>
      <div className="mb-4 flex items-center gap-3">
        <TeamLogo abbr={team} size={40} />
        <select
          value={team}
          onChange={(e) => setTeam(e.target.value)}
          className="flex-1 rounded-none border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none"
        >
          {TEAMS.filter((t) => t.abbr !== exclude).map((t) => (
            <option key={t.abbr} value={t.abbr} className="bg-ink-800">
              {t.city} {t.name} · ${t.payroll}M
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        {roster.length === 0 && (
          <p className="py-6 text-center text-xs text-white/40">No tracked players for this team in the demo set.</p>
        )}
        {roster.map((p) => {
          const sel = selected.includes(p.id);
          return (
            <button
              key={p.id}
              onClick={() => onToggle(p.id)}
              className="flex w-full items-center gap-3 rounded-none border p-2.5 text-left transition"
              style={{
                borderColor: sel ? `${accent}66` : "rgba(255,255,255,0.07)",
                background: sel ? `${accent}12` : "transparent",
              }}
            >
              <div
                className="flex h-5 w-5 items-center justify-center rounded-none border"
                style={{ borderColor: sel ? accent : "rgba(255,255,255,0.2)", background: sel ? accent : "transparent" }}
              >
                {sel ? <Check size={13} className="text-[#0a0c11]" /> : <Plus size={12} className="text-white/30" />}
              </div>
              <PlayerAvatar player={p} size={30} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-white/85">{p.name}</div>
                <div className="stat-num text-[11px] text-white/40">
                  {p.pos} · {p.ppg} PPG · ${p.salary}M
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-none bg-white/[0.03] p-2.5">
      <div className="text-[10px] uppercase text-white/40">{label}</div>
      <div className="stat-num mt-0.5 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}
