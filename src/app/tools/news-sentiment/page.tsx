"use client";

import { useMemo, useState } from "react";
import { TrendingUp, TrendingDown, Minus, Rss } from "lucide-react";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { PlayerPicker } from "@/components/ui/PlayerPicker";
import { LineChart } from "@/components/ui/LineChart";
import { Badge } from "@/components/ui/Controls";
import { Meter } from "@/components/ui/Meter";
import { Reveal } from "@/components/ui/Reveal";
import { getTool } from "@/lib/tools";
import { getPlayer, getPlayerByName } from "@/lib/data";
import { newsSentiment } from "@/lib/engine/content";
import type { Player } from "@/lib/types";

const CYAN = "#7E8CA0";

const TREND = {
  rising: { color: "#5FA97E", Icon: TrendingUp, label: "Rising" },
  cooling: { color: "#BF5B4E", Icon: TrendingDown, label: "Cooling" },
  steady: { color: "#7E8CA0", Icon: Minus, label: "Steady" },
} as const;

export default function NewsSentimentPage() {
  const tool = getTool("news-sentiment")!;
  const [player, setPlayer] = useState<Player | null>(() => getPlayerByName("Ja Morant") ?? null);

  const result = useMemo(() => (player ? newsSentiment(player) : null), [player]);

  return (
    <ToolShell tool={tool}>
      <div className="mb-6 max-w-md">
        <PlayerPicker value={player} onChange={setPlayer} accent={CYAN} placeholder="Track a player's narrative…" />
      </div>

      {!player || !result ? (
        <Panel className="flex min-h-[300px] flex-col items-center justify-center text-center">
          <Rss size={40} className="mb-4 text-cyan" />
          <p className="max-w-xs text-sm text-white/50">
            Pick a player to chart how media sentiment around them has trended over the last ten weeks.
          </p>
        </Panel>
      ) : (
        <SentimentView player={player} result={result} />
      )}
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
  const currentColor = result.current >= 0 ? "#5FA97E" : "#BF5B4E";

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
              series={[{ name: "Sentiment", color: CYAN, points: result.series.map((s) => s.score) }]}
              labels={result.series.map((s) => s.week)}
              yMin={-100}
              yMax={100}
              height={240}
            />
            {/* zero baseline annotation */}
            <div className="pointer-events-none absolute inset-x-0 top-1/2 flex items-center">
              <div className="ml-9 mr-9 h-px w-full border-t border-dashed border-white/15" />
            </div>
          </div>
          <div className="mt-2 flex justify-between px-9 text-[10px] uppercase tracking-wider text-white/35">
            <span>Negative narrative</span>
            <span>Positive narrative</span>
          </div>
        </Panel>

        <Panel title="Coverage volume by week">
          <div className="space-y-2.5">
            {result.series.map((s) => (
              <div key={s.week} className="flex items-center gap-3">
                <span className="stat-num w-8 text-[11px] text-white/45">{s.week}</span>
                <Meter value={s.volume} color={s.score >= 0 ? "#5FA97E" : "#BF5B4E"} height={7} />
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
          <div className="space-y-2.5">
            {result.headlines.map((h, i) => {
              const pos = h.tone > 0;
              return (
                <Reveal key={i} delay={i * 0.07}>
                  <div
                    className="rounded-none border-l-2 bg-white/[0.02] py-2 pl-3 pr-2"
                    style={{ borderColor: pos ? "#5FA97E" : "#BF5B4E" }}
                  >
                    <p className="text-sm leading-snug text-white/80">{h.text}</p>
                    <span
                      className="stat-num mt-1 inline-block text-[10px]"
                      style={{ color: pos ? "#5FA97E" : "#BF5B4E" }}
                    >
                      tone {h.tone > 0 ? "+" : ""}
                      {h.tone}
                    </span>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </Panel>
      </div>

      <div className="lg:col-span-2">
        <Insight accent={CYAN}>
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
