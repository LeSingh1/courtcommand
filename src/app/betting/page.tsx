"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpRight, Check, Trash2, TrendingUp, TrendingDown, Sigma } from "lucide-react";
import { spring } from "@/lib/motion";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { Segmented } from "@/components/ui/Controls";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { gradeColor } from "@/lib/cn";
import type { ToolMeta } from "@/lib/types";
import {
  edgeBoard,
  optimizeLineup,
  MARKETS,
  MARKET_LABEL,
  KELLY_CAP,
  kellyFraction,
  type PropEdge,
  type Market,
  type OddsType,
  type Side,
  type PlayType,
  type LineupPick,
  type ConfidenceTier,
} from "@/lib/engine/betting";

// Ember accent (= var(--accent) #4d8dff), the sanctioned Prediction-category color.
const EMERALD = "#4D8DFF";

// Betting isn't registered in tools.ts (it's not a public /tools entry), so we
// describe it locally to drive the shared ToolShell header (breadcrumb + Share).
const BETTING_TOOL: ToolMeta = {
  slug: "betting",
  name: "EdgeBoard",
  short: "EdgeBoard",
  tagline:
    "Every player prop projected with a recency-blended mean and variance floor, priced against the book line. Build a slip and the Poisson-binomial optimizer grades your expected value.",
  category: "Prediction",
  accent: "ember",
  icon: "Sigma",
  keywords: ["betting", "edge", "props", "over", "under", "parlay", "ev"],
};

const ODDS_LABEL: Record<OddsType, string> = { standard: "Standard", demon: "Demon", goblin: "Goblin" };

