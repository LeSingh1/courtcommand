export interface Bar {
  label: string;
  value: number;
  color?: string;
  sub?: string;
}

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
      {bars.map((b) => {
        const pct = Math.max(2, (b.value / m) * 100);
        return (
          <div key={b.label} className="flex items-center gap-3">
            <div className="w-28 shrink-0 truncate text-right text-xs text-[var(--text-muted)]">
              {b.label}
            </div>
            <div className="relative h-6 flex-1 overflow-hidden bg-[rgba(255,255,255,0.05)]">
              <div
                className="flex h-full items-center justify-end pr-2"
                style={{ width: `${pct}%`, background: b.color ?? "#C8F23F" }}
              >
                <span className="stat-num text-[11px] font-semibold text-[#120802]">
                  {b.value.toFixed(decimals)}
                  {unit}
                </span>
              </div>
            </div>
            {b.sub && <div className="w-12 text-xs text-[var(--text-faint)]">{b.sub}</div>}
          </div>
        );
      })}
    </div>
  );
}
