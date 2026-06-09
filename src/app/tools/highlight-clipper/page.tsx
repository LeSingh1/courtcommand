"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Scissors, UploadCloud, Film, Activity, Volume2, Zap } from "lucide-react";
import { spring } from "@/lib/motion";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { Slider, Badge } from "@/components/ui/Controls";
import { Meter } from "@/components/ui/Meter";
import { Reveal, Enter } from "@/components/ui/Reveal";
import { AnalyzeOverlay, useAnalyze } from "@/components/ui/Analyze";
import { TrackRecord } from "@/components/ui/TrackRecord";
import { getTool } from "@/lib/tools";
import { detectHighlights, type HighlightClip } from "@/lib/engine/game";
import { gradeColor } from "@/lib/cn";

const EMBER = "#E0561F";

const TYPE_COLOR: Record<string, string> = {
  Dunk: "#E0561F",
  Three: "#7E8CA0",
  Block: "#BF5B4E",
  "And-1": "#C9A14A",
  Assist: "#5FA97E",
  Steal: "#E0561F",
};

export default function HighlightClipperPage() {
  const tool = getTool("highlight-clipper")!;
  const [filename, setFilename] = useState<string | null>(null);
  const [durationMin, setDurationMin] = useState(12);
  const [clips, setClips] = useState<HighlightClip[] | null>(null);
  const analyze = useAnalyze([
    "Decoding frames…",
    "Tracking motion vectors…",
    "Listening for crowd spikes…",
    "Ranking moments…",
  ]);

  const detect = () => {
    if (!filename) setFilename("Q4_full.mp4");
    analyze.run(() => setClips(detectHighlights(durationMin)));
  };

  const top = clips?.[0] ?? null;

  return (
    <ToolShell tool={tool}>
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Panel title="Source footage">
          <div className="space-y-5">
            <button
              onClick={() => setFilename(filename ? null : "Q4_full.mp4")}
              className="group flex w-full flex-col items-center justify-center gap-3 rounded-none border-2 border-dashed px-4 py-8 text-center transition"
              style={{
                borderColor: filename ? `${EMBER}66` : "rgba(255,255,255,0.14)",
                background: filename ? `${EMBER}0d` : "rgba(255,255,255,0.02)",
              }}
            >
              <div>
                {filename ? (
                  <Film size={30} className="text-ember" />
                ) : (
                  <UploadCloud size={30} className="text-white/40 transition group-hover:text-white/70" />
                )}
              </div>
              {filename ? (
                <div>
                  <div className="stat-num text-sm font-semibold text-white">{filename}</div>
                  <div className="text-[11px] text-white/45">{durationMin}:00 · 1080p60 · tap to clear</div>
                </div>
              ) : (
                <div>
                  <div className="text-sm font-medium text-white/80">Drop game film here</div>
                  <div className="text-[11px] text-white/55">MP4 · up to 4K · or click to load demo</div>
                </div>
              )}
            </button>

            <Slider
              label="Clip window length"
              value={durationMin}
              min={4}
              max={20}
              unit=" min"
              onChange={setDurationMin}
            />

            <motion.button onClick={detect} whileTap={{ scale: 0.96 }} transition={spring.snappy} className="btn-ember flex w-full items-center justify-center gap-2 rounded-none py-3 text-sm">
              <Scissors size={15} /> Detect highlights
            </motion.button>
            <p className="text-[11px] leading-relaxed text-white/55">
              The auto-editor scans the timeline for motion-vector bursts and crowd-audio spikes, then
              ranks each moment by detection confidence.
            </p>
          </div>
        </Panel>

        <div className="space-y-6">
          <AnimatePresence mode="wait">
          {analyze.phase === "running" ? (
            <motion.div
              key="running"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={spring.soft}
            >
              <AnalyzeOverlay steps={analyze.steps} stepIdx={analyze.stepIdx} accent={EMBER} />
            </motion.div>
          ) : clips ? (
            <motion.div
              key="result"
              className="space-y-6"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={spring.soft}
            >
              {top && (
                <Insight accent={EMBER}>
                  Top moment: a <b>{top.label.toLowerCase()}</b> at <b className="stat-num">{top.t}</b> with{" "}
                  <b>{top.confidence}% confidence</b> — driven by a {top.motion}-motion / {top.audio}-audio spike.
                  {" "}
                  {top.confidence >= 70
                    ? "Lead your reel with this clip."
                    : "Verify it before featuring — confidence is modest."}
                </Insight>
              )}

              <Panel
                title="Detected timeline"
                right={<span className="stat-num text-xs text-white/45">{clips.length} clips found</span>}
              >
                <div className="space-y-3">
                  {clips.map((c, i) => {
                    const color = TYPE_COLOR[c.type] ?? EMBER;
                    return (
                      <Reveal key={`${c.t}-${i}`} delay={Math.min(0.4, i * 0.05)}>
                        <div className="rounded-none border border-white/[0.07] bg-white/[0.02] p-3.5 transition hover:border-white/15">
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col items-center">
                              <span className="stat-num text-lg font-bold text-white">{c.t}</span>
                              <span className="text-[10px] uppercase text-white/50">timestamp</span>
                            </div>
                            <div className="h-9 w-px bg-white/10" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <Badge color={color}>{c.type}</Badge>
                                <span className="truncate text-sm font-medium text-white/85">{c.label}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Zap size={13} style={{ color: gradeColor(c.confidence) }} />
                              <span className="stat-num text-lg font-bold" style={{ color: gradeColor(c.confidence) }}>
                                {c.confidence}
                              </span>
                            </div>
                          </div>
                          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                            <div className="flex items-center gap-2">
                              <Activity size={12} className="shrink-0 text-white/40" />
                              <Meter value={c.motion} color="#E0561F" height={6} />
                              <span className="stat-num w-7 text-right text-[11px] text-white/55">{c.motion}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Volume2 size={12} className="shrink-0 text-white/40" />
                              <Meter value={c.audio} color="#7E8CA0" height={6} />
                              <span className="stat-num w-7 text-right text-[11px] text-white/55">{c.audio}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Zap size={12} className="shrink-0 text-white/40" />
                              <Meter value={c.confidence} color={gradeColor(c.confidence)} height={6} />
                              <span className="stat-num w-7 text-right text-[11px] text-white/55">{c.confidence}</span>
                            </div>
                          </div>
                        </div>
                      </Reveal>
                    );
                  })}
                </div>
              </Panel>
            </motion.div>
          ) : (
            <Enter key="empty">
            <Panel className="flex h-full min-h-[320px] flex-col items-center justify-center text-center">
              <div className="mb-4">
                <Scissors size={40} className="text-ember" />
              </div>
              <p className="max-w-xs text-sm text-white/50">
                Load footage and run detection — the auto-clipper surfaces every dunk, triple, block, and
                dime ranked by how loud the moment was.
              </p>
            </Panel>
            </Enter>
          )}
          </AnimatePresence>
        </div>
      </div>

      <div className="mt-8 space-y-3">
        <div>
          <div className="kicker" style={{ color: "#C9A14A" }}>Model track record</div>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            Below is the model&apos;s real training history — the count of player-seasons it has learned
            from growing each year since 2003 — alongside its validation metric and the method used to measure it.
          </p>
        </div>
        <TrackRecord slug="highlight-clipper" accent="#C9A14A" />
      </div>
    </ToolShell>
  );
}
