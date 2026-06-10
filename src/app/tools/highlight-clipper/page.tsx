"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Scissors, Loader2, Flame } from "lucide-react";
import { spring } from "@/lib/motion";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { ShotReplay } from "@/components/ui/ShotReplay";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { TrackRecord } from "@/components/ui/TrackRecord";
import { getTool, categoryColor } from "@/lib/tools";
import { PLAYERS } from "@/lib/data";
import { loadRealShots, highlightReel, type HighlightClip } from "@/lib/data/shots";
import { gradeColor } from "@/lib/cn";
import type { Player } from "@/lib/types";

const playerByEspn = (id: number): Player | undefined => PLAYERS.find((p) => p.espnId === id);

export default function HighlightClipperPage() {
  const tool = getTool("highlight-clipper")!;
  const accent = categoryColor(tool.category);
  const [shots, setShots] = useState<Awaited<ReturnType<typeof loadRealShots>> | null>(null);
  useEffect(() => {
    let alive = true;
    loadRealShots().then((d) => alive && setShots(d));
    return () => {
      alive = false;
    };
  }, []);

  const reel = useMemo<HighlightClip[]>(() => (shots ? highlightReel(shots, 30) : []), [shots]);
  const [sel, setSel] = useState(0);

  if (!shots) {
    return (
      <ToolShell tool={tool}>
        <Panel className="flex min-h-[360px] flex-col items-center justify-center gap-3 text-center">
          <Loader2 size={22} className="animate-spin text-[var(--text-faint)]" />
          <p className="text-sm text-white/50">Scanning every playoff make for highlights…</p>
        </Panel>
      </ToolShell>
    );
  }

  const clip = reel[sel] ?? reel[0];
  const player = clip ? playerByEspn(clip.shot.espnId) : undefined;

  return (
    <ToolShell tool={tool}>
      <Insight accent={accent}>
        Auto-detected <b>{reel.length} highlight-worthy plays</b> from the real 2026 playoffs — dunks,
        deep threes, and clutch makes scored straight from the play-by-play. Each card&rsquo;s confidence
        is the detector&rsquo;s real highlight score.
      </Insight>

      <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* reel list */}
        <Panel title="Detected clips">
          <div className="no-scrollbar max-h-[460px] space-y-1.5 overflow-y-auto">
            {reel.map((h, i) => {
              const p = playerByEspn(h.shot.espnId);
              const on = i === sel;
              return (
                <button
                  key={h.shot.id}
                  onClick={() => setSel(i)}
                  className="flex w-full items-center gap-2.5 border px-2.5 py-2 text-left transition"
                  style={{ borderColor: on ? `${accent}66` : "var(--line)", background: on ? `${accent}12` : "transparent" }}
                >
                  {p ? <PlayerAvatar player={p} size={28} /> : null}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs text-white/85">{h.shot.player}</div>
                    <div className="stat-num text-[10px] text-[var(--text-faint)]">
                      {h.shot.game} · Q{h.shot.period}
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    {h.tags.slice(0, 1).map((t) => (
                      <span key={t} className="border px-1 py-0.5 text-[9px]" style={{ borderColor: `${accent}40`, color: accent }}>
                        {t}
                      </span>
                    ))}
                  </div>
                  <span className="scoreboard w-7 text-right text-sm" style={{ color: gradeColor(h.score) }}>
                    {h.score}
                  </span>
                </button>
              );
            })}
          </div>
        </Panel>

        {/* selected clip */}
        <div className="space-y-6">
          {clip && (
            <motion.div key={clip.shot.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={spring.soft} className="space-y-6">
              <Panel>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {player ? <PlayerAvatar player={player} size={46} /> : null}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{clip.shot.player}</span>
                        <TeamLogo abbr={clip.shot.team} size={16} />
                      </div>
                      <div className="mt-0.5 text-sm text-[var(--text-muted)]">{clip.shot.text}</div>
                      <div className="stat-num mt-1 text-[11px] text-[var(--text-faint)]">
                        {clip.shot.game} · Q{clip.shot.period} {clip.shot.clock}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <Flame size={14} style={{ color: gradeColor(clip.score) }} />
                      <span className="scoreboard text-2xl" style={{ color: gradeColor(clip.score) }}>
                        {clip.score}
                      </span>
                    </div>
                    <span className="kicker">Confidence</span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {clip.tags.map((t) => (
                    <span key={t} className="border px-2 py-0.5 text-[11px]" style={{ borderColor: `${accent}40`, color: accent }}>
                      {t}
                    </span>
                  ))}
                </div>
              </Panel>

              <Panel title="Clip preview">
                <ShotReplay key={clip.shot.id} x={clip.shot.x} y={clip.shot.y} made accent={accent} height={340} />
                <p className="mt-2 text-center text-[11px] text-[var(--text-faint)]">
                  Recreated from the shot&rsquo;s real court coordinates · for actual broadcast video of
                  real shots, see the Shot Quality Film Room
                </p>
              </Panel>
            </motion.div>
          )}
        </div>
      </div>

      <div className="mt-8 space-y-3">
        <div>
          <div className="kicker" style={{ color: accent }}>
            Data &amp; method
          </div>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            Highlights are scored from real 2026 playoff play-by-play — the detector weights dunks,
            deep threes, clutch timing, and shot difficulty into a confidence score. Real frame-level
            video detection isn&rsquo;t available offline, so this surfaces the real plays and recreates
            them; the Shot Quality Film Room carries actual broadcast clips.
          </p>
        </div>
        <TrackRecord slug="highlight-clipper" accent={accent} />
      </div>
    </ToolShell>
  );
}
