"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shapes } from "lucide-react";
import { spring } from "@/lib/motion";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { PlayerPicker } from "@/components/ui/PlayerPicker";
import { Badge } from "@/components/ui/Controls";
import { Reveal } from "@/components/ui/Reveal";
import { getTool } from "@/lib/tools";
import { getPlayer, getPlayerByName } from "@/lib/data";
import { playTypeMix, type PlayTypeMix } from "@/lib/engine/teams";
import type { Player } from "@/lib/types";

const ACCENT = "#7E8CA0";

export default function PlayTypePage() {
  const tool = getTool("playtype")!;
  const [player, setPlayer] = useState<Player | null>(() => getPlayerByName("Luka Doncic") ?? null);

  const mix: PlayTypeMix[] = useMemo(() => (player ? playTypeMix(player) : []), [player]);
  const primary = mix[0];
  const bestEff = useMemo(
    () => (mix.length ? [...mix].sort((a, b) => b.ppp - a.ppp)[0] : null),
    [mix],
  );

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

      <AnimatePresence mode="wait">
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
          <p className="max-w-sm text-sm text-white/50">
            The PlayType Classifier breaks a player's possessions into pick-and-roll, isolation,
            spot-up, transition, post-up, cuts, and handoffs — with efficiency on each.
          </p>
        </Panel>
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
                <div className="mb-5 flex h-9 w-full overflow-hidden rounded-none">
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
                  {mix.map((m, i) => (
                    <Reveal key={m.type} delay={i * 0.04}>
                      <div
                        className="flex items-center gap-3 rounded-none border p-3"
                        style={{
                          borderColor: m === primary ? `${ACCENT}44` : "rgba(255,255,255,0.06)",
                          background: m === primary ? `${ACCENT}0d` : "transparent",
                        }}
                      >
                        <span
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ background: m.color }}
                        />
                        <span className="flex-1 text-sm text-white/85">{m.type}</span>
                        <div className="w-32">
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${m.freq}%`, background: m.color }}
                            />
                          </div>
                        </div>
                        <span className="stat-num w-10 text-right text-sm font-semibold text-white">
                          {m.freq}%
                        </span>
                        <span className="stat-num w-14 text-right text-xs text-white/55">
                          {m.ppp.toFixed(2)}
                        </span>
                      </div>
                    </Reveal>
                  ))}
                </div>
                <div className="mt-3 flex justify-end gap-[58px] pr-1 text-[10px] uppercase tracking-widest text-white/35">
                  <span>freq</span>
                  <span>ppp</span>
                </div>
              </Panel>
            </Reveal>
          </div>

          <div className="space-y-6">
            <Reveal delay={0.05}>
              <Panel title="Offensive identity">
                <div className="space-y-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-white/45">
                      Bread & butter
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ background: primary.color }} />
                      <span className="text-lg font-semibold text-white">{primary.type}</span>
                      <span className="stat-num text-sm text-white/50">{primary.freq}%</span>
                    </div>
                  </div>
                  {bestEff && (
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-white/45">
                        Most efficient
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ background: bestEff.color }}
                        />
                        <span className="text-lg font-semibold text-white">{bestEff.type}</span>
                        <span className="stat-num text-sm text-white/50">
                          {bestEff.ppp.toFixed(2)} PPP
                        </span>
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-white/45">
                      Archetype
                    </div>
                    <div className="mt-1 text-sm text-white/80">{player.archetype}</div>
                  </div>
                </div>
              </Panel>
            </Reveal>

            <Reveal delay={0.1}>
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
    </ToolShell>
  );
}
