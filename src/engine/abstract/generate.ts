import type { AbstractItem, Element, Figure, Rule } from '../../schema/item';
import { Rng } from '../rng';
import { describeRule, TRAP_FOR_RULE, valueName } from './explain';
import { applyRules, brokenRules, collisions, PATH_CELLS, sameFigure, validElement, visualKey } from './model';

export type RuleType = 'rotate' | 'move' | 'count' | 'add_remove' | 'alternate' | 'cycle';
export const RULE_TYPES: RuleType[] = ['rotate', 'move', 'count', 'add_remove', 'alternate', 'cycle'];

const ROTORS = ['arrow', 'lshape', 'wedge'] as const;
const PLAIN = ['circle', 'square', 'triangle', 'hexagon', 'cross'] as const;
const FILLS = ['empty', 'solid', 'striped'] as const;
const LABEL: Record<string, string> = {
  arrow: 'arrow', lshape: 'L-shape', wedge: 'wedge', circle: 'circle', square: 'square', triangle: 'triangle',
  hexagon: 'hexagon', cross: 'cross', pips: 'dots', spokes: 'star of lines',
};

class Fail extends Error {}
function need(c: boolean): asserts c {
  if (!c) throw new Fail();
}

type Kind = 'rotor' | 'plain' | 'pips' | 'spokes';
const kindOf = (e: Element): Kind =>
  (ROTORS as readonly string[]).includes(e.shape) ? 'rotor' : e.shape === 'pips' ? 'pips' : e.shape === 'spokes' ? 'spokes' : 'plain';

function newElement(rng: Rng, id: string, kind: Kind, used: Set<string>): Element {
  const pool = kind === 'rotor' ? ROTORS : kind === 'plain' ? PLAIN : [kind];
  const free = pool.filter((s) => !used.has(s));
  need(free.length > 0);
  const shape = rng.pick(free) as Element['shape'];
  used.add(shape);
  const fill = kind === 'pips' || kind === 'spokes' ? 'solid' : rng.pick(FILLS);
  return {
    id,
    label: LABEL[shape],
    shape,
    cell: 4,
    rotation: kind === 'rotor' || kind === 'spokes' ? rng.int(0, 7) * 45 : 0,
    fill,
    colour: rng.pick(['black', 'grey'] as const),
    size: kind === 'pips' || kind === 'spokes' ? 2 : (rng.pick([2, 3, 3]) as 2 | 3),
    count: 1,
  };
}

/** Attributes an alternate/cycle rule may drive on this element, given rules already attached to it. */
function freeAttrs(e: Element, rules: Rule[], cycle: boolean): string[] {
  const taken = new Set<string>(rules.filter((r) => r.type !== 'static' && r.el === e.id).map((r) => ('attr' in r ? r.attr : r.type)));
  const k = kindOf(e);
  let attrs: string[] = k === 'pips' || k === 'spokes' ? ['colour'] : ['fill', 'size', 'colour'];
  if (k === 'plain') attrs.push('shape');
  if (cycle) attrs = attrs.filter((a) => a !== 'colour'); // only two colours, so nothing to cycle
  if (taken.has('fill')) attrs = attrs.filter((a) => a !== 'colour');
  if (taken.has('colour')) attrs = attrs.filter((a) => a !== 'fill');
  return attrs.filter((a) => !taken.has(a));
}

