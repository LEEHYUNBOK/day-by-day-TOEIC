// 서버에서 그리는 순수 SVG 차트. 색은 dataviz 검증(validate_palette)을 통과한 두 색.
export const SELF_COLOR = '#b4540a';
export const AI_COLOR = '#2a7fbf';
const INK = '#1c1a17';

export function BarChart({ rows }: { rows: { label: string; value: number; n: number }[] }) {
  const rowH = 30;
  const labelW = 130;
  const W = 560;
  const barW = W - labelW - 90;
  return (
    <svg viewBox={`0 0 ${W} ${rows.length * rowH + 4}`} className="w-full" role="img" aria-label="토픽별 평균 점수">
      {rows.map((r, i) => {
        const y = i * rowH + 4;
        const w = Math.max(2, (r.value / 100) * barW);
        return (
          <g key={r.label}>
            <title>{`${r.label}: 평균 ${r.value}점 (질문 ${r.n}개)`}</title>
            <text x={labelW - 8} y={y + 15} textAnchor="end" fontSize="13" fill={INK}>{r.label}</text>
            <rect x={labelW} y={y} width={barW} height={20} rx={4} fill={INK} opacity={0.07} />
            <rect x={labelW} y={y} width={w} height={20} rx={4} fill={AI_COLOR} />
            <text x={labelW + barW + 8} y={y + 15} fontSize="13" fontWeight="700" fill={INK}>{r.value}점 <tspan fontWeight="400" opacity={0.6}>n={r.n}</tspan></text>
          </g>
        );
      })}
    </svg>
  );
}

export type LinePoint = { label: string; self: number | null; ai: number | null };

export function LineChart({ points }: { points: LinePoint[] }) {
  const W = 560, H = 220, L = 36, R = 16, T = 12, B = 30;
  const x = (i: number) => (points.length === 1 ? (L + W - R) / 2 : L + (i / (points.length - 1)) * (W - L - R));
  const y = (v: number) => T + (1 - v / 100) * (H - T - B);
  const series = [
    { name: '자기점수', color: SELF_COLOR, key: 'self' as const },
    { name: 'AI 점수', color: AI_COLOR, key: 'ai' as const },
  ];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="시도별 자기점수와 AI 점수">
      {[0, 50, 100].map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={INK} opacity={0.15} />
          <text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill={INK} opacity={0.7}>{v}</text>
        </g>
      ))}
      {points.map((p, i) => (
        <text key={i} x={x(i)} y={H - 10} textAnchor="middle" fontSize="11" fill={INK} opacity={0.7}>{p.label}</text>
      ))}
      {series.map((s) => {
        const pts = points.map((p, i) => ({ v: p[s.key], i })).filter((p): p is { v: number; i: number } => p.v !== null);
        return (
          <g key={s.key}>
            <polyline points={pts.map((p) => `${x(p.i)},${y(p.v)}`).join(' ')} fill="none" stroke={s.color} strokeWidth={2} />
            {pts.map((p) => (
              <circle key={p.i} cx={x(p.i)} cy={y(p.v)} r={4.5} fill={s.color} stroke="#fbf9f4" strokeWidth={2}>
                <title>{`${points[p.i].label} ${s.name} ${p.v}점`}</title>
              </circle>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

export function Legend() {
  return (
    <p className="flex gap-4 text-xs">
      <span className="flex items-center gap-1"><i className="inline-block h-0.5 w-4" style={{ background: SELF_COLOR }} />자기점수</span>
      <span className="flex items-center gap-1"><i className="inline-block h-0.5 w-4" style={{ background: AI_COLOR }} />AI 점수</span>
    </p>
  );
}
