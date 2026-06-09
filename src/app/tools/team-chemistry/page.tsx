"use client";

import { useMemo, useState } from "react";
import { Atom } from "lucide-react";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { PlayerPicker } from "@/components/ui/PlayerPicker";
import { Meter } from "@/components/ui/Meter";
import { Gauge } from "@/components/ui/Gauge";
import { Badge } from "@/components/ui/Controls";
import { Reveal } from "@/components/ui/Reveal";
import { getTool } from "@/lib/tools";
import { TEAMS, TEAM_MAP, playersByTeam } from "@/lib/data";
import { teamChemistry, type ChemistryResult } from "@/lib/engine/teams";
import { gradeColor } from "@/lib/cn";
import type { Player } from "@/lib/types";

const ACCENT = "#5FA97E";

export default function TeamChemistryPage() {
  const tool = getTool("team-chemistry")!;
  const [player, setPlayer] = useState<Player | null>(null);
  const [team, setTeam] = useState("BOS");

  const result: ChemistryResult | null = useMemo(
    () => (player ? teamChemistry(player, team) : null),
    [player, team],
  );

  const roster = useMemo(
    () => playersByTeam(team).filter((p) => !player || p.id !== player.id),
    [team, player],
  );
  const tm = TEAM_MAP[team];

  return (
    <ToolShell tool={tool}>
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-1.5 text-xs font-medium text-white/60">Player</div>
          <PlayerPicker
            value={player}
            onChange={setPlayer}
            accent={ACCENT}
            placeholder="Pick a player to test fit…"
          />
        </div>
        <div>
          <div className="mb-1.5 text-xs font-medium text-white/60">Destination team</div>
          <div className="flex items-center gap-3 rounded-none border border-white/10 bg-white/[0.04] px-3 py-[7px]">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-none text-xs font-bold text-white"
              style={{ background: tm?.color }}
            >
              {tm?.abbr}
            </span>
            <select
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              className="flex-1 bg-transparent text-sm text-white outline-none"
            >
              {TEAMS.map((t) => (
                <option key={t.abbr} value={t.abbr} className="bg-ink-800">
                  {t.city} {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {!result ? (
        <Panel className="flex min-h-[300px] flex-col items-center justify-center text-center">
          <Atom size={40} className="mb-4" style={{ color: ACCENT }} />
          <p className="max-w-sm text-sm text-white/50">
            Drop any player onto a roster and the Chemistry Simulator predicts fit from usage
            overlap, spacing, defense, and positional need against the current core.
          </p>
        </Panel>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <Reveal>
            <Panel className="flex flex-col items-center justify-center text-center">
              <Gauge value={result.fit} label="Fit" color={gradeColor(result.fit)} />
              <div className="mt-4 flex items-center gap-2">
                <span className="text-sm text-white/55">Chemistry grade</span>
                <Badge color={gradeColor(result.fit)} soft={false}>
                  {result.grade}
                </Badge>
              </div>
              <p className="mt-3 text-xs text-white/45">
                {player!.name} → {tm?.city} {tm?.name}
              </p>
            </Panel>
          </Reveal>

          <div className="space-y-6">
            <Reveal delay={0.05}>
              <Panel title="Fit breakdown">
                <div className="space-y-4">
                  <Meter
                    label="Usage overlap"
                    valueLabel={`${result.usageOverlap}`}
                    value={result.usageOverlap}
                    color="#7E8CA0"
                  />
                  <Meter
                    label="Spacing gain"
                    valueLabel={`${result.spacingGain}`}
                    value={result.spacingGain}
                    color="#5FA97E"
                  />
                  <Meter
                    label="Defense gain"
                    valueLabel={`${result.defenseGain}`}
                    value={result.defenseGain}
                    color="#C9A14A"
                  />
                  <Meter
                    label="Positional need"
                    valueLabel={`${result.positionalNeed}`}
                    value={result.positionalNeed}
                    color="#E0561F"
                  />
                </div>
              </Panel>
            </Reveal>

            <Reveal delay={0.1}>
              <Insight accent={ACCENT}>
                <ul className="space-y-1.5">
                  {result.notes.map((n) => (
                    <li key={n}>· {n}</li>
                  ))}
                </ul>
              </Insight>
            </Reveal>

            {roster.length > 0 && (
              <Reveal delay={0.14}>
                <Panel title={`Current ${tm?.name} core`}>
                  <div className="flex flex-wrap gap-2">
                    {roster.map((p) => (
                      <span
                        key={p.id}
                        className="flex items-center gap-2 rounded-none border border-white/[0.07] bg-white/[0.03] px-2.5 py-1.5 text-xs text-white/75"
                      >
                        <span className="stat-num text-[10px] text-white/40">{p.pos}</span>
                        {p.name}
                      </span>
                    ))}
                  </div>
                </Panel>
              </Reveal>
            )}
          </div>
        </div>
      )}
    </ToolShell>
  );
}
