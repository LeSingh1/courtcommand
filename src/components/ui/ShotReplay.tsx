"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CourtLines } from "@/components/ui/CourtChart";

const HOOP = { x: 250, y: 62 };
const DUR = 2.2;
const N = 30; // arc samples

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Refined 2.5D recreation of a real shot. The ball travels from the shot's real
 * court coordinates along a physical arc to the rim; a ground shadow tracks its
 * floor position while the ball lifts and grows toward the apex (depth cue), a
 * glowing comet trail follows, and it swishes (make) or rims out (miss) with a
 * splash ring. Reduced-motion-safe. Data-driven — licensed game video isn't
 * available offline (see Film Room for real NBA clips).
 */
export function ShotReplay({
  x,
  y,
  made,
  accent = "#E9A23B",
  height = 360,
}: {
  x: number;
  y: number;
  made: boolean;
  accent?: string;
  height?: number;
}) {
  const reduce = useReducedMotion();
  const miss = "#8E96A4";
  const ball = made ? accent : miss;

  const f = useMemo(() => {
    const dist = Math.hypot(x - HOOP.x, y - HOOP.y);
    const apex = Math.min(50 + dist * 0.34, 168); // arc height in px
    const bx: number[] = [];
    const by: number[] = [];
    const br: number[] = [];
    const sx: number[] = [];
    const sy: number[] = [];
    const sr: number[] = [];
    const so: number[] = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const gx = x + (HOOP.x - x) * t;
      const gy = y + (HOOP.y - y) * t;
      const h = apex * Math.sin(Math.PI * t); // 0 → apex → 0
      const hn = h / apex;
      bx.push(r1(gx));
      by.push(r1(gy - h));
      br.push(r1(6 + hn * 3.4)); // grows near apex (closer to camera)
      sx.push(r1(gx));
      sy.push(r1(gy));
      sr.push(r1(7.5 - hn * 4.5)); // shadow tightens as ball rises
      so.push(r1(0.36 - hn * 0.28));
    }
    // outcome tail past the rim
    if (made) {
      bx.push(HOOP.x, HOOP.x);
      by.push(HOOP.y + 22, HOOP.y + 40);
      br.push(6.6, 5.8);
      sx.push(HOOP.x, HOOP.x);
      sy.push(HOOP.y + 22, HOOP.y + 40);
      sr.push(4.5, 5.4);
      so.push(0.2, 0.28);
    } else {
      const dir = x < HOOP.x ? 1 : -1;
      bx.push(HOOP.x + dir * 22, HOOP.x + dir * 58);
      by.push(HOOP.y - 12, HOOP.y + 34);
      br.push(7, 7);
      sx.push(HOOP.x + dir * 22, HOOP.x + dir * 58);
      sy.push(HOOP.y + 26, HOOP.y + 46);
      sr.push(5.2, 6.2);
      so.push(0.22, 0.3);
    }
    const total = bx.length;
    const times = bx.map((_, i) => i / (total - 1));
    const rimFrac = N / (total - 1); // when ball reaches the rim
    // guide path through arc points
    let guide = `M ${bx[0]} ${by[0]}`;
    for (let i = 1; i <= N; i++) guide += ` L ${bx[i]} ${by[i]}`;
    return { bx, by, br, sx, sy, sr, so, times, rimFrac, guide, apexX: bx[Math.round(N / 2)], apexY: by[Math.round(N / 2)] };
  }, [x, y, made]);

  const loop = {
    duration: DUR,
    ease: [0.34, 0.85, 0.4, 1] as const,
    repeat: Infinity,
    repeatDelay: 0.5,
    times: f.times,
  };

  // lock-step comet echoes — each trails the head by k samples, every loop.
  const echoes = [1, 2, 3, 4].map((k) => ({
    k,
    cx: f.bx.map((_, i) => f.bx[Math.max(0, i - k)]),
    cy: f.by.map((_, i) => f.by[Math.max(0, i - k)]),
    r: f.br.map((_, i) => f.br[Math.max(0, i - k)] * (1 - k * 0.16)),
    opacity: 0.42 - k * 0.08,
  }));

  return (
    <svg viewBox="0 0 500 470" style={{ height }} className="h-auto w-full select-none">
      <defs>
        <radialGradient id="sr-floor" cx="50%" cy="34%" r="78%">
          <stop offset="0%" stopColor="#191920" />
          <stop offset="62%" stopColor="#101013" />
          <stop offset="100%" stopColor="#0a0a0c" />
        </radialGradient>
        <radialGradient id="sr-rimglow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={accent} stopOpacity={0.32} />
          <stop offset="100%" stopColor={accent} stopOpacity={0} />
        </radialGradient>
        <filter id="sr-glow" x="-70%" y="-70%" width="240%" height="240%">
          <feGaussianBlur stdDeviation="3.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect x={0} y={0} width={500} height={470} fill="url(#sr-floor)" />
      {/* soft pool of light under the rim for depth */}
      <ellipse cx={HOOP.x} cy={HOOP.y + 4} rx={150} ry={120} fill="url(#sr-rimglow)" />
      <CourtLines />

      {/* faint trajectory guide */}
      <path d={f.guide} fill="none" stroke={`${ball}30`} strokeWidth={1.4} strokeDasharray="3 7" strokeLinecap="round" />

      {/* shot origin marker */}
      <circle cx={x} cy={y} r={6} fill="none" stroke={ball} strokeWidth={1.75} opacity={0.85} />
      <circle cx={x} cy={y} r={2} fill={ball} />

      {reduce ? (
        // Static, fully-visible fallback: ball resting at the apex.
        <>
          <ellipse cx={f.apexX} cy={f.sy[Math.round(N / 2)]} rx={4} ry={2} fill="#000" opacity={0.3} />
          <circle cx={f.apexX} cy={f.apexY} r={8} fill={ball} stroke="#0a0a0c" strokeWidth={1} filter="url(#sr-glow)" />
        </>
      ) : (
        <>
          {/* ground shadow */}
          <motion.ellipse
            ry={2.4}
            fill="#000"
            initial={{ cx: f.sx[0], cy: f.sy[0], rx: f.sr[0], opacity: f.so[0] }}
            animate={{ cx: f.sx, cy: f.sy, rx: f.sr, opacity: f.so }}
            transition={loop}
          />

          {/* rim splash on make */}
          {made && (
            <>
              <motion.circle
                cx={HOOP.x}
                cy={HOOP.y}
                fill="none"
                stroke={accent}
                strokeWidth={2.5}
                initial={{ r: 9, opacity: 0 }}
                animate={{ r: [9, 9, 22, 30], opacity: [0, 0, 0.95, 0] }}
                transition={{ duration: DUR, repeat: Infinity, repeatDelay: 0.5, times: [0, f.rimFrac - 0.02, f.rimFrac + 0.06, 1] }}
                style={{ transformOrigin: `${HOOP.x}px ${HOOP.y}px` }}
              />
              {/* net swish flick */}
              <motion.path
                d={`M ${HOOP.x - 9} ${HOOP.y + 2} L ${HOOP.x} ${HOOP.y + 16} L ${HOOP.x + 9} ${HOOP.y + 2}`}
                fill="none"
                stroke={accent}
                strokeWidth={1.5}
                strokeLinecap="round"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0, 0.9, 0], pathLength: [0.4, 0.4, 1, 1] }}
                transition={{ duration: DUR, repeat: Infinity, repeatDelay: 0.5, times: [0, f.rimFrac - 0.02, f.rimFrac + 0.05, f.rimFrac + 0.16] }}
              />
            </>
          )}

          {/* comet echoes (tail → head) */}
          {echoes
            .slice()
            .reverse()
            .map((e) => (
              <motion.circle
                key={e.k}
                fill={ball}
                initial={{ cx: e.cx[0], cy: e.cy[0], r: e.r[0] }}
                animate={{ cx: e.cx, cy: e.cy, r: e.r }}
                transition={loop}
                style={{ opacity: e.opacity }}
              />
            ))}

          {/* the ball */}
          <motion.circle
            fill={ball}
            stroke="#0a0a0c"
            strokeWidth={1}
            filter="url(#sr-glow)"
            initial={{ cx: f.bx[0], cy: f.by[0], r: f.br[0] }}
            animate={{ cx: f.bx, cy: f.by, r: f.br }}
            transition={loop}
          />
        </>
      )}
    </svg>
  );
}
