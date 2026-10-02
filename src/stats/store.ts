import { useSyncExternalStore } from 'react';
import { z } from 'zod';
import { SETTINGS, type Category } from '../../config/settings';

const KEY = 'epso-trainer:v1';
const DAY = 24 * 60 * 60 * 1000;

export const Attempt = z.object({
  itemId: z.string(),
  category: z.enum(['verbal', 'numerical', 'abstract']),
  subtype: z.string(),
  difficulty: z.number(),
  mode: z.enum(['practice', 'exam', 'mock', 'mistakes', 'speed']),
  ts: z.number(),
  timeMs: z.number(),
  targetSec: z.number(),
  chosen: z.string().nullable().optional(), // interactive items
  correct: z.boolean().optional(), // interactive items
  trap: z.string().optional(), // trap tag of the wrong option chosen
  selfRating: z.enum(['got', 'partly', 'missed']).optional(), // reveal items
});
export type Attempt = z.infer<typeof Attempt>;

export const Session = z.object({
  id: z.string(),
  kind: z.enum(['practice', 'exam', 'mock', 'mistakes', 'speed']),
  ts: z.number(),
  label: z.string(),
  scores: z.array(z.object({ category: z.enum(['verbal', 'numerical', 'abstract']), correct: z.number(), total: z.number() })),
  passed: z.boolean().optional(),
});
export type Session = z.infer<typeof Session>;

export const SrsEntry = z.object({ stage: z.number().int(), due: z.number(), lapses: z.number().int() });
export type SrsEntry = z.infer<typeof SrsEntry>;

export const StoreData = z.object({
  version: z.literal(1),
  attempts: z.array(Attempt),
  sessions: z.array(Session),
  srs: z.record(z.string(), SrsEntry),
});
export type StoreData = z.infer<typeof StoreData>;

const empty = (): StoreData => ({ version: 1, attempts: [], sessions: [], srs: {} });

function load(): StoreData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = StoreData.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : empty();
  } catch {
    return empty();
  }
}

let state: StoreData = load();
const listeners = new Set<() => void>();

function commit(next: StoreData) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked: progress stays in memory for this visit.
  }
  listeners.forEach((l) => l());
}

export function useStore(): StoreData {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

export function getStore() {
  return state;
}

/** Records attempts and updates the spaced-repetition schedule (1, 3, 7 days). */
export function recordAttempts(list: Attempt[]) {
  const srs = { ...state.srs };
  const intervals = SETTINGS.SRS_INTERVALS_DAYS;
  for (const a of list) {
    const failed = a.correct === false || a.selfRating === 'missed' || a.selfRating === 'partly';
    const entry = srs[a.itemId];
    if (failed) {
      srs[a.itemId] = { stage: 0, due: a.ts + intervals[0] * DAY, lapses: (entry?.lapses ?? 0) + 1 };
    } else if (entry && a.ts >= entry.due - DAY / 2) {
      // Correct on (or near) the due date: move to the next interval, or graduate.
      const stage = entry.stage + 1;
      if (stage >= intervals.length) delete srs[a.itemId];
      else srs[a.itemId] = { ...entry, stage, due: a.ts + intervals[stage] * DAY };
    }
  }
  commit({ ...state, attempts: [...state.attempts, ...list], srs });
}

export function recordSession(s: Session) {
  commit({ ...state, sessions: [...state.sessions, s] });
}

export function exportData(): string {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 1);
}

export function importData(text: string, merge: boolean): { ok: boolean; message: string } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, message: 'The file is not valid JSON.' };
  }
  const parsed = StoreData.safeParse(json);
  if (!parsed.success) return { ok: false, message: 'The file does not look like an export from this trainer.' };
  const d = parsed.data;
  if (!merge) {
    commit(d);
    return { ok: true, message: `Imported ${d.attempts.length} attempts and ${d.sessions.length} sessions.` };
  }
  const seen = new Set(state.attempts.map((a) => `${a.itemId}@${a.ts}`));
  const attempts = [...state.attempts, ...d.attempts.filter((a) => !seen.has(`${a.itemId}@${a.ts}`))].sort((a, b) => a.ts - b.ts);
  const sids = new Set(state.sessions.map((s) => s.id));
  const sessions = [...state.sessions, ...d.sessions.filter((s) => !sids.has(s.id))].sort((a, b) => a.ts - b.ts);
  commit({ version: 1, attempts, sessions, srs: { ...d.srs, ...state.srs } });
  return { ok: true, message: `Merged: now ${attempts.length} attempts and ${sessions.length} sessions.` };
}

export function resetData() {
  commit(empty());
}

export function dueItems(now = Date.now()): string[] {
  return Object.entries(state.srs)
    .filter(([, e]) => e.due <= now)
    .sort((a, b) => a[1].due - b[1].due)
    .map(([id]) => id);
}

export const CATEGORY_LABEL: Record<Category, string> = {
  verbal: 'Verbal reasoning',
  numerical: 'Numerical reasoning',
  abstract: 'Abstract reasoning',
};
