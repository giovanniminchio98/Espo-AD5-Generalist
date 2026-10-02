import { SETTINGS } from '../config/settings.ts';
import { applyRules, brokenRules, collisions, sameFigure, visualKey } from '../src/engine/abstract/model.ts';
import { tooClose } from '../src/engine/numerical/assemble.ts';
import { fmtValue, type Fmt, parseShown } from '../src/engine/numerical/common.ts';
import { RECIPE_BY_NAME } from '../src/engine/numerical/recipes.ts';
import { normaliseSpace, wordCount } from '../src/lib/format.ts';
import { type AbstractItem, Item, type NumericalItem, structuralProblems, type VerbalItem } from '../src/schema/item.ts';
import { readBank } from './io.ts';

export interface CheckResult {
  errors: string[];
  warnings: string[];
  items: Item[];
}

const COUNT_KEY = { verbal: 'VERBAL_COUNT', numerical: 'NUMERICAL_COUNT', abstract: 'ABSTRACT_COUNT' } as const;

function shingles(text: string, n = 5): Set<string> {
  const w = normaliseSpace(text).toLowerCase().replace(/[^a-z0-9 ]/g, '').split(' ');
  const out = new Set<string>();
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(' '));
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter || 1);
}

function checkVerbal(it: VerbalItem, err: (m: string) => void) {
  const wc = wordCount(it.passage);
  if (wc < 180 || wc > 280) err(`passage has ${wc} words (allowed 180–280)`);
  const passage = normaliseSpace(it.passage);
  for (const q of it.evidence) if (!passage.includes(normaliseSpace(q))) err(`evidence quote not found in passage: "${q.slice(0, 60)}…"`);
  if (it.subtype === 'incorrect_statement' && it.polarity !== 'incorrect') err('incorrect_statement items must have polarity "incorrect"');
  if (it.polarity === 'incorrect' && it.mode === 'interactive' && !/incorrect|not|cannot/i.test(it.prompt)) err('polarity "incorrect" but the prompt does not ask for the incorrect statement');
  if (it.options) {
    const texts = it.options.map((o) => normaliseSpace(o.text).toLowerCase());
    if (new Set(texts).size !== texts.length) err('duplicate option texts');
  }
}

function checkNumerical(it: NumericalItem, err: (m: string) => void) {
  const recipe = RECIPE_BY_NAME[it.recipe.name];
  if (!recipe) return err(`unknown recipe ${it.recipe.name}`);
  if (recipe.subtype !== it.subtype) err(`subtype ${it.subtype} does not match recipe ${recipe.subtype}`);
  let v;
  try {
    v = recipe.solve(it.source, it.recipe.params);
  } catch (e) {
    return err(`recompute failed: ${(e as Error).message}`);
  }
  const text = fmtValue(v, it.recipe.params.fmt as Fmt);
  if (text !== it.answer_text) err(`recomputed answer ${text} ≠ stored answer_text ${it.answer_text}`);
  if (typeof v === 'number') {
    if (typeof it.answer_value !== 'number' || Math.abs(v - it.answer_value) > 1e-6 * Math.max(1, Math.abs(v))) err(`recomputed value ${v} ≠ answer_value ${it.answer_value}`);
  } else if (v !== it.answer_value) err(`recomputed value ${v} ≠ answer_value ${it.answer_value}`);
  if (it.mode === 'interactive' && it.options) {
    const correct = it.options.find((o) => o.key === it.correct);
    if (correct?.text !== text) err(`correct option text "${correct?.text}" ≠ recomputed "${text}"`);
    const texts = it.options.map((o) => o.text);
    if (new Set(texts).size !== texts.length) err('duplicate option texts');
    // Numeric options must be clearly apart so that rounding never makes a distractor defensible.
    const nums = it.options.map((o) => parseShown(o.text));
    if (nums.every((n) => Number.isFinite(n)) && typeof v === 'number') {
      for (let i = 0; i < nums.length; i++)
        for (let j = i + 1; j < nums.length; j++) if (tooClose(nums[i], nums[j])) err(`options ${it.options[i].key} and ${it.options[j].key} are within 3% of each other`);
    }
  } else if (it.mode === 'reveal' && !it.correct.includes(text)) err('reveal solution does not state the recomputed answer');
}

function checkAbstract(it: AbstractItem, err: (m: string) => void) {
  let frames;
  try {
    frames = [0, 1, 2, 3, 4, 5].map((t) => applyRules(it.base, it.rules, t));
  } catch (e) {
    return err(`rule engine failed: ${(e as Error).message}`);
  }
  for (let t = 0; t < 5; t++) if (!sameFigure(frames[t], it.series[t])) err(`series figure ${t + 1} does not match the rules`);
  if (!sameFigure(frames[5], it.answer)) err('stored answer does not match the rules');
  for (const f of frames) if (collisions(f)) err('two elements share a cell');
  for (let t = 1; t < 6; t++) if (sameFigure(frames[t], frames[t - 1])) err(`figures ${t} and ${t + 1} are identical`);
  if (it.mode === 'interactive' && it.options) {
    const fits = it.options.filter((o) => brokenRules(it.rules, frames[5], o.figure).length === 0);
    if (fits.length !== 1) err(`${fits.length} options satisfy all rules (expected exactly 1)`);
    else if (fits[0].key !== it.correct) err(`the option that fits is ${fits[0].key}, but correct is ${it.correct}`);
    const keys = it.options.map((o) => visualKey(o.figure));
    if (new Set(keys).size !== keys.length) err('two options look identical');
    for (const o of it.options) {
      if (o.key === it.correct) continue;
      const b = brokenRules(it.rules, frames[5], o.figure);
      if (b.length !== 1) err(`option ${o.key} breaks ${b.length} rules (expected exactly 1)`);
      else if (o.breaks !== b[0]) err(`option ${o.key} is tagged as breaking rule ${o.breaks} but breaks rule ${b[0]}`);
      if (collisions(o.figure)) err(`option ${o.key} has two elements in one cell`);
    }
  }
}

