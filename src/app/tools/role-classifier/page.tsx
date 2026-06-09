"use client";

import { useMemo, useState } from "react";
import { Boxes, X } from "lucide-react";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { Reveal } from "@/components/ui/Reveal";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { getTool } from "@/lib/tools";
import { roleClusters } from "@/lib/engine/players";

export default function RoleClassifierPage() {
  const tool = getTool("role-classifier")!;
  const clusters = useMemo(() => roleClusters(), []);
  const [activeRole, setActiveRole] = useState<string | null>(null);

  const totalPlayers = clusters.reduce((s, c) => s + c.players.length, 0);
  const active = clusters.find((c) => c.role === activeRole) ?? null;

  return (
    <ToolShell tool={tool}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Insight accent="#7E8CA0">
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
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-white/65 transition hover:bg-white/[0.06]"
          >
            <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
            {c.role}
            <span className="stat-num text-white/40">{c.players.length}</span>
          </button>
        ))}
      </div>

      {/* Cluster grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {clusters.map((c, i) => (
          <Reveal key={c.role} delay={i * 0.05}>
            <button
              onClick={() => setActiveRole(c.role)}
              className="glass group relative flex h-full w-full flex-col overflow-hidden rounded-none p-5 text-left transition hover:-translate-y-0.5"
              style={{ boxShadow: activeRole === c.role ? `0 0 0 1px ${c.color}66` : undefined }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-none"
                  style={{ background: `${c.color}1f` }}
                >
                  <span className="h-3 w-3 rounded-full" style={{ background: c.color }} />
                </span>
                <span
                  className="stat-num rounded-full px-2 py-0.5 text-[11px] font-bold"
                  style={{ background: `${c.color}1f`, color: c.color }}
                >
                  {c.players.length}
                </span>
              </div>
              <h3 className="mt-3 text-base font-semibold text-white">{c.role}</h3>
              <p className="mt-1 text-xs leading-relaxed text-white/50">{c.blurb}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {c.players.slice(0, 5).map((p) => {
                  return (
                    <span
                      key={p.id}
                      className="inline-flex items-center gap-1 rounded-full bg-white/[0.04] py-0.5 pl-0.5 pr-2 text-[10px] text-white/70"
                    >
                      <PlayerAvatar player={p} size={16} rounded />
                      {p.name}
                    </span>
                  );
                })}
                {c.players.length > 5 && (
                  <span className="inline-flex items-center rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/45">
                    +{c.players.length - 5} more
                  </span>
                )}
              </div>
            </button>
          </Reveal>
        ))}
      </div>

      {/* Detail panel */}
      {active && (
        <div className="mt-6">
          <Reveal>
            <Panel
              title={`${active.role} · ${active.players.length} players`}
              right={
                <button
                  onClick={() => setActiveRole(null)}
                  className="rounded-none p-1 text-white/40 transition hover:bg-white/10 hover:text-white"
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
                      className="flex items-center gap-3 rounded-none border border-white/[0.06] bg-white/[0.02] p-3"
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
          </Reveal>
        </div>
      )}
    </ToolShell>
  );
}
