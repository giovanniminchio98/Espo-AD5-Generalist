import { useState } from 'react';
import { SETTINGS } from '../../config/settings';
import { fmtTime } from '../lib/labels';
import { CATEGORY_LABEL } from '../stats/store';
import type { SectionResult } from './ExamRunner';
import { ItemView } from './ItemView';

export function scoreOf(r: SectionResult) {
  return r.items.filter((i) => r.answers[i.id] === i.correct).length;
}

/** Pass/fail check against the pass marks in settings (scaled if a section has a non-standard length). */
export function passCheck(results: SectionResult[]) {
  const get = (c: string) => results.find((r) => r.category === c);
  const v = get('verbal');
  const n = get('numerical');
  const a = get('abstract');
  const out: { label: string; score: number; of: number; need: number; pass: boolean }[] = [];
  if (v) {
    const need = Math.ceil((SETTINGS.PASS_MARKS.verbal / SETTINGS.EXAM_TIMINGS.verbal.questions) * v.items.length);
    out.push({ label: 'Verbal reasoning', score: scoreOf(v), of: v.items.length, need, pass: scoreOf(v) >= need });
  }
  if (n && a) {
    const of = n.items.length + a.items.length;
    const std = SETTINGS.EXAM_TIMINGS.numerical.questions + SETTINGS.EXAM_TIMINGS.abstract.questions;
    const need = Math.ceil((SETTINGS.PASS_MARKS.numericalAbstract / std) * of);
    const score = scoreOf(n) + scoreOf(a);
    out.push({ label: 'Numerical + abstract combined', score, of, need, pass: score >= need });
  }
  return out;
}

export function Review({ results, title, onDone, showPass }: { results: SectionResult[]; title: string; onDone: () => void; showPass: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const checks = showPass ? passCheck(results) : [];
  const overall = checks.length ? checks.every((c) => c.pass) : null;
  return (
    <div className="review">
      <div className="card summary">
        <h2>{title}: results</h2>
        <div className="score-tiles">
          {results.map((r) => (
            <div className="tile" key={r.category}>
              <div className="tile-label">{CATEGORY_LABEL[r.category]}</div>
              <div className="tile-value">
                {scoreOf(r)} / {r.items.length}
              </div>
              <div className="tile-sub">Time used {fmtTime(r.timeUsed)}</div>
            </div>
          ))}
        </div>
        {checks.length > 0 && (
          <div className={`pass-box ${overall ? 'ok' : 'bad'}`}>
            <strong>{overall ? 'PASS' : 'FAIL'}</strong> against the pass marks in your settings
            <ul>
              {checks.map((c) => (
                <li key={c.label}>
                  {c.pass ? '✓' : '✗'} {c.label}: {c.score}/{c.of} (pass mark {c.need})
                </li>
              ))}
            </ul>
            <p className="muted">In the real competition, passing is necessary but your ranking also matters; aim well above the pass mark.</p>
          </div>
        )}
        <button className="btn primary" onClick={onDone}>
          Done
        </button>
      </div>
      {results.map((r) => (
        <section key={r.category} className="review-section">
          <h3>{CATEGORY_LABEL[r.category]}: every question</h3>
          <ul className="review-list">
            {r.items.map((it, k) => {
              const a = r.answers[it.id];
              const ok = a === it.correct;
              const isOpen = open === it.id;
              return (
                <li key={it.id} className={ok ? 'ok' : 'bad'}>
                  <button className="review-row" onClick={() => setOpen(isOpen ? null : it.id)} aria-expanded={isOpen}>
                    <span className="mark">{ok ? '✓' : '✗'}</span>
                    <span>Question {k + 1}</span>
                    <span className="muted">
                      Your answer: {a ?? '—'} · Correct: {it.correct} · {fmtTime((r.times[it.id] ?? 0) / 1000)}
                    </span>
                    <span className="chev">{isOpen ? '▲' : '▼'}</span>
                  </button>
                  {isOpen && <ItemView item={it} chosen={a} feedback showMeta />}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
