export interface LineSeries {
  name: string;
  color: string;
  points: number[];
  dashed?: boolean;
}

export function LineChart({
  series,
  labels,
  height = 220,
  yMin,
  yMax,
  yLabel,
  band,
}: {
  series: LineSeries[];
  labels?: string[];
  height?: number;
  yMin?: number;
  yMax?: number;
  yLabel?: string;
  band?: { lo: number[]; hi: number[]; color: string };
}) {
  const width = 560;
  const padX = 36;
  const padY = 18;
  const all = series.flatMap((s) => s.points).concat(band ? [...band.lo, ...band.hi] : []);
  const lo = yMin ?? Math.min(...all);
  const hi = yMax ?? Math.max(...all);
  const span = hi - lo || 1;
  const n = Math.max(...series.map((s) => s.points.length), 2);

  const x = (i: number) => padX + (i / (n - 1)) * (width - padX * 2);
  const y = (v: number) => padY + (1 - (v - lo) / span) * (height - padY * 2);

  const path = (pts: number[]) =>
    pts.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ");

  const area = (loArr: number[], hiArr: number[]) => {
    const top = hiArr.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ");
    const bottom = loArr
      .map((v, i) => `L ${x(loArr.length - 1 - i)} ${y(loArr[loArr.length - 1 - i])}`)
      .join(" ");
    return `${top} ${bottom} Z`;
  };

  const gridY = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full">
      {gridY.map((g) => (
        <line
          key={g}
          x1={padX}
          x2={width - padX}
          y1={padY + g * (height - padY * 2)}
          y2={padY + g * (height - padY * 2)}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={1}
        />
      ))}
      {gridY.map((g) => (
        <text
          key={`l${g}`}
          x={4}
          y={padY + g * (height - padY * 2) + 3}
          fontSize={9}
          className="stat-num"
          fill="rgba(255,255,255,0.35)"
        >
          {(hi - g * span).toFixed(0)}
        </text>
      ))}
      {band && (
        <path d={area(band.lo, band.hi)} fill={`${band.color}1f`} stroke="none" />
      )}
      {series.map((s) => (
        <path
          key={s.name}
          d={path(s.points)}
          fill="none"
          stroke={s.color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={s.dashed ? "5 5" : undefined}
        />
      ))}
      {series.map((s) =>
        s.points.map((v, i) => (
          <circle key={`${s.name}-${i}`} cx={x(i)} cy={y(v)} r={2.6} fill={s.color} />
        )),
      )}
      {labels &&
        labels.map((lab, i) => (
          <text
            key={lab + i}
            x={x(i)}
            y={height - 2}
            fontSize={9}
            textAnchor="middle"
            className="stat-num"
            fill="rgba(255,255,255,0.4)"
          >
            {lab}
          </text>
        ))}
      {yLabel && (
        <text x={width - padX} y={12} fontSize={9} textAnchor="end" fill="rgba(255,255,255,0.4)">
          {yLabel}
        </text>
      )}
    </svg>
  );
}