// Muted semantic colors for confidence tiers (match the gradeColor palette).
const TIER_COLOR: Record<ConfidenceTier, string> = { A: "#4D8DFF", B: "#D7BC6A", C: "#D7BC6A" };

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
    <ToolShell tool={BETTING_TOOL}>
      {/* EdgeBoard model tag + responsible-use disclaimer */}
      <div className="enter mb-8">
        <div
          className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 border px-3 py-1.5 text-[11px]"
          style={{ borderColor: `${EMERALD}40` }}
        >
          <span className="flex items-center gap-1.5 font-semibold" style={{ color: EMERALD }}>
            <Sigma size={12} /> EdgeBoard model
          </span>
          <span className="text-[var(--text-muted)]">Recency-weighted projections · isotonic-style edge</span>
          <span className="stat-num text-[var(--text)]">Poisson-binomial EV</span>
        </div>
        <p className="mt-4 max-w-2xl text-[11px] text-[var(--text-faint)]">
          For entertainment and analysis only. Not betting advice. Projections are built from each
          player&rsquo;s real season-level production; the lines shown are modeled around those
          projections, not real posted sportsbook lines (there&rsquo;s no live book feed in this
          offline demo). Suggested stakes are <b>half Kelly</b> at each pick&rsquo;s implied odds (the edge is
          vs our own modeled line, and model error makes the true edge uncertain — fractional Kelly
          is the honest sizing), hard-capped at {KELLY_CAP * 100}% of bankroll; confidence tiers (A/B/C) grade edge size against
          projection volatility. Point the model at a live game-log and odds feed to match the
          production EdgeBoard.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Board */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter by market"
              value={market}
              onChange={(e) => setMarket(e.target.value as Market | "ALL")}
              className="cursor-pointer border border-[var(--line-strong)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none"
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

          {/* Prop cards — the actual EdgeBoard / PrizePicks board treatment:
              one card per prop, glyph-coded demons and goblins, circular
              headshot, the line front and center, More/Less to pick. */}
          {board.length === 0 ? (
            <Panel>
              <div className="py-12 text-center text-sm text-[var(--text-faint)]">
                No edges match these filters.
              </div>
            </Panel>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {board.map((e) => (
                <PropCard
                  key={e.id}
                  edge={e}
                  selectedSide={slip.find((x) => x.id === e.id)?.side ?? null}
                  onPick={(side) => toggle(e.id, side)}
                />
              ))}
            </div>
          )}
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
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={spring.soft}
                    >
                      <div className="flex items-center gap-2.5 px-4 py-2.5">
                        <PlayerAvatar player={pk.prop.player} size={28} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 truncate text-xs text-[var(--text)]">
                            {pk.prop.player.name}
                            <OddsGlyph oddsType={pk.prop.oddsType} size={14} />
                          </div>
                          <div className="stat-num text-[10px] text-[var(--text-faint)]">
                            {pk.side === "more" ? "Over" : "Under"} {pk.prop.line} {pk.prop.marketLabel} ·{" "}
                            {(pk.prob * 100).toFixed(0)}% · Kelly{" "}
                            {(
                              kellyFraction(
                                pk.prob,
                                pk.side === pk.prop.side ? pk.prop.implied : 1 - pk.prop.implied,
                              ) * 100
                            ).toFixed(1)}
                            %
                          </div>
                        </div>
                        <motion.button
                          aria-label={`Remove ${pk.prop.player.name} ${pk.prop.marketLabel}`}
                          whileTap={{ scale: 0.85 }}
                          onClick={() => toggle(pk.prop.id, pk.side)}
                          className="cursor-pointer text-[var(--text-faint)] transition hover:text-[#F4647D]"
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
                      aria-label="Entry amount in dollars"
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
                    color={lineup.expectedValue >= 0 ? EMERALD : "#F4647D"}
                  />
                  <SlipStat
                    label="EV / stake"
                    value={`${lineup.evPct >= 0 ? "+" : ""}${lineup.evPct.toFixed(0)}%`}
                    color={lineup.evPct >= 0 ? EMERALD : "#F4647D"}
                  />
                </div>

                {lineup.correlationWarning && (
                  <div
                    className="mt-3 rounded-lg border px-3 py-2 text-[11px] leading-relaxed"
                    style={{ borderColor: "#F4647D66", color: "#F4647D" }}
                  >
                    {lineup.correlationWarning}{" "}
                    <span className="stat-num text-[var(--text-muted)]">
                      Adjusted hit prob {(lineup.hitProbAdjusted * 100).toFixed(1)}%.
                    </span>
                  </div>
                )}

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
          odds of hitting <i>k</i> of your legs; stacking one player across markets gets flagged as
          correlated and the all-hit tail is discounted. Kelly is a stake-sizing ceiling, not a
          target — it caps at {KELLY_CAP * 100}% no matter how big the modeled edge.
        </Insight>
      </div>
    </ToolShell>
  );
}

// Authentic PrizePicks demon/goblin glyphs (bundled locally, same assets the
// production EdgeBoard uses) with their canonical colors.
const ODDS_ACCENT: Record<OddsType, string> = {
  standard: "#4D8DFF",
  demon: "#FF6B35",
  goblin: "#4ADE80",
};

function OddsGlyph({ oddsType, size = 22 }: { oddsType: OddsType; size?: number }) {
  if (oddsType === "standard") return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={oddsType === "demon" ? "/demon.png" : "/goblin.png"}
      alt={ODDS_LABEL[oddsType]}
      title={
        oddsType === "demon"
          ? "Demon — harder line, boosted payout"
          : "Goblin — easier line, reduced payout"
      }
      width={size}
      height={size}
      className="inline-block shrink-0"
      style={{ width: size, height: size }}
    />
  );
}

