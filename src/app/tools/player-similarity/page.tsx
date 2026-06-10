"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { GitCompareArrows } from "lucide-react";
import { spring, staggerParent, staggerItem } from "@/lib/motion";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { PlayerPicker } from "@/components/ui/PlayerPicker";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { RadarChart } from "@/components/ui/RadarChart";
import { Segmented } from "@/components/ui/Controls";
import { AnalyzeOverlay, useAnalyze } from "@/components/ui/Analyze";
import { TrackRecord } from "@/components/ui/TrackRecord";
import { getTool, categoryColor } from "@/lib/tools";
import { getPlayer } from "@/lib/data";
import {
  similarPlayers,
  radarValues,
  RADAR_AXES,
  type SimResult,
  type PositionFilter,
  type AgeBandFilter,
} from "@/lib/engine/players";
import type { Player } from "@/lib/types";

export default function SimilarityPage() {
  return (
    <Suspense fallback={null}>
      <SimilarityInner />
    </Suspense>
  );
}

function SimilarityInner() {
  const tool = getTool("player-similarity")!;
  const accent = categoryColor(tool.category);
  const params = useSearchParams();
  const router = useRouter();
  const [player, setPlayer] = useState<Player | null>(null);
  const [results, setResults] = useState<SimResult[]>([]);
  const [active, setActive] = useState(0);
  const [posFilter, setPosFilter] = useState<PositionFilter>("any");
  const [ageFilter, setAgeFilter] = useState<AgeBandFilter>("any");
  const analyze = useAnalyze([
    "Vectorizing playstyle…",
    "Z-scoring vs the league pool…",
    "Computing weighted cosine similarity…",
    "Ranking closest comps…",
  ]);

  useEffect(() => {
    const a = params.get("a");
    if (a) {
      const p = getPlayer(a);
      if (p) setPlayer(p);
    }
  }, [params]);

  useEffect(() => {
    if (!player) {
      setResults([]);
      router.replace("?", { scroll: false });
      return;
    }
    router.replace(`?a=${player.id}`, { scroll: false });
    analyze.run(() => {
      setResults(similarPlayers(player.id, 6, { position: posFilter, ageBand: ageFilter }));
      setActive(0);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);

  // Filter changes recompute instantly — no fake re-analysis pass.
  useEffect(() => {
    if (!player || analyze.phase === "running") return;
    setResults(similarPlayers(player.id, 6, { position: posFilter, ageBand: ageFilter }));
    setActive(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posFilter, ageFilter]);

  const comp = results[active]?.player ?? null;

  return (
    <ToolShell tool={tool}>
      <div className="mb-6 flex flex-wrap items-end gap-x-6 gap-y-4">
        <div className="w-full max-w-md">
          <PlayerPicker value={player} onChange={setPlayer} accent={accent} placeholder="Pick a player to find twins…" />
        </div>
        <div>
          <div className="mb-1.5 text-[10px] uppercase tracking-wider text-white/40">Position</div>
          <Segmented<PositionFilter>
            options={[
              { label: "Any", value: "any" },
              { label: "Adjacent", value: "adjacent" },
              { label: "Same", value: "same" },
            ]}
            value={posFilter}
            onChange={setPosFilter}
            accent={accent}
          />
        </div>
        <div>
          <div className="mb-1.5 text-[10px] uppercase tracking-wider text-white/40">Age band</div>
          <Segmented<AgeBandFilter>
            options={[
              { label: "Any age", value: "any" },
              { label: "Within 3 yrs", value: "within3" },
            ]}
            value={ageFilter}
            onChange={setAgeFilter}
            accent={accent}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
      {!player ? (
        <motion.div
          key="empty"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={spring.soft}
        >
          <Panel className="flex min-h-[300px] flex-col items-center justify-center text-center">
            <GitCompareArrows size={40} className="mb-4" style={{ color: accent }} />
            <p className="max-w-xs text-sm text-white/50">
              Choose any player — HoopRadar maps their statistical fingerprint and finds the closest
              stylistic twins in the league.
            </p>
          </Panel>
        </motion.div>
      ) : analyze.phase === "running" ? (
        <motion.div
          key="running"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={spring.soft}
        >
          <AnalyzeOverlay steps={analyze.steps} stepIdx={analyze.stepIdx} accent={accent} />
        </motion.div>
      ) : (
        <motion.div
          key="results"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={spring.soft}
          className="grid gap-6 lg:grid-cols-[1fr_360px]"
        >
          <div className="space-y-6">
            <Panel title="Closest comparisons">
              {results.length === 0 ? (
                <p className="py-8 text-center text-sm text-white/45">
                  No comps under these filters — widen the position or age band.
                </p>
              ) : (
              <motion.div className="space-y-2.5" variants={staggerParent} initial="initial" animate="animate">
                {results.map((r, i) => {
                  return (
                    <motion.button
                      key={r.player.id}
                      variants={staggerItem}
                      whileHover={{ y: -3 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setActive(i)}
                      className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition"
                      style={{
                        borderColor: i === active ? `${accent}55` : "rgba(255,255,255,0.07)",
                        background: i === active ? `${accent}0f` : "transparent",
                      }}
                    >
                      <PlayerAvatar player={r.player} size={40} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-white">{r.player.name}</span>
                          <span className="stat-num text-xs text-white/40">{r.player.pos}</span>
                          <span
                            className="rounded-lg px-1.5 py-0.5 text-[9px] uppercase tracking-wide"
                            style={{ background: `${accent}1a`, color: accent }}
                          >
                            {r.matchedArchetype}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {r.reasons.map((reason) => (
                            <span key={reason} className="text-[10px] text-white/45">
                              · {reason}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="stat-num text-lg font-bold" style={{ color: accent }}>{r.score}</div>
                        <div className="text-[9px] uppercase text-white/35">match</div>
                      </div>
                    </motion.button>
                  );
                })}
              </motion.div>
              )}
            </Panel>

            {results[active] && (
              <Panel title="Shared traits vs differences">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <div className="mb-2 text-[10px] uppercase tracking-wider text-white/40">
                      Most shared
                    </div>
                    <div className="space-y-2">
                      {results[active].topSharedTraits.map((t) => (
                        <div
                          key={t.label}
                          className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2"
                        >
                          <span className="text-xs text-white/70">{t.label}</span>
                          <span className="stat-num text-xs font-semibold" style={{ color: accent }}>
                            Δ {t.delta.toFixed(2)}σ
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 text-[10px] uppercase tracking-wider text-white/40">
                      Biggest differences
                    </div>
                    <div className="space-y-2">
                      {results[active].biggestDifferences.map((t) => (
                        <div
                          key={t.label}
                          className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2"
                        >
                          <span className="text-xs text-white/70">{t.label}</span>
                          <span className="stat-num text-xs font-semibold text-white/50">
                            Δ {t.delta.toFixed(2)}σ
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-white/40">
                  Δ is the gap in league-normalized standard deviations (z-scores) between the two
                  players on that dimension — smaller means more alike.
                </p>
              </Panel>
            )}
          </div>

          <div className="space-y-6">
            <Panel title="Stat fingerprint">
              <div className="flex justify-center">
                <RadarChart
                  axes={RADAR_AXES}
                  series={[
                    { name: player.name, color: "#E9A23B", values: radarValues(player) },
                    ...(comp ? [{ name: comp.name, color: accent, values: radarValues(comp) }] : []),
                  ]}
                />
              </div>
              <div className="mt-3 flex items-center justify-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-white/70">
                  <span className="h-2 w-2 rounded-full bg-ember" /> {player.name}
                </span>
                {comp && (
                  <span className="flex items-center gap-1.5 text-white/70">
                    <span className="h-2 w-2 rounded-full" style={{ background: accent }} /> {comp.name}
                  </span>
                )}
              </div>
            </Panel>

            {comp && (
              <Insight accent={accent}>
                <b>{comp.name}</b> is the closest match to <b>{player.name}</b> at{" "}
                <b>{results[active].score}%</b> similarity — {results[active].reasons.join(", ")}.
              </Insight>
            )}
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      <div className="mt-8 space-y-3">
        <div>
          <div className="kicker" style={{ color: "#9FB6C4" }}>Model track record</div>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">Comps are computed by z-scoring every player across ten stat dimensions against the full league pool, then ranking by cosine similarity over weighted profiles (scoring 22%, efficiency 18%, playmaking 16%, defense 16%, shot diet 16%, rebounding 12%). Each season since 2003, that multi-stat profile is checked against what players actually produced the next year — the bars show the season-by-season correlation (about r=0.89), the signal the similarity engine rides on.</p>
        </div>
        <TrackRecord slug="player-similarity" accent="#9FB6C4" />
      </div>
    </ToolShell>
  );
}
