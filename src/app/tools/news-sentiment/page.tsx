"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, Activity, Loader2 } from "lucide-react";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { PlayerPicker } from "@/components/ui/PlayerPicker";
import { LineChart } from "@/components/ui/LineChart";
import { Badge } from "@/components/ui/Controls";
import { Meter } from "@/components/ui/Meter";
import { TrackRecord } from "@/components/ui/TrackRecord";
import { spring, staggerParent, staggerItem } from "@/lib/motion";
import { getTool } from "@/lib/tools";
import { PLAYERS } from "@/lib/data";
import {
  loadRealShots,
  playerForm,
  shotPlayerIds,
  type RealShot,
  type PlayerForm,
} from "@/lib/data/shots";
import type { Player } from "@/lib/types";

// Category accent for "Content & Media" (gold), matching the ToolShell header.
const ACCENT = "#C9A14A";
const POS = "#5FA97E"; // Team & Strategy green
const NEG = "#E0561F"; // app accent ember (negative/cooling)
const STEADY = "#6c6c72"; // neutral

const TREND = {
  rising: { color: POS, Icon: TrendingUp, label: "Heating up" },
  cooling: { color: NEG, Icon: TrendingDown, label: "Cooling off" },
  steady: { color: STEADY, Icon: Minus, label: "Holding" },
} as const;