// PrizePicks-faithful prop card, Court Mono build: header chips, circular
// headshot ringed in the odds-type accent, the line front and center, and a
// split More/Less control carrying the model's probabilities.
function PropCard({
  edge: e,
  selectedSide,
  onPick,
}: {
  edge: PropEdge;
  selectedSide: Side | null;
  onPick: (side: Side) => void;
}) {
  const accent = ODDS_ACCENT[e.oddsType];
  const selected = selectedSide !== null;
  return (
    <motion.div
      layout
      whileHover={{ y: -3 }}
      transition={spring.snappy}
      className="relative flex flex-col rounded-2xl border bg-[var(--surface)] p-4"
      style={{
        borderColor: selected ? accent : "var(--line)",
        boxShadow: selected ? `0 0 0 1px ${accent}, 0 14px 36px -18px ${accent}66` : undefined,
      }}
    >
      {selected && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={spring.snappy}
          className="absolute -right-2 -top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full"
          style={{ background: accent, color: "#0a0a0b" }}
        >
          <Check size={14} strokeWidth={3} />
        </motion.span>
      )}

      {/* header chips */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <TeamLogo abbr={e.player.team} size={16} />
          <span className="stat-num text-[10px] text-[var(--text-faint)]">{e.player.team}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="rounded-full border px-1.5 py-px text-[9px] font-bold"
            style={{ color: TIER_COLOR[e.confidenceTier], borderColor: `${TIER_COLOR[e.confidenceTier]}55` }}
            title={`Confidence tier ${e.confidenceTier} — edge vs projection volatility`}
          >
            {e.confidenceTier}
          </span>
          <span
            className="stat-num rounded-full px-1.5 py-px text-[10px] font-semibold"
            style={{ background: `${accent}1c`, color: accent }}
            title="Model edge over the line's implied probability"
          >
            {e.edge >= 0 ? "+" : ""}
            {(e.edge * 100).toFixed(0)}%
          </span>
          <OddsGlyph oddsType={e.oddsType} />
        </div>
      </div>

      {/* headshot */}
      <div className="mt-3 flex justify-center">
        <span
          className="flex items-center justify-center overflow-hidden rounded-full border-2 bg-[var(--surface-2)]"
          style={{ borderColor: accent, boxShadow: `0 0 16px ${accent}33` }}
        >
          <PlayerAvatar player={e.player} size={72} />
        </span>
      </div>

      {/* name + meta */}
      <div className="mt-2.5 text-center">
        <div className="truncate text-sm font-semibold text-[var(--text)]">{e.player.name}</div>
        <div className="stat-num mt-0.5 text-[10px] text-[var(--text-faint)]">
          {e.player.pos} · proj {e.projection} · Kelly{" "}
          {e.kellyFraction > 0 ? `${(e.kellyFraction * 100).toFixed(1)}%` : "—"}
        </div>
      </div>

      {/* line + stat */}
      <div className="mt-3 border-t border-dashed pt-2.5 text-center" style={{ borderColor: `${accent}44` }}>
        <span className="scoreboard text-3xl text-[var(--text)]">{e.line}</span>
        <span className="ml-2 text-xs text-[var(--text-muted)]">{e.marketLabel}</span>
      </div>

      {/* More / Less */}
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        {(["more", "less"] as Side[]).map((side) => {
          const active = selectedSide === side;
          const prob = side === "more" ? e.pMore : e.pLess;
          const sideColor = side === "more" ? accent : "#F4647D";
          const recommended = e.side === side;
          return (
            <motion.button
              key={side}
              onClick={() => onPick(side)}
              whileTap={{ scale: 0.94 }}
              transition={spring.snappy}
              className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-semibold"
              style={{
                color: active ? "#0a0a0b" : sideColor,
                background: active ? sideColor : "transparent",
                borderColor: active ? sideColor : recommended ? `${sideColor}66` : "var(--line)",
              }}
              aria-pressed={active}
              aria-label={`${side === "more" ? "More" : "Less"} than ${e.line} ${e.marketLabel} for ${e.player.name}`}
            >
              {side === "more" ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              {side === "more" ? "More" : "Less"}
              <span className="stat-num text-[10px] opacity-80">{(prob * 100).toFixed(0)}%</span>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}

function SlipStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2">
      <div className="text-[10px] text-[var(--text-faint)]">{label}</div>
      <div className="stat-num mt-0.5 text-sm font-semibold" style={{ color: color ?? "var(--text)" }}>
        {value}
      </div>
    </div>
  );
}
