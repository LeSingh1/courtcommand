"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LineChart as LineChartIcon } from "lucide-react";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { PlayerPicker } from "@/components/ui/PlayerPicker";
import { LineChart } from "@/components/ui/LineChart";
import { Badge } from "@/components/ui/Controls";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { getTool } from "@/lib/tools";
import { developmentCurve } from "@/lib/engine/players";
import { getPlayer, getPlayerByName } from "@/lib/data";
import { spring, staggerParent, staggerItem } from "@/lib/motion";
import type { Player } from "@/lib/types";

const CYAN = "#7E8CA0";

export default function DevelopmentCurvePage() {
  const tool = getTool("development-curve")!;
  const [player, setPlayer] = useState<Player | null>(getPlayerByName("Victor Wembanyama") ?? null);

  const result = useMemo(() => (player ? developmentCurve(player.id) : null), [player]);

  const now = result?.curve[0];
  const peak = result ? result.curve.find((c) => c.age === result.peakAge) : undefined;

  return (
    <ToolShell tool={tool}>
      <div className="mb-6 max-w-md">
        <PlayerPicker
          value={player}
          onChange={setPlayer}
          accent={CYAN}
          placeholder="Pick a player to project…"
        />
      </div>

      <AnimatePresence mode="wait">
      {!player || !result ? (
        <Panel className="flex min-h-[300px] flex-col items-center justify-center text-center">
          <LineChartIcon size={40} className="mb-4" style={{ color: CYAN }} />
          <p className="max-w-xs text-sm text-white/50">
            Choose a player and project their PER trajectory across the next six seasons, with an
            uncertainty band, a peak-age marker, and a veteran comp.
          </p>
        </Panel>
      ) : (
        <motion.div
          key={player.id}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={spring.soft}
          className="grid gap-6 lg:grid-cols-[1fr_340px]"
        >
          <div className="space-y-6">
            <Panel title="Projected development curve">
              <LineChart
                series={[{ name: "Projected PER", color: CYAN, points: result.curve.map((c) => c.proj) }]}
                band={{
                  lo: result.curve.map((c) => c.lo),
                  hi: result.curve.map((c) => c.hi),
                  color: CYAN,
                }}
                labels={result.curve.map((c) => String(c.age))}
                yLabel="PER"
                height={240}
              />
              <div className="mt-3 flex items-center justify-center gap-4 text-[11px] text-white/45">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: CYAN }} /> Projected PER
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-4 rounded-full" style={{ background: `${CYAN}30` }} /> Range (lo–hi)
                </span>
                <span className="stat-num">x-axis: age</span>
              </div>
            </Panel>

            <motion.div
              variants={staggerParent}
              initial="initial"
              animate="animate"
              className="grid gap-4 sm:grid-cols-3"
            >
              <motion.div variants={staggerItem}>
                <Panel className="text-center">
                  <div className="stat-num display text-3xl" style={{ color: CYAN }}>
                    {result.peakAge}
                  </div>
                  <div className="mt-1 text-[10px] uppercase tracking-wide text-white/40">Peak age</div>
                  {peak && (
                    <div className="stat-num mt-1 text-xs text-white/50">~{peak.proj} PER projected</div>
                  )}
                </Panel>
              </motion.div>
              <motion.div variants={staggerItem}>
                <Panel className="text-center">
                  <div className="stat-num display text-3xl text-white">{now?.proj}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-wide text-white/40">
                    Now (age {player.age})
                  </div>
                  <div className="stat-num mt-1 text-xs text-white/50">current PER</div>
                </Panel>
              </motion.div>
              <motion.div variants={staggerItem}>
                <Panel className="flex h-full flex-col items-center justify-center text-center">
                  <div className="mb-1.5 text-[10px] uppercase tracking-wide text-white/40">Ceiling</div>
                  <Badge color={CYAN}>{result.ceiling}</Badge>
                </Panel>
              </motion.div>
            </motion.div>
          </div>

          <div className="space-y-6">
            <Panel title="Veteran comp">
              {result.comp ? (
                <div className="flex items-center gap-3">
                  <PlayerAvatar player={result.comp} size={48} />
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-white">{result.comp.name}</div>
                    <div className="stat-num text-xs text-white/45">
                      {result.comp.pos} · age {result.comp.age} · {result.comp.archetype}
                    </div>
                    <div className="stat-num mt-0.5 text-xs text-white/40">
                      {result.comp.ppg}/{result.comp.rpg}/{result.comp.apg} · {result.comp.per} PER
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-white/45">
                  No close veteran archetype match — a relatively unique developmental profile.
                </p>
              )}
            </Panel>

            <Insight accent={CYAN}>
              <b>{player.name}</b> ({player.age}) projects to peak around <b>age {result.peakAge}</b> at roughly{" "}
              <b>{peak?.proj} PER</b>, with a <b>{result.ceiling.toLowerCase()}</b> outcome on the table.
              {result.comp ? (
                <>
                  {" "}
                  The closest stylistic blueprint is <b>{result.comp.name}</b>.
                </>
              ) : null}
            </Insight>
          </div>
        </motion.div>
      )}
      </AnimatePresence>
    </ToolShell>
  );
}
