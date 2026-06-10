"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { Slider, Segmented, Field } from "@/components/ui/Controls";
import { Meter } from "@/components/ui/Meter";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { LineChart } from "@/components/ui/LineChart";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { getTool, categoryColor } from "@/lib/tools";
import { winProbability } from "@/lib/engine/game";
import { loadRealShots, playoffGames, type RealShot } from "@/lib/data/shots";
import { loadPbp, gameWpSeries, wpCalibration, type PbpGame } from "@/lib/data/pbp";

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

  // Full play-by-play (FTs, turnovers, clock) — the event-driven curve.
  const [pbp, setPbp] = useState<PbpGame[] | null>(null);
  useEffect(() => {
    let alive = true;
    loadPbp().then((d) => alive && setPbp(d));
    return () => {
      alive = false;
    };
  }, []);
  const series = useMemo(() => {
    const g = pbp?.find((x) => x.gameId === gameId);
    return g ? gameWpSeries(g) : null;
  }, [pbp, gameId]);
  // Brier by game phase across all 89 games — the model's real calibration receipt.
  const calibration = useMemo(() => (pbp && pbp.length ? wpCalibration(pbp) : null), [pbp]);
  const game = games.find((g) => g.gameId === gameId);
  const [A, B] = series?.teams ?? ["", ""];

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
              {series ? (
                <>
                  <LineChart
                    series={[{ name: A, color: accent, points: series.points.map((p) => p.wp) }]}
                    labels={series.points.map(() => "")}
                    yMin={0}
                    yMax={100}
                    yLabel={`${A} WP %`}
                    height={220}
                  />
                  <div className="mt-2 flex items-center justify-between text-[11px] text-white/50">
                    <span className="flex items-center gap-1.5">
                      <TeamLogo abbr={A} size={14} /> {A}
                    </span>
                    <span>
                      {series.points.length} events · FGs, FTs, turnovers · excitement{" "}
                      <span className="stat-num text-white/75">{series.excitement}</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      {B} <TeamLogo abbr={B} size={14} />
                    </span>
                  </div>
                  <div className="mt-4 border-t border-white/[0.07] pt-3">
                    <div className="kicker mb-2" style={{ color: accent }}>
                      Biggest swings
                    </div>
                    {series.swings.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {series.swings.map((s) => (
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
                      <p className="text-[11px] text-white/40">No single event moved the needle in this game.</p>
                    )}
                    <div className="stat-num mt-2 text-[11px] text-white/55">
                      {series.turningPoint
                        ? `Turning point: ${series.turningPoint.label} — the last time the WP lead changed hands.`
                        : `Wire-to-wire: the WP lead never changed hands.`}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex min-h-[220px] items-center justify-center text-sm text-white/40">
                  Loading the full play-by-play…
                </div>
              )}
            </Panel>
            <Panel title="Calibration by phase">
              {calibration ? (
                <div className="space-y-1.5">
                  {calibration.map((b) => (
                    <div key={b.label} className="flex items-center gap-2 text-xs">
                      <span className="w-16 shrink-0 text-[var(--text-muted)]">{b.label}</span>
                      <div className="flex-1">
                        <Meter value={Math.max(2, (0.25 - b.brier) * 400)} color={accent} height={5} />
                      </div>
                      <span className="stat-num w-12 text-right text-[var(--text)]">{b.brier.toFixed(3)}</span>
                    </div>
                  ))}
                  <p className="pt-2 text-[11px] leading-relaxed text-[var(--text-faint)]">
                    Brier score of the model&rsquo;s WP at every event vs the real final result,
                    across all 89 playoff games ({calibration.reduce((a, b) => a + b.n, 0).toLocaleString()}{" "}
                    predictions). Lower is better; 0.250 = always saying 50/50. Longer bar = sharper.
                  </p>
                  {series ? (
                    <div className="stat-num border-t border-white/[0.07] pt-2 text-[11px] text-white/55">
                      This game: final {A} WP {series.points.at(-1)?.wp ?? 0}% ·{" "}
                      {series.finalMargin >= 0 ? `${A} +${series.finalMargin}` : `${B} +${-series.finalMargin}`}
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs text-white/40">Scoring 43,000 predictions…</p>
              )}
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
            The dial is the trained win-probability model (AUC 0.93) evaluated on the game state you
            set. The curve replays that same model across the <b>full</b> play-by-play of a real 2026
            playoff game — every field goal, free throw, and turnover, with the real running score and
            clock, and team strength from each side&rsquo;s real season net rating. Possession is
            approximated as flipping after a score or turnover; fouling situation and timeouts
            aren&rsquo;t modeled yet, which is exactly what the calibration table is for — Brier scored
            against the real final result of all 89 games, split by game phase, shows where the model
            is sharp and where late-game state it can&rsquo;t see costs it. Swings and the turning
            point are derived from the same computed curve, and the excitement index is the total
            probability movement across the game.
          </p>
        </div>
      </div>
    </ToolShell>
  );
}
