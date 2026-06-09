"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";
import { staggerParent, staggerItem, spring } from "@/lib/motion";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { Segmented, Badge } from "@/components/ui/Controls";
import { Diverging } from "@/components/ui/Meter";
import { Reveal } from "@/components/ui/Reveal";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
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

  const board = useMemo(() => contractBoard(), []);
  const rows = useMemo(
    () => (filter === "all" ? board : board.filter((r) => r.verdict === filter)),
    [board, filter],
  );

  const bestBargain = board[0];
  const worstOverpay = board[board.length - 1];

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
                    <div className="stat-num text-3xl font-bold" style={{ color: accent }}>
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
        <div className="overflow-x-auto">
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
            <AnimatePresence mode="wait">
            <motion.tbody
              key={filter}
              variants={staggerParent}
              initial="initial"
              animate="animate"
            >
              {rows.map((r, i) => {
                const pos = r.surplus >= 0;
                return (
                  <motion.tr
                    key={r.player.id}
                    variants={staggerItem}
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
                  </motion.tr>
                );
              })}
            </motion.tbody>
            </AnimatePresence>
          </table>
        </div>
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
    </ToolShell>
  );
}
