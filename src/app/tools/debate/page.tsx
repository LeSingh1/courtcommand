"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { MessagesSquare, Check, Info } from "lucide-react";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { PlayerPicker } from "@/components/ui/PlayerPicker";
import { Diverging, Meter } from "@/components/ui/Meter";
import { Segmented, Badge } from "@/components/ui/Controls";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { TrackRecord } from "@/components/ui/TrackRecord";
import { getTool, categoryColor } from "@/lib/tools";
import { getPlayer, getPlayerByName } from "@/lib/data";
import { debate } from "@/lib/engine/content";
import { spring } from "@/lib/motion";
import type { Player } from "@/lib/types";

const TEAL = "#41C7E0";
type Lens = "overall" | "offense" | "defense";

export default function DebatePage() {
  return (
    <Suspense fallback={null}>
      <DebateInner />
    </Suspense>
  );
}

function DebateInner() {
  const tool = getTool("debate")!;
  const GOLD = categoryColor(tool.category);
  const params = useSearchParams();
  const [a, setA] = useState<Player | null>(() => getPlayerByName("Anthony Edwards") ?? null);
  const [b, setB] = useState<Player | null>(() => getPlayerByName("Luka Doncic") ?? null);
  const [lens, setLens] = useState<Lens>("overall");

  useEffect(() => {
    const pa = params.get("a");
    const pb = params.get("b");
    if (pa) {
      const p = getPlayer(pa);
      if (p) setA(p);
    }
    if (pb) {
      const p = getPlayer(pb);
      if (p) setB(p);
    }
  }, [params]);

  const result = useMemo(() => debate(a?.id ?? "", b?.id ?? "", lens), [a, b, lens]);

  return (
    <ToolShell tool={tool}>
      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_auto_1fr]">
        <PlayerPicker value={a} onChange={setA} accent={GOLD} exclude={b ? [b.id] : []} placeholder="Side A…" />
        <div className="flex items-center justify-center">
          <Segmented
            accent={GOLD}
            value={lens}
            onChange={setLens}
            options={[
              { label: "Overall", value: "overall" },
              { label: "Offense", value: "offense" },
              { label: "Defense", value: "defense" },
            ]}
          />
        </div>
        <PlayerPicker value={b} onChange={setB} accent={TEAL} exclude={a ? [a.id] : []} placeholder="Side B…" />
      </div>

      <AnimatePresence mode="wait">
      {typeof result === "string" ? (
        <Panel className="flex min-h-[300px] flex-col items-center justify-center text-center">
          <MessagesSquare size={40} className="mb-4 text-[#D7BC6A]" />
          <p className="max-w-xs text-sm text-white/50">{result}</p>
          <p className="mt-3 max-w-xs text-xs text-white/35">
            The engine builds an evidence-backed case for each side and calls the edge by the
            numbers.
          </p>
        </Panel>
      ) : (
        <motion.div
          key={`${result.a.player.id}-${result.b.player.id}-${lens}`}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={spring.soft}
        >
          <div className="grid items-stretch gap-4 lg:grid-cols-[1fr_120px_1fr]">
            <DebateCard side={result.a} accent={GOLD} leading={result.edge > 0} />

            <div className="flex flex-col items-center justify-center gap-3">
              <div className="text-[10px] text-white/40">Edge</div>
              <div
                className="stat-num text-3xl font-bold"
                style={{ color: result.edge >= 0 ? GOLD : TEAL }}
              >
                {result.edge > 0 ? "+" : ""}
                {result.edge}
              </div>
              <div className="w-full px-1">
                <Diverging value={result.edge} range={100} color={GOLD} negColor={TEAL} />
              </div>
              <div className="flex w-full justify-between text-[9px] text-white/35">
                <span className="truncate">{result.a.player.name.split(" ").slice(-1)[0]}</span>
                <span className="truncate">{result.b.player.name.split(" ").slice(-1)[0]}</span>
              </div>
            </div>

            <DebateCard side={result.b} accent={TEAL} leading={result.edge < 0} />
          </div>

          <div className="mt-6">
            <Insight accent={GOLD}>
              <b>Verdict:</b> {result.verdict}
            </Insight>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-[240px_1fr]">
            <Panel title="Verdict confidence">
              <div className="flex items-end gap-2">
                <span className="scoreboard text-4xl" style={{ color: GOLD }}>
                  {result.confidence_score}
                </span>
                <span className="mb-1 text-[10px] text-white/40">
                  / 95 max
                </span>
              </div>
              <div className="mt-3">
                <Meter
                  value={((result.confidence_score - 50) / 45) * 100}
                  color={GOLD}
                  height={6}
                />
              </div>
              <p className="mt-3 text-[11px] leading-snug text-white/45">
                Scaled from the size of the statistical edge: 50 is a coin flip, 95 is a decisive
                gap in the {lens} lens.
              </p>
            </Panel>
            <Panel title="Context notes">
              <div className="space-y-2.5">
                {result.context_notes.map((note) => (
                  <div
                    key={note}
                    className="flex items-start gap-2.5 text-sm leading-relaxed text-white/65"
                  >
                    <Info size={15} className="mt-0.5 shrink-0" style={{ color: TEAL }} />
                    <span>{note}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <div className="mt-4">
            <Panel title="Statistical edge">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-[11px] text-white/40">
                      <th className="py-2 font-medium">Stat</th>
                      <th className="py-2 font-semibold" style={{ color: GOLD }}>
                        {result.a.player.name.split(" ").slice(-1)[0]}
                      </th>
                      <th className="py-2 font-semibold" style={{ color: TEAL }}>
                        {result.b.player.name.split(" ").slice(-1)[0]}
                      </th>
                      <th className="py-2 text-right font-medium">Edge</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      {
                        label: "PPG",
                        va: result.a.player.ppg,
                        vb: result.b.player.ppg,
                        higherBetter: true,
                        fmt: (v: number) => v.toFixed(1),
                      },
                      {
                        label: "TS%",
                        va: Math.round(result.a.player.tsp * 100),
                        vb: Math.round(result.b.player.tsp * 100),
                        higherBetter: true,
                        fmt: (v: number) => `${v}%`,
                      },
                      {
                        label: "BPM",
                        va: result.a.player.bpm,
                        vb: result.b.player.bpm,
                        higherBetter: true,
                        fmt: (v: number) => (v >= 0 ? `+${v}` : String(v)),
                      },
                      {
                        label: "Def Impact",
                        va: result.a.player.defImpact,
                        vb: result.b.player.defImpact,
                        higherBetter: true,
                        fmt: (v: number) => String(v),
                      },
                      {
                        label: "APG",
                        va: result.a.player.apg,
                        vb: result.b.player.apg,
                        higherBetter: true,
                        fmt: (v: number) => v.toFixed(1),
                      },
                      {
                        label: "USG%",
                        va: result.a.player.usg,
                        vb: result.b.player.usg,
                        higherBetter: true,
                        fmt: (v: number) => `${v}%`,
                      },
                    ].map(({ label, va, vb, higherBetter, fmt }) => {
                      const aWins = higherBetter ? va > vb : va < vb;
                      const bWins = higherBetter ? vb > va : vb < va;
                      return (
                        <tr
                          key={label}
                          className="border-b border-white/[0.04] transition hover:bg-white/[0.03]"
                        >
                          <td className="py-2.5 text-xs text-white/45">{label}</td>
                          <td
                            className="stat-num py-2.5 font-semibold"
                            style={{ color: aWins ? GOLD : "rgba(255,255,255,0.7)" }}
                          >
                            {fmt(va)}
                          </td>
                          <td
                            className="stat-num py-2.5 font-semibold"
                            style={{ color: bWins ? TEAL : "rgba(255,255,255,0.7)" }}
                          >
                            {fmt(vb)}
                          </td>
                          <td className="py-2.5 text-right">
                            {aWins && <span className="stat-num text-xs" style={{ color: GOLD }}>▲ A</span>}
                            {bWins && <span className="stat-num text-xs" style={{ color: TEAL }}>▲ B</span>}
                            {!aWins && !bWins && <span className="text-[10px] text-white/25">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      <div className="mt-8 space-y-3">
        <div>
          <div className="kicker" style={{ color: "#D7BC6A" }}>Model track record</div>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            Each season since 2003, the player ratings these head-to-head edges draw on are checked against what those players produced the next year — the bars show that season-by-season correlation (about r=0.89). Context notes flag age, role, and usage gaps the raw edge can&rsquo;t see, and the confidence score is a fixed mapping of the edge size (50 = coin flip, 95 = decisive).
          </p>
        </div>
        <TrackRecord slug="debate" accent="#D7BC6A" />
      </div>
    </ToolShell>
  );
}

function DebateCard({
  side,
  accent,
  leading,
}: {
  side: { player: Player; points: string[] };
  accent: string;
  leading: boolean;
}) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={spring.snappy}
      className="glass rounded-lg p-5"
      style={{ boxShadow: leading ? `inset 0 0 0 1px ${accent}44` : undefined }}
    >
      <div className="mb-4 flex items-center gap-3">
        <PlayerAvatar player={side.player} size={44} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-white">{side.player.name}</div>
          <div className="stat-num text-[11px] text-white/45">
            {side.player.pos} · {side.player.ppg}/{side.player.rpg}/{side.player.apg}
          </div>
        </div>
        {leading && <Badge color={accent}>Edge</Badge>}
      </div>
      <div className="space-y-2.5">
        {side.points.map((pt, i) => (
          <div
            key={i}
            className="flex items-start gap-2.5 text-sm leading-relaxed text-white/75"
          >
            <Check size={15} className="mt-0.5 shrink-0" style={{ color: accent }} />
            <span>{pt}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
