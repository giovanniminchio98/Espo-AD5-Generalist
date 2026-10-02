import { useId } from 'react';
import type { Element, Figure as Fig } from '../../schema/item';

const INK = '#111111';
const GREY = '#8c8c8c';
const R: Record<number, number> = { 1: 7, 2: 10.5, 3: 14 };
const PIP_LAYOUT: Record<number, number[]> = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8], 7: [0, 2, 3, 4, 5, 6, 8], 8: [0, 1, 2, 3, 5, 6, 7, 8], 9: [0, 1, 2, 3, 4, 5, 6, 7, 8],
};

function poly(points: [number, number][], r: number) {
  return points.map(([x, y]) => `${(x * r).toFixed(2)},${(y * r).toFixed(2)}`).join(' ');
}

const SHAPE_POINTS: Record<string, [number, number][]> = {
  triangle: [[0, -1], [0.866, 0.5], [-0.866, 0.5]],
  hexagon: [0, 1, 2, 3, 4, 5].map((k) => [Math.cos((Math.PI / 3) * k), Math.sin((Math.PI / 3) * k)] as [number, number]),
  cross: [[-0.3, -1], [0.3, -1], [0.3, -0.3], [1, -0.3], [1, 0.3], [0.3, 0.3], [0.3, 1], [-0.3, 1], [-0.3, 0.3], [-1, 0.3], [-1, -0.3], [-0.3, -0.3]],
  arrow: [[0, -1], [0.62, -0.18], [0.22, -0.18], [0.22, 1], [-0.22, 1], [-0.22, -0.18], [-0.62, -0.18]],
  lshape: [[-0.6, -1], [-0.1, -1], [-0.1, 0.45], [0.7, 0.45], [0.7, 1], [-0.6, 1]],
  wedge: [[0, -1], [0.45, 1], [-0.45, 1]],
};

function center(cell: number): [number, number] {
  return [6 + (cell % 3) * 36 + 18, 6 + Math.floor(cell / 3) * 36 + 18];
}

function Shape({ e, pid }: { e: Element; pid: string }) {
  const [cx, cy] = center(e.cell);
  const colour = e.colour === 'grey' ? GREY : INK;
  if (e.shape === 'pips') {
    return (
      <g>
        {(PIP_LAYOUT[e.count] ?? []).map((k) => (
          <circle key={k} cx={cx + ((k % 3) - 1) * 9.5} cy={cy + (Math.floor(k / 3) - 1) * 9.5} r={3} fill={colour} />
        ))}
      </g>
    );
  }
  if (e.shape === 'spokes') {
    return (
      <g transform={`translate(${cx} ${cy})`}>
        {Array.from({ length: e.count }, (_, k) => {
          const a = ((e.rotation + 45 * k - 90) * Math.PI) / 180;
          return <line key={k} x1={0} y1={0} x2={15 * Math.cos(a)} y2={15 * Math.sin(a)} stroke={colour} strokeWidth={2.4} strokeLinecap="round" />;
        })}
        <circle r={2.2} fill={colour} />
      </g>
    );
  }
  const r = R[e.size];
  const fill = e.fill === 'empty' ? '#ffffff' : e.fill === 'solid' ? colour : `url(#${pid}-${e.colour})`;
  const common = { fill, stroke: INK, strokeWidth: 1.6, strokeLinejoin: 'round' as const };
  return (
    <g transform={`translate(${cx} ${cy}) rotate(${e.rotation})`}>
      {e.shape === 'circle' && <circle r={r} {...common} />}
      {e.shape === 'square' && <rect x={-r * 0.82} y={-r * 0.82} width={r * 1.64} height={r * 1.64} {...common} />}
      {SHAPE_POINTS[e.shape] && <polygon points={poly(SHAPE_POINTS[e.shape], r)} {...common} />}
    </g>
  );
}

export function Figure({ figure, size = 112, grid = false, title }: { figure: Fig; size?: number; grid?: boolean; title?: string }) {
  const pid = useId().replace(/:/g, '');
  return (
    <svg className="figure" width={size} height={size} viewBox="0 0 120 120" role="img" aria-label={title ?? 'figure'}>
      <defs>
        {(['black', 'grey'] as const).map((c) => (
          <pattern key={c} id={`${pid}-${c}`} patternUnits="userSpaceOnUse" width={4} height={4} patternTransform="rotate(45)">
            <rect width={4} height={4} fill="#ffffff" />
            <line x1={0} y1={0} x2={0} y2={4} stroke={c === 'grey' ? GREY : INK} strokeWidth={1.7} />
          </pattern>
        ))}
      </defs>
      <rect x={3} y={3} width={114} height={114} fill="#ffffff" stroke="#2b2b2b" strokeWidth={1.5} rx={2} />
      {grid && (
        <g stroke="#cfd6e4" strokeWidth={0.8}>
          <line x1={42} y1={6} x2={42} y2={114} />
          <line x1={78} y1={6} x2={78} y2={114} />
          <line x1={6} y1={42} x2={114} y2={42} />
          <line x1={6} y1={78} x2={114} y2={78} />
        </g>
      )}
      {figure.elements.map((e) => (
        <Shape key={e.id} e={e} pid={pid} />
      ))}
    </svg>
  );
}

export function QuestionMarkFigure({ size = 112 }: { size?: number }) {
  return (
    <svg className="figure" width={size} height={size} viewBox="0 0 120 120" role="img" aria-label="next figure?">
      <rect x={3} y={3} width={114} height={114} fill="#ffffff" stroke="#2b2b2b" strokeWidth={1.5} strokeDasharray="5 4" rx={2} />
      <text x={60} y={76} textAnchor="middle" fontSize={48} fontWeight={700} fill="#003399">?</text>
    </svg>
  );
}
