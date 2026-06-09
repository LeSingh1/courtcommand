"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpRight, Plus, Check, Trash2, TrendingUp, TrendingDown, Sigma } from "lucide-react";
import { spring } from "@/lib/motion";
import { Panel, Insight } from "@/components/tool/ToolShell";
import { Segmented } from "@/components/ui/Controls";
import { Meter } from "@/components/ui/Meter";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { gradeColor } from "@/lib/cn";
import {
  edgeBoard,
  optimizeLineup,
  MARKETS,
  MARKET_LABEL,
  type PropEdge,
  type Market,
  type OddsType,
  type Side,
  type PlayType,
  type LineupPick,
} from "@/lib/engine/betting";

const EMERALD = "#2FA96B";

const ODDS_LABEL: Record<OddsType, string> = { standard: "Standard", demon: "Demon", goblin: "Goblin" };

export default function BettingPage() {
  const [market, setMarket] = useState<Market | "ALL">("ALL");
  const [oddsType, setOddsType] = useState<OddsType | "ALL">("ALL");
  const [slip, setSlip] = useState<{ id: string; side: Side }[]>([]);
  const [playType, setPlayType] = useState<PlayType>("power");
  const [entry, setEntry] = useState(10);

  const board = useMemo(
    () => edgeBoard({ market, oddsType }).slice(0, 40),
    [market, oddsType],
  );
  const byId = useMemo(() => {
    const m = new Map<string, PropEdge>();
    for (const e of edgeBoard()) m.set(e.id, e);
    return m;
  }, []);

  const toggle = (id: string, side: Side) => {
    setSlip((s) => {
      const ex = s.find((x) => x.id === id);
      if (ex) return ex.side === side ? s.filter((x) => x.id !== id) : s.map((x) => (x.id === id ? { id, side } : x));
      if (s.length >= 6) return s;
      return [...s, { id, side }];
    });
  };

  const picks: LineupPick[] = slip
    .map(({ id, side }) => {
      const prop = byId.get(id);
      if (!prop) return null;
      return { prop, side, prob: side === "more" ? prop.pMore : prop.pLess };
    })
    .filter(Boolean) as LineupPick[];

  const lineup = useMemo(() => optimizeLineup(picks, playType, entry), [picks, playType, entry]);

  return (
    <div className="mx-auto max-w-7xl px-5 pb-28 pt-28 sm:px-8">
      {/* Header */}
      <div className="enter mb-10 border-b border-[var(--line)] pb-8">
        <div className="kicker mb-3 flex items-center gap-3" style={{ color: EMERALD }}>
          <span className="h-px w-8" style={{ background: EMERALD }} />
          Betting · Edge Board
        </div>
        <h1 className="display text-4xl text-[var(--text)] sm:text-6xl">
          The <span className="display-italic" style={{ color: EMERALD }}>edge</span> engine.
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">
          The EdgeBoard model, inside CourtCommand. Every player prop is projected with a
          recency-blended mean and variance floor, converted to a P(over) through a normal CDF,
          nudged by matchup and form signals, then priced against the book line. Build a slip and the
          Poisson-binomial optimizer grades your expected value.
        </p>
        <div
          className="mt-5 inline-flex flex-wrap items-center gap-x-3 gap-y-1 border px-3 py-1.5 text-[11px]"
          style={{ borderColor: `${EMERALD}40` }}
        >
          <span className="flex items-center gap-1.5 font-semibold uppercase tracking-wider" style={{ color: EMERALD }}>
            <Sigma size={12} /> EdgeBoard model
          </span>
          <span className="text-[var(--text-muted)]">Recency-weighted projections · isotonic-style edge</span>
          <span className="stat-num text-[var(--text)]">Poisson-binomial EV</span>
        </div>
        <p className="mt-4 max-w-2xl text-[11px] text-[var(--text-faint)]">
          For entertainment and analysis only. Not betting advice. Projections use season-level data;
          point the model at a live game-log feed to match the production EdgeBoard.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Board */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={market}
              onChange={(e) => setMarket(e.target.value as Market | "ALL")}
              className="border border-[var(--line-strong)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none"
            >
              <option value="ALL">All markets</option>
              {MARKETS.map((m) => (
                <option key={m} value={m} className="bg-[var(--surface)]">
                  {MARKET_LABEL[m]}
                </option>
              ))}
            </select>
            <Segmented
              accent={EMERALD}
              value={oddsType}
              onChange={setOddsType}
              options={[
                { label: "All", value: "ALL" },
                { label: "Standard", value: "standard" },
                { label: "Demon", value: "demon" },
                { label: "Goblin", value: "goblin" },
              ]}
            />
            <span className="ml-auto text-xs text-[var(--text-faint)]">
              {board.length} top edges
            </span>
          </div>

          <Panel className="!p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--line)] text-left text-[11px] uppercase tracking-wide text-[var(--text-faint)]">
                    <th className="py-2.5 pl-4 font-medium">Player</th>
                    <th className="py-2.5 font-medium">Prop</th>
                    <th className="py-2.5 font-medium">Line</th>
                    <th className="py-2.5 font-medium">Proj</th>
                    <th className="py-2.5 font-medium">Edge</th>
                    <th className="py-2.5 pr-4 text-right font-medium">Pick</th>
                  </tr>
                </thead>
                <tbody>
                  {board.map((e) => {
                    const sel = slip.find((x) => x.id === e.id);
                    const ec = gradeColor(50 + e.edge * 280);
                    return (
                      <tr key={e.id} className="border-b border-[var(--line)] transition-colors hover:bg-[var(--surface-2)]">
                        <td className="py-2 pl-4">
                          <div className="flex items-center gap-2.5">
                            <PlayerAvatar player={e.player} size={30} />
                            <div className="min-w-0">
                              <div className="truncate text-[var(--text)]">{e.player.name}</div>
                              <div className="flex items-center gap-1">
                                <TeamLogo abbr={e.player.team} size={12} />
                                <span className="stat-num text-[10px] text-[var(--text-faint)]">{e.player.team}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2">
                          <div className="text-[var(--text-muted)]">{e.marketLabel}</div>
                          {e.oddsType !== "standard" && (
                            <span
                              className="text-[10px] font-semibold uppercase"
                              style={{ color: e.oddsType === "demon" ? "#BF5B4E" : EMERALD }}
                            >
                              {ODDS_LABEL[e.oddsType]}
                            </span>
                          )}
                        </td>
                        <td className="stat-num py-2 text-[var(--text)]">{e.line}</td>
                        <td className="stat-num py-2 text-[var(--text-muted)]">{e.projection}</td>
                        <td className="py-2">
                          <div className="flex items-center gap-2">
                            <div className="w-12">
                              <Meter value={e.edge * 100} max={40} color={ec} height={4} />
                            </div>
                            <span className="stat-num text-xs font-semibold" style={{ color: ec }}>
                              {e.edge >= 0 ? "+" : ""}
                              {(e.edge * 100).toFixed(0)}%
                            </span>
                          </div>
                        </td>
                        <td className="py-2 pr-4">
                          <div className="flex items-center justify-end gap-1.5">
                            <PickButton
                              active={sel?.side === "more"}
                              recommended={e.side === "more"}
                              color={EMERALD}
                              onClick={() => toggle(e.id, "more")}
                            >
                              <TrendingUp size={12} /> O {e.line}
                            </PickButton>
                            <PickButton
                              active={sel?.side === "less"}
                              recommended={e.side === "less"}
                              color="#BF5B4E"
                              onClick={() => toggle(e.id, "less")}
                            >
                              <TrendingDown size={12} /> U {e.line}
                            </PickButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        {/* Bet slip */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="border border-[var(--line)] bg-[var(--surface)]">
            <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
              <span className="text-sm font-semibold text-[var(--text)]">Bet slip</span>
              <span className="kicker" style={{ color: EMERALD }}>
                {slip.length}/6 picks
              </span>
            </div>

            {picks.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-[var(--text-faint)]">
                Tap <span className="text-[var(--text-muted)]">Over</span> or{" "}
                <span className="text-[var(--text-muted)]">Under</span> on the board to build a 2–6 pick
                entry. The optimizer grades your EV.
              </div>
            ) : (
              <div className="divide-y divide-[var(--line)]">
                <AnimatePresence initial={false}>
                  {picks.map((pk) => (
                    <motion.div
                      key={pk.prop.id}
                      layout
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={spring.soft}
                      className="overflow-hidden"
                    >
                      <div className="flex items-center gap-2.5 px-4 py-2.5">
                        <PlayerAvatar player={pk.prop.player} size={28} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs text-[var(--text)]">{pk.prop.player.name}</div>
                          <div className="stat-num text-[10px] text-[var(--text-faint)]">
                            {pk.side === "more" ? "Over" : "Under"} {pk.prop.line} {pk.prop.marketLabel} ·{" "}
                            {(pk.prob * 100).toFixed(0)}%
                          </div>
                        </div>
                        <motion.button
                          whileTap={{ scale: 0.85 }}
                          onClick={() => toggle(pk.prop.id, pk.side)}
                          className="text-[var(--text-faint)] transition hover:text-[#BF5B4E]"
                        >
                          <Trash2 size={14} />
                        </motion.button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {lineup && (
              <div className="border-t border-[var(--line)] p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <Segmented
                    accent={EMERALD}
                    value={playType}
                    onChange={setPlayType}
                    options={[
                      { label: "Power", value: "power" },
                      { label: "Flex", value: "flex" },
                    ]}
                  />
                  <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                    $
                    <input
                      type="number"
                      value={entry}
                      min={1}
                      onChange={(e) => setEntry(Math.max(1, Number(e.target.value)))}
                      className="w-14 border border-[var(--line)] bg-[var(--surface-2)] px-2 py-1 text-right text-[var(--text)] outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <SlipStat label="Payout" value={`${lineup.payoutMultiplier}×`} />
                  <SlipStat label="Hit prob (all)" value={`${(lineup.hitProbAll * 100).toFixed(1)}%`} />
                  <SlipStat
                    label="Expected value"
                    value={`${lineup.expectedValue >= 0 ? "+" : ""}$${lineup.expectedValue.toFixed(2)}`}
                    color={lineup.expectedValue >= 0 ? EMERALD : "#BF5B4E"}
                  />
                  <SlipStat
                    label="EV / stake"
                    value={`${lineup.evPct >= 0 ? "+" : ""}${lineup.evPct.toFixed(0)}%`}
                    color={lineup.evPct >= 0 ? EMERALD : "#BF5B4E"}
                  />
                </div>

                <div className="mt-3 flex items-center justify-between border border-[var(--line)] px-3 py-2">
                  <span className="text-xs text-[var(--text-muted)]">Slip grade · {lineup.correlationRisk} corr.</span>
                  <span
                    className="scoreboard text-2xl"
                    style={{ color: gradeColor(50 + lineup.evPct * 1.6) }}
                  >
                    {lineup.grade}
                  </span>
                </div>

                {/* hit distribution */}
                <div className="mt-3">
                  <div className="kicker mb-1.5">Hit distribution</div>
                  <div className="flex items-end gap-1" style={{ height: 48 }}>
                    {lineup.distribution.map((d, k) => (
                      <div key={k} className="flex flex-1 flex-col items-center justify-end">
                        <div
                          className="w-full"
                          style={{
                            height: `${Math.max(2, d * 100)}%`,
                            background: k === picks.length ? EMERALD : "rgba(255,255,255,0.14)",
                          }}
                        />
                        <span className="stat-num mt-1 text-[9px] text-[var(--text-faint)]">{k}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <Link
            href="/tools/fantasy-draft"
            className="group mt-3 flex items-center justify-between border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-xs text-[var(--text-muted)] transition hover:text-[var(--text)]"
          >
            <span className="link-underline">Pair with the Fantasy Draft model</span>
            <ArrowUpRight size={14} className="transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>
      </div>

      <div className="mt-8">
        <Insight>
          The board ranks props by <b>model edge</b> — P(model) minus the line&rsquo;s implied
          probability. <b>Demons</b> pay 1.5× per pick but clear a harder line; <b>goblins</b> pay
          0.85× on an easier one. The optimizer&rsquo;s Poisson-binomial distribution shows the real
          odds of hitting <i>k</i> of your legs.
        </Insight>
      </div>
    </div>
  );
}

function PickButton({
  children,
  active,
  recommended,
  color,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  recommended?: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.9 }}
      animate={{ scale: active ? 1.04 : 1 }}
      transition={spring.snappy}
      className="inline-flex items-center gap-1 border px-2 py-1 text-[11px] font-semibold"
      style={{
        color: active ? "#0a0a0b" : color,
        background: active ? color : "transparent",
        borderColor: active ? color : recommended ? `${color}66` : "var(--line)",
      }}
    >
      {children}
    </motion.button>
  );
}

function SlipStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">{label}</div>
      <div className="stat-num mt-0.5 text-sm font-semibold" style={{ color: color ?? "var(--text)" }}>
        {value}
      </div>
    </div>
  );
}
