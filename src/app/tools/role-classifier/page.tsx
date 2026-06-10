"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Boxes, X } from "lucide-react";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { TrackRecord } from "@/components/ui/TrackRecord";
import { getTool, categoryColor } from "@/lib/tools";
import { roleClusters } from "@/lib/engine/players";
import { spring, staggerParent, staggerItem } from "@/lib/motion";

export default function RoleClassifierPage() {
  const tool = getTool("role-classifier")!;
  const accent = categoryColor(tool.category);
  const clusters = useMemo(() => roleClusters(), []);
  const [activeRole, setActiveRole] = useState<string | null>(null);

  const totalPlayers = clusters.reduce((s, c) => s + c.players.length, 0);
  const active = clusters.find((c) => c.role === activeRole) ?? null;

  if (!clusters.length) {
    return (
      <ToolShell tool={tool}>
        <Panel title="No clusters">
          <p className="text-sm text-[var(--text-muted)]">No players available to classify.</p>
        </Panel>
      </ToolShell>
    );
  }

  return (
    <ToolShell tool={tool}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Insight accent={accent}>
          <b>{totalPlayers}</b> players cluster into <b>{clusters.length}</b> on-court roles by
          archetype. The largest group is <b>{clusters[0].role}</b> ({clusters[0].players.length}).
          Tap any cluster to scout its players.
        </Insight>
      </div>

      {/* Legend */}
      <div className="mb-6 flex flex-wrap gap-2">
        {clusters.map((c) => (
          <button
            key={c.role}
            onClick={() => setActiveRole(c.role)}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--line)] bg-white/[0.03] px-3 py-1 text-xs text-white/65 transition hover:bg-white/[0.06]"
          >
            <span className="h-2 w-2 rounded-lg" style={{ background: c.color }} />
            {c.role}
            <span className="stat-num text-white/40">{c.players.length}</span>
          </button>
        ))}
      </div>

      {/* Cluster grid */}
      <motion.div
        variants={staggerParent}
        initial="initial"
        animate="animate"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {clusters.map((c) => (
          <motion.button
            key={c.role}
            variants={staggerItem}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.97 }}
            transition={spring.snappy}
            onClick={() => setActiveRole(c.role)}
            className="glass group relative flex h-full w-full flex-col overflow-hidden rounded-lg p-5 text-left"
            style={{ boxShadow: activeRole === c.role ? `0 0 0 1px ${c.color}66` : undefined }}
          >
              <div className="flex items-center justify-between">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ background: `${c.color}1f` }}
                >
                  <span className="h-3 w-3 rounded-lg" style={{ background: c.color }} />
                </span>
                <span
                  className="stat-num rounded-lg px-2 py-0.5 text-[11px] font-bold"
                  style={{ background: `${c.color}1f`, color: c.color }}
                >
                  {c.players.length}
                </span>
              </div>
              <h3 className="mt-3 text-[15px] font-semibold tracking-tight text-white">{c.role}</h3>
              <p className="mt-1 text-xs leading-relaxed text-white/50">{c.blurb}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {c.players.slice(0, 5).map((p) => {
                  return (
                    <span
                      key={p.id}
                      className="inline-flex items-center gap-1 rounded-lg bg-white/[0.04] py-0.5 pl-0.5 pr-2 text-[10px] text-white/70"
                    >
                      <PlayerAvatar player={p} size={16} rounded />
                      {p.name}
                    </span>
                  );
                })}
                {c.players.length > 5 && (
                  <span className="inline-flex items-center rounded-lg bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/45">
                    +{c.players.length - 5} more
                  </span>
                )}
              </div>
          </motion.button>
        ))}
      </motion.div>

      {/* Detail panel */}
      <AnimatePresence mode="wait">
      {active && (
        <motion.div
          key={active.role}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={spring.soft}
          className="mt-6"
        >
            <Panel
              title={`${active.role} · ${active.players.length} players`}
              right={
                <button
                  onClick={() => setActiveRole(null)}
                  className="rounded-lg p-1 text-white/40 transition hover:bg-white/10 hover:text-white"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              }
            >
              <p className="mb-4 text-sm text-white/55">{active.blurb}</p>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {active.players.map((p) => {
                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
                    >
                      <PlayerAvatar player={p} size={40} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-white">{p.name}</div>
                        <div className="stat-num text-[11px] text-white/45">
                          {p.pos} · {p.archetype}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="stat-num text-lg font-bold" style={{ color: active.color }}>
                          {p.ppg}
                        </div>
                        <div className="text-[9px] uppercase text-white/35">PPG</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
        </motion.div>
      )}
      </AnimatePresence>

      <div className="mt-8 space-y-3">
        <div>
          <div className="kicker" style={{ color: "#4E8FA8" }}>Model track record</div>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            Each season since 2003, the bars show how often a player's assigned on-court archetype actually held the following year — stable about 70% of the time, the consistency the classifier is graded on.
          </p>
        </div>
        <TrackRecord slug="role-classifier" accent="#4E8FA8" />
      </div>
    </ToolShell>
  );
}
