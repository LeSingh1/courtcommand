"use client";

import { useEffect, useMemo, useState } from "react";
import { Shield } from "lucide-react";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { Segmented, Badge } from "@/components/ui/Controls";
import { Meter } from "@/components/ui/Meter";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { getTool, categoryColor } from "@/lib/tools";
import { defenseBoard } from "@/lib/engine/players";
import { gradeColor } from "@/lib/cn";

type SortKey = "defScore" | "rimProtect" | "perimeter";

export default function DefensiveImpactPage() {
  const tool = getTool("defensive-impact")!;
  const ACCENT = categoryColor(tool.category);
  const [sort, setSort] = useState<SortKey>("defScore");

  const [isAnalyzing, setIsAnalyzing] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setIsAnalyzing(false), 500);
    return () => clearTimeout(t);
  }, []);

  const base = useMemo(() => defenseBoard(), []);
  const board = useMemo(
    () => [...base].sort((a, b) => b[sort] - a[sort]),
    [base, sort],
  );

  const bestRim = useMemo(
    () => [...base].sort((a, b) => b.rimProtect - a.rimProtect)[0],
    [base],
  );
  const bestPerimeter = useMemo(
    () => [...base].sort((a, b) => b.perimeter - a.perimeter)[0],
    [base],
  );

  return (
    <ToolShell tool={tool}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Insight accent={ACCENT}>
          {board.length > 0 ? (
            <>
              <b>{board[0].player.name}</b> leads the defensive board on this view. Rim protection
              weights blocks, position, and defensive rebounding; perimeter weights steals, guard
              position, and on-court net.
            </>
          ) : (
            <>No defenders match this view — adjust the sort to see the board.</>
          )}
        </Insight>
        <Segmented
          accent={ACCENT}
          value={sort}
          onChange={setSort}
          options={[
            { label: "Overall", value: "defScore" },
            { label: "Rim", value: "rimProtect" },
            { label: "Perimeter", value: "perimeter" },
          ]}
        />
      </div>

      {/* Podium */}
      {isAnalyzing ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass skeleton h-[148px] rounded-none p-5 animate-pulse" />
          ))}
        </div>
      ) : board.length === 0 ? (
        <Panel className="mb-6 flex min-h-[148px] flex-col items-center justify-center text-center">
          <Shield size={32} className="mb-3" style={{ color: ACCENT }} />
          <p className="text-sm text-white/55">No defenders match this view.</p>
        </Panel>
      ) : (
        <div className="enter mb-6 grid gap-4 sm:grid-cols-3">
          {board.slice(0, 3).map((r, i) => {
            return (
              <div
                key={r.player.id}
                className="enter lift"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="glass rounded-none p-5">
                  <div className="flex items-center justify-between">
                    <span className="display text-4xl text-white/15">#{i + 1}</span>
                    <Shield size={20} style={{ color: gradeColor(r.defScore) }} />
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <PlayerAvatar player={r.player} size={40} />
                    <span className="font-semibold text-white">{r.player.name}</span>
                  </div>
                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <div
                        className="scoreboard text-4xl"
                        style={{ color: gradeColor(r.defScore) }}
                      >
                        {r.defScore}
                      </div>
                      <div className="text-[11px] uppercase text-white/55">
                        Def score · {r.grade}
                      </div>
                    </div>
                    <div className="stat-num text-right text-xs text-white/50">
                      <div>Rim {r.rimProtect}</div>
                      <div>Perim {r.perimeter}</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Panel title="Defensive impact board">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wide text-white/40">
                <th className="py-2 pl-2 font-medium">#</th>
                <th className="py-2 font-medium">Player</th>
                <th className="py-2 font-medium">Def score</th>
                <th className="py-2 text-right font-medium">Rim</th>
                <th className="py-2 text-right font-medium">Perimeter</th>
                <th className="py-2 text-right font-medium">Opp FG%</th>
                <th className="py-2 pr-2 text-right font-medium">Grade</th>
              </tr>
            </thead>
            <tbody>
              {board.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-white/55">
                    No defenders match this view.
                  </td>
                </tr>
              )}
              {board.map((r, i) => {
                return (
                  <tr
                    key={r.player.id}
                    className="border-b border-white/[0.04] transition hover:bg-white/[0.03]"
                  >
                    <td className="stat-num py-2.5 pl-2 text-white/55">{i + 1}</td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2.5">
                        <PlayerAvatar player={r.player} size={28} />
                        <span className="text-white/85">{r.player.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-16">
                          <Meter value={r.defScore} color={gradeColor(r.defScore)} height={6} />
                        </div>
                        <span
                          className="stat-num w-6 font-semibold"
                          style={{ color: gradeColor(r.defScore) }}
                        >
                          {r.defScore}
                        </span>
                      </div>
                    </td>
                    <td className="stat-num py-2.5 text-right text-white/65">{r.rimProtect}</td>
                    <td className="stat-num py-2.5 text-right text-white/65">{r.perimeter}</td>
                    <td className="stat-num py-2.5 text-right text-white/65">{r.oppFg}%</td>
                    <td className="py-2.5 pr-2 text-right">
                      <Badge color={gradeColor(r.defScore)}>{r.grade}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {bestRim && bestPerimeter && (
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Insight accent={ACCENT}>
          <b>{bestRim.player.name}</b> is the league&apos;s best rim protector (
          <b>{bestRim.rimProtect}</b> rim score), walling off the paint and holding opponents to{" "}
          <b>{bestRim.oppFg}%</b> at the rim.
        </Insight>
        <Insight accent="#5FA97E">
          <b>{bestPerimeter.player.name}</b> is the top perimeter stopper (
          <b>{bestPerimeter.perimeter}</b> perimeter score) — disruptive hands and point-of-attack
          containment.
        </Insight>
      </div>
      )}
    </ToolShell>
  );
}
