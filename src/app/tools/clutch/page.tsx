"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Flame, Loader2 } from "lucide-react";
import { spring } from "@/lib/motion";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { Segmented, Badge } from "@/components/ui/Controls";
import { ebShrink, wilsonCI } from "@/lib/engine/stats";
import { Meter } from "@/components/ui/Meter";
import { Reveal } from "@/components/ui/Reveal";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { TrackRecord } from "@/components/ui/TrackRecord";
import { getTool, categoryColor } from "@/lib/tools";
import { PLAYERS } from "@/lib/data";
import { loadRealShots, clutchLeaders, type ClutchLeader, type ClutchOptions } from "@/lib/data/shots";
import { gradeColor } from "@/lib/cn";
import type { Player } from "@/lib/types";

const playerByEspn = (id: number): Player | undefined => PLAYERS.find((p) => p.espnId === id);
type SortKey = "pts" | "efg" | "att";
type DefKey = "5" | "2" | "ot";

const DEFS: Record<DefKey, { label: string; opts: ClutchOptions; minAtt: number; title: string; phrase: string }> = {
  "5": {
    label: "Last 5:00",
    opts: { lastMinutes: 5 },
    minAtt: 6,
    title: "last 5:00, Q4 + OT",
    phrase: "the final five minutes of the fourth quarter and overtime",
  },
  "2": {
    label: "Last 2:00",
    opts: { lastMinutes: 2 },
    minAtt: 3,
    title: "last 2:00, Q4 + OT",
    phrase: "the final two minutes of the fourth quarter and overtime",
  },
  ot: {
    label: "OT only",
    opts: { otOnly: true },
    minAtt: 2,
    title: "overtime periods only",
    phrase: "overtime periods",
  },
};

