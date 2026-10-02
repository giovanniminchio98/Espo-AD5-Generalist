import { SETTINGS, type Category } from '../../config/settings';
import type { Attempt, StoreData } from './store';

export interface Acc {
  correct: number;
  total: number;
}
const pct = (a: Acc) => (a.total ? a.correct / a.total : 0);
export { pct };

function group(attempts: Attempt[], key: (a: Attempt) => string): Map<string, Acc> {
  const m = new Map<string, Acc>();
  for (const a of attempts) {
    if (a.correct === undefined) continue;
    const k = key(a);
    const g = m.get(k) ?? { correct: 0, total: 0 };
    g.total++;
    if (a.correct) g.correct++;
    m.set(k, g);
  }
  return m;
}

export function accuracyBy(store: StoreData, key: 'category' | 'subtype' | 'difficulty', category?: Category) {
  return group(
    store.attempts.filter((a) => !category || a.category === category),
    (a) => String(a[key]),
  );
}

export function timing(store: StoreData, category: Category) {
  const list = store.attempts.filter((a) => a.category === category && a.correct !== undefined && a.timeMs > 0);
  if (!list.length) return null;
  const avg = list.reduce((s, a) => s + a.timeMs, 0) / list.length / 1000;
  const target = list.reduce((s, a) => s + a.targetSec, 0) / list.length;
  const t = SETTINGS.EXAM_TIMINGS[category];
  return { avg, target, official: (t.minutes * 60) / t.questions, n: list.length };
}

export function trapCounts(store: StoreData, category?: Category) {
  const m = new Map<string, number>();
  for (const a of store.attempts) if (a.trap && (!category || a.category === category)) m.set(a.trap, (m.get(a.trap) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

export function selfRatings(store: StoreData) {
  const r = { got: 0, partly: 0, missed: 0 };
  for (const a of store.attempts) if (a.selfRating) r[a.selfRating]++;
  return r;
}

/** Estimated exam score: recent accuracy, weighted towards harder items (the real test is medium/hard). */
export function estimate(store: StoreData, category: Category) {
  const recent = store.attempts.filter((a) => a.category === category && a.correct !== undefined).slice(-40);
  if (recent.length < 10) return null;
  const w = { 1: 0.6, 2: 1, 3: 1.3 } as Record<number, number>;
  let num = 0;
  let den = 0;
  for (const a of recent) {
    num += (a.correct ? 1 : 0) * w[a.difficulty];
    den += w[a.difficulty];
  }
  const p = num / den;
  const q = SETTINGS.EXAM_TIMINGS[category].questions;
  return { p, score: Math.round(p * q), of: q, n: recent.length };
}

/** Daily accuracy for the trend chart. */
export function dailyTrend(store: StoreData, category?: Category) {
  const m = new Map<string, Acc>();
  for (const a of store.attempts) {
    if (a.correct === undefined || (category && a.category !== category)) continue;
    const d = new Date(a.ts).toISOString().slice(0, 10);
    const g = m.get(d) ?? { correct: 0, total: 0 };
    g.total++;
    if (a.correct) g.correct++;
    m.set(d, g);
  }
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([day, acc]) => ({ day, ...acc, p: pct(acc) }));
}
