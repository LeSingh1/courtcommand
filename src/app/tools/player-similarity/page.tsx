"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { GitCompareArrows } from "lucide-react";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { PlayerPicker } from "@/components/ui/PlayerPicker";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { RadarChart } from "@/components/ui/RadarChart";
import { Meter } from "@/components/ui/Meter";
import { Badge } from "@/components/ui/Controls";
import { AnalyzeOverlay, useAnalyze } from "@/components/ui/Analyze";
import { getTool } from "@/lib/tools";
import { getPlayer } from "@/lib/data";
import { similarPlayers, radarValues, RADAR_AXES, type SimResult } from "@/lib/engine/players";
import type { Player } from "@/lib/types";

export default function SimilarityPage() {
  return (
    <Suspense fallback={null}>
      <SimilarityInner />
    </Suspense>
  );
}

function SimilarityInner() {
  const tool = getTool("player-similarity")!;
  const params = useSearchParams();
  const [player, setPlayer] = useState<Player | null>(null);
  const [results, setResults] = useState<SimResult[]>([]);
  const [active, setActive] = useState(0);
  const analyze = useAnalyze([
    "Vectorizing playstyle…",
    "Computing usage & shot profile…",
    "Measuring statistical distance…",
    "Ranking closest comps…",
  ]);

  useEffect(() => {
    const a = params.get("a");
    if (a) {
      const p = getPlayer(a);
      if (p) setPlayer(p);
    }
  }, [params]);

  useEffect(() => {
    if (!player) {
      setResults([]);
      return;
    }
    analyze.run(() => {
      setResults(similarPlayers(player.id, 6));
      setActive(0);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);

  const comp = results[active]?.player ?? null;

  return (
    <ToolShell tool={tool}>
      <div className="mb-6 max-w-md">
        <PlayerPicker value={player} onChange={setPlayer} accent="#7E8CA0" placeholder="Pick a player to find twins…" />
      </div>

      {!player ? (
        <Panel className="flex min-h-[300px] flex-col items-center justify-center text-center">
          <GitCompareArrows size={40} className="mb-4 text-cyan" />
          <p className="max-w-xs text-sm text-white/50">
            Choose any player — HoopRadar maps their statistical fingerprint and finds the closest
            stylistic twins in the league.
          </p>
        </Panel>
      ) : analyze.phase === "running" ? (
        <AnalyzeOverlay steps={analyze.steps} stepIdx={analyze.stepIdx} accent="#7E8CA0" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <Panel title="Closest comparisons">
              <div className="space-y-2.5">
                {results.map((r, i) => {
                  return (
                    <button
                      key={r.player.id}
                      onClick={() => setActive(i)}
                      className="flex w-full items-center gap-3 rounded-none border p-3 text-left transition"
                      style={{
                        borderColor: i === active ? "#7E8CA055" : "rgba(255,255,255,0.07)",
                        background: i === active ? "#7E8CA00f" : "transparent",
                      }}
                    >
                      <PlayerAvatar player={r.player} size={40} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-white">{r.player.name}</span>
                          <span className="stat-num text-xs text-white/40">{r.player.pos}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {r.reasons.map((reason) => (
                            <span key={reason} className="text-[10px] text-white/45">
                              · {reason}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="stat-num text-lg font-bold text-cyan">{r.score}</div>
                        <div className="text-[9px] uppercase text-white/35">match</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Panel>
          </div>

          <div className="space-y-6">
            <Panel title="Stat fingerprint">
              <div className="flex justify-center">
                <RadarChart
                  axes={RADAR_AXES}
                  series={[
                    { name: player.name, color: "#E0561F", values: radarValues(player) },
                    ...(comp ? [{ name: comp.name, color: "#7E8CA0", values: radarValues(comp) }] : []),
                  ]}
                />
              </div>
              <div className="mt-3 flex items-center justify-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-white/70">
                  <span className="h-2 w-2 rounded-full bg-ember" /> {player.name}
                </span>
                {comp && (
                  <span className="flex items-center gap-1.5 text-white/70">
                    <span className="h-2 w-2 rounded-full bg-cyan" /> {comp.name}
                  </span>
                )}
              </div>
            </Panel>

            {comp && (
              <Insight accent="#7E8CA0">
                <b>{comp.name}</b> is the closest match to <b>{player.name}</b> at{" "}
                <b>{results[active].score}%</b> similarity — {results[active].reasons.join(", ")}.
              </Insight>
            )}
          </div>
        </div>
      )}
    </ToolShell>
  );
}
