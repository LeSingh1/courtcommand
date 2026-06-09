"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gem } from "lucide-react";
import { spring, staggerParent, staggerItem } from "@/lib/motion";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { Slider } from "@/components/ui/Controls";
import { Meter } from "@/components/ui/Meter";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { getTool } from "@/lib/tools";
import { underratedBoard } from "@/lib/engine/players";

const MINT = "#5FA97E";

export default function UnderratedPage() {
  const tool = getTool("underrated")!;
  const [maxSalary, setMaxSalary] = useState(25);

  const board = useMemo(() => underratedBoard(maxSalary), [maxSalary]);
  const top = board.slice(0, 3);
  const sleeper = board[0];

  return (
    <ToolShell tool={tool}>
      <div className="mb-6 grid gap-6 lg:grid-cols-[320px_1fr]">
        <Panel title="Filter">
          <div className="space-y-5">
            <Slider
              label="Max salary"
              value={maxSalary}
              min={5}
              max={40}
              unit=" M$"
              accent={MINT}
              onChange={setMaxSalary}
            />
            <div className="rounded-none border border-white/10 bg-white/[0.03] p-3 text-xs text-white/55">
              Showing <b className="text-white">{board.length}</b> players under{" "}
              <b className="text-mint">${maxSalary}M</b>. Score blends true shooting, BPM, on-court
              net, cheapness, and low-usage &ldquo;under-the-radar&rdquo; value.
            </div>
          </div>
        </Panel>

        <AnimatePresence mode="wait">
          <motion.div
            key={sleeper ? sleeper.player.id : "empty"}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={spring.soft}
          >
            {sleeper ? (
              <Insight accent="#5FA97E">
                <b>{sleeper.player.name}</b> is the top sleeper at this price — an underrated score of{" "}
                <b className="text-mint">{sleeper.underratedScore}</b> on a ${sleeper.player.salary}M
                deal{sleeper.reasons.length ? `: ${sleeper.reasons.join(", ")}` : ""}. High output for a
                fraction of the noise.
              </Insight>
            ) : (
              <Insight accent="#5FA97E">No players fall under ${maxSalary}M — raise the cap.</Insight>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Hidden gem cards */}
      {top.length > 0 && (
        <motion.div
          key={maxSalary}
          className="mb-6 grid gap-4 sm:grid-cols-3"
          variants={staggerParent}
          initial="initial"
          animate="animate"
        >
          {top.map((r, i) => {
            return (
              <motion.div
                key={r.player.id}
                variants={staggerItem}
                whileHover={{ y: -3 }}
                transition={spring.snappy}
              >
                <div className="glass rounded-none p-5">
                  <div className="flex items-center justify-between">
                    <span className="display text-4xl text-white/15">#{i + 1}</span>
                    <Gem size={20} style={{ color: MINT }} />
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <PlayerAvatar player={r.player} size={40} />
                    <span className="font-semibold text-white">{r.player.name}</span>
                  </div>
                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <div className="stat-num text-3xl font-bold text-mint">
                        {r.underratedScore}
                      </div>
                      <div className="text-[10px] uppercase text-white/40">
                        Underrated · ${r.player.salary}M
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {r.reasons.map((reason) => (
                      <span
                        key={reason}
                        className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{ background: `${MINT}1f`, color: MINT }}
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      <Panel title="Underrated rankings">
        <div className="space-y-2">
          {board.map((r, i) => {
            return (
              <div
                key={r.player.id}
                className="flex flex-wrap items-center gap-3 rounded-none border border-white/[0.06] bg-white/[0.02] p-3 transition hover:bg-white/[0.04]"
              >
                <span className="stat-num w-6 text-center text-sm text-white/35">{i + 1}</span>
                <PlayerAvatar player={r.player} size={32} />
                <div className="min-w-[120px]">
                  <div className="text-sm font-semibold text-white">{r.player.name}</div>
                  <div className="stat-num text-[11px] text-white/45">
                    {r.player.pos} · {r.player.archetype}
                  </div>
                </div>
                <div className="flex min-w-[160px] flex-1 items-center gap-2.5">
                  <div className="flex-1">
                    <Meter value={r.underratedScore} color={MINT} height={6} />
                  </div>
                  <span className="stat-num w-7 text-sm font-bold text-mint">
                    {r.underratedScore}
                  </span>
                </div>
                <div className="hidden flex-wrap gap-1.5 sm:flex">
                  {r.reasons.map((reason) => (
                    <span
                      key={reason}
                      className="rounded-full px-2 py-0.5 text-[10px] text-white/55"
                      style={{ background: "rgba(255,255,255,0.05)" }}
                    >
                      {reason}
                    </span>
                  ))}
                </div>
                <span className="stat-num ml-auto text-xs font-semibold text-white/60">
                  ${r.player.salary}M
                </span>
              </div>
            );
          })}
        </div>
      </Panel>
    </ToolShell>
  );
}
