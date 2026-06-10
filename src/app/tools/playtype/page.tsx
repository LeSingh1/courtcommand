"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shapes } from "lucide-react";
import { spring } from "@/lib/motion";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { PlayerPicker } from "@/components/ui/PlayerPicker";
import { Badge } from "@/components/ui/Controls";
import { AnalyzeOverlay } from "@/components/ui/Analyze";
import { Reveal } from "@/components/ui/Reveal";
import { TrackRecord } from "@/components/ui/TrackRecord";
import { getTool, categoryColor } from "@/lib/tools";
import { getPlayerByName } from "@/lib/data";
import { playTypeMix, type PlayTypeMix } from "@/lib/engine/teams";
import type { Player } from "@/lib/types";

const ANALYZE_STEPS = [
  "Mapping possessions…",
  "Tagging play types…",
  "Computing efficiency…",
];

export default function PlayTypePage() {
  const tool = getTool("playtype")!;
  const ACCENT = categoryColor(tool.category);
  const [player, setPlayer] = useState<Player | null>(() => getPlayerByName("Luka Doncic") ?? null);
  const [analyzing, setAnalyzing] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);

  const mix: PlayTypeMix[] = useMemo(() => (player ? playTypeMix(player) : []), [player]);
  const primary = mix[0];
  const bestEff = useMemo(
    () => (mix.length ? [...mix].sort((a, b) => b.ppp - a.ppp)[0] : null),
    [mix],
  );

  // Brief analyzing affordance on each player change (skips the preloaded
  // default so above-the-fold content paints immediately on first load).
  const firstLoad = useRef(true);
  useEffect(() => {
    if (!player) {
      setAnalyzing(false);
      return;
    }
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    setAnalyzing(true);
    setStepIdx(0);
    const per = 450 / ANALYZE_STEPS.length;
    const ticks = ANALYZE_STEPS.map((_, i) =>
      setTimeout(() => setStepIdx(i), per * i),
    );
    const done = setTimeout(() => setAnalyzing(false), 450);
    return () => {
      ticks.forEach(clearTimeout);
      clearTimeout(done);
    };
  }, [player?.id]);

  return (
    <ToolShell tool={tool}>
      <div className="mb-6 max-w-md">
        <PlayerPicker
          value={player}
          onChange={setPlayer}
          accent={ACCENT}
          placeholder="Pick a player to map their offense…"
        />
      </div>

      <AnimatePresence mode="wait" initial={false}>
      {!player || !primary ? (
        <motion.div
          key="empty"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={spring.soft}
        >
        <Panel className="flex min-h-[300px] flex-col items-center justify-center text-center">
          <Shapes size={40} className="mb-4" style={{ color: ACCENT }} />
          <div className="kicker mb-2">No player selected</div>
          <p className="max-w-sm text-sm text-[var(--text-faint)]">
            Pick a player to break their possessions into pick-and-roll, isolation, spot-up,
            transition, post-up, cuts, and handoffs — with efficiency on each.
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
          <AnalyzeOverlay steps={ANALYZE_STEPS} stepIdx={stepIdx} accent={ACCENT} />
        </motion.div>
      ) : (
        <motion.div
          key={player.id}
          className="grid gap-6 lg:grid-cols-[1fr_320px]"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={spring.soft}
        >
          <div className="space-y-6">
            <Reveal>
              <Panel
                title="Possession mix"
                right={
                  <Badge color={ACCENT}>
                    Primary · {primary.type}
                  </Badge>
                }
              >
                {/* stacked frequency bar */}
                <div className="mb-5 flex h-9 w-full overflow-hidden rounded-lg">
                  {mix.map((m) => (
                    <div
                      key={m.type}
                      className="h-full"
                      style={{ width: `${m.freq}%`, background: m.color }}
                      title={`${m.type} · ${m.freq}%`}
                    />
                  ))}
                </div>

                <div className="space-y-2.5">
                  {mix.map((m) => (
                    <Reveal key={m.type}>
                      <div
                        className="flex items-center gap-3 rounded-lg border p-3"
                        style={{
                          borderColor: m === primary ? `${ACCENT}44` : "rgba(255,255,255,0.06)",
                          background: m === primary ? `${ACCENT}0d` : "transparent",
                        }}
                      >
                        <span
                          className="h-3 w-3 shrink-0"
                          style={{ background: m.color }}
                        />
                        <span className="flex-1 text-sm text-[var(--text-muted)]">{m.type}</span>
                        <div className="w-32">
                          <div className="h-1.5 w-full overflow-hidden bg-white/[0.06]">
                            <div
                              className="h-full"
                              style={{ width: `${m.freq}%`, background: m.color }}
                            />
                          </div>
                        </div>
                        <span className="stat-num w-10 text-right text-sm font-semibold text-[var(--text)]">
                          {m.freq}%
                        </span>
                        <span className="stat-num w-14 text-right text-xs text-[var(--text-faint)]">
                          {m.ppp.toFixed(2)}
                        </span>
                      </div>
                    </Reveal>
                  ))}
                </div>
                <div className="mt-3 flex justify-end gap-[58px] pr-1 text-[10px] uppercase tracking-widest text-[var(--text-faint)]">
                  <span>freq</span>
                  <span>ppp</span>
                </div>
              </Panel>
            </Reveal>
          </div>

          <div className="space-y-6">
            <Reveal>
              <Panel title="Offensive identity">
                <div className="space-y-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-[var(--text-faint)]">
                      Bread & butter
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="h-3 w-3 shrink-0" style={{ background: primary.color }} />
                      <span className="text-lg font-semibold text-[var(--text)]">{primary.type}</span>
                      <span className="stat-num text-sm text-[var(--text-faint)]">{primary.freq}%</span>
                    </div>
                  </div>
                  {bestEff && (
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-[var(--text-faint)]">
                        Most efficient
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <span
                          className="h-3 w-3 shrink-0"
                          style={{ background: bestEff.color }}
                        />
                        <span className="text-lg font-semibold text-[var(--text)]">{bestEff.type}</span>
                        <span className="stat-num text-sm text-[var(--text-faint)]">
                          {bestEff.ppp.toFixed(2)} PPP
                        </span>
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-[var(--text-faint)]">
                      Archetype
                    </div>
                    <div className="mt-1 text-sm text-[var(--text-muted)]">{player.archetype}</div>
                  </div>
                </div>
              </Panel>
            </Reveal>

            <Reveal>
              <Insight accent={ACCENT}>
                <b>{player.name}</b> runs offense primarily out of{" "}
                <b>{primary.type.toLowerCase()}</b> ({primary.freq}% of possessions)
                {bestEff && bestEff.type !== primary.type ? (
                  <>
                    {" "}
                    but is most efficient on <b>{bestEff.type.toLowerCase()}</b> looks at{" "}
                    {bestEff.ppp.toFixed(2)} PPP
                  </>
                ) : (
                  <> at {primary.ppp.toFixed(2)} PPP</>
                )}
                {" "}— a classic {player.archetype.toLowerCase()} profile.
              </Insight>
            </Reveal>
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      <div className="mt-8 space-y-3">
        <div>
          <div className="kicker" style={{ color: "#5FA97E" }}>Model track record</div>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            The model's possession classifier is checked against ESPN's own play-type labels on real plays — it agrees about 90% of the time — shown alongside the training data that has grown every season since 2003.
          </p>
        </div>
        <TrackRecord slug="playtype" accent="#5FA97E" />
      </div>
    </ToolShell>
  );
}
