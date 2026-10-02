// Generates the abstract bank from the rule engine. Each item is re-checked by `npm run validate`.
import { SETTINGS } from '../config/settings.ts';
import { type AbstractSlot, buildAbstract, RULE_TYPES, type RuleType } from '../src/engine/abstract/generate.ts';
import { balancedLetters, Rng } from '../src/engine/rng.ts';
import { writeBatches } from './io.ts';

const N = SETTINGS.ABSTRACT_COUNT;
const rng = new Rng(9001);
const nEasy = Math.round(N * 0.3);
const nHard = Math.round(N * 0.25);
const nMed = N - nEasy - nHard;

const slots: Omit<AbstractSlot, 'id'>[] = [];
for (let i = 0; i < nEasy; i++) slots.push({ difficulty: 1, types: [RULE_TYPES[i % RULE_TYPES.length]], mode: 'interactive', seed: 500000 + i * 13 });
const pairs: RuleType[][] = [];
for (let a = 0; a < RULE_TYPES.length; a++) for (let b = a + 1; b < RULE_TYPES.length; b++) pairs.push([RULE_TYPES[a], RULE_TYPES[b]]);
for (let i = 0; i < nMed; i++) slots.push({ difficulty: 2, types: rng.shuffle(pairs[i % pairs.length]), mode: 'interactive', seed: 600000 + i * 13 });
for (let i = 0; i < nHard; i++) slots.push({ difficulty: 3, types: rng.sample(RULE_TYPES, 3), mode: 'interactive', seed: 700000 + i * 13 });

// About 15% reveal items, spread over the difficulties (6 easy, 8 medium, 4 hard).
const quota = { 1: 6, 2: 8, 3: 4 } as Record<number, number>;
for (const i of rng.shuffle(slots.map((_, k) => k))) {
  const s = slots[i];
  if (quota[s.difficulty] > 0) {
    s.mode = 'reveal';
    quota[s.difficulty]--;
  }
}

const shuffled = new Rng(31337).shuffle(slots);
const letters = balancedLetters(shuffled.filter((s) => s.mode === 'interactive').length, 5, 8080);
let li = 0;
const seen = new Set<string>();
const items = shuffled.map((s, i) => {
  const slot: AbstractSlot = { ...s, id: `AR-${String(i + 1).padStart(3, '0')}` };
  if (slot.mode === 'interactive') slot.letter = letters[li++];
  return buildAbstract(slot, seen);
});
writeBatches('abstract', items);
console.log(`abstract: wrote ${items.length} items (${items.filter((x) => x.mode === 'reveal').length} reveal)`);
