// Generates the numerical bank. Every number comes from a seeded generator and every answer is computed in code.
import { SETTINGS } from '../config/settings.ts';
import { buildNumerical, type Slot } from '../src/engine/numerical/assemble.ts';
import { RECIPES } from '../src/engine/numerical/recipes.ts';
import { balancedLetters, Rng } from '../src/engine/rng.ts';
import { writeBatches } from './io.ts';

const N = SETTINGS.NUMERICAL_COUNT;
const perRecipe = N / RECIPES.length;
// Difficulty split per recipe: 6 recipes get 4/5/3, 4 get 3/6/3 → 36/54/30 overall (30/45/25%).
const splits: [number, number, number][] = RECIPES.map((_, i) => (i < 6 ? [4, 5, 3] : [3, 6, 3]));

const slots: Omit<Slot, 'id'>[] = [];
RECIPES.forEach((r, ri) => {
  const [e, m, h] = splits[ri];
  if (e + m + h !== perRecipe) throw new Error('split does not match NUMERICAL_COUNT');
  const ds = [...Array(e).fill(1), ...Array(m).fill(2), ...Array(h).fill(3)] as (1 | 2 | 3)[];
  ds.forEach((d, k) => slots.push({ recipe: r.name, difficulty: d, mode: 'interactive', seed: 100000 + ri * 1000 + k * 37 }));
});

// About 15% reveal items: two per recipe for the first eight recipes, one for the last two (18 in total).
const order = new Rng(2024).shuffle(slots.map((_, i) => i));
let revealCount = 0;
RECIPES.forEach((r, ri) => {
  const want = ri < 8 ? 2 : 1;
  const mine = order.filter((i) => slots[i].recipe === r.name);
  for (const i of mine.slice(0, want)) {
    slots[i].mode = 'reveal';
    slots[i].revealKind = revealCount++ % 2 === 0 ? 'estimate' : 'setup';
  }
});

const shuffled = new Rng(77).shuffle(slots);
const letters = balancedLetters(shuffled.filter((s) => s.mode === 'interactive').length, 5, 4242);
let li = 0;
const items = shuffled.map((s, i) => {
  const slot: Slot = { ...s, id: `NR-${String(i + 1).padStart(3, '0')}` };
  if (slot.mode === 'interactive') slot.letter = letters[li++];
  return buildNumerical(slot);
});

writeBatches('numerical', items);
console.log(`numerical: wrote ${items.length} items (${items.filter((x) => x.mode === 'reveal').length} reveal)`);
