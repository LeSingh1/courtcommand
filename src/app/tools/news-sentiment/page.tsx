"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, Rss } from "lucide-react";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { PlayerPicker } from "@/components/ui/PlayerPicker";
import { LineChart } from "@/components/ui/LineChart";
import { Badge } from "@/components/ui/Controls";
import { Meter } from "@/components/ui/Meter";
import { TrackRecord } from "@/components/ui/TrackRecord";
import { spring, staggerParent, staggerItem } from "@/lib/motion";
import { getTool } from "@/lib/tools";
import { getPlayer, getPlayerByName } from "@/lib/data";
import { newsSentiment } from "@/lib/engine/content";
import type { Player } from "@/lib/types";

// Category accent for "Content & Media" (gold), matching the ToolShell header.
const ACCENT = "#C9A14A";
// Sentiment tone palette — all in-contract muted tones.
const POS = "#5FA97E"; // Team & Strategy green
const NEG = "#E0561F"; // app accent ember (negative/warm)
const STEADY = "#6c6c72"; // var(--text-faint) neutral

const TREND = {
  rising: { color: POS, Icon: TrendingUp, label: "Rising" },
  cooling: { color: NEG, Icon: TrendingDown, label: "Cooling" },
  steady: { color: STEADY, Icon: Minus, label: "Steady" },
} as const;

export default function NewsSentimentPage() {
  const tool = getTool("news-sentiment")!;
  const reduceMotion = useReducedMotion();
  const [player, setPlayer] = useState<Player | null>(() => getPlayerByName("Ja Morant") ?? null);

  const result = useMemo(() => (player ? newsSentiment(player) : null), [player]);

  // Brief analyzing affordance on each player change (skipped under reduced motion).
  const [analyzing, setAnalyzing] = useState(false);
  const firstRun = useRef(true);
  useEffect(() => {
    if (!player) {
      setAnalyzing(false);
      return;
    }
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (reduceMotion) return;
    setAnalyzing(true);
    const t = setTimeout(() => setAnalyzing(false), 520);
    return () => clearTimeout(t);
  }, [player, reduceMotion]);

  return (
    <ToolShell tool={tool}>
      <div className="mb-6 max-w-md">
        <PlayerPicker value={player} onChange={setPlayer} accent={ACCENT} placeholder="Track a player's narrative…" />
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
              <Rss size={40} className="mb-4" style={{ color: ACCENT }} />
              <p className="max-w-xs text-sm text-white/50">
                Pick a player to chart how media sentiment around them has trended over the last ten weeks.
              </p>
            </Panel>
          </motion.div>
        ) : analyzing ? (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={spring.soft}
          >
            <Panel className="flex min-h-[300px] flex-col items-center justify-center text-center">
              <motion.div
                aria-hidden
                className="mb-4 h-6 w-6 rounded-full border-2 border-white/15"
                style={{ borderTopColor: ACCENT }}
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
              />
              <p className="kicker text-white/55">Reading the cycle…</p>
              <p className="mt-1.5 max-w-xs text-sm text-white/40">
                Scanning ten weeks of coverage for <span className="text-white/70">{player.name}</span>.
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
            <SentimentView player={player} result={result} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-8 space-y-3">
        <div>
          <div className="kicker" style={{ color: "#C9A14A" }}>Model track record</div>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            This traces the real data the sentiment model was trained on — the count of player-seasons growing each year since 2003 as coverage history deepened — alongside its validation metric and the method behind it.
          </p>
        </div>
        <TrackRecord slug="news-sentiment" accent="#C9A14A" />
      </div>
    </ToolShell>
  );
}

function SentimentView({
  player,
  result,
}: {
  player: Player;
  result: ReturnType<typeof newsSentiment>;
}) {
  const trend = TREND[result.trend];
  const { Icon } = trend;
  const currentColor = result.current >= 0 ? POS : NEG;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <Panel
          title="Sentiment trend (10 weeks)"
          right={
            <Badge color={trend.color}>
              <Icon size={12} /> {trend.label}
            </Badge>
          }
        >
          <div className="relative">
            <LineChart
              series={[{ name: "Sentiment", color: ACCENT, points: result.series.map((s) => s.score) }]}
              labels={result.series.map((s) => s.week)}
              yMin={-100}
              yMax={100}
              height={240}
            />
            {/* zero baseline annotation — inset tracks the chart's padX (36/560) so it
                scales with the responsive SVG instead of overflowing at fixed 36px. */}
            <div
              className="pointer-events-none absolute top-1/2 h-px border-t border-dashed border-white/15"
              style={{ left: `${(36 / 560) * 100}%`, right: `${(36 / 560) * 100}%` }}
            />
          </div>
          <div
            className="mt-2 flex justify-between text-[10px] uppercase tracking-wider text-white/35"
            style={{ paddingLeft: `${(36 / 560) * 100}%`, paddingRight: `${(36 / 560) * 100}%` }}
          >
            <span>Negative narrative</span>
            <span>Positive narrative</span>
          </div>
        </Panel>

        <Panel title="Coverage volume by week">
          <div className="space-y-2.5">
            {result.series.map((s) => (
              <div key={s.week} className="flex items-center gap-3">
                <span className="stat-num w-8 text-[11px] text-white/45">{s.week}</span>
                <Meter value={s.volume} color={s.score >= 0 ? POS : NEG} height={7} />
                <span className="stat-num w-8 text-right text-[11px] text-white/55">{s.volume}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="space-y-6">
        <Panel className="flex flex-col items-center justify-center py-7 text-center">
          <div className="text-[10px] uppercase tracking-widest text-white/40">Current sentiment</div>
          <div className="stat-num my-2 text-5xl font-bold" style={{ color: currentColor }}>
            {result.current > 0 ? "+" : ""}
            {result.current}
          </div>
          <Badge color={trend.color}>
            <Icon size={12} /> {trend.label}
          </Badge>
          <p className="mt-3 max-w-[14rem] text-xs text-white/50">
            on a −100 to +100 scale for <span className="text-white/75">{player.name}</span>
          </p>
        </Panel>

        <Panel title="Latest headlines">
          <motion.div
            className="space-y-2.5"
            variants={staggerParent}
            initial="initial"
            animate="animate"
          >
            {result.headlines.map((h, i) => {
              const pos = h.tone > 0;
              return (
                <motion.div key={`${h.text}-${i}`} variants={staggerItem}>
                  <div
                    className="rounded-none border-l-2 bg-white/[0.02] py-2 pl-3 pr-2"
                    style={{ borderColor: pos ? POS : NEG }}
                  >
                    <p className="text-sm leading-snug text-white/80">{h.text}</p>
                    <span
                      className="stat-num mt-1 inline-block text-[10px]"
                      style={{ color: pos ? POS : NEG }}
                    >
                      tone {h.tone > 0 ? "+" : ""}
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
          Media sentiment around <b>{player.name}</b> is <b>{trend.label.toLowerCase()}</b>, sitting at{" "}
          <b>
            {result.current > 0 ? "+" : ""}
            {result.current}
          </b>{" "}
          this week.{" "}
          {result.trend === "rising"
            ? "The narrative has swung in his favor — a good window for value."
            : result.trend === "cooling"
              ? "Coverage has soured recently; expect more scrutiny in the cycle ahead."
              : "Coverage is holding flat with no major narrative swing either direction."}
        </Insight>
      </div>
    </div>
  );
}
