"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Newspaper, Trophy } from "lucide-react";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { Field } from "@/components/ui/Controls";
import { Reveal } from "@/components/ui/Reveal";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { AnalyzeOverlay, useAnalyze } from "@/components/ui/Analyze";
import { TrackRecord } from "@/components/ui/TrackRecord";
import { getTool } from "@/lib/tools";
import { TEAMS, TEAM_MAP, playersByTeam } from "@/lib/data";
import { gameRecap, type BoxLine } from "@/lib/engine/game";
import { spring } from "@/lib/motion";
import type { Player } from "@/lib/types";

const EMBER = "#4D8DFF";

const HEADLINE_LABELS: Record<string, string> = {
  straight: "Straight",
  dramatic: "Dramatic",
  "stat-led": "Stat-led",
};

// build star BoxLines from the team's top-2 scorers
function starsFor(abbr: string): BoxLine[] {
  return [...playersByTeam(abbr)]
    .sort((x, y) => y.ppg - x.ppg)
    .slice(0, 2)
    .map((p) => ({
      name: p.name,
      pts: Math.round(p.ppg),
      reb: Math.round(p.rpg),
      ast: Math.round(p.apg),
    }));
}

export default function GameRecapPage() {
  const tool = getTool("game-recap")!;
  const [homeTeam, setHomeTeam] = useState("BOS");
  const [awayTeam, setAwayTeam] = useState("LAL");
  const [homeScore, setHomeScore] = useState(118);
  const [awayScore, setAwayScore] = useState(112);
  const [recap, setRecap] = useState<ReturnType<typeof gameRecap> | null>(null);
  const [headlineIdx, setHeadlineIdx] = useState(0);

  const analyze = useAnalyze([
    "Parsing the box score…",
    "Identifying turning points…",
    "Crowning the top performer…",
    "Writing the story…",
  ]);

  const homeStars = useMemo(() => starsFor(homeTeam), [homeTeam]);
  const awayStars = useMemo(() => starsFor(awayTeam), [awayTeam]);

  // map a star/box-line name back to a Player for headshots
  const playerByName = useMemo(() => {
    const m = new Map<string, Player>();
    for (const p of [...playersByTeam(homeTeam), ...playersByTeam(awayTeam)]) {
      m.set(p.name, p);
    }
    return m;
  }, [homeTeam, awayTeam]);

  const home = TEAM_MAP[homeTeam];
  const away = TEAM_MAP[awayTeam];

  const generate = () => {
    if (homeTeam === awayTeam) return;
    analyze.run(() => {
      setHeadlineIdx(0);
      setRecap(gameRecap({ homeTeam, awayTeam, homeScore, awayScore, homeStars, awayStars }));
    });
  };

  return (
    <ToolShell tool={tool}>
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Panel title="Box score input">
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Home team">
                <TeamSelect value={homeTeam} onChange={setHomeTeam} />
              </Field>
              <Field label="Home score">
                <ScoreInput value={homeScore} onChange={setHomeScore} />
              </Field>
              <Field label="Away team">
                <TeamSelect value={awayTeam} onChange={setAwayTeam} />
              </Field>
              <Field label="Away score">
                <ScoreInput value={awayScore} onChange={setAwayScore} />
              </Field>
            </div>

            {homeTeam === awayTeam && (
              <p className="text-[11px] text-rose">Pick two different teams.</p>
            )}

            <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3">
              <div className="mb-2 text-[10px] text-white/40">Auto star lines</div>
              <div className="space-y-1.5">
                {[...homeStars, ...awayStars].map((s) => {
                  const sp = playerByName.get(s.name);
                  return (
                    <div key={s.name} className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex min-w-0 items-center gap-2 text-white/70">
                        {sp && <PlayerAvatar player={sp} size={22} />}
                        <span className="truncate">{s.name}</span>
                      </span>
                      <span className="stat-num shrink-0 text-white/50">
                        {s.pts}p · {s.reb}r · {s.ast}a
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <motion.button
              onClick={generate}
              whileTap={{ scale: 0.96 }}
              transition={spring.snappy}
              className="btn-ember w-full rounded-lg py-3 text-sm"
            >
              Generate recap
            </motion.button>
          </div>
        </Panel>

        <div className="space-y-6">
          {analyze.phase === "running" ? (
            <AnalyzeOverlay steps={analyze.steps} stepIdx={analyze.stepIdx} accent={EMBER} />
          ) : recap ? (
            <AnimatePresence mode="wait">
            <motion.div
              key={recap.headline}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={spring.soft}
            >
            <Panel>
              <div className="eyebrow mb-2 text-ember">Final · Recap</div>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {recap.headline_options.map((o, i) => (
                  <button
                    key={o.style}
                    onClick={() => setHeadlineIdx(i)}
                    className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#4D8DFF]"
                    style={
                      i === headlineIdx
                        ? { background: EMBER, color: "#061129" }
                        : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)" }
                    }
                  >
                    {HEADLINE_LABELS[o.style] ?? o.style}
                  </button>
                ))}
              </div>
              <Reveal>
                <h2 className="display text-2xl leading-tight text-white sm:text-3xl">
                  {recap.headline_options[headlineIdx]?.text ?? recap.headline}
                </h2>
              </Reveal>

              {/* score line */}
              <div className="my-5 flex items-center gap-4 rounded-lg border border-white/[0.07] bg-white/[0.02] p-4">
                <ScoreSide abbr={awayTeam} score={awayScore} win={awayScore > homeScore} />
                <span className="stat-num text-sm text-white/30">@</span>
                <ScoreSide abbr={homeTeam} score={homeScore} win={homeScore > awayScore} />
              </div>

              <div className="space-y-3.5">
                {recap.body.map((para, i) => (
                  <Reveal key={i}>
                    <p className="text-sm leading-relaxed text-white/75">{para}</p>
                  </Reveal>
                ))}
              </div>

              {/* key facts */}
              <Reveal>
                <div className="mt-5 rounded-lg border border-white/[0.07] bg-white/[0.02] p-4">
                  <div className="kicker mb-2" style={{ color: EMBER }}>
                    Key facts
                  </div>
                  <ul className="space-y-1.5">
                    {recap.key_facts.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-xs text-white/65">
                        <span className="mt-[5px] h-1 w-1 shrink-0 rounded-lg" style={{ background: EMBER }} />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>

              {/* player of the game */}
              {recap.topPerformer && (
                <Reveal>
                  <div className="mt-6 flex items-center gap-4 rounded-lg border border-[#D7BC6A33] bg-[#D7BC6A0d] p-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#D7BC6A22]">
                      <Trophy size={22} className="text-gold" />
                    </div>
                    <div className="flex flex-1 items-center gap-3">
                      {playerByName.get(recap.topPerformer.name) && (
                        <PlayerAvatar player={playerByName.get(recap.topPerformer.name)!} size={40} />
                      )}
                      <div>
                        <div className="text-[10px] text-white/45">Player of the Game</div>
                        <div className="font-semibold text-white">{recap.topPerformer.name}</div>
                      </div>
                    </div>
                    <div className="flex gap-4 text-right">
                      <StatCell value={recap.topPerformer.pts} label="PTS" />
                      <StatCell value={recap.topPerformer.reb} label="REB" />
                      <StatCell value={recap.topPerformer.ast} label="AST" />
                    </div>
                  </div>
                </Reveal>
              )}
            </Panel>
            </motion.div>
            </AnimatePresence>
          ) : (
            <Panel className="flex h-full min-h-[320px] flex-col items-center justify-center text-center">
              <Newspaper size={40} className="mb-4 text-ember" />
              <p className="max-w-xs text-sm text-white/50">
                Set the matchup and final score — the auto-writer turns it into an ESPN-style recap with a
                Player of the Game.
              </p>
            </Panel>
          )}

          {recap && recap.topPerformer && home && away && (
            <Insight accent={EMBER}>
              <b>{recap.topPerformer.name}</b> headlines the night with a {recap.topPerformer.pts}/
              {recap.topPerformer.reb}/{recap.topPerformer.ast} line in a{" "}
              {Math.abs(homeScore - awayScore)}-point decision.
            </Insight>
          )}
        </div>
      </div>

      <div className="mt-8 space-y-3">
        <div>
          <div className="kicker" style={{ color: "#D7BC6A" }}>Model track record</div>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            The recap writer is built on real player-season data that deepens each year from 2003 to today — the panel
            below shows that growing season count along with the model's validation metric and how it was measured.
            The headline variants and key facts are deterministic templates filled only from the box score you enter
            (teams, final score, and the auto star lines) — nothing in them is invented beyond that input.
          </p>
        </div>
        <TrackRecord slug="game-recap" accent="#D7BC6A" />
      </div>
    </ToolShell>
  );
}

function TeamSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition focus:border-white/25"
    >
      {TEAMS.map((t) => (
        <option key={t.abbr} value={t.abbr} className="bg-[#0a0c11] text-white">
          {t.city} {t.name}
        </option>
      ))}
    </select>
  );
}

function ScoreInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(Math.max(0, parseInt(e.target.value || "0", 10)))}
      className="stat-num w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition focus:border-white/25"
    />
  );
}

function ScoreSide({ abbr, score, win }: { abbr: string; score: number; win: boolean }) {
  const team = TEAM_MAP[abbr];
  return (
    <div className="flex flex-1 items-center gap-3">
      <TeamLogo abbr={abbr} size={40} />
      <div>
        <div className="text-xs text-white/55">{team?.name}</div>
        <div
          className="scoreboard text-3xl"
          style={{ color: win ? "#fff" : "rgba(255,255,255,0.45)" }}
        >
          {score}
        </div>
      </div>
      {win && <ChevronRight size={16} className="text-ember" />}
    </div>
  );
}

function StatCell({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="scoreboard text-xl text-white">{value}</div>
      <div className="text-[9px] text-white/40">{label}</div>
    </div>
  );
}