function attachRule(rng: Rng, type: RuleType, d: number, els: Element[], rules: Rule[], used: Set<string>): void {
  const compatible = (e: Element) => {
    const k = kindOf(e);
    const has = (t: string) => rules.some((r) => r.el === e.id && r.type === t);
    switch (type) {
      case 'rotate':
        return k === 'rotor' && !has('rotate');
      case 'count':
        return k === 'pips' && !has('count');
      case 'add_remove':
        return k === 'spokes' && !has('add_remove');
      case 'move':
        return !has('move');
      case 'alternate':
      case 'cycle':
        return freeAttrs(e, rules, type === 'cycle').length > 0 && !(type === 'cycle' && has('cycle'));
    }
  };
  const reuse = els.filter(compatible);
  let e: Element;
  if (reuse.length && rng.chance(d === 3 ? 0.5 : 0.4)) e = rng.pick(reuse);
  else {
    const kind: Kind =
      type === 'rotate' ? 'rotor' : type === 'count' ? 'pips' : type === 'add_remove' ? 'spokes' : rng.pick(['plain', 'plain', 'rotor'] as Kind[]);
    e = newElement(rng, `e${els.length + 1}`, kind, used);
    els.push(e);
  }
  switch (type) {
    case 'rotate': {
      const steps = d === 1 ? [90, -90, 45, -45] : [90, -90, 45, -45, 135, -135];
      rules.push({ type: 'rotate', el: e.id, step: rng.pick(steps) });
      break;
    }
    case 'move': {
      const opts: [string, number][] = [['perimeter_cw', 1], ['perimeter_ccw', 1]];
      if (d >= 2) opts.push(['reading', 1], ['column', 1], ['reading_reverse', 1], ['perimeter_cw', 2], ['perimeter_ccw', 2]);
      if (d === 3) opts.push(['perimeter_cw', 3], ['perimeter_ccw', 3]);
      const [path, step] = rng.pick(opts);
      e.cell = rng.pick(PATH_CELLS[path]);
      rules.push({ type: 'move', el: e.id, path: path as 'reading', step });
      break;
    }
    case 'count': {
      const up = rng.chance(0.5);
      e.count = up ? rng.int(1, 3) : rng.int(7, 9);
      rules.push({ type: 'count', el: e.id, delta: up ? 1 : -1 });
      break;
    }
    case 'add_remove': {
      const up = rng.chance(0.55);
      e.count = up ? rng.int(0, 2) : rng.int(6, 8);
      rules.push({ type: 'add_remove', el: e.id, delta: up ? 1 : -1 });
      break;
    }
    case 'alternate':
    case 'cycle': {
      const attr = rng.pick(freeAttrs(e, rules, type === 'cycle'));
      let pool: (string | number)[];
      if (attr === 'fill') pool = [...FILLS];
      else if (attr === 'size') pool = [1, 2, 3];
      else if (attr === 'colour') pool = ['black', 'grey'];
      else pool = PLAIN.filter((s) => s === e.shape || !used.has(s));
      const n = type === 'alternate' ? 2 : attr === 'shape' && d === 3 && pool.length >= 4 ? rng.pick([3, 4]) : 3;
      need(pool.length >= n);
      const values = rng.sample(pool, n);
      if (attr === 'shape') {
        values.forEach((v) => used.add(String(v)));
        e.label = 'shape';
      }
      if (attr === 'colour' && e.fill === 'empty') e.fill = rng.pick(['solid', 'striped']);
      (e as Record<string, unknown>)[attr] = values[0];
      if (attr === 'shape') e.shape = values[0] as Element['shape'];
      rules.push(
        type === 'alternate'
          ? { type: 'alternate', el: e.id, attr: attr as 'fill', values }
          : { type: 'cycle', el: e.id, attr: attr as 'fill', values },
      );
      break;
    }
  }
}

function placeFixed(rng: Rng, els: Element[], rules: Rule[]) {
  const movers = new Set(rules.filter((r) => r.type === 'move').map((r) => r.el));
  const taken = new Set<number>();
  for (const e of els) if (movers.has(e.id)) taken.add(e.cell);
  for (const e of els) {
    if (movers.has(e.id)) continue;
    const free = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((c) => !taken.has(c));
    // Prefer the centre for a single fixed element when something moves around the edge.
    e.cell = free.includes(4) && rng.chance(0.6) ? 4 : rng.pick(free);
    taken.add(e.cell);
  }
}

// ------------------------------------------------------------- distractors
interface Cand {
  fig: Figure;
  rule: number;
  note: string;
}

const mod = (x: number, m: number) => ((x % m) + m) % m;

