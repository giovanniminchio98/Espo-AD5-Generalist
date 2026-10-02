import { useRef, useState } from 'react';
import { CATEGORIES, SETTINGS, type Category } from '../../config/settings';
import type { Bank } from '../data/bank';
import { DIFFICULTY_LABEL, fmtTime, SUBTYPE_LABEL, TRAP_LABEL } from '../lib/labels';
import { accuracyBy, dailyTrend, estimate, pct, selfRatings, timing, trapCounts } from '../stats/selectors';
import { CATEGORY_LABEL, exportData, importData, resetData, useStore } from '../stats/store';

function Bar({ value, label, sub }: { value: number; label: string; sub: string }) {
  return (
    <div className="hbar">
      <span className="hbar-label">{label}</span>
      <span className="hbar-track">
        <span className={`hbar-fill ${value >= 0.7 ? 'good' : value >= 0.5 ? 'mid' : 'low'}`} style={{ width: `${Math.round(value * 100)}%` }} />
      </span>
      <span className="hbar-val">
        {Math.round(value * 100)}% <small>{sub}</small>
      </span>
    </div>
  );
}

function Trend({ points }: { points: { day: string; p: number; total: number }[] }) {
  if (points.length < 2) return <p className="muted">The trend appears after practising on at least two different days.</p>;
  const W = 560;
  const H = 180;
  const pad = 30;
  const x = (i: number) => pad + (i * (W - 2 * pad)) / (points.length - 1);
  const y = (p: number) => H - pad - p * (H - 2 * pad);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="trend" role="img" aria-label="Accuracy over time">
      {[0, 0.5, 1].map((t) => (
        <g key={t}>
          <line x1={pad} x2={W - pad} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" />
          <text x={pad - 6} y={y(t) + 4} textAnchor="end" className="tick">
            {t * 100}%
          </text>
        </g>
      ))}
      <line x1={pad} x2={W - pad} y1={y(0.5)} y2={y(0.5)} stroke="var(--eu-gold)" strokeDasharray="4 4" />
      <polyline fill="none" stroke="var(--eu-blue)" strokeWidth={2.5} points={points.map((p, i) => `${x(i)},${y(p.p)}`).join(' ')} />
      {points.map((p, i) => (
        <circle key={p.day} cx={x(i)} cy={y(p.p)} r={4} fill="var(--eu-blue)">
          <title>
            {p.day}: {Math.round(p.p * 100)}% of {p.total}
          </title>
        </circle>
      ))}
      <text x={pad} y={H - 8} className="tick">
        {points[0].day}
      </text>
      <text x={W - pad} y={H - 8} textAnchor="end" className="tick">
        {points[points.length - 1].day}
      </text>
    </svg>
  );
}

