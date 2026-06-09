"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Check, X, Film, Clapperboard } from "lucide-react";
import { Panel, Insight } from "@/components/tool/ToolShell";
import { Gauge } from "@/components/ui/Gauge";
import { ShotReplay } from "@/components/ui/ShotReplay";
import { gradeRealShot } from "@/lib/engine/game";
import { gradeColor } from "@/lib/cn";
import { spring } from "@/lib/motion";
import {
  CLIP_PLAYERS,
  clipsForPlayer,
  clipToShot,
  clipCourt,
  clipDistFt,
  clipIsThree,
  DEFAULT_CLIP_ID,
  REAL_CLIPS,
  type RealClip,
} from "@/lib/data/clips";

const ACCENT = "#E0561F";
const MISS = "#BF5B4E";
const MADE = "#5FA97E";

const DEFAULT_PLAYER =
  REAL_CLIPS.find((c) => c.id === DEFAULT_CLIP_ID)?.player ?? CLIP_PLAYERS[0]?.player ?? "";

function gradeBadgeColor(g: string): string {
  if (/A/.test(g)) return MADE;
  if (/B/.test(g)) return "#C9A14A";
  if (/C/.test(g)) return "#7E8CA0";
  return MISS;
}

export function ShotFilm() {
  const [q, setQ] = useState("");
  const [player, setPlayer] = useState(DEFAULT_PLAYER);
  const clips = useMemo(() => clipsForPlayer(player), [player]);
  const [clipId, setClipId] = useState<string>(
    clipsForPlayer(DEFAULT_PLAYER).find((c) => c.id === DEFAULT_CLIP_ID)?.id ??
      clipsForPlayer(DEFAULT_PLAYER)[0]?.id ??
      "",
  );
  const [vidErr, setVidErr] = useState(false);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return CLIP_PLAYERS.filter((p) => !s || p.player.toLowerCase().includes(s)).slice(0, 80);
  }, [q]);

  const clip: RealClip | undefined = clips.find((c) => c.id === clipId) ?? clips[0];
  const grade = clip ? gradeRealShot(clipToShot(clip)) : null;
  const court = clip ? clipCourt(clip) : { x: 250, y: 240 };

  const pickPlayer = (name: string) => {
    setPlayer(name);
    setVidErr(false);
    setClipId(clipsForPlayer(name)[0]?.id ?? "");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      {/* Left: player + clip list */}
      <div className="space-y-4">
        <Panel title="Players on film">
          <div className="mb-3 flex items-center gap-2 border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2">
            <Search size={15} className="text-[var(--text-faint)]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search players…"
              aria-label="Search players on film"
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35"
            />
          </div>
          <div className="no-scrollbar max-h-56 space-y-1 overflow-y-auto">
            {filtered.map((p) => {
              const sel = p.player === player;
              return (
                <button
                  key={p.player}
                  onClick={() => pickPlayer(p.player)}
                  className="flex w-full cursor-pointer items-center gap-2.5 border px-2.5 py-1.5 text-left transition"
                  style={{
                    borderColor: sel ? `${ACCENT}66` : "transparent",
                    background: sel ? `${ACCENT}12` : "transparent",
                  }}
                >
                  <Film size={14} className="shrink-0 text-[var(--text-faint)]" />
                  <span className="flex-1 truncate text-sm text-white/85">{p.player}</span>
                  <span className="stat-num text-[11px] text-[var(--text-faint)]">{p.count}</span>
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel title={`${player} · clips`}>
          <div className="no-scrollbar max-h-[330px] space-y-1 overflow-y-auto">
            {clips.map((c) => {
              const sel = c.id === clipId;
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setClipId(c.id);
                    setVidErr(false);
                  }}
                  className="flex w-full cursor-pointer items-center gap-2.5 border px-2.5 py-2 text-left transition"
                  style={{
                    borderColor: sel ? `${ACCENT}66` : "var(--line)",
                    background: sel ? `${ACCENT}12` : "transparent",
                  }}
                >
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center"
                    style={{
                      background: c.made ? MADE : "transparent",
                      border: c.made ? "none" : `1px solid ${MISS}55`,
                    }}
                  >
                    {c.made ? <Check size={12} className="text-[#0a0a0b]" /> : <X size={11} style={{ color: MISS }} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs text-white/85">{c.action}</div>
                    <div className="stat-num text-[10px] text-[var(--text-faint)]">{c.inputs.when}</div>
                  </div>
                  <span
                    className="stat-num shrink-0 px-1.5 py-0.5 text-[10px] font-semibold"
                    style={{ color: gradeBadgeColor(c.grade), border: `1px solid ${gradeBadgeColor(c.grade)}40` }}
                  >
                    {c.grade}
                  </span>
                </button>
              );
            })}
          </div>
        </Panel>
      </div>

      {/* Right: video + grade + replay */}
      <div className="space-y-6">
        <AnimatePresence mode="wait">
          {clip && grade ? (
            <motion.div
              key={clip.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={spring.soft}
              className="space-y-6"
            >
              {/* REAL VIDEO */}
              <Panel
                title="Real broadcast clip"
                right={
                  <span className="flex items-center gap-1.5 text-[11px] text-[var(--text-faint)]">
                    <Clapperboard size={13} /> videos.nba.com
                  </span>
                }
              >
                <div className="relative overflow-hidden border border-[var(--line)] bg-black">
                  {vidErr ? (
                    <div className="flex aspect-video flex-col items-center justify-center gap-2 text-center">
                      <Film size={26} className="text-[var(--text-faint)]" />
                      <p className="max-w-xs text-xs text-[var(--text-muted)]">
                        This clip is temporarily unavailable from the league CDN. The model grade and
                        2.5D replay below are recreated from the same shot.
                      </p>
                      <a
                        href={clip.url}
                        target="_blank"
                        rel="noreferrer"
                        className="stat-num text-[11px] underline"
                        style={{ color: ACCENT }}
                      >
                        Open source
                      </a>
                    </div>
                  ) : (
                    <video
                      key={clip.id}
                      src={clip.url}
                      autoPlay
                      muted
                      loop
                      playsInline
                      controls
                      preload="metadata"
                      onError={() => setVidErr(true)}
                      className="aspect-video w-full bg-black"
                    />
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-white">
                      {clip.player} · <span className="text-[var(--text-muted)]">{clip.action}</span>
                    </div>
                    <div className="stat-num mt-0.5 text-[11px] text-[var(--text-faint)]">{clip.series}</div>
                  </div>
                  <span
                    className="scoreboard px-2.5 py-1 text-sm"
                    style={{
                      color: clip.made ? MADE : MISS,
                      border: `1px solid ${clip.made ? MADE : MISS}45`,
                      background: `${clip.made ? MADE : MISS}10`,
                    }}
                  >
                    {clip.made ? "MADE" : "MISS"}
                  </span>
                </div>
              </Panel>

              {/* grade vs reality */}
              <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
                <Panel className="flex flex-col items-center justify-center">
                  <Gauge value={grade.result.qSQ} label="Model qSQ" color={gradeColor(grade.result.qSQ)} />
                  <div className="mt-3 text-center">
                    <div className="text-sm font-semibold text-white">{grade.result.rating}</div>
                    <div className="stat-num mt-1 text-xs text-white/45">
                      {grade.result.expFg}% expected · {grade.result.expPoints} pts
                    </div>
                  </div>
                </Panel>
                <Panel>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="border border-[var(--line)] p-3">
                      <div className="kicker mb-1">CourtCommand grade</div>
                      <div className="scoreboard text-2xl" style={{ color: gradeColor(grade.result.qSQ) }}>
                        {grade.result.qSQ}
                      </div>
                      <div className="text-[11px] text-[var(--text-faint)]">{grade.result.rating}</div>
                    </div>
                    <div
                      className="border p-3"
                      style={{
                        borderColor: clip.made ? `${MADE}55` : `${MISS}55`,
                        background: clip.made ? `${MADE}0f` : `${MISS}0f`,
                      }}
                    >
                      <div className="kicker mb-1">Reality</div>
                      <div className="scoreboard text-2xl" style={{ color: clip.made ? MADE : MISS }}>
                        {clip.made ? "MADE" : "MISS"}
                      </div>
                      <div className="text-[11px] text-[var(--text-faint)]">
                        {clipDistFt(clip)} ft {clipIsThree(clip) ? "three" : "two"}
                      </div>
                    </div>
                  </div>
                  {/* real tracking metrics from the clip */}
                  <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[var(--line)] pt-3">
                    <Metric label="Release ∠" value={`${clip.metrics.releaseAngleDeg}°`} />
                    <Metric label="Release ht" value={`${clip.metrics.releaseHeightFt}′`} />
                    <Metric label="ShotSense xFG" value={`${Math.round(clip.modelXfg * 100)}%`} />
                  </div>
                </Panel>
              </div>

              <Insight accent={ACCENT}>{grade.verdict}</Insight>

              {/* refined 2.5D replay */}
              <Panel title="2.5D replay">
                <ShotReplay key={clip.id} x={court.x} y={court.y} made={clip.made} height={340} />
                <p className="mt-2 text-center text-[11px] text-[var(--text-faint)]">
                  Trajectory recreated from the shot&rsquo;s real court location and outcome · the clip
                  above is the actual broadcast video
                </p>
              </Panel>
            </motion.div>
          ) : (
            <Panel className="flex min-h-[320px] items-center justify-center text-center">
              <p className="max-w-xs text-sm text-white/50">Pick a player and a clip to watch the real shot.</p>
            </Panel>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="kicker mb-0.5">{label}</div>
      <div className="scoreboard text-base text-white">{value}</div>
    </div>
  );
}
