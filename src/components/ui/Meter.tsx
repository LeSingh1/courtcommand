import { cn } from "@/lib/cn";

export function Meter({
  value,
  max = 100,
  color = "#4D8DFF",
  label,
  valueLabel,
  className,
  height = 6,
}: {
  value: number;
  max?: number;
  color?: string;
  label?: string;
  valueLabel?: string;
  className?: string;
  height?: number;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={cn("w-full", className)}>
      {(label || valueLabel) && (
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-[var(--text-muted)]">{label}</span>
          <span className="stat-num text-[var(--text)]">{valueLabel}</span>
        </div>
      )}
      <div className="w-full overflow-hidden bg-[rgba(255,255,255,0.06)]" style={{ height }}>
        <div className="grow-x h-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export function Diverging({
  value,
  range = 10,
  color = "#4D8DFF",
  negColor = "#F4647D",
}: {
  value: number;
  range?: number;
  color?: string;
  negColor?: string;
}) {
  const pct = Math.max(-1, Math.min(1, value / range));
  const w = Math.abs(pct) * 50;
  return (
    <div className="relative h-2 w-full overflow-hidden bg-[rgba(255,255,255,0.06)]">
      <div className="absolute left-1/2 top-0 h-full w-px bg-white/20" />
      <div
        className="absolute top-0 h-full"
        style={{
          background: pct >= 0 ? color : negColor,
          width: `${w}%`,
          left: pct >= 0 ? "50%" : `${50 - w}%`,
        }}
      />
    </div>
  );
}
