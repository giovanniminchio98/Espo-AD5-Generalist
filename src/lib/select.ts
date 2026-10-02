import type { Category } from '../../config/settings';
import type { Item } from '../schema/item';
import type { Attempt } from '../stats/store';

export interface Filter {
  category?: Category;
  subtype?: string;
  difficulty?: number;
  mode?: 'interactive' | 'reveal' | 'any';
}

export function matches(i: Item, f: Filter) {
  return (
    (!f.category || i.category === f.category) &&
    (!f.subtype || i.subtype === f.subtype) &&
    (!f.difficulty || i.difficulty === f.difficulty) &&
    (!f.mode || f.mode === 'any' || i.mode === f.mode)
  );
}

function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/** Picks n items: never-seen items first, then the ones seen longest ago; random order within each group. */
export function pickItems(items: Item[], f: Filter, n: number, attempts: Attempt[]): Item[] {
  const last = new Map<string, number>();
  for (const a of attempts) last.set(a.itemId, Math.max(last.get(a.itemId) ?? 0, a.ts));
  const pool = shuffle(items.filter((i) => matches(i, f)));
  pool.sort((a, b) => (last.get(a.id) ?? 0) - (last.get(b.id) ?? 0));
  return shuffle(pool.slice(0, n));
}

/** Exam-style selection: interactive items, weighted towards medium and hard like the real test. */
export function pickExam(items: Item[], category: Category, n: number, attempts: Attempt[]): Item[] {
  const want = { 1: Math.round(n * 0.25), 3: Math.round(n * 0.3) } as Record<number, number>;
  want[2] = n - want[1] - want[3];
  const out: Item[] = [];
  for (const d of [1, 2, 3]) out.push(...pickItems(items, { category, difficulty: d, mode: 'interactive' }, want[d], attempts));
  if (out.length < n) {
    const have = new Set(out.map((i) => i.id));
    out.push(...pickItems(items.filter((i) => !have.has(i.id)), { category, mode: 'interactive' }, n - out.length, attempts));
  }
  return shuffle(out);
}
