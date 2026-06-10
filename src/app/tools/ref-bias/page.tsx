"use client";

import { useMemo, useState } from "react";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { Segmented } from "@/components/ui/Controls";
import { Meter } from "@/components/ui/Meter";
import { Reveal } from "@/components/ui/Reveal";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { TrackRecord } from "@/components/ui/TrackRecord";
import { getTool, categoryColor } from "@/lib/tools";
import { PLAYERS } from "@/lib/data";
import { FT_RATES, teamFtRates } from "@/lib/data/ftrate";
import { gradeColor } from "@/lib/cn";
import type { Player } from "@/lib/types";

const playerByEspn = (id: number): Player | undefined => PLAYERS.find((p) => p.espnId === id);
type View = "players" | "teams";

export default function RefBiasPage() {
  const tool = getTool("ref-bias")!;
  const accent = categoryColor(tool.category);
  const [view, setView] = useState<View>("players");

  const players = useMemo(() => [...FT_RATES].sort((a, b) => b.ftr - a.ftr).slice(0, 40), []);
  const teams = useMemo(() => teamFtRates(), []);
  const maxFtr = players[0]?.ftr ?? 1;
  const leader = players[0];
  const score = (ftr: number) => Math.round((ftr / maxFtr) * 100);

  return (
    <ToolShell tool={tool}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Insight accent={accent}>
          <b>{leader?.name}</b> draws the most contact in the league — a <b>{leader?.ftr.toFixed(2)}</b> free-throw
          rate ({leader?.fta} FTA per {leader?.fga} FGA). Free-throw rate is real foul-drawing pressure
          from this season&rsquo;s box scores; it reflects playstyle and whistle patterns, not a claim
          about referee intent.
        </Insight>
        <Segmented
          accent={accent}
          value={view}
          onChange={setView}
          options={[
            { label: "Players", value: "players" },
            { label: "Teams", value: "teams" },
          ]}
        />
      </div>

      <div key={view} className="enter">
        {view === "players" ? (
          <Panel title="Foul-drawn rate · FTA per FGA">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wide text-white/40">
                    <th className="py-2 pl-2 font-medium">#</th>
                    <th className="py-2 font-medium">Player</th>
                    <th className="py-2 font-medium">FT rate</th>
                    <th className="py-2 font-medium">FTA</th>
                    <th className="py-2 font-medium">FGA</th>
                    <th className="py-2 pr-2 text-right font-medium">FT%</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((r, i) => {
                    const p = playerByEspn(r.espnId);
                    return (
                      <tr key={r.espnId} className="border-b border-white/[0.04] transition hover:bg-white/[0.03]">
                        <td className="stat-num py-2.5 pl-2 text-white/35">{i + 1}</td>
                        <td className="py-2.5">
                          <div className="flex items-center gap-2.5">
                            {p ? <PlayerAvatar player={p} size={28} /> : null}
                            <span className="text-white/85">{r.name}</span>
                            <TeamLogo abbr={r.team} size={14} />
                          </div>
                        </td>
                        <td className="py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-20">
                              <Meter value={score(r.ftr)} color={gradeColor(score(r.ftr))} height={6} />
                            </div>
                            <span className="stat-num w-9 font-semibold" style={{ color: gradeColor(score(r.ftr)) }}>
                              {r.ftr.toFixed(2)}
                            </span>
                          </div>
                        </td>
                        <td className="stat-num py-2.5 text-white/65">{r.fta}</td>
                        <td className="stat-num py-2.5 text-white/65">{r.fga}</td>
                        <td className="stat-num py-2.5 pr-2 text-right text-white/55">{Math.round(r.ftp * 100)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        ) : (
          <Panel title="Team free-throw rate · who gets to the line">
            <div className="grid gap-2.5 sm:grid-cols-2">
              {teams.map((t, i) => (
                <Reveal key={t.team} delay={Math.min(i * 0.02, 0.3)}>
                  <div className="flex items-center gap-3 border border-white/[0.06] bg-white/[0.02] p-3">
                    <span className="stat-num w-5 text-white/35">{i + 1}</span>
                    <TeamLogo abbr={t.team} size={26} />
                    <span className="flex-1 text-sm text-white/85">{t.team}</span>
                    <div className="w-24">
                      <Meter value={Math.round((t.ftr / teams[0].ftr) * 100)} color={gradeColor(Math.round((t.ftr / teams[0].ftr) * 100))} height={6} />
                    </div>
                    <span className="stat-num w-12 text-right font-semibold" style={{ color: accent }}>
                      {t.ftr.toFixed(3)}
                    </span>
                  </div>
                </Reveal>
              ))}
            </div>
          </Panel>
        )}
      </div>

      <div className="mt-8 space-y-3">
        <div>
          <div className="kicker" style={{ color: accent }}>
            Data &amp; method
          </div>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            Free-throw rate (FTA ÷ FGA) is counted from this season&rsquo;s real box-score totals for{" "}
            {FT_RATES.length} players. It surfaces who draws contact most — a measurable whistle pattern,
            not an accusation of officiating bias. Real per-call officiating data isn&rsquo;t public, so
            this tool reports rates, not intent.
          </p>
        </div>
        <TrackRecord slug="ref-bias" accent={accent} />
      </div>
    </ToolShell>
  );
}