export function runChecks(opts: { category?: string; partial?: boolean } = {}): CheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const items: Item[] = [];
  const ids = new Map<string, string>();
  for (const { file, items: raw } of readBank(opts.category)) {
    raw.forEach((r, i) => {
      const where = `${file}#${i} (${(r as { id?: string }).id ?? '?'})`;
      const parsed = Item.safeParse(r);
      if (!parsed.success) {
        errors.push(`${where}: schema: ${parsed.error.issues.slice(0, 3).map((x) => `${x.path.join('.')}: ${x.message}`).join('; ')}`);
        return;
      }
      const it = parsed.data;
      if (ids.has(it.id)) errors.push(`${where}: duplicate id (also in ${ids.get(it.id)})`);
      ids.set(it.id, file);
      const prefix = { verbal: 'VR', numerical: 'NR', abstract: 'AR' }[it.category];
      if (!it.id.startsWith(prefix)) errors.push(`${where}: id prefix does not match category`);
      if (!file.startsWith(it.category)) errors.push(`${where}: item is in the wrong folder`);
      const err = (m: string) => errors.push(`${where}: ${m}`);
      structuralProblems(it).forEach(err);
      if (it.category === 'verbal') checkVerbal(it, err);
      if (it.category === 'numerical') checkNumerical(it, err);
      if (it.category === 'abstract') checkAbstract(it, err);
      items.push(it);
    });
  }

  // Near-duplicate passages and duplicate figures.
  const verbal = items.filter((i): i is VerbalItem => i.category === 'verbal');
  const sh = verbal.map((v) => shingles(v.passage));
  for (let i = 0; i < verbal.length; i++)
    for (let j = i + 1; j < verbal.length; j++) {
      const s = jaccard(sh[i], sh[j]);
      if (s > 0.3) errors.push(`${verbal[i].id} and ${verbal[j].id}: passages are near-duplicates (similarity ${s.toFixed(2)})`);
    }
  const seriesKeys = new Map<string, string>();
  for (const it of items) {
    if (it.category !== 'abstract') continue;
    const k = it.series.map(visualKey).join('#');
    if (seriesKeys.has(k)) errors.push(`${it.id}: same figure series as ${seriesKeys.get(k)}`);
    seriesKeys.set(k, it.id);
  }
  const numKeys = new Map<string, string>();
  for (const it of items) {
    if (it.category !== 'numerical') continue;
    const k = JSON.stringify(it.source) + it.prompt;
    if (numKeys.has(k)) errors.push(`${it.id}: duplicate of ${numKeys.get(k)}`);
    numKeys.set(k, it.id);
  }

  // Bank-level targets.
  for (const cat of ['verbal', 'numerical', 'abstract'] as const) {
    if (opts.category && opts.category !== cat) continue;
    const list = items.filter((i) => i.category === cat);
    const target = SETTINGS[COUNT_KEY[cat]];
    const report = opts.partial ? warnings : errors;
    if (list.length < target) report.push(`${cat}: ${list.length} items, settings require ${target}`);
    if (!list.length) continue;
    const inter = list.filter((i) => i.mode === 'interactive');
    const nOpt = cat === 'verbal' ? 4 : 5;
    const [lo, hi] = SETTINGS.LETTER_BALANCE[nOpt];
    for (const L of 'ABCDE'.slice(0, nOpt)) {
      const share = inter.filter((i) => i.correct === L).length / (inter.length || 1);
      if (share < lo || share > hi) report.push(`${cat}: letter ${L} is correct in ${(share * 100).toFixed(1)}% of interactive items (allowed ${lo * 100}–${hi * 100}%)`);
    }
    for (const d of [1, 2, 3] as const) {
      const share = list.filter((i) => i.difficulty === d).length / list.length;
      if (Math.abs(share - SETTINGS.DIFFICULTY_MIX[d]) > SETTINGS.DIFFICULTY_TOLERANCE)
        report.push(`${cat}: difficulty ${d} is ${(share * 100).toFixed(1)}% (target ${SETTINGS.DIFFICULTY_MIX[d] * 100}% ± ${SETTINGS.DIFFICULTY_TOLERANCE * 100})`);
    }
    const rshare = (list.length - inter.length) / list.length;
    if (Math.abs(rshare - SETTINGS.REVEAL_SHARE) > SETTINGS.REVEAL_TOLERANCE)
      report.push(`${cat}: reveal items are ${(rshare * 100).toFixed(1)}% (target ${SETTINGS.REVEAL_SHARE * 100}% ± ${SETTINGS.REVEAL_TOLERANCE * 100})`);
  }
  return { errors, warnings, items };
}
