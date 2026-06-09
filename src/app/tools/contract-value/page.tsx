"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";
import { spring } from "@/lib/motion";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { Segmented, Badge } from "@/components/ui/Controls";
import { Diverging } from "@/components/ui/Meter";
import { Reveal } from "@/components/ui/Reveal";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { TrackRecord } from "@/components/ui/TrackRecord";
import { getTool } from "@/lib/tools";
import { contractBoard, type ContractRow } from "@/lib/engine/players";

type Filter = "all" | "Bargain" | "Fair" | "Overpaid";

const VERDICT_COLOR: Record<ContractRow["verdict"], string> = {
  Bargain: "#5FA97E",
  Fair: "#C9A14A",
  Overpaid: "#BF5B4E",
};

const POS = "#5FA97E";
const NEG = "#BF5B4E";

export default function ContractValuePage() {
  const tool = getTool("contract-value")!;
  const [filter, setFilter] = useState<Filter>("all");

  const [isAnalyzing, setIsAnalyzing] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setIsAnalyzing(false), 350);
    return () => clearTimeout(t);
  }, []);

  const board = useMemo(() => contractBoard(), []);
  const rows = useMemo(
    () => (filter === "all" ? board : board.filter((r) => r.verdict === filter)),
    [board, filter],
  );

  const bestBargain = board[0];
  const worstOverpay = board[board.length - 1];

  if (isAnalyzing) {
    return (
      <ToolShell tool={tool}>
        <Panel title="Contract value board">
          <div className="flex items-center gap-3 py-2 text-sm text-[var(--text-muted)]">
            <span className="inline-block h-3 w-3 animate-pulse" style={{ background: POS }} />
            Analyzing contracts…
          </div>
          <div className="mt-4 space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-9 w-full animate-pulse bg-white/[0.04]" />
            ))}
          </div>
        </Panel>
      </ToolShell>
    );
  }

  return (
    <ToolShell tool={tool}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Insight accent="#5FA97E">
          <b>{bestBargain.player.name}</b> is the league&apos;s best value — producing{" "}
          <b>${bestBargain.produced}M</b> on a <b>${bestBargain.player.salary}M</b> deal for{" "}
          <b className="text-mint">+${bestBargain.surplus}M</b> of surplus. Production is modeled
          from win value, availability, and the age curve.
        </Insight>
        <Segmented
          accent="#5FA97E"
          value={filter}
          onChange={setFilter}
          options={[
            { label: "All", value: "all" },
            { label: "Bargains", value: "Bargain" },
            { label: "Fair", value: "Fair" },
            { label: "Overpaid", value: "Overpaid" },
          ]}
        />
      </div>

      {/* Highlight cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        {[
          { label: "Biggest bargain", row: bestBargain, accent: POS, Icon: TrendingUp },
          { label: "Worst overpay", row: worstOverpay, accent: NEG, Icon: TrendingDown },
        ].map(({ label, row, accent, Icon }, i) => {
          return (
            <Reveal key={label} delay={i * 0.08}>
              <motion.div whileHover={{ y: -3 }} transition={spring.snappy} className="glass relative overflow-hidden rounded-none p-5">
                <div className="flex items-center justify-between">
                  <span className="eyebrow" style={{ color: accent }}>
                    {label}
                  </span>
                  <Icon size={18} style={{ color: accent }} />
                </div>
                <div className="mt-3 flex items-center gap-2.5">
                  <PlayerAvatar player={row.player} size={40} />
                  <div>
                    <div className="font-semibold text-white">{row.player.name}</div>
                    <div className="stat-num text-[11px] text-white/45">
                      {row.player.pos} · ${row.player.salary}M salary
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <div className="scoreboard text-4xl leading-none tabular-nums" style={{ color: accent }}>
                      {row.surplus >= 0 ? "+" : ""}
                      ${row.surplus}M
                    </div>
                    <div className="text-[10px] uppercase text-white/40">Surplus value</div>
                  </div>
                  <div className="stat-num text-right text-xs text-white/50">
                    <div>${row.produced}M produced</div>
                    <div>Grade {row.grade}</div>
                  </div>
                </div>
              </motion.div>
            </Reveal>
          );
        })}
      </div>

      <Panel title={`Contract value board · ${rows.length} players`}>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 border border-[var(--line)] px-6 py-12 text-center">
            <p className="text-sm text-[var(--text-muted)]">No players match this filter.</p>
            <button
              onClick={() => setFilter("all")}
              className="border border-[var(--line)] px-3 py-1.5 text-xs uppercase tracking-wide text-white/70 transition hover:bg-white/[0.04]"
            >
              Clear filter
            </button>
          </div>
        ) : (
        <div key={filter} className="enter overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wide text-white/40">
                <th className="py-2 pl-2 font-medium">#</th>
                <th className="py-2 font-medium">Player</th>
                <th className="py-2 text-right font-medium">Salary</th>
                <th className="py-2 text-right font-medium">Produced</th>
                <th className="py-2 font-medium">Surplus</th>
                <th className="py-2 font-medium">Verdict</th>
                <th className="py-2 pr-2 text-right font-medium">Grade</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const pos = r.surplus >= 0;
                return (
                  <tr
                    key={r.player.id}
                    className="border-b border-white/[0.04] transition hover:bg-white/[0.03]"
                  >
                    <td className="stat-num py-2.5 pl-2 text-white/35">{i + 1}</td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2.5">
                        <PlayerAvatar player={r.player} size={28} />
                        <span className="text-white/85">{r.player.name}</span>
                      </div>
                    </td>
                    <td className="stat-num py-2.5 text-right text-white/65">
                      ${r.player.salary}M
                    </td>
                    <td className="stat-num py-2.5 text-right text-white/65">${r.produced}M</td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-24">
                          <Diverging value={r.surplus} range={20} />
                        </div>
                        <span
                          className="stat-num w-16 text-xs font-semibold"
                          style={{ color: pos ? POS : NEG }}
                        >
                          {pos ? "+" : ""}
                          ${r.surplus}M
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5">
                      <Badge color={VERDICT_COLOR[r.verdict]}>{r.verdict}</Badge>
                    </td>
                    <td className="py-2.5 pr-2 text-right">
                      <span
                        className="stat-num rounded-none px-2 py-0.5 text-xs font-bold"
                        style={{
                          background: `${VERDICT_COLOR[r.verdict]}1f`,
                          color: VERDICT_COLOR[r.verdict],
                        }}
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
        )}
      </Panel>

      <div className="mt-6">
        <Insight accent="#BF5B4E">
          <b>{worstOverpay.player.name}</b> is the steepest overpay — ${worstOverpay.player.salary}M
          for just ${worstOverpay.produced}M of production (
          <b className="text-rose">${worstOverpay.surplus}M</b>). The gap from{" "}
          <b>{bestBargain.player.name}</b> to <b>{worstOverpay.player.name}</b> spans{" "}
          <b>${(bestBargain.surplus - worstOverpay.surplus).toFixed(1)}M</b> of surplus value.
        </Insight>
      </div>

      <div className="mt-8 space-y-3">
        <div>
          <div className="kicker" style={{ color: "#4E8FA8" }}>Model track record</div>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            This panel traces the model&apos;s real training history, showing the count of player-seasons it
            learned from growing each year since 2003, alongside the validation metric and method used to
            check its surplus-value estimates.
          </p>
        </div>
        <TrackRecord slug="contract-value" accent="#4E8FA8" />
      </div>
    </ToolShell>
  );
}