function withChange(f: Figure, id: string, patch: Partial<Element>): Figure {
  return { elements: f.elements.map((e) => (e.id === id ? { ...e, ...patch } : { ...e })) };
}

function candidates(base: Figure, rules: Rule[], expected: Figure, prev: Figure): Cand[] {
  const out: Cand[] = [];
  rules.forEach((r, ri) => {
    const e = expected.elements.find((x) => x.id === r.el)!;
    const L = e.label;
    const add = (patch: Partial<Element>, note: string) => out.push({ fig: withChange(expected, r.el, patch), rule: ri, note });
    switch (r.type) {
      case 'rotate': {
        const dir = r.step > 0 ? 'clockwise' : 'anticlockwise';
        add({ rotation: mod(e.rotation - r.step, 360) }, `The ${L} has not rotated since figure 5; it should turn ${Math.abs(r.step)}° ${dir} again.`);
        add({ rotation: mod(e.rotation + r.step, 360) }, `The ${L} has rotated two steps instead of one.`);
        add({ rotation: mod(e.rotation - 2 * r.step, 360) }, `The ${L} has turned the wrong way (it rotates ${dir}).`);
        add({ rotation: mod(e.rotation + 180, 360) }, `The ${L} points in the opposite direction.`);
        break;
      }
      case 'move': {
        const path = PATH_CELLS[r.path];
        const i = path.indexOf(e.cell);
        add({ cell: path[mod(i - r.step, path.length)] }, `The ${L} has stayed where it was in figure 5.`);
        add({ cell: path[mod(i + r.step, path.length)] }, `The ${L} has moved one step too far.`);
        add({ cell: path[mod(i - 2 * r.step, path.length)] }, `The ${L} has moved in the wrong direction.`);
        add({ cell: path[mod(i + 1, path.length)] === e.cell ? path[mod(i + 2, path.length)] : path[mod(i + 1, path.length)] }, `The ${L} is in the wrong cell.`);
        break;
      }
      case 'count':
        for (const k of [-r.delta, r.delta, 2 * r.delta, -2 * r.delta]) {
          const c = e.count + k;
          if (c >= 1 && c <= 9) add({ count: c }, `There should be ${e.count} dot${e.count === 1 ? '' : 's'}, not ${c}.`);
        }
        break;
      case 'add_remove':
        for (const k of [-r.delta, r.delta]) {
          const c = e.count + k;
          if (c >= 0 && c <= 8) add({ count: c }, `There should be ${e.count} line${e.count === 1 ? '' : 's'}, not ${c}.`);
        }
        if (r.delta > 0 && e.count >= 2 && e.count <= 7)
          add({ rotation: mod(e.rotation - 45, 360) }, 'The new line has been added on the wrong (anticlockwise) side.');
        if (r.delta < 0 && e.count >= 1 && e.count <= 6)
          add({ rotation: mod(e.rotation + 45, 360) }, 'The wrong line has been removed (the first one instead of the most clockwise one).');
        break;
      case 'alternate':
      case 'cycle': {
        const cur = (e as Record<string, unknown>)[r.attr];
        const pool = r.attr === 'fill' ? FILLS : r.attr === 'size' ? [1, 2, 3] : r.attr === 'colour' ? ['black', 'grey'] : PLAIN;
        const order = [...r.values.filter((v) => v !== cur), ...pool.filter((v) => !r.values.includes(v))];
        for (const v of order) {
          const patch: Partial<Element> = { [r.attr]: v } as Partial<Element>;
          const what = r.type === 'alternate' ? 'alternates' : 'cycles';
          add(patch, `The ${L}'s ${r.attr} should be ${valueName(r.attr, cur)} (it ${what}), not ${valueName(r.attr, v)}.`);
        }
        break;
      }
      case 'static': {
        const governed = new Set(
          rules.filter((x) => x.type !== 'static' && x.el === r.el).map((x) => (x.type === 'rotate' ? 'rotation' : x.type === 'move' ? 'cell' : 'attr' in x ? x.attr : 'count')),
        );
        const k = kindOf(e);
        if (k === 'pips' || k === 'spokes') {
          if (!governed.has('count')) add({ count: e.count + 1 }, `The number of ${L} should not change.`);
          if (!governed.has('colour')) add({ colour: e.colour === 'black' ? 'grey' : 'black' }, `The ${L} should not change colour.`);
          break;
        }
        if (!governed.has('fill')) for (const f of FILLS) if (f !== e.fill) add({ fill: f }, `The ${L}'s fill has changed, but it never changes in the series.`);
        if (!governed.has('size')) add({ size: e.size === 3 ? 2 : 3 }, `The ${L}'s size has changed, but it never changes in the series.`);
        if (!governed.has('colour') && e.fill !== 'empty') add({ colour: e.colour === 'black' ? 'grey' : 'black' }, `The ${L}'s colour has changed, but it never changes in the series.`);
        if (!governed.has('rotation') && k === 'rotor') add({ rotation: mod(e.rotation + 90, 360) }, `The ${L} has been turned, but it never turns in the series.`);
        if (!governed.has('shape') && !governed.has('rotation')) {
          const pool = k === 'rotor' ? ROTORS : PLAIN;
          const other = pool.find((s) => s !== e.shape && !expected.elements.some((x) => x.shape === s));
          if (other) add({ shape: other as Element['shape'] }, `The ${L} has become a ${LABEL[other]}, but its shape never changes.`);
        }
        break;
      }
    }
  });
  void base;
  void prev;
  return out;
}

