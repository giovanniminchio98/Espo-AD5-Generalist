import type { NumericalItem } from '../../schema/item';
import { Rng } from '../rng';
import { type Built, type Distractor, fmtValue, need, parseShown, Retry, type Value } from './common';
import { RECIPE_BY_NAME } from './recipes';

/** Minimum relative gap between any two numeric options, so rounding never makes two options equivalent. */
export const MIN_GAP = 0.03;

export function tooClose(a: Value, b: Value): boolean {
  if (typeof a !== 'number' || typeof b !== 'number') return a === b;
  const m = Math.max(Math.abs(a), Math.abs(b));
  return m === 0 || Math.abs(a - b) / m < MIN_GAP;
}

function pickDistractors(b: Built): (Distractor & { text: string })[] {
  const fmt = b.params.fmt;
  const answerText = fmtValue(b.answer, fmt);
  const out: (Distractor & { text: string })[] = [];
  for (const d of b.distractors) {
    if (typeof d.value === 'number' && (!Number.isFinite(d.value) || d.value === 0)) continue;
    const text = fmtValue(d.value, fmt);
    if (text === answerText || out.some((o) => o.text === text)) continue;
    if (tooClose(d.value, b.answer) || out.some((o) => tooClose(o.value, d.value))) continue;
    // Also compare the values as displayed, after rounding.
    const shown = parseShown(text);
    if (typeof b.answer === 'number' && !Number.isNaN(shown) && (tooClose(shown, parseShown(answerText)) || out.some((o) => tooClose(parseShown(o.text), shown)))) continue;
    out.push({ ...d, text });
    if (out.length === 4) break;
  }
  need(out.length === 4, 'not enough distinct distractors');
  return out;
}

export interface Slot {
  id: string;
  recipe: string;
  difficulty: 1 | 2 | 3;
  mode: 'interactive' | 'reveal';
  revealKind?: 'estimate' | 'setup';
  letter?: string;
  seed: number;
}

const EST_TIME = { 1: 80, 2: 115, 3: 150 } as const;

export function buildNumerical(slot: Slot): NumericalItem {
  const recipe = RECIPE_BY_NAME[slot.recipe];
  for (let attempt = 0; attempt < 500; attempt++) {
    const seed = slot.seed + attempt * 7919;
    try {
      const b = recipe.build(new Rng(seed), slot.difficulty);
      const fmt = b.params.fmt;
      const answerText = fmtValue(b.answer, fmt);
      const ds = pickDistractors(b);
      const answer_value = typeof b.answer === 'number' ? Number(b.answer.toFixed(6)) : b.answer;
      const base = {
        id: slot.id,
        category: 'numerical' as const,
        subtype: recipe.subtype,
        difficulty: slot.difficulty,
        source: b.source,
        recipe: { name: recipe.name, seed, params: b.params },
        answer_value,
        answer_text: answerText,
        prompt: b.prompt,
      };
      if (slot.mode === 'reveal') {
        const estimate = slot.revealKind === 'estimate';
        return {
          ...base,
          mode: 'reveal',
          task: estimate
            ? 'Estimate the answer to within 10% in under 30 seconds, without the calculator. Write your estimate, then reveal the solution.'
            : 'Before computing anything, write down the full calculation you would key into the calculator. Then reveal the solution.',
          correct: estimate
            ? `Quick estimate: ${b.estimate} Exact answer: ${answerText}. Your estimate counts if it is within 10% of this.`
            : `Set-up: ${b.setup}. Result: ${answerText}.`,
          explanation: { steps: b.steps, shortcut: b.shortcut },
          trap_tags: [],
          est_time_sec: estimate ? 30 : 60,
        };
      }
      const rng = new Rng(seed ^ 0x5bd1e995);
      const order = rng.shuffle(ds);
      const li = 'ABCDE'.indexOf(slot.letter!);
      const options = [] as NonNullable<NumericalItem['options']>;
      let k = 0;
      for (let i = 0; i < 5; i++) {
        const key = 'ABCDE'[i] as 'A';
        if (i === li) options.push({ key, text: answerText, note: 'Correct.' });
        else {
          const d = order[k++];
          options.push({ key, text: d.text, trap: d.trap, note: d.note });
        }
      }
      return {
        ...base,
        mode: 'interactive',
        options,
        correct: slot.letter!,
        explanation: { steps: b.steps, shortcut: b.shortcut },
        trap_tags: [...new Set(ds.map((d) => d.trap))],
        est_time_sec: EST_TIME[slot.difficulty],
      };
    } catch (e) {
      if (e instanceof Retry) continue;
      throw e;
    }
  }
  throw new Error(`could not build ${slot.id} (${slot.recipe}, d${slot.difficulty})`);
}
