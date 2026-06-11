"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { Segmented, Badge } from "@/components/ui/Controls";
import { Meter } from "@/components/ui/Meter";
import { Reveal } from "@/components/ui/Reveal";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { TrackRecord } from "@/components/ui/TrackRecord";
import { getTool, categoryColor } from "@/lib/tools";
import { PLAYERS } from "@/lib/data";
import { FT_RATES, teamFtRates, ftrZScores } from "@/lib/data/ftrate";
import { OFFICIAL_GAMES, refSplits, REF_SMALL_SAMPLE_GAMES } from "@/lib/data/officials";
import { gradeColor } from "@/lib/cn";
import type { Player } from "@/lib/types";

const playerByEspn = (id: number): Player | undefined => PLAYERS.find((p) => p.espnId === id);
type View = "players" | "teams" | "refs";

const signed = (n: number, digits = 1) => `${n >= 0 ? "+" : ""}${n.toFixed(digits)}`;

export default function RefBiasPage() {
  const tool = getTool("ref-bias")!;
  const accent = categoryColor(tool.category);
  const [view, setView] = useState<View>("players");
  const [refQuery, setRefQuery] = useState("");
  const [pickedRef, setPickedRef] = useState<string | null>(null);

  // z-scores are standardized against the full pool, then the table shows the top 40.
  const players = useMemo(() => ftrZScores().sort((a, b) => b.ftr - a.ftr).slice(0, 40), []);
  const teams = useMemo(() => teamFtRates(), []);
  const refs = useMemo(() => refSplits(), []);
  const refsShown = useMemo(
    () => refs.filter((r) => r.official.toLowerCase().includes(refQuery.trim().toLowerCase())),
    [refs, refQuery],
  );
  // Clicking a row picks an official; a search that narrows to one name also picks it.
  const inspected =
    refs.find((r) => r.official === pickedRef) ?? (refsShown.length === 1 ? refsShown[0] : null);
  const maxFtr = players[0]?.ftr ?? 1;
  const leader = players[0];
  const score = (ftr: number) => Math.round((ftr / maxFtr) * 100);

  return (
    <ToolShell tool={tool}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Insight accent={accent}>
          <b>{leader?.name}</b> draws the most contact in the league — a <b>{leader?.ftr.toFixed(2)}</b> free-throw
          rate ({leader?.fta} FTA per {leader?.fga} FGA), <b>{leader && leader.z >= 0 ? "+" : ""}{leader?.z.toFixed(1)}σ</b>{" "}
          above the {FT_RATES.length}-player pool. Free-throw rate is real foul-drawing pressure
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
            { label: "Referees", value: "refs" },
          ]}
        />
      </div>

      <div key={view} className="enter">
        {view === "players" ? (
          <Panel title="Foul-drawn rate · FTA per FGA">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-[11px] text-white/40">
                    <th className="py-2 pl-2 font-medium">#</th>
                    <th className="py-2 font-medium">Player</th>
                    <th className="py-2 font-medium">FT rate</th>
                    <th className="py-2 font-medium">z vs pool</th>
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
                            {r.smallSample && <Badge color="#8E96A4">thin sample</Badge>}
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
                        <td className="stat-num py-2.5 text-white/65">
                          {r.z >= 0 ? "+" : ""}
                          {r.z.toFixed(1)}σ
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
        ) : view === "teams" ? (
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
        ) : (
          <div className="space-y-4">
            <Panel
              title="Officials · 2026 playoff crews"
              right={
                <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 focus-within:border-white/25">
                  <Search size={14} className="text-white/40" />
                  <input
                    value={refQuery}
                    onChange={(e) => {
                      setRefQuery(e.target.value);
                      setPickedRef(null);
                    }}
                    placeholder="Search an official…"
                    aria-label="Search officials"
                    className="w-40 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
                  />
                </label>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-[11px] text-white/40">
                      <th className="py-2 pl-2 font-medium">Official</th>
                      <th className="py-2 font-medium">Games</th>
                      <th className="py-2 font-medium">Total FTA/g</th>
                      <th className="py-2 font-medium">Home−away FTA</th>
                      <th className="py-2 pr-2 font-medium">Biggest team delta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {refsShown.map((r) => {
                      const top = r.teams[0];
                      const active = inspected?.official === r.official;
                      return (
                        <tr
                          key={r.official}
                          onClick={() => setPickedRef(r.official)}
                          className="cursor-pointer border-b border-white/[0.04] transition hover:bg-white/[0.03]"
                          style={active ? { background: `${accent}14` } : undefined}
                        >
                          <td className="py-2.5 pl-2">
                            <span className="text-white/85">{r.official}</span>
                            {r.smallSample && (
                              <Badge color="#8E96A4" className="ml-2">thin sample</Badge>
                            )}
                          </td>
                          <td className="stat-num py-2.5 text-white/65">{r.games}</td>
                          <td className="stat-num py-2.5 text-white/65">{r.avgTotalFta.toFixed(1)}</td>
                          <td className="stat-num py-2.5 text-white/65">{signed(r.avgFtaDiff)}</td>
                          <td className="py-2.5 pr-2">
                            {top ? (
                              <span className="flex items-center gap-2">
                                <TeamLogo abbr={top.team} size={14} />
                                <span className="stat-num text-white/85">{signed(top.delta)} FTA/g</span>
                                {top.smallSample && <Badge color="#8E96A4">thin</Badge>}
                              </span>
                            ) : (
                              <span className="text-white/35">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {refsShown.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-4 pl-2 text-white/45">
                          No official matches that search in the {OFFICIAL_GAMES.length}-game dataset.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>

            {inspected ? (
              <Panel title={`${inspected.official} · per-team free-throw splits`}>
                <p className="mb-3 max-w-2xl text-xs text-white/45">
                  Each row compares a team&rsquo;s average free-throw attempts in the{" "}
                  {inspected.games} playoff games {inspected.official} officiated against that
                  team&rsquo;s other playoff games, with a ±95% bound on the difference (Welch).{" "}
                  <span className="text-white/70">
                    {inspected.teams.filter((t) => t.withinNoise).length} of {inspected.teams.length}{" "}
                    splits here are statistically indistinguishable from chance
                  </span>{" "}
                  — at these sample sizes, that is the expected honest finding.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px] text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-left text-[11px] text-white/40">
                        <th className="py-2 pl-2 font-medium">Team</th>
                        <th className="py-2 font-medium">Games together</th>
                        <th className="py-2 font-medium">FTA/g with</th>
                        <th className="py-2 font-medium">FTA/g without</th>
                        <th className="py-2 pr-2 font-medium">Delta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inspected.teams.map((t) => (
                        <tr key={t.team} className="border-b border-white/[0.04] transition hover:bg-white/[0.03]">
                          <td className="py-2.5 pl-2">
                            <span className="flex items-center gap-2">
                              <TeamLogo abbr={t.team} size={16} />
                              <span className="text-white/85">{t.team}</span>
                              {t.smallSample && <Badge color="#8E96A4">thin sample</Badge>}
                            </span>
                          </td>
                          <td className="stat-num py-2.5 text-white/65">
                            {t.gamesWith} <span className="text-white/35">/ {t.gamesWithout} without</span>
                          </td>
                          <td className="stat-num py-2.5 text-white/65">{t.ftaWith.toFixed(1)}</td>
                          <td className="stat-num py-2.5 text-white/65">{t.ftaWithout.toFixed(1)}</td>
                          <td className="py-2.5 pr-2">
                            <span
                              className="stat-num font-semibold"
                              style={{ color: t.withinNoise ? "#8E96A4" : accent }}
                              title={`±${(1.96 * t.se).toFixed(1)} FTA/g at 95% — ${t.withinNoise ? "within" : "outside"} the noise band`}
                            >
                              {signed(t.delta)}
                            </span>
                            <span className="stat-num ml-1.5 text-[10px] text-white/35">
                              ±{(1.96 * t.se).toFixed(1)}
                            </span>
                            {t.withinNoise && (
                              <span className="ml-1.5 text-[10px] text-white/40">noise</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            ) : (
              <p className="text-sm text-white/45">
                Select an official above — or search a name (try Williams) — to see how every
                team&rsquo;s free-throw volume moves with that crew on the floor.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-8 space-y-3">
        <div>
          <div className="kicker" style={{ color: accent }}>
            Data &amp; method
          </div>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            Free-throw rate (FTA ÷ FGA) is counted from this season&rsquo;s real box-score totals for{" "}
            {FT_RATES.length} players. The z column standardizes each rate against that full pool
            (player FTr minus the pool mean, divided by the pool&rsquo;s standard deviation), so it
            measures how unusual a rate is — a measurable whistle pattern, not an accusation of
            officiating bias. Players whose shot volume projects under 200 field-goal attempts across
            a full season are flagged as thin samples. Real per-call officiating data isn&rsquo;t
            public, so this tool reports rates, not intent.
          </p>
          <p className="mt-2 max-w-2xl text-sm text-[var(--text-muted)]">
            The referees view uses real data too: officiating crews and team free-throw counts for
            all {OFFICIAL_GAMES.length} games of the 2026 playoffs, from ESPN box scores. The
            deltas compare a team&rsquo;s free-throw volume with and without a given official —
            correlations on tiny samples (an official works a handful of games per team), not
            evidence of intent. Playoff FT volume also moves with matchup, pace, and late-game
            fouling, none of which an assignment split controls for.
          </p>
        </div>
        <TrackRecord slug="ref-bias" accent={accent} />
      </div>
    </ToolShell>
  );
}