function chooseDistractors(rng: Rng, rules: Rule[], expected: Figure, cands: Cand[], d: number): Cand[] {
  const ok = (c: Cand) => {
    if (collisions(c.fig) || !c.fig.elements.every(validElement) || sameFigure(c.fig, expected)) return false;
    const b = brokenRules(rules, expected, c.fig);
    return b.length === 1 && b[0] === c.rule; // every distractor breaks exactly one rule
  };
  const byRule = new Map<number, Cand[]>();
  for (const c of cands.filter(ok)) byRule.set(c.rule, [...(byRule.get(c.rule) ?? []), c]);
  const active = rules.map((r, i) => (r.type === 'static' ? -1 : i)).filter((i) => i >= 0 && byRule.has(i));
  const statics = rules.map((r, i) => (r.type === 'static' ? i : -1)).filter((i) => i >= 0 && byRule.has(i));
  // Prefer statics of elements that have no active rule (a cleaner trap).
  const pureStatic = statics.filter((i) => !rules.some((r) => r.type !== 'static' && r.el === rules[i].el));
  const plan: number[] = [];
  if (d === 1) plan.push(active[0], active[0], active[0]);
  else if (d === 2) plan.push(...active, rng.pick(active));
  else plan.push(...active);
  plan.push(pureStatic.length ? rng.pick(pureStatic) : statics.length ? rng.pick(statics) : rng.pick(active));
  const chosen: Cand[] = [];
  const keys = new Set([visualKey(expected)]);
  const take = (ri: number) => {
    const list = byRule.get(ri) ?? [];
    for (const c of list) {
      const k = visualKey(c.fig);
      if (keys.has(k)) continue;
      keys.add(k);
      chosen.push(c);
      return true;
    }
    return false;
  };
  for (const ri of plan.slice(0, 4)) take(ri);
  const all = [...byRule.keys()];
  while (chosen.length < 4) {
    if (!all.some((ri) => take(ri))) break;
  }
  need(chosen.length === 4);
  return chosen;
}

// ------------------------------------------------------------- items
export interface AbstractSlot {
  id: string;
  difficulty: 1 | 2 | 3;
  types: RuleType[];
  mode: 'interactive' | 'reveal';
  letter?: string;
  seed: number;
}

const EST = { 1: 45, 2: 60, 3: 80 } as const;

