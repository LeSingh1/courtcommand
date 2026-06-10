export interface ShotDot {
  x: number;
  y: number;
  made: boolean;
  r?: number;
}

export interface Zone {
  id: string;
  label: string;
  cx: number;
  cy: number;
  efg: number;
  freq: number;
}

export function CourtLines({ stroke = "rgba(255,255,255,0.22)" }: { stroke?: string }) {
  return (
    <g fill="none" stroke={stroke} strokeWidth={1.5}>
      <rect x={10} y={10} width={480} height={450} />
      <rect x={170} y={10} width={160} height={190} />
      <circle cx={250} cy={200} r={60} />
      <line x1={190} y1={50} x2={310} y2={50} />
      <circle cx={250} cy={62} r={9} />
      <path d="M 210 62 A 40 40 0 0 0 290 62" />
      <line x1={30} y1={10} x2={30} y2={130} />
      <line x1={470} y1={10} x2={470} y2={130} />
      <path d="M 30 130 A 237 237 0 0 0 470 130" />
      <path d="M 10 460 A 60 60 0 0 1 130 460" opacity={0.4} />
    </g>
  );
}

export function CourtChart({
  shots,
  zones,
  showShots = true,
  height = 380,
}: {
  shots?: ShotDot[];
  zones?: Zone[];
  showShots?: boolean;
  height?: number;
}) {
  const heatColor = (efg: number) => {
    if (efg >= 0.58) return "#4D8DFF";
    if (efg >= 0.5) return "#D7BC6A";
    if (efg >= 0.44) return "#41C7E0";
    if (efg >= 0.38) return "#8E96A4";
    return "#6B6E78";
  };

  return (
    <svg viewBox="0 0 500 470" style={{ height }} className="h-auto w-full">
      <rect x={0} y={0} width={500} height={470} fill="#0e0e10" />
      {zones?.map((z) => (
        <g key={z.id}>
          <circle
            cx={z.cx}
            cy={z.cy}
            r={14 + z.freq * 26}
            fill={`${heatColor(z.efg)}2e`}
            stroke={heatColor(z.efg)}
            strokeWidth={1.25}
          />
          <text
            x={z.cx}
            y={z.cy + 3}
            textAnchor="middle"
            fontSize={11}
            className="stat-num"
            fill="#fff"
            fontWeight={600}
          >
            {Math.round(z.efg * 100)}
          </text>
        </g>
      ))}
      {showShots &&
        shots?.map((s, i) => (
          <circle
            key={i}
            cx={s.x}
            cy={s.y}
            r={s.r ?? 4}
            fill={s.made ? "#4D8DFF" : "none"}
            stroke={s.made ? "none" : "#6B6E78"}
            strokeWidth={s.made ? 0 : 1.4}
          />
        ))}
      <CourtLines />
    </svg>
  );
}
