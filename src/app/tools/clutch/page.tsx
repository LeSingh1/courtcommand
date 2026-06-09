"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Timer, Flame } from "lucide-react";
import { spring } from "@/lib/motion";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { Segmented } from "@/components/ui/Controls";
import { Meter } from "@/components/ui/Meter";
import { Reveal } from "@/components/ui/Reveal";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { getTool } from "@/lib/tools";
import { clutchBoard } from "@/lib/engine/players";
import { gradeColor } from "@/lib/cn";

type SortKey = "clutchScore" | "poise" | "difficulty";

export default function ClutchPage() {
  const tool = getTool("clutch")!;
  const [sort, setSort] = useState<SortKey>("clutchScore");
  const board = useMemo(
    () => [...clutchBoard()].sort((a, b) => (b[sort] as number) - (a[sort] as number)),
    [sort],
  );
  const leader = board[0];

  return (
    <ToolShell tool={tool}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Insight accent="#BF5B4E">
          <b>{leader.player.name}</b> tops the Clutch Index — elite poise ({leader.poise}) on
          high-difficulty late-game looks. Clutch = last 5 minutes, margin within 5.
        </Insight>
        <Segmented
          accent="#BF5B4E"
          value={sort}
          onChange={setSort}
          options={[
            { label: "Clutch Score", value: "clutchScore" },
            { label: "Poise", value: "poise" },
            { label: "Difficulty", value: "difficulty" },
          ]}
        />
      </div>

      <AnimatePresence mode="wait">
      <motion.div
        key={sort}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={spring.soft}
      >
      {/* podium */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {board.slice(0, 3).map((r, i) => {
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
                  <Flame size={20} style={{ color: gradeColor(r.clutchScore) }} />
                </div>
                <div className="mt-2 flex items-center gap-2.5">
                  <PlayerAvatar player={r.player} size={44} />
                  <span className="font-semibold text-white">{r.player.name}</span>
                </div>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <div className="stat-num text-3xl font-bold" style={{ color: gradeColor(r.clutchScore) }}>
                      {r.clutchScore}
                    </div>
                    <div className="text-[10px] uppercase text-white/40">Clutch score · {r.grade}</div>
                  </div>
                  <div className="stat-num text-right text-xs text-white/50">
                    <div>{r.player.clutchPpg} clutch PPG</div>
                    <div>{(r.player.clutchFgp * 100).toFixed(0)}% FG</div>
                  </div>
                </div>
              </motion.div>
            </Reveal>
          );
        })}
      </div>

      <Panel title="Full clutch leaderboard">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wide text-white/40">
                <th className="py-2 pl-2 font-medium">#</th>
                <th className="py-2 font-medium">Player</th>
                <th className="py-2 font-medium">Clutch</th>
                <th className="py-2 font-medium">Poise</th>
                <th className="py-2 font-medium">Difficulty</th>
                <th className="py-2 pr-2 text-right font-medium">Grade</th>
              </tr>
            </thead>
            <tbody>
              {board.map((r, i) => {
                return (
                  <tr key={r.player.id} className="border-b border-white/[0.04] transition hover:bg-white/[0.03]">
                    <td className="stat-num py-2.5 pl-2 text-white/35">{i + 1}</td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2.5">
                        <PlayerAvatar player={r.player} size={28} />
                        <span className="text-white/85">{r.player.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-16">
                          <Meter value={r.clutchScore} color={gradeColor(r.clutchScore)} height={6} />
                        </div>
                        <span className="stat-num w-6 font-semibold" style={{ color: gradeColor(r.clutchScore) }}>
                          {r.clutchScore}
                        </span>
                      </div>
                    </td>
                    <td className="stat-num py-2.5 text-white/65">{r.poise}</td>
                    <td className="stat-num py-2.5 text-white/65">{r.difficulty}</td>
                    <td className="py-2.5 pr-2 text-right">
                      <span
                        className="stat-num rounded-none px-2 py-0.5 text-xs font-bold"
                        style={{ background: `${gradeColor(r.clutchScore)}1f`, color: gradeColor(r.clutchScore) }}
                      >
                        {r.grade}
                      </span>
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