export default function ClutchPage() {
  const tool = getTool("clutch")!;
  const accent = categoryColor(tool.category);
  const [sort, setSort] = useState<SortKey>("pts");
  const [def, setDef] = useState<DefKey>("5");
  const [shots, setShots] = useState<Awaited<ReturnType<typeof loadRealShots>> | null>(null);
  useEffect(() => {
    let alive = true;
    loadRealShots().then((d) => alive && setShots(d));
    return () => {
      alive = false;
    };
  }, []);

  const board = useMemo<ClutchLeader[]>(() => {
    if (!shots) return [];
    const b = clutchLeaders(shots, DEFS[def].minAtt, DEFS[def].opts);
    return [...b].sort((a, b) =>
      sort === "pts" ? b.pts - a.pts : sort === "efg" ? b.efg - a.efg : b.att - a.att,
    );
  }, [shots, sort, def]);

  if (!shots) {
    return (
      <ToolShell tool={tool}>
        <Panel className="flex min-h-[360px] flex-col items-center justify-center gap-3 text-center">
          <Loader2 size={22} className="animate-spin text-[var(--text-faint)]" />
          <p className="text-sm text-white/50">Counting every clutch-time playoff shot…</p>
        </Panel>
      </ToolShell>
    );
  }

  const leader = board[0];
  const score = (r: ClutchLeader) => Math.round(r.efg * 100);

  return (
    <ToolShell tool={tool}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Insight accent={accent}>
          {leader ? (
            <>
              <b>{leader.player}</b> leads the 2026 playoffs in clutch-time scoring —{" "}
              <b>{leader.pts} points</b> on {Math.round(leader.fgPct * 100)}% shooting in {DEFS[def].phrase}.
              Every number here is counted from the real playoff play-by-play; rows under 10 attempts
              are dimmed.
            </>
          ) : (
            "No shots match this clutch definition yet."
          )}
        </Insight>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <Segmented
            accent={accent}
            value={def}
            onChange={setDef}
            options={[
              { label: "Last 5:00", value: "5" },
              { label: "Last 2:00", value: "2" },
              { label: "OT only", value: "ot" },
            ]}
          />
          <Segmented
            accent={accent}
            value={sort}
            onChange={setSort}
            options={[
              { label: "Points", value: "pts" },
              { label: "Efficiency", value: "efg" },
              { label: "Volume", value: "att" },
            ]}
          />
        </div>
      </div>

      <div key={`${sort}-${def}`} className="enter">
        {/* podium */}
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          {board.slice(0, 3).map((r, i) => {
            const p = playerByEspn(r.espnId);
            return (
              <Reveal key={r.espnId} delay={i * 0.08}>
                <motion.div
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.97 }}
                  transition={spring.snappy}
                  className="glass relative overflow-hidden rounded-lg p-5"
                >
                  <div className="flex items-center justify-between">
                    <span className="display text-4xl text-white/15">#{i + 1}</span>
                    <Flame size={20} style={{ color: gradeColor(score(r)) }} />
                  </div>
                  <div className="mt-2 flex items-center gap-2.5">
                    {p ? <PlayerAvatar player={p} size={44} /> : null}
                    <span className="font-semibold text-white">{r.player}</span>
                    {r.smallSample && <Badge color="#8E96A4">{r.att} att</Badge>}
                  </div>
                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <div className="scoreboard text-4xl" style={{ color: gradeColor(score(r)) }}>
                        {r.pts}
                      </div>
                      <div className="text-[11px] text-white/55">Clutch points</div>
                    </div>
                    <div className="stat-num text-right text-xs text-white/50">
                      <div>{Math.round(r.fgPct * 100)}% FG</div>
                      <div>
                        {r.threeMade}/{r.threeAtt} 3PT
                      </div>
                      <div>{r.att} att</div>
                    </div>
                  </div>
                </motion.div>
              </Reveal>
            );
          })}
        </div>

        <Panel title={`Clutch-time leaderboard · ${DEFS[def].title}`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-[11px] text-white/40">
                  <th className="py-2 pl-2 font-medium">#</th>
                  <th className="py-2 font-medium">Player</th>
                  <th className="py-2 font-medium">Pts</th>
                  <th className="py-2 font-medium">FG</th>
                  <th className="py-2 font-medium">3PT</th>
                  <th className="py-2 font-medium">eFG%</th>
                  <th className="py-2 font-medium">Adj FG%</th>
                  <th className="py-2 pr-2 text-right font-medium">Att</th>
                </tr>
              </thead>
              <tbody>
                {board.map((r, i) => {
                  const p = playerByEspn(r.espnId);
                  return (
                    <tr
                      key={r.espnId}
                      className={`border-b border-white/[0.04] transition hover:bg-white/[0.03] ${r.smallSample ? "opacity-60" : ""}`}
                    >
                      <td className="stat-num py-2.5 pl-2 text-white/35">{i + 1}</td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2.5">
                          {p ? <PlayerAvatar player={p} size={28} /> : null}
                          <span className="text-white/85">{r.player}</span>
                          {r.smallSample && (
                            <span className="stat-num text-[11px] text-[var(--text-faint)]">{r.att} att</span>
                          )}
                        </div>
                      </td>
                      <td className="stat-num py-2.5 font-semibold text-white/85">{r.pts}</td>
                      <td className="stat-num py-2.5 text-white/65">
                        {r.made}/{r.att}
                      </td>
                      <td className="stat-num py-2.5 text-white/65">
                        {r.threeMade}/{r.threeAtt}
                      </td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-16">
                            <Meter value={Math.round(r.efg * 100)} color={gradeColor(score(r))} height={6} />
                          </div>
                          <span className="stat-num w-9 font-semibold" style={{ color: gradeColor(score(r)) }}>
                            {Math.round(r.efg * 100)}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5">
                        {(() => {
                          const prior = p?.fgp ?? 0.47;
                          const adj = ebShrink(r.fgPct, r.att, prior, 15);
                          const [lo, hi] = wilsonCI(r.made, r.att);
                          return (
                            <span
                              className="stat-num text-white/75"
                              title={`Raw ${Math.round(r.fgPct * 100)}% on ${r.att} att (95% CI ${Math.round(lo * 100)}–${Math.round(hi * 100)}%), shrunk toward season ${Math.round(prior * 100)}%`}
                            >
                              {Math.round(adj * 100)}%
                              <span className="ml-1 text-[10px] text-[var(--text-faint)]">
                                ±{Math.round(((hi - lo) / 2) * 100)}
                              </span>
                            </span>
                          );
                        })()}
                      </td>
                      <td className="stat-num py-2.5 pr-2 text-right text-white/55">{r.att}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] text-[var(--text-faint)]">
            Rows under 10 attempts are dimmed. Adj FG% is empirical-Bayes shrinkage: the clutch rate
            pulled toward the player&rsquo;s own season FG% with a 15-attempt prior weight, shown with
            a 95% Wilson interval — at these sample sizes, the regressed number is the honest one.
          </p>
        </Panel>
      </div>

      <div className="mt-8 space-y-3">
        <div>
          <div className="kicker" style={{ color: accent }}>
            Model track record
          </div>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            The leaderboard above is counted directly from real 2026 playoff play-by-play under the
            selected clutch definition (the time window applies to the end of Q4 and of each overtime;
            OT-only counts any overtime shot). Rows under 10 attempts are dimmed and tighter windows
            use a lower attempt floor, so read those rates loosely. The panel below
            validates the player-rating model the clutch grades lean on, season by season since 2003
            (about r=0.89).
          </p>
        </div>
        <TrackRecord slug="clutch" accent={accent} />
      </div>
    </ToolShell>
  );
}