export default function NewsSentimentPage() {
  const tool = getTool("news-sentiment")!;
  const [shots, setShots] = useState<RealShot[] | null>(null);
  useEffect(() => {
    let alive = true;
    loadRealShots().then((d) => alive && setShots(d));
    return () => {
      alive = false;
    };
  }, []);

  // Restrict the picker to players who actually have playoff games in the data.
  const pool = useMemo(() => {
    if (!shots) return [] as Player[];
    const ids = shotPlayerIds(shots, 6);
    return PLAYERS.filter((p) => p.espnId != null && ids.has(p.espnId)).sort((a, b) => b.ppg - a.ppg);
  }, [shots]);

  const [player, setPlayer] = useState<Player | null>(null);
  useEffect(() => {
    if (!player && pool.length) setPlayer(pool[0]);
  }, [pool, player]);

  const result = useMemo<PlayerForm | null>(
    () => (shots && player?.espnId != null ? playerForm(shots, player.espnId) : null),
    [shots, player],
  );

  if (!shots) {
    return (
      <ToolShell tool={tool}>
        <Panel className="flex min-h-[360px] flex-col items-center justify-center gap-3 text-center">
          <Loader2 size={22} className="animate-spin text-[var(--text-faint)]" />
          <p className="text-sm text-white/50">Loading every playoff game log…</p>
        </Panel>
      </ToolShell>
    );
  }

  return (
    <ToolShell tool={tool}>
      <div className="mb-6 max-w-md">
        <PlayerPicker
          value={player}
          onChange={setPlayer}
          pool={pool}
          accent={ACCENT}
          placeholder="Track a playoff player's form…"
        />
      </div>

      <AnimatePresence mode="wait">
        {!player || !result ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={spring.soft}
          >
            <Panel className="flex min-h-[300px] flex-col items-center justify-center text-center">
              <Activity size={40} className="mb-4" style={{ color: ACCENT }} />
              <p className="max-w-xs text-sm text-white/50">
                Pick a player to chart their game-by-game momentum across the real 2026 playoffs.
              </p>
            </Panel>
          </motion.div>
        ) : (
          <motion.div
            key={player.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={spring.soft}
          >
            <FormView player={player} result={result} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-8 space-y-3">
        <div>
          <div className="kicker" style={{ color: ACCENT }}>
            Data &amp; method
          </div>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            This is a <b>narrative-momentum</b> signal modeled from a player&rsquo;s real game-by-game
            playoff production — points and shooting efficiency counted directly from the 2026
            play-by-play, scored against the player&rsquo;s own postseason baseline. It is performance
            buzz, not scraped media: there is no live news feed offline, so the &ldquo;headlines&rdquo;
            below are factual game lines, not generated quotes.
          </p>
        </div>
        <TrackRecord slug="news-sentiment" accent={ACCENT} />
      </div>
    </ToolShell>
  );
}

function FormView({ player, result }: { player: Player; result: PlayerForm }) {
  const trend = TREND[result.trend];
  const { Icon } = trend;
  const currentColor = result.current >= 0 ? POS : NEG;
  const maxPts = Math.max(1, ...result.games.map((g) => g.pts));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <Panel
          title={`Momentum by game (${result.games.length} playoff games)`}
          right={
            <Badge color={trend.color}>
              <Icon size={12} /> {trend.label}
            </Badge>
          }
        >
          <div className="relative">
            <LineChart
              series={[{ name: "Momentum", color: ACCENT, points: result.games.map((g) => g.score) }]}
              labels={result.games.map((g, i) =>
                i === 0 || i === result.games.length - 1 || i % Math.ceil(result.games.length / 6) === 0
                  ? `G${i + 1}`
                  : "",
              )}
              yMin={-100}
              yMax={100}
              height={240}
            />
            <div
              className="pointer-events-none absolute top-1/2 h-px border-t border-dashed border-white/15"
              style={{ left: `${(36 / 560) * 100}%`, right: `${(36 / 560) * 100}%` }}
            />
          </div>
          <div
            className="mt-2 flex justify-between text-[10px] uppercase tracking-wider text-white/35"
            style={{ paddingLeft: `${(36 / 560) * 100}%`, paddingRight: `${(36 / 560) * 100}%` }}
          >
            <span>Below his baseline</span>
            <span>Above his baseline</span>
          </div>
        </Panel>

        <Panel title="Field-goal points by game">
          <div className="space-y-2.5">
            {result.games.map((g, i) => (
              <div key={g.gameId} className="flex items-center gap-3">
                <span className="stat-num w-14 shrink-0 text-[11px] text-white/45">
                  G{i + 1} {g.opp}
                </span>
                <Meter value={Math.round((g.pts / maxPts) * 100)} color={g.score >= 0 ? POS : NEG} height={7} />
                <span className="stat-num w-10 text-right text-[11px] text-white/65">{g.pts} pt</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="space-y-6">
        <Panel className="flex flex-col items-center justify-center py-7 text-center">
          <div className="text-[10px] uppercase tracking-widest text-white/40">Current momentum</div>
          <div className="stat-num my-2 text-5xl font-bold" style={{ color: currentColor }}>
            {result.current > 0 ? "+" : ""}
            {result.current}
          </div>
          <Badge color={trend.color}>
            <Icon size={12} /> {trend.label}
          </Badge>
          <p className="mt-3 max-w-[14rem] text-xs text-white/50">
            latest game vs <span className="text-white/75">{player.name}</span>&rsquo;s playoff baseline
            ({result.avgPts} FG pts/g)
          </p>
        </Panel>

        <Panel title="Recent games">
          <motion.div className="space-y-2.5" variants={staggerParent} initial="initial" animate="animate">
            {result.headlines.map((h, i) => {
              const pos = h.tone >= 0;
              return (
                <motion.div key={`${h.text}-${i}`} variants={staggerItem}>
                  <div
                    className="rounded-lg border-l-2 bg-white/[0.02] py-2 pl-3 pr-2"
                    style={{ borderColor: pos ? POS : NEG }}
                  >
                    <p className="text-sm leading-snug text-white/80">{h.text}</p>
                    <span className="stat-num mt-1 inline-block text-[10px]" style={{ color: pos ? POS : NEG }}>
                      momentum {h.tone > 0 ? "+" : ""}
                      {h.tone}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </Panel>
      </div>

      <div className="lg:col-span-2">
        <Insight accent={ACCENT}>
          <b>{player.name}</b> is <b>{trend.label.toLowerCase()}</b> in the playoffs, his latest game
          grading <b>
            {result.current > 0 ? "+" : ""}
            {result.current}
          </b>{" "}
          against his own postseason baseline.{" "}
          {result.peak ? (
            <>
              His high-water mark was <b>{result.peak.pts} field-goal points</b> vs {result.peak.opp || "his opponent"}.
            </>
          ) : null}{" "}
          {result.trend === "rising"
            ? "The arrow is pointing up heading into the next game."
            : result.trend === "cooling"
              ? "His production has dipped off his own standard lately."
              : "He has been steady relative to his postseason norm."}
        </Insight>
      </div>
    </div>
  );
}
