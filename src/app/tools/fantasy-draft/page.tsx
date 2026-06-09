"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Crown } from "lucide-react";
import { spring } from "@/lib/motion";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { Segmented } from "@/components/ui/Controls";
import { Meter } from "@/components/ui/Meter";
import { Reveal } from "@/components/ui/Reveal";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { getTool } from "@/lib/tools";
import { fantasyBoard, type PuntCategory } from "@/lib/engine/content";
import { gradeColor } from "@/lib/cn";

const GOLD = "#C9A14A";

const PUNTS: { label: string; value: PuntCategory }[] = [
  { label: "No Punt", value: "none" },
  { label: "Punt FT%", value: "ft" },
  { label: "Punt FG%", value: "fg" },
  { label: "Punt AST", value: "ast" },
  { label: "Punt TO", value: "to" },
  { label: "Punt 3PT", value: "3pt" },
];

const CATS: { key: "pts" | "reb" | "ast" | "stl" | "blk" | "threes"; label: string }[] = [
  { key: "pts", label: "PTS" },
  { key: "reb", label: "REB" },
  { key: "ast", label: "AST" },
  { key: "stl", label: "STL" },
  { key: "blk", label: "BLK" },
  { key: "threes", label: "3PM" },
];

function ZCell({ z }: { z: number }) {
  const color = z >= 0 ? gradeColor(50 + z * 15) : "#BF5B4E";
  return (
    <span
      className="stat-num inline-flex h-7 w-12 items-center justify-center rounded-none text-[11px] font-semibold"
      style={{ background: `${color}1c`, color, border: `1px solid ${color}30` }}
    >
      {z > 0 ? "+" : ""}
      {z.toFixed(2)}
    </span>
  );
}

export default function FantasyDraftPage() {
  const tool = getTool("fantasy-draft")!;
  const [punt, setPunt] = useState<PuntCategory>("none");
  const board = useMemo(() => fantasyBoard(punt), [punt]);
  const top3 = board.slice(0, 3);
  const puntLabel = PUNTS.find((p) => p.value === punt)!.label;

  return (
    <ToolShell tool={tool}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Insight accent={GOLD}>
          {punt === "none" ? (
            <>
              <b>{top3[0].player.name}</b> headlines the board on raw 9-cat value ({top3[0].zScore} z).
              Pick a punt strategy to zero out a category and re-rank around your build.
            </>
          ) : (
            <>
              Punting <b>{puntLabel.replace("Punt ", "")}</b> reshuffles the top of the draft —{" "}
              <b>{top3[0].player.name}</b> ({top3[0].zScore} z) leads the recalculated board, rewarding
              players who don't lean on that category.
            </>
          )}
        </Insight>
        <Segmented accent={GOLD} value={punt} onChange={setPunt} options={PUNTS} />
      </div>

      <AnimatePresence mode="wait">
      <motion.div
        key={punt}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={spring.soft}
      >
      {/* top-3 cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {top3.map((r, i) => {
          return (
            <Reveal key={r.player.id} delay={i * 0.08}>
              <motion.div
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.97 }}
                transition={spring.snappy}
                className="glass relative overflow-hidden rounded-none p-5"
              >
                <div className="flex items-center justify-between">
                  <span className="display text-4xl text-white/15">#{i + 1}</span>
                  {i === 0 ? (
                    <Crown size={20} style={{ color: GOLD }} />
                  ) : (
                    <Trophy size={18} style={{ color: GOLD }} />
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <PlayerAvatar player={r.player} size={40} />
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-white">{r.player.name}</div>
                    <div className="stat-num text-[10px] uppercase text-white/40">{r.player.pos}</div>
                  </div>
                </div>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <div className="stat-num text-3xl font-bold" style={{ color: GOLD }}>
                      {r.zScore}
                    </div>
                    <div className="text-[10px] uppercase text-white/40">Total z-score</div>
                  </div>
                  <div className="w-20">
                    <Meter value={r.scarcity} color={GOLD} height={6} />
                    <div className="mt-1 text-right text-[9px] uppercase text-white/35">
                      {r.scarcity} scarcity
                    </div>
                  </div>
                </div>
              </motion.div>
            </Reveal>
          );
        })}
      </div>

      <Panel title={`Draft board · ${puntLabel}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wide text-white/40">
                <th className="py-2 pl-2 font-medium">#</th>
                <th className="py-2 font-medium">Player</th>
                <th className="py-2 pr-2 text-right font-medium">Z</th>
                {CATS.map((c) => (
                  <th key={c.key} className="py-2 text-center font-medium">
                    {c.label}
                  </th>
                ))}
                <th className="py-2 pr-2 font-medium">Scarcity</th>
              </tr>
            </thead>
            <tbody>
              {board.map((r) => {
                return (
                  <tr
                    key={r.player.id}
                    className="border-b border-white/[0.04] transition hover:bg-white/[0.03]"
                  >
                    <td className="stat-num py-2.5 pl-2 text-white/35">{r.rank}</td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2.5">
                        <PlayerAvatar player={r.player} size={28} />
                        <span className="text-white/85">{r.player.name}</span>
                        <span className="stat-num text-[10px] text-white/35">{r.player.pos}</span>
                      </div>
                    </td>
                    <td className="stat-num py-2.5 pr-2 text-right text-base font-bold" style={{ color: GOLD }}>
                      {r.zScore}
                    </td>
                    {CATS.map((c) => (
                      <td key={c.key} className="py-2.5 text-center">
                        <ZCell z={r.cats[c.key]} />
                      </td>
                    ))}
                    <td className="py-2.5 pr-2">
                      <div className="flex items-center gap-2">
                        <div className="w-16">
                          <Meter value={r.scarcity} color={GOLD} height={6} />
                        </div>
                        <span className="stat-num w-6 text-xs text-white/55">{r.scarcity}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      </motion.div>
      </AnimatePresence>
    </ToolShell>
  );
}
