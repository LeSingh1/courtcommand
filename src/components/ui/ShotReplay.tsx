"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { CourtLines } from "@/components/ui/CourtChart";

const HOOP = { x: 250, y: 60 };

/**
 * Animated recreation of a real shot — the ball travels from the shot's actual
 * court coordinates along an arc to the rim, then swishes (make) or rims out
 * (miss). A data-driven "replay" (licensed game video isn't available offline).
 */
export function ShotReplay({
  x,
  y,
  made,
  accent = "#E0561F",
  height = 360,
}: {
  x: number;
  y: number;
  made: boolean;
  accent?: string;
  height?: number;
}) {
  const ballColor = made ? accent : "#7E8CA0";

  // sample a quadratic arc from (x,y) to the hoop, then a short outcome tail
  const { cx, cy, times, arcPath } = useMemo(() => {
    const peak = Math.min(y, HOOP.y) - Math.max(70, Math.abs(x - HOOP.x) * 0.5 + y * 0.25);
    const ctrl = { x: (x + HOOP.x) / 2, y: peak };
    const N = 22;
    const cxArr: number[] = [];
    const cyArr: number[] = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const px = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * ctrl.x + t * t * HOOP.x;
      const py = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * ctrl.y + t * t * HOOP.y;
      cxArr.push(px);
      cyArr.push(py);
    }
    // outcome tail
    if (made) {
      cxArr.push(HOOP.x, HOOP.x);
      cyArr.push(HOOP.y + 26, HOOP.y + 44);
    } else {
      const dir = x < HOOP.x ? -1 : 1;
      cxArr.push(HOOP.x + dir * 34, HOOP.x + dir * 70);
      cyArr.push(HOOP.y - 18, HOOP.y + 36);
    }
    const total = cxArr.length;
    const t = cxArr.map((_, i) => i / (total - 1));
    const path = `M ${x} ${y} Q ${ctrl.x} ${ctrl.y} ${HOOP.x} ${HOOP.y}`;
    return { cx: cxArr, cy: cyArr, times: t, arcPath: path };
  }, [x, y, made]);

  const loop = { duration: 2.4, ease: "easeInOut" as const, repeat: Infinity, repeatDelay: 0.5, times };

  return (
    <svg viewBox="0 0 500 470" style={{ height }} className="h-auto w-full">
      <rect x={0} y={0} width={500} height={470} fill="#0e0e10" />
      <CourtLines />

      {/* dashed arc guide */}
      <path d={arcPath} fill="none" stroke={`${ballColor}55`} strokeWidth={1.5} strokeDasharray="4 6" />

      {/* shot origin marker */}
      <circle cx={x} cy={y} r={6} fill="none" stroke={ballColor} strokeWidth={2} />
      <circle cx={x} cy={y} r={2} fill={ballColor} />

      {/* rim flash on make */}
      {made && (
        <motion.circle
          cx={HOOP.x}
          cy={HOOP.y}
          r={10}
          fill="none"
          stroke={accent}
          strokeWidth={2.5}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: [0, 0, 0.9, 0], scale: [0.5, 0.5, 1.8, 2.2] }}
          transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 0.5, times: [0, 0.78, 0.86, 1] }}
          style={{ transformOrigin: `${HOOP.x}px ${HOOP.y}px` }}
        />
      )}

      {/* the ball */}
      <motion.circle
        r={7}
        fill={ballColor}
        stroke="#160600"
        strokeWidth={1}
        initial={{ cx: cx[0], cy: cy[0] }}
        animate={{ cx, cy }}
        transition={loop}
      />
    </svg>
  );
}
