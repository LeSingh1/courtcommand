"use client";

import { useState } from "react";
import { Trophy, Zap, Crown } from "lucide-react";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { Badge } from "@/components/ui/Controls";
import { Reveal } from "@/components/ui/Reveal";
import { AnalyzeOverlay, useAnalyze } from "@/components/ui/Analyze";
import { getTool } from "@/lib/tools";
import {
  simulateBracket,
  NCAA_FIELD,
  type NcaaTeam,
  type BracketGame,
} from "@/lib/engine/content";

const GOLD = "#C9A14A";
const ROSE = "#BF5B4E";
const ROUND_NAMES = ["Round of 16", "Quarterfinals", "Semifinals", "Final"];

function TeamRow({
  team,
  prob,
  isWinner,
}: {
  team: NcaaTeam;
  prob: number;
  isWinner: boolean;
}) {
  return (
    <div
      className="flex items-center gap-2 rounded-none px-2 py-1.5 transition"
      style={{
        background: isWinner ? `${GOLD}14` : "transparent",
        opacity: isWinner ? 1 : 0.5,
      }}
    >
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] font-bold text-white"
        style={{ background: team.color }}
      >
        {team.seed}
      </span>
      <span className="flex-1 truncate text-xs font-medium text-white/90">{team.name}</span>
      <span
        className="stat-num text-[11px] font-semibold"
        style={{ color: isWinner ? GOLD : "rgba(255,255,255,0.4)" }}
      >
        {prob}%
      </span>
    </div>
  );
}

export default function MarchMadnessPage() {
  const tool = getTool("march-madness")!;
  const [result, setResult] = useState<{ rounds: BracketGame[][]; champion: NcaaTeam } | null>(null);
  const analyze = useAnalyze([
    "Seeding the field…",
    "Modeling matchups…",
    "Rolling possessions…",
    "Crowning a champion…",
  ]);

  const run = () => {
    analyze.run(() => setResult(simulateBracket()));
  };

  const upsetCount = result?.rounds.flat().filter((g) => g.upset).length ?? 0;

  return (
    <ToolShell tool={tool}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Insight accent={GOLD}>
          {result ? (
            <>
              <b>{result.champion.name}</b> (#{result.champion.seed} seed) cuts down the nets in this
              simulation, surviving {result.rounds.length} rounds and {upsetCount} bracket-busting
              upset{upsetCount === 1 ? "" : "s"} along the way.
            </>
          ) : (
            <>
              Sixteen teams, one bracket. The model weighs net efficiency, strength of schedule,
              recent form, and seeding — then rolls the dance. Hit simulate to crown a champion.
            </>
          )}
        </Insight>
        <button
          onClick={run}
          className="rounded-none px-5 py-2.5 text-sm font-semibold transition"
          style={{ background: GOLD, color: "#160d00" }}
        >
          {result ? "Re-simulate Tournament" : "Simulate Tournament"}
        </button>
      </div>

      {analyze.phase === "running" ? (
        <AnalyzeOverlay steps={analyze.steps} stepIdx={analyze.stepIdx} accent={GOLD} />
      ) : result ? (
        <div className="space-y-6">
          {/* champion banner */}
          <Reveal>
            <div
              className="glass relative flex flex-col items-center overflow-hidden rounded-none border px-6 py-8 text-center"
              style={{ borderColor: `${GOLD}33` }}
            >
              <div>
                <Crown size={40} style={{ color: GOLD }} />
              </div>
              <div className="eyebrow mt-3" style={{ color: GOLD }}>
                National Champion
              </div>
              <div className="display mt-1 text-4xl text-white">{result.champion.name}</div>
              <div className="mt-2 flex items-center gap-2 text-xs text-white/50">
                <span
                  className="flex h-6 w-6 items-center justify-center rounded text-[10px] font-bold text-white"
                  style={{ background: result.champion.color }}
                >
                  {result.champion.seed}
                </span>
                <span className="stat-num">
                  {result.champion.seed} seed · {result.champion.eff} net eff
                </span>
              </div>
            </div>
          </Reveal>

          {/* bracket rounds */}
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-4">
              {result.rounds.map((round, ri) => (
                <div key={ri} className="w-[230px] shrink-0">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
                      {ROUND_NAMES[ri] ?? `Round ${ri + 1}`}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {round.map((game, gi) => {
                      const aWins = game.winner.name === game.a.name;
                      return (
                        <Reveal key={gi} delay={gi * 0.05}>
                          <div
                            className="glass rounded-none border border-transparent p-2.5"
                            style={game.upset ? { borderColor: `${ROSE}40` } : undefined}
                          >
                            <TeamRow team={game.a} prob={game.aProb} isWinner={aWins} />
                            <div className="my-0.5 flex items-center justify-center">
                              <span className="text-[9px] uppercase tracking-widest text-white/25">
                                vs
                              </span>
                            </div>
                            <TeamRow team={game.b} prob={100 - game.aProb} isWinner={!aWins} />
                            {game.upset && (
                              <div className="mt-2 flex justify-end">
                                <Badge color={ROSE}>
                                  <Zap size={10} /> Upset
                                </Badge>
                              </div>
                            )}
                          </div>
                        </Reveal>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <Panel title="The field">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {NCAA_FIELD.map((t, i) => (
              <Reveal key={t.name} delay={i * 0.03}>
                <div className="flex items-center gap-2.5 rounded-none border border-white/10 bg-white/[0.03] p-3">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-none text-xs font-bold text-white"
                    style={{ background: t.color }}
                  >
                    {t.seed}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">{t.name}</div>
                    <div className="stat-num text-[10px] text-white/40">{t.eff} net eff</div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <div className="mt-5 flex items-center gap-2 text-xs text-white/35">
            <Trophy size={13} style={{ color: GOLD }} />
            16 teams seeded 1–7. Press simulate to run the bracket end to end.
          </div>
        </Panel>
      )}
    </ToolShell>
  );
}
