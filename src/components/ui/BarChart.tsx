export interface Bar {
  label: string;
  value: number;
  color?: string;
  sub?: string;
}

// Horizontal bar list. Fills sweep in from the left (staggered, GPU scaleX,
// reduced-motion-safe via .grow-x). Value labels sit inside the fill when it
// is wide enough and flip to the right of it when it isn't — a number is
// never clipped, no matter how small the bar.
export function BarChart({
  bars,
  max,
  unit = "",
  decimals = 0,
}: {
  bars: Bar[];
  max?: number;
  unit?: string;
  decimals?: number;
}) {
  const m = max ?? Math.max(...bars.map((b) => b.value), 1) * 1.05;
  return (
    <div className="flex flex-col gap-2.5">
      {bars.map((b, i) => {
        const pct = Math.max(1, Math.min(100, (b.value / m) * 100));
        const inside = pct >= 22; // enough room for the label within the fill
        const delay = `${Math.min(i * 70, 560)}ms`;
        return (
          <div key={b.label} className="flex items-center gap-3">
            <div className="w-28 shrink-0 truncate text-right text-xs text-[var(--text-muted)]">
              {b.label}
            </div>
            <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-[rgba(255,255,255,0.05)]">
              <div
                className="grow-x h-full rounded-md"
                style={{ width: `${pct}%`, background: b.color ?? "#4D8DFF", animationDelay: delay }}
              />
              <span
                className="enter-fade stat-num absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[11px] font-semibold"
                style={{
                  left: `${pct}%`,
                  transform: inside
                    ? "translate(calc(-100% - 8px), -50%)"
                    : "translate(8px, -50%)",
                  color: inside ? "#061129" : "var(--text-muted)",
                  animationDelay: delay,
                }}
              >
                {b.value.toFixed(decimals)}
                {unit}
              </span>
            </div>
            {b.sub && <div className="w-12 text-xs text-[var(--text-faint)]">{b.sub}</div>}
          </div>
        );
      })}
    </div>
  );
}
