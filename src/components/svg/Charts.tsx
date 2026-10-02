import { nat, num } from '../../lib/format';
import type { DataSource } from '../../schema/item';

type ChartSource = Extract<DataSource, { kind: 'bar' | 'line' }>;
const SERIES_COLOURS = ['#003399', '#E0A800', '#5B7BC0'];

function niceMax(x: number) {
  const p = 10 ** Math.floor(Math.log10(x));
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= x) return m * p;
  return 10 * p;
}

export function Chart({ src }: { src: ChartSource }) {
  const W = 560;
  const H = 280;
  const pad = { l: 46, r: 14, t: 18, b: 34 };
  const all = src.series.flatMap((s) => s.values);
  const max = niceMax(Math.max(...all) * 1.08);
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const n = src.categories.length;
  const band = iw / n;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const dp = src.dp ?? 0;
  return (
    <figure className="chart">
      <figcaption>{src.caption}</figcaption>
      {src.series.length > 1 && (
        <div className="legend">
          {src.series.map((s, i) => (
            <span key={s.name}>
              <i style={{ background: SERIES_COLOURS[i] }} /> {s.name}
            </span>
          ))}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={src.caption}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" strokeWidth={1} />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" className="tick">
              {nat(t)}
            </text>
          </g>
        ))}
        {src.categories.map((c, i) => (
          <text key={c} x={pad.l + band * i + band / 2} y={H - pad.b + 18} textAnchor="middle" className="tick">
            {c}
          </text>
        ))}
        {src.kind === 'bar' &&
          src.series.map((s, si) => {
            const bw = (band * 0.7) / src.series.length;
            return s.values.map((v, i) => {
              const x = pad.l + band * i + band * 0.15 + bw * si;
              return (
                <g key={`${si}-${i}`}>
                  <rect x={x} y={y(v)} width={bw - 2} height={pad.t + ih - y(v)} fill={SERIES_COLOURS[si]} rx={2} />
                  <text x={x + (bw - 2) / 2} y={y(v) - 5} textAnchor="middle" className="val">
                    {num(v, dp)}
                  </text>
                </g>
              );
            });
          })}
        {src.kind === 'line' &&
          src.series.map((s, si) => {
            const pts = s.values.map((v, i) => [pad.l + band * i + band / 2, y(v)] as const);
            return (
              <g key={s.name}>
                <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={SERIES_COLOURS[si]} strokeWidth={2.5} />
                {pts.map(([px, py], i) => {
                  const other = src.series.find((_, k) => k !== si);
                  const above = !other || s.values[i] >= other.values[i];
                  return (
                    <g key={i}>
                      <circle cx={px} cy={py} r={4} fill={SERIES_COLOURS[si]} />
                      <text x={px} y={above ? py - 9 : py + 17} textAnchor="middle" className="val" fill={SERIES_COLOURS[si]}>
                        {num(s.values[i], dp)}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}
        <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} stroke="var(--chart-axis)" strokeWidth={1.2} />
      </svg>
      <div className="unit">Unit: {src.unit}</div>
    </figure>
  );
}

type TableSource = Extract<DataSource, { kind: 'table' }>;

export function DataTable({ src }: { src: TableSource }) {
  const fmt = (v: string | number, ci: number) => (typeof v === 'number' ? (src.dp?.[ci] !== undefined ? num(v, src.dp[ci]) : nat(v)) : v);
  return (
    <div className="table-wrap">
      <table className="data">
        <caption>{src.caption}</caption>
        <thead>
          <tr>
            {src.columns.map((c, i) => (
              <th key={c} className={i ? 'num' : ''}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {src.rows.map((r) => (
            <tr key={String(r[0])} className={r[0] === 'Total' || r[0] === 'Number of respondents' ? 'total' : ''}>
              {r.map((v, i) => (
                <td key={i} className={typeof v === 'number' ? 'num' : ''}>
                  {fmt(v, i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {src.note && <p className="note">{src.note}</p>}
    </div>
  );
}