export function tryBuild(slot: AbstractSlot, seed: number): AbstractItem {
  const rng = new Rng(seed);
  const d = slot.difficulty;
  const els: Element[] = [];
  const rules: Rule[] = [];
  const used = new Set<string>();
  for (const t of slot.types) attachRule(rng, t, d, els, rules, used);
  // Add a fixed element: always for easy items, sometimes for harder ones.
  if (d === 1 || (els.length < 3 && rng.chance(0.6))) els.push(newElement(rng, `e${els.length + 1}`, rng.pick(['plain', 'rotor'] as Kind[]), used));
  need(els.length <= 4 && new Set(els.map((e) => e.label)).size === els.length);
  placeFixed(rng, els, rules);
  for (const e of els) rules.push({ type: 'static', el: e.id });
  const base: Figure = { elements: els };
  const frames = [0, 1, 2, 3, 4, 5].map((t) => applyRules(base, rules, t));
  for (const f of frames) need(!collisions(f) && f.elements.every(validElement));
  // Every active rule must visibly change something between consecutive frames.
  for (let t = 1; t < 6; t++) need(!sameFigure(frames[t], frames[t - 1]));
  const series = frames.slice(0, 5);
  const answer = frames[5];
  const cands = candidates(base, rules, answer, frames[4]);
  const ds = chooseDistractors(rng, rules, answer, cands, d);
  const ruleText = rules.map((r) => describeRule(r, rules, base));
  const activeText = rules.map((r, i) => (r.type === 'static' && rules.some((x) => x.type !== 'static' && x.el === r.el) ? '' : ruleText[i])).filter(Boolean);
  const subtype = (d === 1 ? { rotate: 'rotation', move: 'movement', count: 'count', add_remove: 'add_remove', alternate: 'alternation', cycle: 'cycle' }[slot.types[0]] : d === 2 ? 'two_rules' : 'three_rules') as AbstractItem['subtype'];
  const common = {
    id: slot.id,
    category: 'abstract' as const,
    subtype,
    difficulty: d,
    seed,
    base,
    rules,
    series,
    answer,
    prompt: 'Which figure comes next in the series?',
    est_time_sec: EST[d],
  };
  if (slot.mode === 'reveal') {
    return {
      ...common,
      mode: 'reveal',
      task: 'Before looking at any options, write down every rule that governs this series (what changes, how, and what stays the same). Then reveal the solution.',
      correct: activeText.join(' '),
      explanation: { steps: [...activeText, 'Applying every rule to figure 5 gives the figure shown as the answer.'], shortcut: 'Track one element at a time across all five figures before looking at the options.' },
      trap_tags: [],
    };
  }
  const order = rng.shuffle(ds);
  const li = 'ABCDE'.indexOf(slot.letter!);
  const options: NonNullable<AbstractItem['options']> = [];
  let k = 0;
  for (let i = 0; i < 5; i++) {
    const key = 'ABCDE'[i] as 'A';
    if (i === li) options.push({ key, figure: answer, note: 'Follows every rule.' });
    else {
      const c = order[k++];
      options.push({ key, figure: c.fig, breaks: c.rule, trap: TRAP_FOR_RULE[rules[c.rule].type] as 'breaks_static', note: c.note });
    }
  }
  return {
    ...common,
    mode: 'interactive',
    options,
    correct: slot.letter!,
    explanation: {
      steps: [...activeText, `Applying every rule to figure 5 gives option ${slot.letter}.`],
      shortcut: 'Pick one rule, eliminate every option that breaks it, then move to the next rule. Each wrong option breaks exactly one rule.',
    },
    trap_tags: [...new Set(ds.map((c) => TRAP_FOR_RULE[rules[c.rule].type]))] as AbstractItem['trap_tags'],
  };
}

export function buildAbstract(slot: AbstractSlot, seen: Set<string>): AbstractItem {
  for (let a = 0; a < 2000; a++) {
    const seed = slot.seed + a * 104729;
    try {
      const item = tryBuild(slot, seed);
      const key = item.series.map(visualKey).join('#');
      if (seen.has(key)) continue;
      seen.add(key);
      return item;
    } catch (e) {
      if (e instanceof Fail) continue;
      throw e;
    }
  }
  throw new Error(`could not build ${slot.id} (${slot.types.join('+')})`);
}
