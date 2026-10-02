import type { DataSource } from '../../schema/item';
import { num, pct, round, signedPct } from '../../lib/format';
import type { Rng } from '../rng';

export type NumTrap =
  | 'wrong_base'
  | 'added_percentages'
  | 'misread_row'
  | 'unit_slip'
  | 'rounding_trap'
  | 'wrong_period'
  | 'reversed_operation';

export type Value = number | string;
export type Params = Record<string, unknown>;

/** How an answer value is printed. Stored in recipe params so the validator formats identically. */
export type Fmt =
  | { t: 'spct'; dp: number }
  | { t: 'pct'; dp: number }
  | { t: 'num'; dp: number; prefix?: string; unit?: string }
  | { t: 'text' };

export function fmtValue(v: Value, f: Fmt): string {
  if (typeof v === 'string' || f.t === 'text') return String(v);
  switch (f.t) {
    case 'spct':
      return signedPct(v, f.dp);
    case 'pct':
      return pct(v, f.dp);
    case 'num': {
      const sign = v < 0 ? '−' : '';
      return `${sign}${f.prefix ?? ''}${num(Math.abs(v), f.dp)}${f.unit ? ' ' + f.unit : ''}`;
    }
  }
}

export interface Distractor {
  value: Value;
  trap: NumTrap;
  note: string;
}

export interface Built {
  source: DataSource;
  prompt: string;
  params: Params & { fmt: Fmt };
  answer: Value;
  distractors: Distractor[]; // candidates; the generator keeps 4 distinct ones
  steps: string[];
  shortcut: string;
  setup: string; // the calculation written out, for "set up before computing" reveal items
  estimate: string; // a quick mental estimate, for "estimate within 10%" reveal items
}

export interface Recipe {
  name: string;
  subtype:
    | 'percentage_change'
    | 'percentage_share'
    | 'ratio'
    | 'average'
    | 'currency_conversion'
    | 'multi_period_growth'
    | 'chart_reading'
    | 'per_capita'
    | 'combined_units'
    | 'survey_percentages';
  build(rng: Rng, d: 1 | 2 | 3): Built;
  /** Recompute the answer from the item's own data source. */
  solve(source: DataSource, params: Params): Value;
}

/** Thrown when random draws produce an unusable item; the generator retries with another seed. */
export class Retry extends Error {}
export function need(cond: boolean, why = 'retry'): asserts cond {
  if (!cond) throw new Retry(why);
}

export const COUNTRIES = [
  'Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czechia', 'Denmark', 'Estonia', 'Finland',
  'France', 'Germany', 'Greece', 'Hungary', 'Ireland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg',
  'Malta', 'Netherlands', 'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden',
];

export function pickCountries(rng: Rng, n: number): string[] {
  return rng.sample(COUNTRIES, n).sort();
}

export function cell(src: DataSource, row: string, col: string): number {
  if (src.kind !== 'table') throw new Error('cell() needs a table');
  const ci = src.columns.indexOf(col);
  const r = src.rows.find((x) => x[0] === row);
  if (ci < 0 || !r) throw new Error(`cell not found: ${row} / ${col}`);
  const v = r[ci];
  if (typeof v !== 'number') throw new Error(`cell is not numeric: ${row} / ${col}`);
  return v;
}

export function fact(src: DataSource, key: string): number {
  if (src.kind !== 'text') throw new Error('fact() needs a text source');
  const v = src.facts[key];
  if (typeof v !== 'number') throw new Error(`fact not found: ${key}`);
  return v;
}

export function series(src: DataSource, name: string): number[] {
  if (src.kind !== 'bar' && src.kind !== 'line') throw new Error('series() needs a chart');
  const s = src.series.find((x) => x.name === name);
  if (!s) throw new Error(`series not found: ${name}`);
  return s.values;
}

export const r1 = (x: number) => round(x, 1);
export const r2 = (x: number) => round(x, 2);
export const r0 = (x: number) => Math.round(x);

/** Neighbouring row (the one just above, or below for the first row). */
export function neighbour<T>(list: T[], item: T): T {
  const i = list.indexOf(item);
  return i > 0 ? list[i - 1] : list[i + 1];
}

export function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b) [a, b] = [b, a % b];
  return a;
}

export function ratioText(a: number, b: number): string {
  const g = gcd(a, b) || 1;
  return `${Math.round(a / g)} : ${Math.round(b / g)}`;
}

/** Two significant figures, for estimation hints. */
export function sig2(x: number): number {
  if (x === 0) return 0;
  const p = 10 ** (Math.floor(Math.log10(Math.abs(x))) - 1);
  return Math.round(x / p) * p;
}

/** Numeric value of a formatted option ("−€1,234.5 thousand" → -1234.5); NaN for text options. */
export function parseShown(text: string): number {
  const m = text.replace(/,/g, '').match(/(−|-)?[^0-9]*?([0-9]+(\.[0-9]+)?)/);
  if (!m || /[A-Za-z]{3,} ?:/.test(text) || / : /.test(text)) return NaN;
  if (/^[A-Za-z]/.test(text) && !/^[A-Z]{3} /.test(text)) return NaN;
  return (m[1] ? -1 : 1) * Number(m[2]);
}
