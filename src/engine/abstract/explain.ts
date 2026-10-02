import type { Element, Figure, Rule } from '../../schema/item';
import { CELL_NAMES } from './model';

const ATTR_NAME: Record<string, string> = { fill: 'fill', colour: 'colour', size: 'size', shape: 'shape' };
const SIZE_NAME: Record<number, string> = { 1: 'small', 2: 'medium', 3: 'large' };
const PATH_DESC: Record<string, string> = {
  perimeter_cw: 'clockwise around the outer ring of cells',
  perimeter_ccw: 'anticlockwise around the outer ring of cells',
  reading: 'forward in reading order (left to right, row by row, wrapping back to the top left)',
  reading_reverse: 'backwards in reading order (right to left, row by row, wrapping round)',
  column: 'down the columns (top to bottom, then on to the next column, wrapping round)',
};

export function valueName(attr: string, v: unknown): string {
  if (attr === 'size') return SIZE_NAME[v as number];
  if (attr === 'fill') return v === 'empty' ? 'white (empty)' : String(v);
  if (attr === 'shape') return String(v) === 'lshape' ? 'L-shape' : String(v);
  return String(v);
}

function label(base: Figure, id: string): string {
  return base.elements.find((e) => e.id === id)?.label ?? id;
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function describeRule(rule: Rule, rules: Rule[], base: Figure): string {
  const L = label(base, rule.el);
  switch (rule.type) {
    case 'rotate':
      return `The ${L} rotates ${Math.abs(rule.step)}° ${rule.step > 0 ? 'clockwise' : 'anticlockwise'} at each step.`;
    case 'move':
      return `The ${L} moves ${plural(Math.abs(rule.step), 'cell')} ${PATH_DESC[rule.path]} at each step.`;
    case 'count':
      return `The number of dots ${rule.delta > 0 ? 'increases' : 'decreases'} by ${Math.abs(rule.delta)} at each step.`;
    case 'add_remove':
      return rule.delta > 0
        ? 'One line is added to the star of lines at each step, always on the clockwise side.'
        : 'One line is removed from the star of lines at each step, always the most clockwise one.';
    case 'alternate':
      return `The ${L}'s ${ATTR_NAME[rule.attr]} alternates between ${valueName(rule.attr, rule.values[0])} and ${valueName(rule.attr, rule.values[1])}.`;
    case 'cycle':
      return `The ${L}'s ${ATTR_NAME[rule.attr]} cycles ${rule.values.map((v) => valueName(rule.attr, v)).join(' → ')}, then starts again.`;
    case 'static': {
      const active = rules.some((r) => r.type !== 'static' && r.el === rule.el);
      return active ? `Everything else about the ${L} stays the same.` : `The ${L} stays exactly the same in every figure.`;
    }
  }
}

/** Short annotation of what a rule looks like in figure t (shown under each figure on the solution screen). */
export function ruleHint(rule: Rule, fig: Figure, base: Figure): string | null {
  const e = fig.elements.find((x) => x.id === rule.el) as Element | undefined;
  if (!e) return null;
  const L = label(base, rule.el);
  switch (rule.type) {
    case 'rotate':
      return `${L} ${e.rotation}°`;
    case 'move':
      return `${L}: ${CELL_NAMES[e.cell]}`;
    case 'count':
      return plural(e.count, 'dot');
    case 'add_remove':
      return plural(e.count, 'line');
    case 'alternate':
    case 'cycle':
      return `${L} ${ATTR_NAME[rule.attr]}: ${valueName(rule.attr, (e as Record<string, unknown>)[rule.attr])}`;
    default:
      return null;
  }
}

export const TRAP_FOR_RULE: Record<Rule['type'], string> = {
  rotate: 'breaks_rotation',
  move: 'breaks_movement',
  count: 'breaks_count',
  add_remove: 'breaks_add_remove',
  alternate: 'breaks_alternation',
  cycle: 'breaks_cycle',
  static: 'breaks_static',
};