export function StatsPage({ bank }: { bank: Bank }) {
  const store = useStore();
  const [cat, setCat] = useState<Category | 'all'>('all');
  const [msg, setMsg] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const c = cat === 'all' ? undefined : cat;
  const answered = store.attempts.filter((a) => a.correct !== undefined && (!c || a.category === c));
  const bySub = accuracyBy(store, 'subtype', c);
  const byDiff = accuracyBy(store, 'difficulty', c);
  const traps = trapCounts(store, c).slice(0, 8);
  const ratings = selfRatings(store);
  const seen = new Set(store.attempts.map((a) => a.itemId));

  const download = () => {
    const blob = new Blob([exportData()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ad5-trainer-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const upload = async (merge: boolean) => {
    const f = file.current?.files?.[0];
    if (!f) return setMsg('Choose a file first.');
    const r = importData(await f.text(), merge);
    setMsg(r.message);
  };

  return (
    <div className="page">
      <h1>Your statistics</h1>
      <div className="score-tiles">
        {CATEGORIES.map((k) => {
          const e = estimate(store, k);
          const acc = accuracyBy(store, 'category').get(k);
          const t = timing(store, k);
          const passLine = k === 'verbal' ? SETTINGS.PASS_MARKS.verbal : Math.ceil(SETTINGS.PASS_MARKS.numericalAbstract / 2);
          return (
            <div className="tile" key={k}>
              <div className="tile-label">{CATEGORY_LABEL[k]}</div>
              <div className="tile-value">{acc ? `${Math.round(pct(acc) * 100)}%` : '—'}</div>
              <div className="tile-sub">{acc ? `${acc.correct}/${acc.total} correct` : 'no answers yet'}</div>
              <div className="tile-sub">
                Estimated exam score:{' '}
                {e ? (
                  <strong className={e.score >= passLine ? 'ok-text' : 'bad-text'}>
                    ≈ {e.score}/{e.of}
                  </strong>
                ) : (
                  'answer 10+ questions'
                )}
              </div>
              {t && (
                <div className="tile-sub">
                  Avg time {fmtTime(t.avg)} · target {fmtTime(t.target)} · exam pace {fmtTime(t.official)}
                </div>
              )}
              <div className="tile-sub">
                Seen {bank.items.filter((i) => i.category === k && seen.has(i.id)).length} of {bank.items.filter((i) => i.category === k).length} items
              </div>
            </div>
          );
        })}
      </div>
      <p className="muted small">
        The estimate uses your last 40 answers in each category, weighting hard items more (the real test leans medium/hard). Numerical and abstract share a pass
        mark of {SETTINGS.PASS_MARKS.numericalAbstract}/20 combined, so the colour uses half of it for each.
      </p>

      <div className="seg filter">
        {(['all', ...CATEGORIES] as const).map((k) => (
          <button key={k} className={k === cat ? 'on' : ''} onClick={() => setCat(k)}>
            {k === 'all' ? 'All categories' : CATEGORY_LABEL[k]}
          </button>
        ))}
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Accuracy by question type</h3>
          {bySub.size ? [...bySub.entries()].sort((a, b) => pct(a[1]) - pct(b[1])).map(([k, v]) => <Bar key={k} label={SUBTYPE_LABEL[k] ?? k} value={pct(v)} sub={`${v.correct}/${v.total}`} />) : <p className="muted">No answers yet.</p>}
        </div>
        <div className="card">
          <h3>Accuracy by difficulty</h3>
          {[1, 2, 3].map((d) => {
            const v = byDiff.get(String(d));
            return v ? <Bar key={d} label={DIFFICULTY_LABEL[d]} value={pct(v)} sub={`${v.correct}/${v.total}`} /> : null;
          })}
          {!byDiff.size && <p className="muted">No answers yet.</p>}
          <h3>Traps you fall for most</h3>
          {traps.length ? (
            <ol className="traps">
              {traps.map(([t, n]) => (
                <li key={t}>
                  <span className="chip">{TRAP_LABEL[t] ?? t}</span> {n}×
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted">Nothing yet: wrong answers are tagged with the trap they fell into.</p>
          )}
        </div>
      </div>

      <div className="card">
        <h3>Score trend</h3>
        <Trend points={dailyTrend(store, c)} />
        <p className="muted small">Daily accuracy on multiple-choice items ({answered.length} answers). The dashed line marks 50%, the pass level.</p>
        {store.sessions.length > 0 && (
          <>
            <h4>Recent exams and sessions</h4>
            <table className="data compact">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Session</th>
                  <th className="num">Score</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {[...store.sessions]
                  .reverse()
                  .slice(0, 12)
                  .map((s) => (
                    <tr key={s.id}>
                      <td>{new Date(s.ts).toLocaleDateString('en-GB')}</td>
                      <td>{s.label}</td>
                      <td className="num">{s.scores.map((x) => `${x.correct}/${x.total}`).join(' · ')}</td>
                      <td>{s.passed === undefined ? '' : s.passed ? '✓ pass' : '✗ fail'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      <div className="card">
        <h3>Self-assessed tasks</h3>
        <p>
          Got it {ratings.got} · Partly {ratings.partly} · Missed {ratings.missed}
        </p>
      </div>

      <div className="card">
        <h3>Back up or move your progress</h3>
        <p className="muted">Progress is stored in this browser only. Export it to keep a copy or to move it to another device.</p>
        <div className="actions wrap">
          <button className="btn primary" onClick={download}>
            Export progress (JSON)
          </button>
          <input ref={file} type="file" accept="application/json,.json" aria-label="Progress file to import" />
          <button className="btn" onClick={() => upload(true)}>
            Import and merge
          </button>
          <button className="btn" onClick={() => window.confirm('Replace all current progress with the file?') && upload(false)}>
            Import and replace
          </button>
          <button className="btn ghost danger" onClick={() => window.confirm('Delete all progress in this browser?') && (resetData(), setMsg('Progress reset.'))}>
            Reset
          </button>
        </div>
        {msg && <p className="msg">{msg}</p>}
      </div>
    </div>
  );
}
