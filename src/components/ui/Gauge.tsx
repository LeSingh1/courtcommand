import { gradeColor } from "@/lib/cn";

export function Gauge({
  value,
  max = 100,
  label,
  size = 168,
  color,
  decimals = 0,
  suffix = "",
}: {
  value: number;
  max?: number;
  label?: string;
  size?: number;
  color?: string;
  decimals?: number;
  suffix?: string;
}) {
  const pct = Math.max(0, Math.min(1, value / max));
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clr = color ?? gradeColor((value / max) * 100);

  return (
    <div className="relative inline-flex flex-col items-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={clr}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c - c * pct}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="scoreboard text-4xl" style={{ color: clr }}>
          {value.toFixed(decimals)}
          {suffix}
        </span>
        {label && (
          <span className="mt-0.5 text-[10px] uppercase tracking-widest text-[var(--text-faint)]">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
