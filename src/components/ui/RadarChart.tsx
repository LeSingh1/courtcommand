export interface RadarSeries {
  name: string;
  color: string;
  values: number[]; // 0-100, aligned to axes
}

export function RadarChart({
  axes,
  series,
  size = 280,
}: {
  axes: string[];
  series: RadarSeries[];
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 38;
  const n = axes.length;
  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;

  const point = (i: number, r: number) => {
    const a = angle(i);
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as const;
  };

  const polygon = (vals: number[]) =>
    vals
      .map((v, i) => {
        const [x, y] = point(i, (Math.max(0, Math.min(100, v)) / 100) * radius);
        return `${x},${y}`;
      })
      .join(" ");

  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="h-auto w-full max-w-[340px]">
      {rings.map((rr, idx) => (
        <polygon
          key={idx}
          points={axes
            .map((_, i) => {
              const [x, y] = point(i, radius * rr);
              return `${x},${y}`;
            })
            .join(" ")}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={1}
        />
      ))}
      {axes.map((_, i) => {
        const [x, y] = point(i, radius);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={1}
          />
        );
      })}
      {series.map((s) => (
        <polygon
          key={s.name}
          points={polygon(s.values)}
          fill={`${s.color}26`}
          stroke={s.color}
          strokeWidth={1.75}
        />
      ))}
      {axes.map((label, i) => {
        const [x, y] = point(i, radius + 20);
        return (
          <text
            key={label}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={10}
            className="stat-num"
            fill="rgba(255,255,255,0.55)"
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}
