"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Check, X } from "lucide-react";
import { Panel, Insight } from "@/components/tool/ToolShell";
import { Gauge } from "@/components/ui/Gauge";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { ShotReplay } from "@/components/ui/ShotReplay";
import { PLAYERS } from "@/lib/data";
import { SHOT_PLAYERS, shotsForPlayer, type RealShot } from "@/lib/data/shots";
import { gradeRealShot } from "@/lib/engine/game";
import { gradeColor } from "@/lib/cn";
import { spring } from "@/lib/motion";
import type { Player } from "@/lib/types";

const playerByEspn = (id: number): Player | undefined => PLAYERS.find((p) => p.espnId === id);

// default to the biggest star who has real shots in the recent window
const DEFAULT_ESPN = (() => {
  let best = SHOT_PLAYERS[0];
  let bestStar = -1;
  for (const sp of SHOT_PLAYERS) {
    const star = playerByEspn(sp.espnId)?.starPower ?? 0;
    if (star > bestStar) {
      bestStar = star;
      best = sp;
    }
  }
  return best?.espnId ?? 0;
})();

export function RealShots() {
  const [q, setQ] = useState("");
  const [espnId, setEspnId] = useState<number>(DEFAULT_ESPN);
  const shots = useMemo(() => shotsForPlayer(espnId), [espnId]);
  const [shotId, setShotId] = useState<string>(shots[0]?.id ?? "");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return SHOT_PLAYERS.filter((p) => !s || p.player.toLowerCase().includes(s))
      .slice()
      .sort((a, b) => (playerByEspn(b.espnId)?.starPower ?? 0) - (playerByEspn(a.espnId)?.starPower ?? 0))
      .slice(0, 60);
  }, [q]);

  const shot = shots.find((x) => x.id === shotId) ?? shots[0];
  const player = playerByEspn(espnId);
  const grade = shot ? gradeRealShot(shot) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      {/* Left: player + shots */}
      <div className="space-y-4">
        <Panel title="Pick a player">
          <div className="mb-3 flex items-center gap-2 border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2">
            <Search size={15} className="text-[var(--text-faint)]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search recent shooters…"
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35"
            />
          </div>
          <div className="no-scrollbar max-h-56 space-y-1 overflow-y-auto">
            {filtered.map((sp) => {
              const p = playerByEspn(sp.espnId);
              const sel = sp.espnId === espnId;
              return (
                <button
                  key={sp.espnId}
                  onClick={() => {
                    setEspnId(sp.espnId);
                    setShotId(shotsForPlayer(sp.espnId)[0]?.id ?? "");
                  }}
                  className="flex w-full items-center gap-2.5 border px-2.5 py-1.5 text-left transition"
                  style={{
                    borderColor: sel ? "#E0561F66" : "transparent",
                    background: sel ? "#E0561F12" : "transparent",
                  }}
                >
                  {p ? <PlayerAvatar player={p} size={26} /> : null}
                  <span className="flex-1 truncate text-sm text-white/85">{sp.player}</span>
                  <span className="stat-num text-[11px] text-[var(--text-faint)]">{sp.count}</span>
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel title={`${player?.name ?? "Player"} · real shots`}>
          <div className="no-scrollbar max-h-[320px] space-y-1 overflow-y-auto">
            {shots.map((s) => {
              const sel = s.id === shotId;
              return (
                <button
                  key={s.id}
                  onClick={() => setShotId(s.id)}
                  className="flex w-full items-center gap-2.5 border px-2.5 py-2 text-left transition"
                  style={{
                    borderColor: sel ? "#E0561F66" : "var(--line)",
                    background: sel ? "#E0561F12" : "transparent",
                  }}
                >
                  <span
                    className="flex h-5 w-5 items-center justify-center"
                    style={{ background: s.made ? "#5FA97E" : "transparent", border: s.made ? "none" : "1px solid #BF5B4E55" }}
                  >
                    {s.made ? <Check size={12} className="text-[#0a0a0b]" /> : <X size={11} className="text-[#BF5B4E]" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs text-white/85">
                      {s.dist}-ft {s.typeText || s.shotType}
                    </div>
                    <div className="stat-num text-[10px] text-[var(--text-faint)]">
                      {s.game} · Q{s.period} {s.clock}
                    </div>
                  </div>
                  <span className="stat-num text-[10px] text-[var(--text-faint)]">{s.value}P</span>
                </button>
              );
            })}
            {shots.length === 0 && (
              <p className="py-6 text-center text-xs text-[var(--text-faint)]">No tracked shots for this player.</p>
            )}
          </div>
        </Panel>
      </div>

      {/* Right: grade + replay */}
      <div className="space-y-6">
        <AnimatePresence mode="wait">
          {shot && grade ? (
            <motion.div
              key={shot.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={spring.soft}
              className="space-y-6"
            >
              {/* outcome + grade header */}
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
                  <div className="flex items-start gap-3">
                    {player ? <PlayerAvatar player={player} size={48} /> : null}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{shot.player}</span>
                        <TeamLogo abbr={shot.team} size={16} />
                      </div>
                      <div className="mt-0.5 text-sm text-[var(--text-muted)]">{shot.text}</div>
                      <div className="stat-num mt-1 text-[11px] text-[var(--text-faint)]">
                        {shot.game} · Q{shot.period} {shot.clock}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="border border-[var(--line)] p-3">
                      <div className="kicker mb-1">Model grade</div>
                      <div className="scoreboard text-2xl" style={{ color: gradeColor(grade.result.qSQ) }}>
                        {grade.result.qSQ}
                      </div>
                      <div className="text-[11px] text-[var(--text-faint)]">{grade.result.rating}</div>
                    </div>
                    <div
                      className="border p-3"
                      style={{
                        borderColor: shot.made ? "#5FA97E55" : "#BF5B4E55",
                        background: shot.made ? "#5FA97E0f" : "#BF5B4E0f",
                      }}
                    >
                      <div className="kicker mb-1">Reality</div>
                      <div className="scoreboard text-2xl" style={{ color: shot.made ? "#5FA97E" : "#BF5B4E" }}>
                        {shot.made ? "MADE" : "MISS"}
                      </div>
                      <div className="text-[11px] text-[var(--text-faint)]">{shot.value} points</div>
                    </div>
                  </div>
                </Panel>
              </div>

              <Insight accent="#E0561F">{grade.verdict}</Insight>

              {/* animated replay */}
              <Panel title="Shot replay">
                <ShotReplay key={shot.id} x={shot.x} y={shot.y} made={shot.made} height={340} />
                <p className="mt-2 text-center text-[11px] text-[var(--text-faint)]">
                  Recreated from the shot&rsquo;s real court coordinates and outcome · defender distance &amp; shot
                  clock are estimated (not in public play-by-play)
                </p>
              </Panel>
            </motion.div>
          ) : (
            <Panel className="flex min-h-[320px] items-center justify-center text-center">
              <p className="max-w-xs text-sm text-white/50">Pick a player and a shot to grade it against the model.</p>
            </Panel>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
