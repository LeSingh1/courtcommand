"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Flame, Loader2 } from "lucide-react";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { LineChart } from "@/components/ui/LineChart";
import { Reveal } from "@/components/ui/Reveal";
import { Badge } from "@/components/ui/Controls";
import { TrackRecord } from "@/components/ui/TrackRecord";
import { getTool } from "@/lib/tools";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { loadRealShots, playoffGames, gameMomentum, type RealShot } from "@/lib/data/shots";

const ACCENT = "#2BD68B";
const AWAY = "#41C7E0";
const COLD = "#00E07F";

export default function MomentumPage() {
  const tool = getTool("momentum")!;
  const [shots, setShots] = useState<RealShot[] | null>(null);
  useEffect(() => {
    let alive = true;
    loadRealShots().then((d) => alive && setShots(d));
    return () => {
      alive = false;
    };
  }, []);

  const games = useMemo(() => (shots ? playoffGames(shots) : []), [shots]);
  const [gameId, setGameId] = useState<string>("");
  useEffect(() => {
    if (!gameId && games[0]) setGameId(games[0].gameId);
  }, [games, gameId]);

  const mom = useMemo(() => (shots && gameId ? gameMomentum(shots, gameId) : null), [shots, gameId]);

  if (!shots) {
    return (
      <ToolShell tool={tool}>
        <Panel className="flex min-h-[360px] flex-col items-center justify-center gap-3 text-center">
          <Loader2 size={22} className="animate-spin text-[var(--text-faint)]" />
          <p className="text-sm text-white/50">Loading the playoff play-by-play…</p>
        </Panel>
      </ToolShell>
    );
  }

  const [A, B] = mom?.teams ?? ["", ""];
  const finalMargin = mom?.timeline.at(-1)?.margin ?? 0;
  const biggest = mom?.biggest ?? null;
  const game = games.find((g) => g.gameId === gameId);

  return (
    <ToolShell tool={tool}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Insight accent={ACCENT}>
          {biggest ? (
            <>
              The biggest run of <b>{game?.game}</b> was a <b style={{ color: biggest.team === A ? ACCENT : AWAY }}>{biggest.pts}-0 {biggest.team} surge</b> in
              Q{biggest.period}. {mom?.runs.length} scoring runs of 6+ in all — reconstructed from the
              real playoff play-by-play (field-goal margin; free throws aren&rsquo;t in public shot data).
            </>
          ) : (
            "Pick a playoff game to chart its momentum."
          )}
        </Insight>
        <select
          value={gameId}
          onChange={(e) => setGameId(e.target.value)}
          aria-label="Pick a playoff game"
          className="cursor-pointer border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm font-semibold text-white outline-none"
        >
          {games.map((g) => (
            <option key={g.gameId} value={g.gameId}>
              {g.game} · {(g.date || "").slice(5, 10)}
            </option>
          ))}
        </select>
      </div>

      {mom && (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <Reveal>
              <Panel
                title="Field-goal margin timeline"
                right={
                  <span className="stat-num flex items-center gap-2 text-xs text-white/50">
                    <TeamLogo abbr={A} size={15} />
                    <span style={{ color: finalMargin >= 0 ? ACCENT : AWAY }}>
                      {finalMargin >= 0 ? `${A} +${finalMargin}` : `${B} +${-finalMargin}`}
                    </span>
                    <TeamLogo abbr={B} size={15} />
                  </span>
                }
              >
                <LineChart
                  height={240}
                  yMin={Math.min(-12, ...mom.timeline.map((p) => p.margin)) - 2}
                  yMax={Math.max(12, ...mom.timeline.map((p) => p.margin)) + 2}
                  series={[{ name: "Margin", color: ACCENT, points: mom.timeline.map((p) => p.margin) }]}
                  labels={mom.timeline.map((p) => (p.i % Math.ceil(mom.timeline.length / 6) === 0 ? `Q${p.period}` : ""))}
                />
                <div className="mt-2 flex items-center justify-between text-[11px] text-white/50">
                  <span>Above the line = {A} ahead</span>
                  <span>{mom.timeline.length} made field goals</span>
                </div>
              </Panel>
            </Reveal>

            <Reveal delay={0.02}>
              <Panel title="How they answered · response to every 8-0+ run">
                {mom.keyShiftEvents.length === 0 ? (
                  <p className="py-5 text-center text-xs text-white/50">
                    No 8-0 runs in this game — no timeout-scale swings to answer.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {mom.keyShiftEvents.map((e, i) => {
                      const resp = e.response;
                      const tone = resp ? (resp.improved ? ACCENT : COLD) : "#8E96A4";
                      return (
                        <div
                          key={`${e.run.startIdx}-${i}`}
                          className="flex items-start gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
                        >
                          <TeamLogo abbr={e.run.team} size={18} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-sm font-semibold text-white/90">
                                {e.run.pts}-0 {e.run.team} run · Q{e.run.period} {e.run.clock}
                              </span>
                              <Badge color={tone}>
                                {resp ? (resp.improved ? "Answered" : "No answer") : "Game over"}
                              </Badge>
                            </div>
                            <p className="mt-1 text-xs leading-snug text-white/60">{e.label}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <p className="mt-3 border-t border-white/[0.06] pt-2.5 text-[11px] text-white/45">
                  Timeout proxy: public play-by-play shot data has no timeout events, so each 8-0+ run
                  is followed by the conceding team&rsquo;s next five field-goal attempts, compared to
                  its FG% up to that point.
                </p>
              </Panel>
            </Reveal>
          </div>

          <Reveal delay={0.04}>
            <Panel title="Scoring runs (6+ points)">
              <div className="no-scrollbar max-h-[420px] space-y-2.5 overflow-y-auto">
                {mom.runs.length === 0 && (
                  <p className="py-6 text-center text-xs text-white/50">No 6-0 runs in this game.</p>
                )}
                {mom.runs.map((r, i) => {
                  const home = r.team === A;
                  const clr = home ? ACCENT : AWAY;
                  return (
                    <motion.div
                      key={`${r.startIdx}-${i}`}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i * 0.03, 0.3) }}
                      className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center" style={{ background: `${clr}1f` }}>
                        <Flame size={15} style={{ color: clr }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-sm font-semibold text-white/90">
                            <TeamLogo abbr={r.team} size={15} /> {r.pts}-0 run
                          </span>
                          <span className="stat-num shrink-0 text-[11px] text-white/45">
                            Q{r.period} {r.clock}
                          </span>
                        </div>
                        <div className="stat-num mt-0.5 text-[11px]" style={{ color: clr }}>
                          {r.team} pulled away
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </Panel>
          </Reveal>
        </div>
      )}

      <div className="mt-8 space-y-3">
        <div>
          <div className="kicker" style={{ color: ACCENT }}>
            Model track record
          </div>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            The runs and post-run responses above are counted directly from real 2026 playoff
            play-by-play (field-goal attempts only — free throws and timeouts aren&rsquo;t in public
            shot data, so the &ldquo;answer&rdquo; window is a proxy, not a literal timeout read). The
            panel below shows the real training-data history the run-detection heuristics were tuned
            on.
          </p>
        </div>
        <TrackRecord slug="momentum" accent={ACCENT} />
      </div>
    </ToolShell>
  );
}
