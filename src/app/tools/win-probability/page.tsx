"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { spring } from "@/lib/motion";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { Slider, Segmented, Field } from "@/components/ui/Controls";
import { Meter } from "@/components/ui/Meter";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { LineChart } from "@/components/ui/LineChart";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { getTool, categoryColor } from "@/lib/tools";
import { winProbability, gameWinProbCurve, biggestSwings } from "@/lib/engine/game";
import { loadRealShots, playoffGames, type RealShot } from "@/lib/data/shots";

const STRENGTHS: { label: string; value: string }[] = [
  { label: "Underdog", value: "-4" },
  { label: "Even", value: "0" },
  { label: "Favorite", value: "4" },
];

function fmtClock(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const DEFAULTS = { margin: 3, secondsLeft: 360, homeStrengthStr: "0", homeHasBall: true };

export default function WinProbabilityPage() {
  const tool = getTool("win-probability")!;
  const accent = categoryColor(tool.category);
  const [margin, setMargin] = useState(DEFAULTS.margin);
  const [secondsLeft, setSecondsLeft] = useState(DEFAULTS.secondsLeft);
  const [homeStrengthStr, setHomeStrengthStr] = useState(DEFAULTS.homeStrengthStr);
  const [homeHasBall, setHomeHasBall] = useState(DEFAULTS.homeHasBall);

  const homeStrength = Number(homeStrengthStr);

  const [isComputing, setIsComputing] = useState(false);
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setIsComputing(true);
    const id = window.setTimeout(() => setIsComputing(false), 220);
    return () => window.clearTimeout(id);
  }, [margin, secondsLeft, homeHasBall, homeStrength]);

  const atDefaults =
    margin === DEFAULTS.margin &&
    secondsLeft === DEFAULTS.secondsLeft &&
    homeStrengthStr === DEFAULTS.homeStrengthStr &&
    homeHasBall === DEFAULTS.homeHasBall;

  const wp = useMemo(
    () => winProbability({ margin, secondsLeft, homeHasBall, homeStrength }),
    [margin, secondsLeft, homeHasBall, homeStrength],
  );

  // Real playoff game curve: the trained model run across an actual game's margins.
  const [shots, setShots] = useState<RealShot[] | null>(null);
  useEffect(() => {
    let alive = true;
    loadRealShots().then((d) => alive && setShots(d));
    return () => {
      alive = false;
    };
  }, []);
  const games = useMemo(() => (shots ? playoffGames(shots) : []), [shots]);
  const [gameId, setGameId] = useState("");
  useEffect(() => {
    if (!gameId && games[0]) setGameId(games[0].gameId);
  }, [games, gameId]);
  const curve = useMemo(() => (shots && gameId ? gameWinProbCurve(shots, gameId) : null), [shots, gameId]);
  const swingReport = useMemo(() => (curve ? biggestSwings(curve) : null), [curve]);
  const game = games.find((g) => g.gameId === gameId);
  const [A, B] = curve?.teams ?? ["", ""];

  return (
    <ToolShell tool={tool}>
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Controls */}
        <Panel title="Game state">
          <div className="space-y-5">
            <Slider label="Home margin" value={margin} min={-20} max={20} accent={accent} onChange={setMargin} />
            <div>
              <Slider
                label="Time left"
                value={secondsLeft}
                min={0}
                max={2880}
                step={30}
                accent={accent}
                onChange={setSecondsLeft}
              />
              <div className="stat-num mt-1 text-right text-[11px] text-white/55">
                {fmtClock(secondsLeft)} remaining
              </div>
            </div>
            <Field label="Home team strength">
              <Segmented accent={accent} value={homeStrengthStr} onChange={setHomeStrengthStr} options={STRENGTHS} />
            </Field>
            <Field label="Possession">
              <Segmented
                accent={accent}
                value={homeHasBall ? "home" : "away"}
                onChange={(v) => setHomeHasBall(v === "home")}
                options={[
                  { label: "Home has ball", value: "home" },
                  { label: "Away has ball", value: "away" },
                ]}
              />
            </Field>
          </div>
        </Panel>

        {/* Result */}
        <div className="space-y-6">
          <Panel>
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <div className="eyebrow mb-1" style={{ color: accent }}>
                Home Win Probability
              </div>
              {isComputing ? (
                <div className="skeleton h-[72px] w-44" aria-hidden />
              ) : (
                <div className="scoreboard text-7xl" style={{ color: accent }}>
                  <AnimatedNumber value={wp} decimals={1} suffix="%" />
                </div>
              )}
              <div className="stat-num mt-1 text-xs text-white/55">
                Away {(100 - wp).toFixed(1)}% · {homeHasBall ? "home" : "away"} ball · {fmtClock(secondsLeft)} left
              </div>
              <div className="mt-5 w-full max-w-md">
                <Meter value={wp} color={accent} height={10} />
                <div className="mt-1.5 flex justify-between text-[10px] text-white/55">
                  <span>Away</span>
                  <span>Home</span>
                </div>
              </div>
              {atDefaults && (
                <div className="mt-3 text-[11px] text-[var(--text-faint)]">
                  Adjust margin, clock, strength, or possession to model a live situation.
                </div>
              )}
            </div>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
            <Panel
              title="Win probability · real playoff game"
              right={
                games.length ? (
                  <select
                    value={gameId}
                    onChange={(e) => setGameId(e.target.value)}
                    aria-label="Pick a playoff game"
                    className="cursor-pointer border border-[var(--line)] bg-[var(--bg)] px-2 py-1 text-[11px] font-semibold text-white outline-none"
                  >
                    {games.map((g) => (
                      <option key={g.gameId} value={g.gameId}>
                        {g.game} · {(g.date || "").slice(5, 10)}
                      </option>
                    ))}
                  </select>
                ) : null
              }
            >
              {curve ? (
                <>
                  <LineChart
                    series={[{ name: A, color: accent, points: curve.home }]}
                    labels={curve.t.map(() => "")}
                    yMin={0}
                    yMax={100}
                    yLabel={`${A} WP %`}
                    height={220}
                  />
                  <div className="mt-2 flex items-center justify-between text-[11px] text-white/50">
                    <span className="flex items-center gap-1.5">
                      <TeamLogo abbr={A} size={14} /> {A}
                    </span>
                    <span>{curve.t.length} made field goals</span>
                    <span className="flex items-center gap-1.5">
                      {B} <TeamLogo abbr={B} size={14} />
                    </span>
                  </div>
                  {swingReport && (
                    <div className="mt-4 border-t border-white/[0.07] pt-3">
                      <div className="kicker mb-2" style={{ color: accent }}>
                        Biggest swings
                      </div>
                      {swingReport.swings.length ? (
                        <div className="flex flex-wrap gap-1.5">
                          {swingReport.swings.map((s) => (
                            <span
                              key={s.index}
                              className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-white/75"
                            >
                              <span
                                className="stat-num mr-1.5 font-semibold"
                                style={{ color: s.delta > 0 ? accent : "#F4647D" }}
                              >
                                {s.delta > 0 ? "+" : ""}
                                {s.delta}%
                              </span>
                              {s.label}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-white/40">No single make moved the needle in this game.</p>
                      )}
                      <div className="stat-num mt-2 text-[11px] text-white/55">
                        {swingReport.turningPoint
                          ? `Turning point: ${swingReport.turningPoint.label} — make ${
                              swingReport.turningPoint.index + 1
                            } of ${curve.home.length}, ${swingReport.turningPoint.wp}% ${A} WP.`
                          : `Wire-to-wire: the WP lead never changed hands.`}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex min-h-[220px] items-center justify-center text-sm text-white/40">
                  Loading the playoff play-by-play…
                </div>
              )}
            </Panel>
            <Panel title="Scoring runs">
              <div className="space-y-2.5">
                {curve?.events.length ? (
                  curve.events.map((e, i) => (
                    <motion.div
                      key={`${e.t}-${i}`}
                      whileHover={{ y: -3 }}
                      transition={spring.snappy}
                      className="enter flex items-center gap-2.5 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2"
                      style={{ animationDelay: `${i * 40}ms` }}
                    >
                      <span
                        className="stat-num flex h-6 w-6 shrink-0 items-center justify-center text-[10px] font-bold"
                        style={{ background: `${accent}1f`, color: accent }}
                      >
                        {i + 1}
                      </span>
                      <span className="text-xs text-white/70">{e.label}</span>
                    </motion.div>
                  ))
                ) : (
                  <p className="text-xs text-white/40">No 6-0+ runs in this game.</p>
                )}
                {curve ? (
                  <div className="stat-num pt-1 text-[11px] text-white/55">
                    Final {A} WP: {curve.home[curve.home.length - 1]}% ·{" "}
                    {curve.finalMargin >= 0 ? `${A} +${curve.finalMargin}` : `${B} +${-curve.finalMargin}`} on FGs
                  </div>
                ) : null}
              </div>
            </Panel>
          </div>

          <Insight accent={accent}>
            With a <b>{margin >= 0 ? "+" : ""}{margin}</b> margin and <b>{fmtClock(secondsLeft)}</b> left, the
            home side projects to <b>{wp.toFixed(1)}%</b>.{" "}
            {homeHasBall ? "Holding possession adds late-game leverage." : "The away team controls the next possession."}{" "}
            {game ? (
              <>
                The curve to the right runs that same model across every made field goal of{" "}
                <b>{game.game}</b>.
              </>
            ) : null}
          </Insight>
        </div>
      </div>

      <div className="mt-8 space-y-3">
        <div>
          <div className="kicker" style={{ color: "#4D8DFF" }}>
            Data &amp; method
          </div>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            The dial is the trained win-probability model (AUC 0.93, Brier 0.107) evaluated on the game
            state you set. The curve replays that same model across a real 2026 playoff game: every
            point is the live margin after each made field goal, with team strength set from each
            side&rsquo;s real season net rating. Margin is field-goal only (free throws aren&rsquo;t in
            public play-by-play), so the curve is a faithful approximation of the real game.
            &ldquo;Biggest swings&rdquo; are simply the three largest single-step moves in that computed
            curve, and the turning point is the last time the modeled probability lead crossed 50% —
            both are derived from the curve, not estimated separately.
          </p>
        </div>
      </div>
    </ToolShell>
  );
}
