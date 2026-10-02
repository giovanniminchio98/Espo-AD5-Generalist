import type { DataSource } from '../../schema/item';
import { nat, num, the } from '../../lib/format';
import type { Rng } from '../rng';
import {
  type Built, type Distractor, type Fmt, type Params, type Recipe, type Value,
  cell, fact, fmtValue, need, neighbour, pickCountries, r0, r1, r2, ratioText, series, sig2,
} from './common';

const P = (params: Params, k: string) => params[k] as never;

// ---------------------------------------------------------------- percentage change
const PC_CONTEXTS = [
  { metric: 'Renewable electricity generation', unit: 'TWh', min: 20, max: 180, dp: 1 },
  { metric: 'Machinery exports to non-EU countries', unit: '€ million', min: 800, max: 9000, dp: 0 },
  { metric: 'Rail freight transported', unit: 'million tonnes', min: 15, max: 120, dp: 1 },
  { metric: 'Overnight stays by foreign tourists', unit: 'thousand', min: 2000, max: 40000, dp: 0 },
  { metric: 'Patent applications filed', unit: 'applications', min: 900, max: 12000, dp: 0 },
];

function growTable(rng: Rng, rows: string[], years: string[], min: number, max: number, dp: number) {
  return rows.map((name) => {
    let v = rng.next() * (max - min) + min;
    const vals = years.map((_, i) => {
      if (i > 0) v = v * (1 + (rng.next() * 0.42 - 0.16));
      return dp ? r1(v) : r0(v);
    });
    return [name, ...vals];
  });
}

const pctChange: Recipe = {
  name: 'pct_change',
  subtype: 'percentage_change',
  build(rng, d) {
    const ctx = rng.pick(PC_CONTEXTS);
    const start = rng.int(2019, 2021);
    const years = [0, 1, 2, 3].map((i) => String(start + i));
    const countries = pickCountries(rng, 5);
    const rows = growTable(rng, countries, years, ctx.min, ctx.max, ctx.dp);
    const source: DataSource = {
      kind: 'table',
      caption: `${ctx.metric}, ${years[0]}–${years[3]} (${ctx.unit}; fictional figures)`,
      columns: ['Country', ...years],
      rows,
      dp: [0, ...years.map(() => ctx.dp)],
    };
    let from: string, to: string;
    if (d === 1) {
      const i = rng.int(0, 2);
      [from, to] = [years[i], years[i + 1]];
    } else {
      [from, to] = rng.pick([[years[0], years[2]], [years[1], years[3]], [years[0], years[3]]]);
    }
    const chosen = d === 3 ? rng.sample(countries, 2).sort() : [rng.pick(countries)];
    const fmt: Fmt = { t: 'spct', dp: 1 };
    const params = { rows: chosen, from, to, fmt };
    const sum = (col: string, rs = chosen) => rs.reduce((s, c) => s + cell(source, c, col), 0);
    const a = sum(from);
    const b = sum(to);
    const ans = ((b - a) / a) * 100;
    need(Math.abs(ans) >= 3);
    const ds: Distractor[] = [
      { value: ((b - a) / b) * 100, trap: 'wrong_base', note: `Divides the change by the ${to} value instead of the ${from} value.` },
      { value: -ans, trap: 'reversed_operation', note: 'Subtracts in the wrong order, so the sign of the change is reversed.' },
    ];
    const otherYear = years.find((y) => y !== from && y !== to)!;
    const o = sum(otherYear);
    ds.push({ value: ((o - a) / a) * 100, trap: 'wrong_period', note: `Uses ${otherYear} instead of ${to} as the end year.` });
    if (d === 3) {
      const pa = ((cell(source, chosen[0], to) - cell(source, chosen[0], from)) / cell(source, chosen[0], from)) * 100;
      const pb = ((cell(source, chosen[1], to) - cell(source, chosen[1], from)) / cell(source, chosen[1], from)) * 100;
      ds.push({ value: pa + pb, trap: 'added_percentages', note: 'Adds the two countries’ percentage changes instead of using their combined totals.' });
      ds.push({ value: (pa + pb) / 2, trap: 'added_percentages', note: 'Averages the two percentage changes; the countries have different sizes, so a simple average is wrong.' });
      ds.push({ value: pa, trap: 'misread_row', note: `Uses ${chosen[0]} only instead of the two countries combined.` });
    } else {
      const nb = neighbour(countries, chosen[0]);
      const na = cell(source, nb, from);
      ds.push({ value: ((cell(source, nb, to) - na) / na) * 100, trap: 'misread_row', note: `Reads the ${nb} row instead of ${chosen[0]}.` });
    }
    const f = (x: number) => num(x, ctx.dp);
    return {
      source,
      params,
      prompt:
        d === 3
          ? `By what percentage did the combined ${ctx.metric.toLowerCase()} of ${chosen[0]} and ${chosen[1]} change between ${from} and ${to}?`
          : `By what percentage did ${ctx.metric.toLowerCase()} in ${the(chosen[0])} change between ${from} and ${to}?`,
      answer: ans,
      distractors: ds,
      steps: [
        d === 3
          ? `Add the two countries: ${from}: ${chosen.map((c) => f(cell(source, c, from))).join(' + ')} = ${f(a)}; ${to}: ${chosen.map((c) => f(cell(source, c, to))).join(' + ')} = ${f(b)}.`
          : `Read ${chosen[0]}: ${from} = ${f(a)}, ${to} = ${f(b)}.`,
        `Change = ${f(b)} − ${f(a)} = ${f(b - a)}.`,
        `Percentage change = ${f(b - a)} ÷ ${f(a)} × 100 = ${fmtValue(ans, fmt)}.`,
      ],
      shortcut: `Divide new by old: ${f(b)} ÷ ${f(a)} = ${num(b / a, 3)}; subtract 1 and read it as a percentage (${fmtValue(ans, fmt)}).`,
      setup: `(${f(b)} − ${f(a)}) ÷ ${f(a)} × 100`,
      estimate: `${num(sig2(b), 0)} ÷ ${num(sig2(a), 0)} ≈ ${num(sig2(b) / sig2(a), 2)}, so roughly ${num((sig2(b) / sig2(a) - 1) * 100, 0)}%.`,
    };
  },
  solve(src, p) {
    const rows = P(p, 'rows') as string[];
    const a = rows.reduce((s, c) => s + cell(src, c, P(p, 'from')), 0);
    const b = rows.reduce((s, c) => s + cell(src, c, P(p, 'to')), 0);
    return ((b - a) / a) * 100;
  },
};

// ---------------------------------------------------------------- percentage share
const SHARE_CONTEXTS = [
  {
    caption: 'Programme allocations', unit: '€ million', label: 'Programme', min: 120, max: 2400,
    rows: ['Research and innovation', 'Regional cohesion', 'Agriculture', 'Digital transition', 'Climate action', 'Administration', 'Neighbourhood policy'],
  },
  {
    caption: 'Exports by destination market', unit: '€ billion', label: 'Destination', min: 4, max: 95,
    rows: ['North America', 'East Asia', 'United Kingdom', 'Switzerland', 'Middle East', 'Latin America', 'Africa'],
  },
  {
    caption: 'Household energy use by source', unit: 'PJ', label: 'Source', min: 30, max: 900,
    rows: ['Natural gas', 'Electricity', 'Oil products', 'Biomass', 'District heating', 'Solar thermal'],
  },
];

const pctShare: Recipe = {
  name: 'pct_share',
  subtype: 'percentage_share',
  build(rng, d) {
    const ctx = rng.pick(SHARE_CONTEXTS);
    const y = rng.int(2021, 2024);
    const years = [String(y - 1), String(y)];
    const names = rng.sample(ctx.rows, rng.int(5, 6));
    const dp = ctx.unit === '€ billion' ? 1 : 0;
    const rows: (string | number)[][] = names.map((n) => {
      const v = rng.next() * (ctx.max - ctx.min) + ctx.min;
      const w = v * (1 + rng.next() * 0.3 - 0.12);
      return [n, dp ? r1(v) : r0(v), dp ? r1(w) : r0(w)];
    });
    const totals = [1, 2].map((ci) => rows.reduce((s, r) => s + (r[ci] as number), 0));
    if (d === 1) rows.push(['Total', dp ? r1(totals[0]) : totals[0], dp ? r1(totals[1]) : totals[1]]);
    const source: DataSource = {
      kind: 'table',
      caption: `${ctx.caption}, ${years[0]} and ${years[1]} (${ctx.unit}; fictional figures)`,
      columns: [ctx.label, ...years],
      rows,
      dp: [0, dp, dp],
    };
    const target = rng.pick(names);
    const col = d === 3 ? 'both' : rng.pick(years);
    const fmt: Fmt = { t: 'pct', dp: 1 };
    const params = { row: target, rows: names, col, fmt };
    const ans = pctShare.solve(source, params) as number;
    need(ans >= 4 && ans <= 60);
    const val = (r: string, c: string) => cell(source, r, c);
    const tot = (c: string) => names.reduce((s, n) => s + val(n, c), 0);
    const ds: Distractor[] = [];
    const f = (x: number) => num(x, dp);
    let steps: string[];
    let setup: string;
    if (d === 3) {
      const [c0, c1] = years;
      const s0 = (val(target, c0) / tot(c0)) * 100;
      const s1 = (val(target, c1) / tot(c1)) * 100;
      ds.push({ value: (s0 + s1) / 2, trap: 'added_percentages', note: 'Averages the two yearly shares; the totals differ, so the shares cannot simply be averaged.' });
      ds.push({ value: s1, trap: 'wrong_period', note: `Uses ${c1} only instead of both years combined.` });
      ds.push({ value: s0, trap: 'wrong_period', note: `Uses ${c0} only instead of both years combined.` });
      const x = val(target, c0) + val(target, c1);
      ds.push({ value: (x / (tot(c0) + tot(c1) - x)) * 100, trap: 'wrong_base', note: 'Compares with all the other rows instead of with the grand total.' });
      const nb = neighbour(names, target);
      ds.push({ value: ((val(nb, c0) + val(nb, c1)) / (tot(c0) + tot(c1))) * 100, trap: 'misread_row', note: `Reads the ${nb} row.` });
      steps = [
        `${target}, both years: ${f(val(target, c0))} + ${f(val(target, c1))} = ${f(x)}.`,
        `Grand total, both years: ${f(tot(c0))} + ${f(tot(c1))} = ${f(tot(c0) + tot(c1))}.`,
        `Share = ${f(x)} ÷ ${f(tot(c0) + tot(c1))} × 100 = ${fmtValue(ans, fmt)}.`,
      ];
      setup = `(${f(val(target, c0))} + ${f(val(target, c1))}) ÷ (${f(tot(c0))} + ${f(tot(c1))}) × 100`;
    } else {
      const other = years.find((c) => c !== col)!;
      const T = tot(col);
      const x = val(target, col);
      ds.push({ value: (x / (T - x)) * 100, trap: 'wrong_base', note: 'Divides by the sum of the other rows instead of by the total.' });
      ds.push({ value: (val(target, other) / tot(other)) * 100, trap: 'wrong_period', note: `Uses the ${other} column instead of ${col}.` });
      const nb = neighbour(names, target);
      ds.push({ value: (val(nb, col) / T) * 100, trap: 'misread_row', note: `Reads the ${nb} row.` });
      ds.push({ value: (x / tot(other)) * 100, trap: 'wrong_base', note: `Divides by the ${other} total instead of the ${col} total.` });
      const biggest = names.filter((n) => n !== target).sort((p, q) => val(q, col) - val(p, col))[0];
      ds.push({ value: (x / (T - val(biggest, col))) * 100, trap: 'misread_row', note: `Leaves ${biggest} out when adding up the total.` });
      steps = [
        d === 1
          ? `Read the ${col} values: ${target} = ${f(x)}, Total = ${f(T)}.`
          : `Add up the ${col} column to get the total: ${f(T)}. ${target} = ${f(x)}.`,
        `Share = ${f(x)} ÷ ${f(T)} × 100 = ${fmtValue(ans, fmt)}.`,
      ];
      setup = `${f(x)} ÷ ${d === 1 ? f(T) : `(${names.map((n) => f(val(n, col))).join(' + ')})`} × 100`;
    }
    return {
      source,
      params,
      prompt:
        d === 3
          ? `Taking ${years[0]} and ${years[1]} together, what percentage of the total did ${target} account for?`
          : `What percentage of the ${col} total did ${target} account for?`,
      answer: ans,
      distractors: ds,
      steps,
      shortcut: 'A share is always part ÷ whole. Check the size first: if the part is about a fifth of the total, the answer must be near 20%.',
      setup,
      estimate: `Round both figures to two significant figures and divide; the result is close to ${num(ans, 0)}%.`,
    };
  },
  solve(src, p) {
    const names = P(p, 'rows') as string[];
    const row = P(p, 'row') as string;
    const col = P(p, 'col') as string;
    const cols = col === 'both' ? (src.kind === 'table' ? src.columns.slice(1) : []) : [col];
    const x = cols.reduce((s, c) => s + cell(src, row, c), 0);
    const t = cols.reduce((s, c) => s + names.reduce((a, n) => a + cell(src, n, c), 0), 0);
    return (x / t) * 100;
  },
};

// ---------------------------------------------------------------- ratio
const RATIO_CONTEXTS = [
  { caption: 'Electricity generation by source', unit: 'GWh', label: 'Country', cols: ['Wind', 'Solar', 'Hydro', 'Biomass'], kMin: 40, kMax: 400, rowKind: 'country' },
  { caption: 'Staff by category', unit: 'staff', label: 'Directorate', cols: ['Administrators', 'Assistants', 'Contract staff', 'Trainees'], kMin: 4, kMax: 30, rowKind: 'dg' },
  { caption: 'Applications received by programme strand', unit: 'applications', label: 'Region', cols: ['Mobility', 'Partnerships', 'Innovation', 'Networks'], kMin: 12, kMax: 90, rowKind: 'region' },
];
const DIRECTORATES = ['Directorate A', 'Directorate B', 'Directorate C', 'Directorate D', 'Directorate E', 'Directorate F'];
const REGIONS = ['North', 'South', 'East', 'West', 'Centre', 'Islands'];

const ratio: Recipe = {
  name: 'ratio',
  subtype: 'ratio',
  build(rng, d) {
    const ctx = rng.pick(RATIO_CONTEXTS);
    const names = ctx.rowKind === 'country' ? pickCountries(rng, 4) : rng.sample(ctx.rowKind === 'dg' ? DIRECTORATES : REGIONS, 4).sort();
    const rows = names.map((n) => {
      const k = rng.int(ctx.kMin, ctx.kMax);
      return [n, ...ctx.cols.map(() => rng.int(1, 9) * k)];
    });
    const source: DataSource = {
      kind: 'table',
      caption: `${ctx.caption} (${ctx.unit}; fictional figures)`,
      columns: [ctx.label, ...ctx.cols],
      rows,
      dp: [0, 0, 0, 0, 0],
    };
    const [A, B, C] = rng.sample(ctx.cols, 3);
    const row = rng.pick(names);
    const fmt: Fmt = { t: 'text' };
    const v = (r: string, c: string) => cell(source, r, c);
    let params: Params & { fmt: Fmt };
    let prompt: string;
    const ds: Distractor[] = [];
    let steps: string[];
    let setup: string;
    if (d === 1) {
      params = { rows: [row], num: [A], den: [B], fmt };
      prompt = `In ${row}, what was the ratio of ${A.toLowerCase()} to ${B.toLowerCase()}?`;
      ds.push({ value: ratioText(v(row, B), v(row, A)), trap: 'reversed_operation', note: `Gives ${B.toLowerCase()} to ${A.toLowerCase()}: the ratio is the wrong way round.` });
      ds.push({ value: ratioText(v(row, A), v(row, C)), trap: 'misread_row', note: `Reads the ${C} column instead of ${B}.` });
      ds.push({ value: ratioText(v(row, A), v(row, A) + v(row, B)), trap: 'wrong_base', note: `Compares ${A.toLowerCase()} with the sum of both columns (part to whole).` });
      const nb = neighbour(names, row);
      ds.push({ value: ratioText(v(nb, A), v(nb, B)), trap: 'misread_row', note: `Reads the ${nb} row.` });
      ds.push({ value: ratioText(v(row, C), v(row, B)), trap: 'misread_row', note: `Reads the ${C} column instead of ${A}.` });
      steps = [
        `Read ${row}: ${A} = ${num(v(row, A))}, ${B} = ${num(v(row, B))}.`,
        `Divide both by their highest common factor (${num(gcdOf(v(row, A), v(row, B)))}): ${ratioText(v(row, A), v(row, B))}.`,
      ];
      setup = `${num(v(row, A))} : ${num(v(row, B))}, then simplify`;
    } else if (d === 2) {
      params = { rows: [row], num: [A, B], den: [C], fmt };
      prompt = `In ${row}, what was the ratio of ${A.toLowerCase()} and ${B.toLowerCase()} combined to ${C.toLowerCase()}?`;
      const n = v(row, A) + v(row, B);
      ds.push({ value: ratioText(v(row, C), n), trap: 'reversed_operation', note: 'The ratio is the wrong way round.' });
      ds.push({ value: ratioText(v(row, A), v(row, C)), trap: 'misread_row', note: `Uses ${A.toLowerCase()} only and forgets to add ${B.toLowerCase()}.` });
      ds.push({ value: ratioText(n, n + v(row, C)), trap: 'wrong_base', note: 'Compares the combined figure with the total of all three columns.' });
      const nb = neighbour(names, row);
      ds.push({ value: ratioText(v(nb, A) + v(nb, B), v(nb, C)), trap: 'misread_row', note: `Reads the ${nb} row.` });
      ds.push({ value: ratioText(v(row, B), v(row, C)), trap: 'misread_row', note: `Uses ${B.toLowerCase()} only and forgets to add ${A.toLowerCase()}.` });
      steps = [
        `${A} + ${B} in ${row}: ${num(v(row, A))} + ${num(v(row, B))} = ${num(n)}.`,
        `Ratio to ${C} (${num(v(row, C))}): ${num(n)} : ${num(v(row, C))}, which simplifies to ${ratioText(n, v(row, C))}.`,
      ];
      setup = `(${num(v(row, A))} + ${num(v(row, B))}) : ${num(v(row, C))}, then simplify`;
    } else {
      const [r1n, r2n] = rng.sample(names, 2).sort();
      params = { rows: [r1n, r2n], num: [A], den: [B], fmt };
      prompt = `Taking ${r1n} and ${r2n} together, what was the ratio of ${A.toLowerCase()} to ${B.toLowerCase()}?`;
      const n = v(r1n, A) + v(r2n, A);
      const m = v(r1n, B) + v(r2n, B);
      ds.push({ value: ratioText(m, n), trap: 'reversed_operation', note: 'The ratio is the wrong way round.' });
      ds.push({ value: ratioText(v(r1n, A), v(r1n, B)), trap: 'misread_row', note: `Uses ${r1n} only.` });
      ds.push({ value: ratioText(v(r2n, A), v(r2n, B)), trap: 'misread_row', note: `Uses ${r2n} only.` });
      ds.push({
        value: ratioText(v(r1n, A) * v(r2n, B) + v(r2n, A) * v(r1n, B), 2 * v(r1n, B) * v(r2n, B)),
        trap: 'added_percentages',
        note: 'Averages the two separate ratios instead of combining the underlying figures.',
      });
      ds.push({ value: ratioText(n, n + m), trap: 'wrong_base', note: `Compares ${A.toLowerCase()} with the total of both columns.` });
      steps = [
        `${A}: ${num(v(r1n, A))} + ${num(v(r2n, A))} = ${num(n)}. ${B}: ${num(v(r1n, B))} + ${num(v(r2n, B))} = ${num(m)}.`,
        `Ratio ${num(n)} : ${num(m)} simplifies to ${ratioText(n, m)}.`,
      ];
      setup = `(${num(v(r1n, A))} + ${num(v(r2n, A))}) : (${num(v(r1n, B))} + ${num(v(r2n, B))}), then simplify`;
    }
    const ans = ratio.solve(source, params) as string;
    const [x, y] = ans.split(' : ').map(Number);
    need(x !== y && x <= 60 && y <= 60);
    return {
      source,
      params,
      prompt,
      answer: ans,
      distractors: ds,
      steps,
      shortcut: 'Check the options before simplifying: the right one must give the same value when you divide its two numbers as when you divide the two figures from the table.',
      setup,
      estimate: `Divide the first figure by the second; ${ans} gives ${num(x / y, 2)}.`,
    };
  },
  solve(src, p) {
    const rows = P(p, 'rows') as string[];
    const sum = (cols: string[]) => rows.reduce((s, r) => s + cols.reduce((a, c) => a + cell(src, r, c), 0), 0);
    return ratioText(sum(P(p, 'num')), sum(P(p, 'den')));
  },
};
function gcdOf(a: number, b: number) {
  while (b) [a, b] = [b, a % b];
  return a;
}

// ---------------------------------------------------------------- average
const AVG_CONTEXTS = [
  { metric: 'Average household electricity price', unit: 'cents per kWh', min: 14, max: 38, dp: 1 },
  { metric: 'New business registrations', unit: 'thousand', min: 8, max: 95, dp: 1 },
  { metric: 'Public research grants awarded', unit: 'grants', min: 150, max: 1400, dp: 0 },
];

const average: Recipe = {
  name: 'average',
  subtype: 'average',
  build(rng, d) {
    if (d === 3) return weightedAverage(rng);
    const ctx = rng.pick(AVG_CONTEXTS);
    const start = rng.int(2018, 2020);
    const years = [0, 1, 2, 3, 4].map((i) => String(start + i));
    const countries = pickCountries(rng, 5);
    const rows = growTable(rng, countries, years, ctx.min, ctx.max, ctx.dp);
    const source: DataSource = {
      kind: 'table',
      caption: `${ctx.metric}, ${years[0]}–${years[4]} (${ctx.unit}; fictional figures)`,
      columns: ['Country', ...years],
      rows,
      dp: [0, ...years.map(() => ctx.dp)],
    };
    const fmt: Fmt = { t: 'num', dp: ctx.dp === 0 ? 1 : 2, unit: ctx.unit };
    const v = (r: string, c: string) => cell(source, r, c);
    const f = (x: number) => num(x, ctx.dp);
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const ds: Distractor[] = [];
    let params: Params & { fmt: Fmt };
    let prompt: string;
    let steps: string[];
    let setup: string;
    let ans: number;
    if (d === 1) {
      const col = rng.pick(years);
      params = { rows: countries, cols: [col], fmt };
      const xs = countries.map((c) => v(c, col));
      ans = mean(xs);
      prompt = `Across the five countries, what was the average value in ${col}?`;
      const other = neighbour(years, col);
      ds.push({ value: mean(countries.map((c) => v(c, other))), trap: 'wrong_period', note: `Averages the ${other} column instead of ${col}.` });
      ds.push({ value: xs.reduce((a, b) => a + b, 0) / 4, trap: 'wrong_base', note: 'Divides the total by 4 instead of 5.' });
      const sorted = [...xs].sort((a, b) => a - b);
      ds.push({ value: sorted[2], trap: 'wrong_base', note: 'Takes the middle value (median) instead of the mean.' });
      ds.push({ value: mean(sorted.slice(0, 4)), trap: 'misread_row', note: 'Leaves out the highest country.' });
      ds.push({ value: (sorted[0] + sorted[4]) / 2, trap: 'wrong_base', note: 'Averages only the highest and lowest values.' });
      steps = [`Add the ${col} column: ${xs.map(f).join(' + ')} = ${f(xs.reduce((a, b) => a + b, 0))}.`, `Divide by 5: ${fmtValue(ans, fmt)}.`];
      setup = `(${xs.map(f).join(' + ')}) ÷ 5`;
    } else {
      const row = rng.pick(countries);
      params = { rows: [row], cols: years, fmt };
      const xs = years.map((y) => v(row, y));
      ans = mean(xs);
      prompt = `What was the average annual value for ${the(row)} over the period ${years[0]}–${years[4]} (inclusive)?`;
      ds.push({ value: mean(xs.slice(1)), trap: 'wrong_period', note: `Leaves out ${years[0]} (counts ${years[1]}–${years[4]} only).` });
      ds.push({ value: (xs[0] + xs[4]) / 2, trap: 'wrong_period', note: 'Averages only the first and last year.' });
      ds.push({ value: xs.reduce((a, b) => a + b, 0) / 4, trap: 'wrong_base', note: 'Divides by 4 (the number of yearly steps) instead of 5 years.' });
      const nb = neighbour(countries, row);
      ds.push({ value: mean(years.map((y) => v(nb, y))), trap: 'misread_row', note: `Reads the ${nb} row.` });
      steps = [`Add the five values for ${row}: ${xs.map(f).join(' + ')} = ${f(xs.reduce((a, b) => a + b, 0))}.`, `Divide by 5 years: ${fmtValue(ans, fmt)}.`];
      setup = `(${xs.map(f).join(' + ')}) ÷ 5`;
    }
    return {
      source, params, prompt, answer: ans, distractors: ds, steps,
      shortcut: 'Pick a round baseline near the values, average the differences from it, then add the baseline back.',
      setup,
      estimate: `The values cluster around ${num(sig2(ans), 0)}, so the average is close to that.`,
    };
  },
  solve(src, p) {
    if (P(p, 'weighted')) {
      const rows = P(p, 'rows') as string[];
      const w = rows.reduce((s, r) => s + cell(src, r, P(p, 'weight')), 0);
      return rows.reduce((s, r) => s + cell(src, r, P(p, 'rate')) * cell(src, r, P(p, 'weight')), 0) / w;
    }
    const rows = P(p, 'rows') as string[];
    const cols = P(p, 'cols') as string[];
    const xs = rows.flatMap((r) => cols.map((c) => cell(src, r, c)));
    return xs.reduce((a, b) => a + b, 0) / xs.length;
  },
};

function weightedAverage(rng: Rng): Built {
  const ctx = rng.pick([
    { caption: 'Unemployment rate and labour force', rate: 'Unemployment rate (%)', weight: 'Labour force (million)', what: 'unemployment rate', wMin: 0.4, wMax: 22, rMin: 3, rMax: 14 },
    { caption: 'Broadband take-up and households', rate: 'Households with fibre (%)', weight: 'Households (million)', what: 'share of households with fibre', wMin: 0.3, wMax: 18, rMin: 18, rMax: 78 },
  ]);
  const countries = pickCountries(rng, 4);
  const rows = countries.map((c) => [c, r1(rng.next() * (ctx.rMax - ctx.rMin) + ctx.rMin), r1(rng.next() * (ctx.wMax - ctx.wMin) + ctx.wMin)]);
  const source: DataSource = { kind: 'table', caption: `${ctx.caption} (fictional figures)`, columns: ['Country', ctx.rate, ctx.weight], rows, dp: [0, 1, 1] };
  const fmt: Fmt = { t: 'pct', dp: 1 };
  const params = { weighted: true, rows: countries, rate: ctx.rate, weight: ctx.weight, fmt };
  const ans = average.solve(source, params) as number;
  const rt = (c: string) => cell(source, c, ctx.rate);
  const wt = (c: string) => cell(source, c, ctx.weight);
  const simple = countries.reduce((s, c) => s + rt(c), 0) / 4;
  need(Math.abs(simple - ans) / ans > 0.06);
  const W = countries.reduce((s, c) => s + wt(c), 0);
  const top = [...countries].sort((a, b) => wt(b) - wt(a))[0];
  const rest = countries.filter((c) => c !== top);
  return {
    source, params, answer: ans,
    prompt: `Taking the four countries together, what was the overall ${ctx.what}?`,
    distractors: [
      { value: simple, trap: 'wrong_base', note: 'Takes the simple average of the four rates, ignoring that the countries differ in size.' },
      { value: rest.reduce((s, c) => s + rt(c) * wt(c), 0) / rest.reduce((s, c) => s + wt(c), 0), trap: 'misread_row', note: `Leaves out ${top}, the largest country.` },
      { value: countries.reduce((s, c) => s + rt(c) * wt(c), 0) / 4, trap: 'wrong_base', note: 'Divides the weighted total by the number of countries instead of by the total size.' },
      { value: rt(top), trap: 'misread_row', note: `Gives the rate of ${top} only.` },
      { value: (Math.max(...countries.map(rt)) + Math.min(...countries.map(rt))) / 2, trap: 'rounding_trap', note: 'Averages only the highest and lowest rates.' },
    ],
    steps: [
      `Weight each rate by its country size: ${countries.map((c) => `${num(rt(c), 1)} × ${num(wt(c), 1)}`).join(' + ')} = ${num(countries.reduce((s, c) => s + rt(c) * wt(c), 0), 2)}.`,
      `Total weight: ${countries.map((c) => num(wt(c), 1)).join(' + ')} = ${num(W, 1)}.`,
      `Overall rate = ${num(countries.reduce((s, c) => s + rt(c) * wt(c), 0), 2)} ÷ ${num(W, 1)} = ${fmtValue(ans, fmt)}.`,
    ],
    shortcut: `The overall rate must lie closest to the rate of the largest country (${top}, ${num(rt(top), 1)}%). The simple average (${num(simple, 1)}%) is a trap.`,
    setup: `Σ(rate × size) ÷ Σ(size)`,
    estimate: `It is pulled towards ${top}'s ${num(rt(top), 1)}%; expect roughly ${num(ans, 0)}%.`,
  };
}

// ---------------------------------------------------------------- currency conversion
const CURRENCIES: [string, string, number][] = [
  ['Swedish krona', 'SEK', 11.3], ['Polish zloty', 'PLN', 4.31], ['Czech koruna', 'CZK', 24.8], ['Hungarian forint', 'HUF', 392],
  ['Danish krone', 'DKK', 7.46], ['Romanian leu', 'RON', 4.97], ['Norwegian krone', 'NOK', 11.6], ['Swiss franc', 'CHF', 0.942],
  ['US dollar', 'USD', 1.084], ['Pound sterling', 'GBP', 0.856], ['Japanese yen', 'JPY', 161.2], ['Icelandic krona', 'ISK', 149.5],
];

function sig4(x: number) {
  const p = 10 ** (Math.floor(Math.log10(x)) - 3);
  return Math.round(x / p) * p;
}

const currency: Recipe = {
  name: 'currency',
  subtype: 'currency_conversion',
  build(rng, d) {
    const cur = rng.sample(CURRENCIES, 5).sort((a, b) => a[1].localeCompare(b[1]));
    const rows = cur.map(([name, code, base]) => [`${name} (${code})`, Number(sig4(base * (1 + rng.next() * 0.1 - 0.05)).toPrecision(4))]);
    const source: DataSource = {
      kind: 'table',
      caption: 'Reference exchange rates on the day of payment (units of currency per €1; fictional rates)',
      columns: ['Currency', 'Units per €1'],
      rows,
    };
    const label = (i: number) => rows[i][0] as string;
    const code = (i: number) => cur[i][1];
    const rate = (i: number) => cell(source, label(i), 'Units per €1');
    const i = rng.int(0, 4);
    const ds: Distractor[] = [];
    const nbI = i > 0 ? i - 1 : i + 1;
    let params: Params & { fmt: Fmt };
    let prompt: string;
    let steps: string[];
    let setup: string;
    let est: string;
    let ans: number;
    if (d === 1) {
      const eur = rng.step(2000, 90000, 50);
      const fmt: Fmt = { t: 'num', dp: 0, unit: code(i) };
      params = { dir: 'from_eur', amount: eur, cur: label(i), fmt };
      ans = eur * rate(i);
      prompt = `A supplier is owed €${num(eur)}. How much is this in ${code(i)}?`;
      ds.push({ value: eur / rate(i), trap: 'reversed_operation', note: 'Divides by the rate instead of multiplying.' });
      ds.push({ value: eur * rate(nbI), trap: 'misread_row', note: `Uses the ${code(nbI)} rate.` });
      ds.push({ value: ans / 10, trap: 'unit_slip', note: 'Decimal point slipped by one place.' });
      ds.push({ value: ans * 10, trap: 'unit_slip', note: 'Decimal point slipped by one place.' });
      steps = [`1 euro buys ${nat(rate(i))} ${code(i)}, so multiply: ${num(eur)} × ${nat(rate(i))} = ${fmtValue(ans, fmt)}.`];
      setup = `${num(eur)} × ${nat(rate(i))}`;
      est = `${num(sig2(eur))} × ${num(sig2(rate(i)), 2)} ≈ ${num(sig2(eur) * sig2(rate(i)))}.`;
    } else if (d === 2) {
      const amt = rng.step(5000, 400000, 100) * (rate(i) > 50 ? 100 : 1);
      const fmt: Fmt = { t: 'num', dp: 0, prefix: '€' };
      params = { dir: 'to_eur', amount: amt, cur: label(i), fmt };
      ans = amt / rate(i);
      prompt = `A grant of ${num(amt)} ${code(i)} is paid to a project partner. What is it worth in euros?`;
      ds.push({ value: amt * rate(i), trap: 'reversed_operation', note: 'Multiplies by the rate instead of dividing.' });
      ds.push({ value: amt / rate(nbI), trap: 'misread_row', note: `Uses the ${code(nbI)} rate.` });
      ds.push({ value: amt / Math.max(1, Math.round(rate(i))), trap: 'rounding_trap', note: 'Rounds the exchange rate to a whole number before dividing.' });
      ds.push({ value: ans / 10, trap: 'unit_slip', note: 'Decimal point slipped by one place.' });
      steps = [`The rate is per euro, so divide: ${num(amt)} ÷ ${nat(rate(i))} = ${fmtValue(ans, fmt)}.`];
      setup = `${num(amt)} ÷ ${nat(rate(i))}`;
      est = `${num(sig2(amt))} ÷ ${num(sig2(rate(i)), 2)} ≈ ${num(sig2(amt) / sig2(rate(i)))}.`;
    } else {
      let j = rng.int(0, 4);
      if (j === i) j = (i + 2) % 5;
      const amt = rng.step(20000, 600000, 500) * (rate(i) > 50 ? 100 : 1);
      const fee = rng.pick([3.5, 4, 4.5, 5]);
      const fmt: Fmt = { t: 'num', dp: 0, unit: code(j) };
      params = { dir: 'cross', amount: amt, cur: label(i), to: label(j), fee, fmt };
      ans = (amt / rate(i)) * (1 - fee / 100) * rate(j);
      prompt = `A payment of ${num(amt)} ${code(i)} is converted into euros, a ${num(fee, 1)}% conversion fee is deducted from the euro amount, and the rest is converted into ${code(j)}. How many ${code(j)} are received?`;
      ds.push({ value: (amt / rate(i)) * rate(j), trap: 'wrong_base', note: 'Forgets to deduct the bank fee.' });
      ds.push({ value: (amt / rate(i)) * (1 + fee / 100) * rate(j), trap: 'reversed_operation', note: 'Adds the fee instead of deducting it.' });
      ds.push({ value: amt * rate(i) * (1 - fee / 100) / rate(j), trap: 'reversed_operation', note: 'Uses both rates the wrong way round.' });
      ds.push({ value: (amt / rate(i)) * (1 - fee / 100) * rate(j === 4 ? 3 : j + 1), trap: 'misread_row', note: 'Uses the wrong target-currency rate.' });
      const iNb = [0, 1, 2, 3, 4].find((x) => x !== i && x !== j)!;
      ds.push({ value: (amt / rate(iNb)) * (1 - fee / 100) * rate(j), trap: 'misread_row', note: `Uses the ${code(iNb)} rate for the original currency.` });
      steps = [
        `To euros: ${num(amt)} ÷ ${nat(rate(i))} = €${num(amt / rate(i), 2)}.`,
        `Deduct the ${num(fee, 1)}% fee: × ${num(1 - fee / 100, 3)} = €${num((amt / rate(i)) * (1 - fee / 100), 2)}.`,
        `To ${code(j)}: × ${nat(rate(j))} = ${fmtValue(ans, fmt)}.`,
      ];
      setup = `${num(amt)} ÷ ${nat(rate(i))} × ${num(1 - fee / 100, 3)} × ${nat(rate(j))}`;
      est = `Ignore the fee first: ${num(sig2(amt))} ÷ ${num(sig2(rate(i)), 2)} × ${num(sig2(rate(j)), 2)}, then take off about ${num(fee, 1)}%.`;
    }
    need(ans > 50);
    return {
      source, params, prompt, answer: ans, distractors: ds, steps,
      shortcut: 'Rates are quoted per €1: going INTO the foreign currency you multiply, coming BACK to euros you divide. Check the answer is the right size for the currency.',
      setup, estimate: est,
    };
  },
  solve(src, p) {
    const rate = (lbl: string) => cell(src, lbl, 'Units per €1');
    const amt = P(p, 'amount') as number;
    switch (P(p, 'dir') as string) {
      case 'from_eur':
        return amt * rate(P(p, 'cur'));
      case 'to_eur':
        return amt / rate(P(p, 'cur'));
      default:
        return (amt / rate(P(p, 'cur'))) * (1 - (P(p, 'fee') as number) / 100) * rate(P(p, 'to'));
    }
  },
};

// ---------------------------------------------------------------- multi-period growth
const GROWTH_CONTEXTS = [
  { subject: 'The operating budget of a regional development agency', unit: 'million', prefix: '€', min: 40, max: 900 },
  { subject: 'The number of passengers at a regional airport', unit: 'million passengers', prefix: '', min: 1.2, max: 30 },
  { subject: 'The number of registered electric vans in one member state', unit: 'thousand vans', prefix: '', min: 15, max: 420 },
];

const growth: Recipe = {
  name: 'growth',
  subtype: 'multi_period_growth',
  build(rng, d) {
    const ctx = rng.pick(GROWTH_CONTEXTS);
    const y0 = rng.int(2019, 2021);
    const n = d === 1 ? 2 : 3;
    const rates = Array.from({ length: n }, (_, k) => (d >= 2 && k === n - 1 ? -1 : 1) * rng.int(3, 18));
    const base = r1(rng.next() * (ctx.max - ctx.min) + ctx.min);
    const facts: Record<string, number> = { base, year0: y0 };
    rates.forEach((g, k) => (facts[`g${k + 1}`] = g));
    const unitText = (x: number) => `${ctx.prefix}${num(x, 1)} ${ctx.unit}`;
    const changes = rates.map((g, k) => `${g >= 0 ? 'rose' : 'fell'} by ${Math.abs(g)}% in ${y0 + k + 1}`);
    const chain = rates.reduce((m, g) => m * (1 + g / 100), 1);
    const fmt: Fmt = { t: 'num', dp: 1, prefix: ctx.prefix, unit: ctx.unit };
    const last = y0 + n;
    let body: string;
    let prompt: string;
    let ans: number;
    const ds: Distractor[] = [];
    const sumRates = rates.reduce((a, b) => a + b, 0);
    if (d < 3) {
      body = `${ctx.subject} was ${unitText(base)} in ${y0}. It ${changes.slice(0, -1).join(', ')}${n > 2 ? ',' : ''} and ${changes[n - 1]}.`;
      prompt = `What was the figure at the end of ${last}?`;
      ans = base * chain;
      ds.push({ value: base * (1 + sumRates / 100), trap: 'added_percentages', note: `Adds the percentages (${sumRates}%) instead of applying them one after another.` });
      ds.push({ value: base * rates.slice(0, -1).reduce((m, g) => m * (1 + g / 100), 1), trap: 'wrong_period', note: `Stops at ${last - 1} and leaves out the last change.` });
      ds.push({ value: base * rates.reduce((m, g) => m * (1 + Math.abs(g) / 100), 1), trap: 'reversed_operation', note: 'Treats every change as an increase.' });
      ds.push({ value: base * chain - base, trap: 'wrong_base', note: 'Gives the change in value rather than the final value.' });
      const [g1, g2] = rates;
      if (n === 2) {
        ds.push({ value: base * (1 + g1 / 100) * (1 - g2 / 100), trap: 'reversed_operation', note: `Treats the ${y0 + 2} rise as a fall.` });
        ds.push({ value: base * (1 + g2 / 100), trap: 'wrong_period', note: `Applies only the ${y0 + 2} change.` });
      } else {
        ds.push({ value: base * (1 + g1 / 100) * (1 + rates[2] / 100), trap: 'wrong_period', note: `Skips the ${y0 + 2} change.` });
        ds.push({ value: base * (1 + g2 / 100) * (1 + rates[2] / 100), trap: 'wrong_period', note: `Skips the ${y0 + 1} change.` });
      }
    } else {
      const fin = r1(base * chain);
      facts.final = fin;
      delete facts.base;
      body = `${ctx.subject} ${changes.slice(0, -1).join(', ')} and ${changes[n - 1]}, reaching ${unitText(fin)} at the end of ${last}.`;
      prompt = `What was the figure in ${y0}, before these changes?`;
      ans = fin / chain;
      ds.push({ value: fin * (1 - sumRates / 100), trap: 'added_percentages', note: 'Subtracts the summed percentages from the final value; percentages of the final value are not percentages of the start.' });
      ds.push({ value: fin * rates.reduce((m, g) => m * (1 - g / 100), 1), trap: 'wrong_base', note: 'Reverses each change by applying the opposite percentage, which uses the wrong base.' });
      ds.push({ value: fin / rates.slice(1).reduce((m, g) => m * (1 + g / 100), 1), trap: 'wrong_period', note: `Undoes only the last ${n - 1} changes.` });
      ds.push({ value: fin * chain, trap: 'reversed_operation', note: 'Applies the changes forwards again instead of undoing them.' });
    }
    const source: DataSource = { kind: 'text', caption: 'Fictional figures', body, facts };
    const params = { fmt, n };
    const mult = rates.map((g) => num(1 + g / 100, 2));
    return {
      source, params, prompt, answer: ans, distractors: ds,
      steps:
        d < 3
          ? [`Turn each change into a multiplier: ${mult.join(', ')}.`, `Apply them in turn: ${num(base, 1)} × ${mult.join(' × ')} = ${fmtValue(ans, fmt)}.`]
          : [`Turn each change into a multiplier: ${mult.join(', ')}; combined: ${num(chain, 4)}.`, `Undo them by dividing: ${num(facts.final, 1)} ÷ ${num(chain, 4)} = ${fmtValue(ans, fmt)}.`],
      shortcut: 'Successive percentage changes multiply, they never add. Combine the multipliers first, then do one multiplication or division.',
      setup: d < 3 ? `${num(base, 1)} × ${mult.join(' × ')}` : `${num(facts.final, 1)} ÷ (${mult.join(' × ')})`,
      estimate: `The net change is a little ${chain > 1 + sumRates / 100 ? 'above' : 'below'} ${sumRates}%, so the answer is close to ${num(sig2(ans), 1)}.`,
    };
  },
  solve(src, p) {
    const n = P(p, 'n') as number;
    const chain = Array.from({ length: n }, (_, k) => fact(src, `g${k + 1}`)).reduce((m, g) => m * (1 + g / 100), 1);
    return src.kind === 'text' && 'final' in src.facts ? fact(src, 'final') / chain : fact(src, 'base') * chain;
  },
};

// ---------------------------------------------------------------- chart reading
const CHART_CONTEXTS = [
  { title: 'Electric car registrations', unit: 'thousand', min: 20, max: 160, a: 'Member State A', b: 'Member State B' },
  { title: 'Wind power capacity installed', unit: 'GW', min: 8, max: 60, a: 'Onshore', b: 'Offshore' },
  { title: 'Visitors to EU-funded heritage sites', unit: 'thousand', min: 120, max: 900, a: 'Northern region', b: 'Southern region' },
  { title: 'Goods exported by rail', unit: 'million tonnes', min: 30, max: 140, a: 'Corridor 1', b: 'Corridor 2' },
];

function wiggle(rng: Rng, n: number, min: number, max: number) {
  let v = rng.next() * (max - min) * 0.5 + min;
  return Array.from({ length: n }, (_, i) => {
    if (i > 0) v = Math.max(min * 0.6, v * (1 + rng.next() * 0.5 - 0.18));
    return r0(v);
  });
}

function argmax(xs: number[]) {
  return xs.indexOf(Math.max(...xs));
}

const chart: Recipe = {
  name: 'chart',
  subtype: 'chart_reading',
  build(rng, d) {
    const ctx = rng.pick(CHART_CONTEXTS);
    const start = rng.int(2016, 2018);
    const cats = Array.from({ length: 7 }, (_, i) => String(start + i));
    const fmt: Fmt = { t: 'text' };
    const ds: Distractor[] = [];
    let source: DataSource;
    let params: Params & { fmt: Fmt };
    let prompt: string;
    let steps: string[];
    if (d === 2) {
      const A = wiggle(rng, 7, ctx.min, ctx.max);
      const B = wiggle(rng, 7, ctx.min, ctx.max);
      source = { kind: 'line', caption: `${ctx.title}, ${cats[0]}–${cats[6]} (${ctx.unit}; fictional figures)`, categories: cats, series: [{ name: ctx.a, values: A }, { name: ctx.b, values: B }], unit: ctx.unit };
      params = { q: 'max_gap', a: ctx.a, b: ctx.b, fmt };
      prompt = `In which year was the gap between ${ctx.a} and ${ctx.b} the largest?`;
      const gaps = A.map((x, i) => Math.abs(x - B[i]));
      const sorted = [...gaps].sort((x, y) => y - x);
      need(sorted[0] >= sorted[1] * 1.15 && sorted[0] - sorted[1] >= 3);
      const k = argmax(gaps);
      ds.push({ value: cats[argmax(A)], trap: 'misread_row', note: `The year when ${ctx.a} peaked, not when the gap was largest.` });
      ds.push({ value: cats[argmax(B)], trap: 'misread_row', note: `The year when ${ctx.b} peaked, not when the gap was largest.` });
      ds.push({ value: cats[gaps.indexOf(Math.min(...gaps))], trap: 'reversed_operation', note: 'The year with the smallest gap.' });
      ds.push({ value: cats[gaps.indexOf(sorted[1])], trap: 'rounding_trap', note: `The second-largest gap (${num(sorted[1])} vs ${num(sorted[0])}).` });
      ds.push({ value: cats[k > 0 ? k - 1 : k + 1], trap: 'wrong_period', note: 'Off by one year.' });
      steps = [
        `Gap each year: ${cats.map((c, i) => `${c}: ${num(gaps[i])}`).join('; ')}.`,
        `The largest is ${num(sorted[0])} in ${cats[k]}.`,
      ];
    } else {
      const V = wiggle(rng, 7, ctx.min, ctx.max);
      source = { kind: 'bar', caption: `${ctx.a}: ${ctx.title.toLowerCase()}, ${cats[0]}–${cats[6]} (${ctx.unit}; fictional figures)`, categories: cats, series: [{ name: ctx.a, values: V }], unit: ctx.unit };
      const inc = V.map((x, i) => (i === 0 ? -Infinity : x - V[i - 1]));
      const pinc = V.map((x, i) => (i === 0 ? -Infinity : (x - V[i - 1]) / V[i - 1]));
      const metric = d === 1 ? inc : pinc;
      const sorted = [...metric].sort((x, y) => y - x);
      need(sorted[0] > 0 && sorted[0] >= sorted[1] * 1.15);
      const k = argmax(metric);
      params = { q: d === 1 ? 'max_increase' : 'max_pct_increase', a: ctx.a, fmt };
      prompt = d === 1 ? 'In which year was the increase on the previous year the largest?' : 'In which year was the percentage increase on the previous year the largest?';
      if (d === 3) {
        need(argmax(inc) !== k);
        ds.push({ value: cats[argmax(inc)], trap: 'wrong_base', note: 'Largest increase in absolute terms, not in percentage terms.' });
      }
      ds.push({ value: cats[argmax(V)], trap: 'misread_row', note: 'The highest bar, not the largest increase.' });
      const dec = inc.map((x) => (x === -Infinity ? Infinity : x));
      ds.push({ value: cats[dec.indexOf(Math.min(...dec))], trap: 'reversed_operation', note: 'The year with the largest fall (or smallest change).' });
      ds.push({ value: cats[metric.indexOf(sorted[1])], trap: 'rounding_trap', note: 'The second-largest increase.' });
      ds.push({ value: cats[k > 1 ? k - 1 : k + 1], trap: 'wrong_period', note: 'Off by one year: the increase is credited to the year in which it ends.' });
      steps =
        d === 1
          ? [`Year-on-year change: ${cats.slice(1).map((c, i) => `${c}: ${inc[i + 1] >= 0 ? '+' : '−'}${num(Math.abs(inc[i + 1]))}`).join('; ')}.`, `The largest increase is ${num(sorted[0])} in ${cats[k]}.`]
          : [
              `Percentage change on the previous year: ${cats.slice(1).map((c, i) => `${c}: ${pinc[i + 1] < 0 ? '−' : ''}${num(Math.abs(pinc[i + 1]) * 100, 1)}%`).join('; ')}.`,
              `The largest is ${num(sorted[0] * 100, 1)}% in ${cats[k]}. A bigger absolute rise from a higher base can be a smaller percentage.`,
            ];
    }
    const ans = chart.solve(source, params) as string;
    return {
      source, params, prompt, answer: ans, distractors: ds, steps,
      shortcut: d === 3 ? 'For percentage growth, compare rise ÷ starting value; a rise from a low bar is worth more.' : 'Scan the labelled values pairwise; only the top two or three candidates need exact subtraction.',
      setup: d === 3 ? 'For each year: (value − previous value) ÷ previous value' : 'For each year: compute the difference, then pick the largest',
      estimate: `Eyeball the chart for the steepest step; here it is ${ans}.`,
    };
  },
  solve(src, p) {
    const cats = src.kind === 'bar' || src.kind === 'line' ? src.categories : [];
    const A = series(src, P(p, 'a'));
    switch (P(p, 'q') as string) {
      case 'max_gap': {
        const B = series(src, P(p, 'b'));
        return cats[argmax(A.map((x, i) => Math.abs(x - B[i])))];
      }
      case 'max_increase':
        return cats[argmax(A.map((x, i) => (i === 0 ? -Infinity : x - A[i - 1])))];
      default:
        return cats[argmax(A.map((x, i) => (i === 0 ? -Infinity : (x - A[i - 1]) / A[i - 1])))];
    }
  },
};

// ---------------------------------------------------------------- per capita
const PC_TABLES = [
  {
    caption: 'Output and population', total: 'GDP (€ billion)', pop: 'Population (million)', other: 'Land area (thousand km²)',
    what: 'GDP per person', fmt: { t: 'num', dp: 0, prefix: '€' } as Fmt, factor: 1000, tMin: 12, tMax: 900, pMin: 0.5, pMax: 25, oMin: 2, oMax: 300,
    unitStep: 'GDP is in € billion and population in millions, so € billion ÷ million = € thousand per person; multiply by 1,000.',
  },
  {
    caption: 'Municipal waste and population', total: 'Municipal waste (thousand tonnes)', pop: 'Population (million)', other: 'Households (million)',
    what: 'municipal waste per person (kg)', fmt: { t: 'num', dp: 0, unit: 'kg' } as Fmt, factor: 1, tMin: 150, tMax: 12000, pMin: 0.5, pMax: 25, oMin: 0.2, oMax: 11,
    unitStep: 'One thousand tonnes is one million kg, and population is in millions, so thousand tonnes ÷ million people = kg per person directly.',
  },
];

const perCapita: Recipe = {
  name: 'per_capita',
  subtype: 'per_capita',
  build(rng, d) {
    const ctx = rng.pick(PC_TABLES);
    const countries = pickCountries(rng, 5);
    const rows = countries.map((c) => {
      const pop = r1(rng.next() * (ctx.pMax - ctx.pMin) + ctx.pMin);
      const perHead = (ctx.tMax / ctx.pMax) * (0.4 + rng.next() * 1.2);
      const total = r1(pop * perHead * (0.7 + rng.next() * 0.6));
      const other = r1(Math.max(ctx.oMin, Math.min(ctx.oMax, pop * (0.3 + rng.next() * 0.6) * (ctx.other.startsWith('Land') ? 9 : 0.42))));
      return [c, total, pop, other];
    });
    const source: DataSource = { kind: 'table', caption: `${ctx.caption} (fictional figures)`, columns: ['Country', ctx.total, ctx.pop, ctx.other], rows, dp: [0, 1, 1, 1] };
    const v = (r: string, c: string) => cell(source, r, c);
    const pc = (r: string) => (v(r, ctx.total) / v(r, ctx.pop)) * ctx.factor;
    const ds: Distractor[] = [];
    let params: Params & { fmt: Fmt };
    let prompt: string;
    let steps: string[];
    let setup: string;
    if (d === 1) {
      const row = rng.pick(countries);
      params = { q: 'value', row, total: ctx.total, pop: ctx.pop, factor: ctx.factor, fmt: ctx.fmt };
      prompt = `What was the ${ctx.what} in ${the(row)}?`;
      const nb = neighbour(countries, row);
      ds.push({ value: pc(nb), trap: 'misread_row', note: `Reads the ${nb} row.` });
      ds.push({ value: (v(row, ctx.total) / v(row, ctx.other)) * ctx.factor, trap: 'misread_row', note: `Divides by ${ctx.other.toLowerCase()} instead of population.` });
      ds.push({ value: pc(row) * 10, trap: 'unit_slip', note: 'Unit slip: a factor of 10 too large.' });
      ds.push({ value: pc(row) / 10, trap: 'unit_slip', note: 'Unit slip: a factor of 10 too small.' });
      ds.push({ value: (v(row, ctx.total) / Math.round(v(row, ctx.pop))) * ctx.factor, trap: 'rounding_trap', note: 'Rounds the population to whole millions before dividing.' });
      steps = [`${ctx.unitStep}`, `${row}: ${num(v(row, ctx.total), 1)} ÷ ${num(v(row, ctx.pop), 1)}${ctx.factor === 1000 ? ' × 1,000' : ''} = ${fmtValue(pc(row), ctx.fmt)}.`];
      setup = `${num(v(row, ctx.total), 1)} ÷ ${num(v(row, ctx.pop), 1)}${ctx.factor === 1000 ? ' × 1,000' : ''}`;
    } else if (d === 2) {
      params = { q: 'max', total: ctx.total, pop: ctx.pop, factor: ctx.factor, fmt: { t: 'text' } };
      prompt = `Which country had the highest ${ctx.what}?`;
      const vals = countries.map(pc);
      const sorted = [...vals].sort((a, b) => b - a);
      need(sorted[0] >= sorted[1] * 1.06);
      const byTotal = [...countries].sort((a, b) => v(b, ctx.total) - v(a, ctx.total))[0];
      const best = countries[vals.indexOf(sorted[0])];
      need(byTotal !== best);
      ds.push({ value: byTotal, trap: 'wrong_base', note: 'Has the largest total, not the largest amount per person.' });
      ds.push({ value: countries[vals.indexOf(Math.min(...vals))], trap: 'reversed_operation', note: 'Has the lowest value per person.' });
      ds.push({ value: countries[vals.indexOf(sorted[1])], trap: 'rounding_trap', note: `Second highest (${fmtValue(sorted[1], ctx.fmt)} vs ${fmtValue(sorted[0], ctx.fmt)}).` });
      for (const c of countries) ds.push({ value: c, trap: 'misread_row', note: `${c}: ${fmtValue(pc(c), ctx.fmt)} per person.` });
      steps = [`Divide each total by its population: ${countries.map((c) => `${c} ${fmtValue(pc(c), ctx.fmt)}`).join('; ')}.`, `Highest: ${best}.`];
      setup = 'For each country: total ÷ population, then compare';
    } else {
      const [a, b] = rng.sample(countries, 2);
      const [hi, lo] = pc(a) > pc(b) ? [a, b] : [b, a];
      need(pc(hi) / pc(lo) > 1.08);
      params = { q: 'compare', hi, lo, total: ctx.total, pop: ctx.pop, factor: ctx.factor, fmt: { t: 'pct', dp: 1 } };
      prompt = `By what percentage was the ${ctx.what} in ${the(hi)} higher than in ${the(lo)}?`;
      ds.push({ value: ((pc(hi) - pc(lo)) / pc(hi)) * 100, trap: 'wrong_base', note: `Divides the difference by ${hi}'s value instead of ${lo}'s.` });
      ds.push({ value: Math.abs((v(hi, ctx.total) - v(lo, ctx.total)) / v(lo, ctx.total)) * 100, trap: 'misread_row', note: 'Compares the totals, not the per-person values.' });
      ds.push({ value: Math.abs((v(hi, ctx.pop) - v(lo, ctx.pop)) / v(lo, ctx.pop)) * 100, trap: 'misread_row', note: 'Compares the populations.' });
      ds.push({ value: (pc(hi) / pc(lo)) * 100, trap: 'unit_slip', note: 'Gives the ratio as a percentage (forgets to subtract 100%).' });
      steps = [
        `${hi}: ${fmtValue(pc(hi), ctx.fmt)} per person; ${lo}: ${fmtValue(pc(lo), ctx.fmt)} per person.`,
        `(${num(pc(hi), 1)} − ${num(pc(lo), 1)}) ÷ ${num(pc(lo), 1)} × 100 = ${num(((pc(hi) - pc(lo)) / pc(lo)) * 100, 1)}%.`,
      ];
      setup = `(${hi} per person ÷ ${lo} per person − 1) × 100`;
    }
    const ans = perCapita.solve(source, params);
    return {
      source, params, prompt, answer: ans, distractors: ds, steps,
      shortcut: 'Settle the units once (billion ÷ million = thousand) and compare per-person values only; totals and populations alone are traps.',
      setup,
      estimate: typeof ans === 'number' ? `Round the inputs to two significant figures; the answer is near ${num(sig2(ans))}.` : 'Rough per-person values are enough to rank the countries.',
    };
  },
  solve(src, p) {
    const pc = (r: string) => (cell(src, r, P(p, 'total')) / cell(src, r, P(p, 'pop'))) * (P(p, 'factor') as number);
    switch (P(p, 'q') as string) {
      case 'value':
        return pc(P(p, 'row'));
      case 'max': {
        const names = src.kind === 'table' ? src.rows.map((r) => r[0] as string) : [];
        return names.reduce((best, c) => (pc(c) > pc(best) ? c : best));
      }
      default:
        return ((pc(P(p, 'hi')) - pc(P(p, 'lo'))) / pc(P(p, 'lo'))) * 100;
    }
  },
};

// ---------------------------------------------------------------- combined units
const combined: Recipe = {
  name: 'combined',
  subtype: 'combined_units',
  build(rng, d) {
    return rng.chance(0.5) ? fleet(rng, d) : solar(rng, d);
  },
  solve(src, p) {
    const f = (k: string) => fact(src, k);
    switch (P(p, 'q') as string) {
      case 'bus_cost':
        return (f('km') * f('l100')) / 100 * f('diesel');
      case 'fleet_cost':
        return (f('buses') * f('km') * f('l100')) / 100 * f('diesel') / 1000;
      case 'fleet_change': {
        const before = (f('buses') * f('km') * f('l100')) / 100 * f('diesel');
        const after = (f('buses') * f('km') * f('l100') * (1 - f('saving') / 100)) / 100 * f('diesel2');
        return (after - before) / 1000;
      }
      case 'solar_mwh':
        return f('mw') * 8760 * (f('cf') / 100);
      case 'solar_revenue':
        return (f('mw') * 8760 * (f('cf') / 100) * f('price')) / 1e6;
      default:
        return Math.floor((f('mw') * 8760 * (f('cf') / 100) * 1000) / f('kwh_home'));
    }
  },
};

function fleet(rng: Rng, d: 1 | 2 | 3): Built {
  const facts = {
    buses: rng.int(18, 140),
    km: rng.step(42000, 88000, 500),
    l100: rng.int(24, 41),
    diesel: r2(1.35 + rng.next() * 0.45),
    petrol: r2(1.55 + rng.next() * 0.4),
    saving: rng.int(6, 18),
    diesel2: 0,
  };
  facts.diesel2 = r2(facts.diesel + 0.08 + rng.next() * 0.2);
  let body = `A municipal transport company runs ${facts.buses} diesel buses. Each bus covers ${num(facts.km)} km a year and uses on average ${facts.l100} litres of diesel per 100 km. Diesel costs €${num(facts.diesel, 2)} per litre; petrol costs €${num(facts.petrol, 2)} per litre.`;
  if (d === 3) body += ` A retrofit would cut fuel consumption by ${facts.saving}%, but the diesel price is expected to rise to €${num(facts.diesel2, 2)} per litre.`;
  const source: DataSource = { kind: 'text', caption: 'Fictional figures', body, facts };
  const litres1 = (facts.km * facts.l100) / 100;
  const ds: Distractor[] = [];
  let params: Params & { fmt: Fmt };
  let prompt: string;
  let steps: string[];
  let setup: string;
  if (d === 1) {
    params = { q: 'bus_cost', fmt: { t: 'num', dp: 0, prefix: '€' } };
    prompt = 'What is the annual fuel cost of one bus?';
    ds.push({ value: litres1 * facts.petrol, trap: 'misread_row', note: 'Uses the petrol price instead of diesel.' });
    ds.push({ value: (facts.km * facts.l100) / 10 * facts.diesel, trap: 'unit_slip', note: 'Divides by 10 instead of 100 (litres per 100 km).' });
    ds.push({ value: litres1, trap: 'unit_slip', note: 'Gives the litres used, not the cost.' });
    ds.push({ value: (facts.km / facts.l100) * facts.diesel, trap: 'reversed_operation', note: 'Divides distance by consumption instead of multiplying.' });
    steps = [`Litres a year: ${num(facts.km)} × ${facts.l100} ÷ 100 = ${num(litres1)} L.`, `Cost: ${num(litres1)} × €${num(facts.diesel, 2)} = €${num(litres1 * facts.diesel)}.`];
    setup = `${num(facts.km)} × ${facts.l100} ÷ 100 × ${num(facts.diesel, 2)}`;
  } else if (d === 2) {
    params = { q: 'fleet_cost', fmt: { t: 'num', dp: 1, prefix: '€', unit: 'thousand' } };
    prompt = 'What is the annual diesel bill for the whole fleet (in € thousand)?';
    const total = litres1 * facts.buses * facts.diesel;
    ds.push({ value: (litres1 * facts.buses * facts.petrol) / 1000, trap: 'misread_row', note: 'Uses the petrol price.' });
    ds.push({ value: total / 100, trap: 'unit_slip', note: 'Divides by 100 instead of 1,000 when converting to thousands (a factor of 10 too large).' });
    ds.push({ value: total / 10000, trap: 'unit_slip', note: 'Unit slip: a factor of 10 too small.' });
    ds.push({ value: (litres1 * facts.diesel) / 1000, trap: 'misread_row', note: 'Gives the cost of one bus only.' });
    steps = [
      `One bus: ${num(facts.km)} × ${facts.l100} ÷ 100 = ${num(litres1)} L a year.`,
      `Fleet: ${num(litres1)} × ${facts.buses} = ${num(litres1 * facts.buses)} L; × €${num(facts.diesel, 2)} = €${num(total)} = €${num(total / 1000, 1)} thousand.`,
    ];
    setup = `${facts.buses} × ${num(facts.km)} × ${facts.l100} ÷ 100 × ${num(facts.diesel, 2)} ÷ 1,000`;
  } else {
    params = { q: 'fleet_change', fmt: { t: 'num', dp: 1, prefix: '€', unit: 'thousand' } };
    prompt = 'By how much would the annual diesel bill for the whole fleet change (in € thousand) if both changes happen?';
    const before = litres1 * facts.buses * facts.diesel;
    const after = litres1 * facts.buses * (1 - facts.saving / 100) * facts.diesel2;
    const pChange = (facts.diesel2 - facts.diesel) / facts.diesel;
    ds.push({ value: (before * (pChange - facts.saving / 100)) / 1000, trap: 'added_percentages', note: 'Adds the percentage changes instead of multiplying the factors.' });
    ds.push({ value: (litres1 * facts.buses * (1 - facts.saving / 100) * facts.diesel - before) / 1000, trap: 'wrong_period', note: 'Ignores the price rise.' });
    ds.push({ value: (litres1 * facts.buses * facts.diesel2 - before) / 1000, trap: 'misread_row', note: 'Ignores the fuel saving.' });
    ds.push({ value: (after - before) / 100, trap: 'unit_slip', note: 'Unit slip: a factor of 10.' });
    ds.push({ value: (before - after) / 1000, trap: 'reversed_operation', note: 'Gets the direction of the change the wrong way round.' });
    steps = [
      `Current bill: ${facts.buses} × ${num(litres1)} L × €${num(facts.diesel, 2)} = €${num(before)}.`,
      `New bill: ${facts.buses} × ${num(litres1)} × ${num(1 - facts.saving / 100, 2)} × €${num(facts.diesel2, 2)} = €${num(after)}.`,
      `Change: €${num(after - before)} ≈ ${fmtValue((after - before) / 1000, params.fmt)}.`,
    ];
    setup = `${facts.buses} × ${num(litres1)} × (${num(1 - facts.saving / 100, 2)} × ${num(facts.diesel2, 2)} − ${num(facts.diesel, 2)}) ÷ 1,000`;
  }
  const ans = combined.solve(source, params) as number;
  need(Math.abs(ans) > 0.5);
  return {
    source, params, prompt, answer: ans, distractors: ds, steps,
    shortcut: 'Write the units next to each number (km × L/100 km × €/L = €) and cancel them; it shows at once where the ÷100 belongs.',
    setup,
    estimate: `Round each input to two significant figures and multiply; you land near ${fmtValue(sig2(ans), params.fmt)}.`,
  };
}

function solar(rng: Rng, d: 1 | 2 | 3): Built {
  const facts = { mw: rng.int(12, 240), cf: rng.int(11, 24), price: rng.int(38, 96), kwh_home: rng.step(2600, 4400, 100) };
  const body = `A solar park has an installed capacity of ${facts.mw} MW. Over a year (8,760 hours) it produces on average ${facts.cf}% of its maximum possible output. The electricity is sold at €${facts.price} per MWh. An average household uses ${num(facts.kwh_home)} kWh of electricity a year.`;
  const source: DataSource = { kind: 'text', caption: 'Fictional figures', body, facts };
  const mwh = facts.mw * 8760 * (facts.cf / 100);
  const ds: Distractor[] = [];
  let params: Params & { fmt: Fmt };
  let prompt: string;
  let steps: string[];
  let setup: string;
  if (d === 1) {
    params = { q: 'solar_mwh', fmt: { t: 'num', dp: 0, unit: 'MWh' } };
    prompt = 'How much electricity does the park produce in a year?';
    ds.push({ value: facts.mw * 8760, trap: 'wrong_base', note: 'Ignores the capacity factor (assumes full output all year).' });
    ds.push({ value: facts.mw * 365 * (facts.cf / 100), trap: 'unit_slip', note: 'Uses 365 days instead of 8,760 hours.' });
    ds.push({ value: mwh * 10, trap: 'unit_slip', note: 'Unit slip: a factor of 10.' });
    ds.push({ value: facts.mw * 8760 * (1 - facts.cf / 100), trap: 'reversed_operation', note: 'Uses the share of time NOT producing.' });
    steps = [`Maximum output: ${facts.mw} MW × 8,760 h = ${num(facts.mw * 8760)} MWh.`, `Actual: × ${facts.cf}% = ${num(mwh)} MWh.`];
    setup = `${facts.mw} × 8,760 × ${facts.cf / 100}`;
  } else if (d === 2) {
    params = { q: 'solar_revenue', fmt: { t: 'num', dp: 2, prefix: '€', unit: 'million' } };
    prompt = 'What is the park’s annual revenue from electricity sales (in € million)?';
    ds.push({ value: (facts.mw * 8760 * facts.price) / 1e6, trap: 'wrong_base', note: 'Ignores the capacity factor.' });
    ds.push({ value: (mwh * facts.price) / 1e5, trap: 'unit_slip', note: 'Unit slip: a factor of 10.' });
    ds.push({ value: (mwh * facts.price) / 1e7, trap: 'unit_slip', note: 'Unit slip: a factor of 10.' });
    ds.push({ value: (facts.mw * 365 * 24 * (1 - facts.cf / 100) * facts.price) / 1e6, trap: 'reversed_operation', note: 'Uses the share of time NOT producing.' });
    steps = [`Output: ${facts.mw} × 8,760 × ${facts.cf}% = ${num(mwh)} MWh.`, `Revenue: ${num(mwh)} × €${facts.price} = €${num(mwh * facts.price)} = €${num((mwh * facts.price) / 1e6, 2)} million.`];
    setup = `${facts.mw} × 8,760 × ${facts.cf / 100} × ${facts.price} ÷ 1,000,000`;
  } else {
    params = { q: 'solar_homes', fmt: { t: 'num', dp: 0, unit: 'households' } };
    prompt = 'How many average households could the park supply for a full year (whole households)?';
    const homes = Math.floor((mwh * 1000) / facts.kwh_home);
    ds.push({ value: Math.floor(mwh / facts.kwh_home), trap: 'unit_slip', note: 'Forgets to convert MWh to kWh (× 1,000).' });
    ds.push({ value: Math.floor((facts.mw * 8760 * 1000) / facts.kwh_home), trap: 'wrong_base', note: 'Ignores the capacity factor.' });
    ds.push({ value: homes * 10, trap: 'unit_slip', note: 'Unit slip: a factor of 10.' });
    ds.push({ value: Math.floor((facts.mw * 8760 * (1 - facts.cf / 100) * 1000) / facts.kwh_home), trap: 'reversed_operation', note: 'Uses the share of time NOT producing.' });
    steps = [`Output: ${facts.mw} × 8,760 × ${facts.cf}% = ${num(mwh)} MWh = ${num(mwh * 1000)} kWh.`, `Households: ${num(mwh * 1000)} ÷ ${num(facts.kwh_home)} = ${num((mwh * 1000) / facts.kwh_home, 1)}, so ${num(homes)} whole households.`];
    setup = `${facts.mw} × 8,760 × ${facts.cf / 100} × 1,000 ÷ ${num(facts.kwh_home)}`;
  }
  const ans = combined.solve(source, params) as number;
  return {
    source, params, prompt, answer: ans, distractors: ds, steps,
    shortcut: 'MW × hours = MWh. Apply the capacity factor once, and convert MWh to kWh (× 1,000) only when comparing with household use.',
    setup,
    estimate: `Round each input to two significant figures and multiply; you land near ${fmtValue(sig2(ans), params.fmt)}.`,
  };
}

// ---------------------------------------------------------------- survey percentages
const SURVEYS = [
  'I trust the information published by public authorities.',
  'Remote work should remain an option for public-sector staff.',
  'Public transport in my city meets my needs.',
  'Climate policy should be a priority for the next five years.',
  'I feel well informed about my rights as a consumer.',
];
const RESPONSES = ['Strongly agree', 'Agree', 'Neither agree nor disagree', 'Disagree', 'Strongly disagree'];

function splitHundred(rng: Rng): number[] {
  const w = RESPONSES.map(() => 0.4 + rng.next());
  const s = w.reduce((a, b) => a + b, 0);
  const p = w.map((x) => Math.max(4, Math.round((x / s) * 100)));
  p[2] += 100 - p.reduce((a, b) => a + b, 0);
  return p;
}

const survey: Recipe = {
  name: 'survey',
  subtype: 'survey_percentages',
  build(rng, d) {
    const statement = rng.pick(SURVEYS);
    const y = rng.int(2022, 2025);
    const years = [String(y - 1), String(y)];
    const a = splitHundred(rng);
    const b = splitHundred(rng);
    const n = [rng.step(1200, 4800, 100), rng.step(1200, 4800, 100)];
    need(n[0] !== n[1]);
    const rows: (string | number)[][] = RESPONSES.map((r, i) => [r, a[i], b[i]]);
    rows.push(['Number of respondents', n[0], n[1]]);
    const source: DataSource = {
      kind: 'table',
      caption: `Survey: “${statement}” (% of respondents; fictional figures)`,
      columns: ['Response', `${years[0]} (%)`, `${years[1]} (%)`],
      rows,
      dp: [0, 0, 0],
    };
    const col = (i: number) => `${years[i]} (%)`;
    const N = (i: number) => cell(source, 'Number of respondents', col(i));
    const p = (r: string, i: number) => cell(source, r, col(i));
    const ds: Distractor[] = [];
    let params: Params & { fmt: Fmt };
    let prompt: string;
    let steps: string[];
    let setup: string;
    if (d === 1) {
      const r = rng.pick(RESPONSES);
      const i = rng.int(0, 1);
      params = { q: 'count', rows: [r], year: i, fmt: { t: 'num', dp: 0, unit: 'respondents' } };
      prompt = `How many respondents answered “${r}” in ${years[i]}?`;
      const nb = neighbour(RESPONSES, r);
      ds.push({ value: (p(nb, i) * N(i)) / 100, trap: 'misread_row', note: `Reads the “${nb}” row.` });
      ds.push({ value: (p(r, 1 - i) * N(i)) / 100, trap: 'wrong_period', note: `Uses the ${years[1 - i]} percentage.` });
      ds.push({ value: (p(r, i) * N(1 - i)) / 100, trap: 'wrong_base', note: `Uses the ${years[1 - i]} number of respondents.` });
      ds.push({ value: (p(r, i) * N(i)) / 10, trap: 'unit_slip', note: 'Divides by 10 instead of 100.' });
      steps = [`${p(r, i)}% of ${num(N(i))} = ${p(r, i)} ÷ 100 × ${num(N(i))} = ${num((p(r, i) * N(i)) / 100)}.`];
      setup = `${p(r, i)} ÷ 100 × ${num(N(i))}`;
    } else if (d === 2) {
      const rs = rng.chance(0.5) ? RESPONSES.slice(0, 2) : RESPONSES.slice(3);
      const label = rs[0] === 'Strongly agree' ? 'agreed (strongly agree or agree)' : 'disagreed (disagree or strongly disagree)';
      params = { q: 'diff', rows: rs, fmt: { t: 'num', dp: 0, unit: 'respondents' } };
      const c = (i: number) => (rs.reduce((s, r) => s + p(r, i), 0) * N(i)) / 100;
      const ans = c(1) - c(0);
      need(Math.abs(ans) >= 20);
      prompt = `How many more (or fewer) respondents ${label} in ${years[1]} than in ${years[0]}? (A negative answer means fewer.)`;
      const P0 = rs.reduce((s, r) => s + p(r, 0), 0);
      const P1 = rs.reduce((s, r) => s + p(r, 1), 0);
      ds.push({ value: ((P1 - P0) * N(1)) / 100, trap: 'added_percentages', note: `Subtracts the percentages first and applies the difference to ${years[1]}'s sample only.` });
      ds.push({ value: ((P1 - P0) * N(0)) / 100, trap: 'added_percentages', note: `Subtracts the percentages first and applies the difference to ${years[0]}'s sample only.` });
      ds.push({ value: ((p(rs[1], 1) * N(1)) - (p(rs[1], 0) * N(0))) / 100, trap: 'misread_row', note: `Counts only “${rs[1]}”.` });
      ds.push({ value: c(0) - c(1), trap: 'reversed_operation', note: 'Subtracts in the wrong order.' });
      ds.push({ value: P1 - P0, trap: 'unit_slip', note: 'Gives the change in percentage points, not in respondents.' });
      steps = [
        `${years[0]}: ${P0}% of ${num(N(0))} = ${num(c(0))}.`,
        `${years[1]}: ${P1}% of ${num(N(1))} = ${num(c(1))}.`,
        `Difference: ${num(c(1))} − ${num(c(0))} = ${num(ans)}.`,
      ];
      setup = `${P1}% × ${num(N(1))} − ${P0}% × ${num(N(0))}`;
    } else {
      const r = rng.pick(RESPONSES);
      params = { q: 'pooled', rows: [r], fmt: { t: 'pct', dp: 1 } };
      prompt = `Taking both survey years together, what percentage of all respondents answered “${r}”?`;
      const pooled = ((p(r, 0) * N(0) + p(r, 1) * N(1)) / (N(0) + N(1)));
      const simple = (p(r, 0) + p(r, 1)) / 2;
      need(Math.abs(pooled - simple) >= 0.8);
      ds.push({ value: simple, trap: 'added_percentages', note: 'Averages the two percentages, ignoring the different sample sizes.' });
      ds.push({ value: p(r, 0) + p(r, 1), trap: 'added_percentages', note: 'Adds the two percentages.' });
      const nb = neighbour(RESPONSES, r);
      ds.push({ value: (p(nb, 0) * N(0) + p(nb, 1) * N(1)) / (N(0) + N(1)), trap: 'misread_row', note: `Reads the “${nb}” row.` });
      ds.push({ value: ((p(r, 0) * N(0) + p(r, 1) * N(1)) / N(1)), trap: 'wrong_base', note: `Divides by ${years[1]}'s respondents only.` });
      steps = [
        `Respondents answering “${r}”: ${p(r, 0)}% × ${num(N(0))} = ${num((p(r, 0) * N(0)) / 100)}; ${p(r, 1)}% × ${num(N(1))} = ${num((p(r, 1) * N(1)) / 100)}.`,
        `Total: ${num((p(r, 0) * N(0) + p(r, 1) * N(1)) / 100)} out of ${num(N(0) + N(1))} = ${num(pooled, 1)}%.`,
      ];
      setup = `(${p(r, 0)}% × ${num(N(0))} + ${p(r, 1)}% × ${num(N(1))}) ÷ (${num(N(0))} + ${num(N(1))})`;
    }
    return {
      source, params, prompt, answer: survey.solve(source, params), distractors: ds, steps,
      shortcut: 'Percentages from samples of different sizes cannot be added or averaged directly; convert to head counts first.',
      setup,
      estimate: 'Convert each percentage to a head count with round sample sizes (e.g. 2,000), then compare.',
    };
  },
  solve(src, p) {
    if (src.kind !== 'table') throw new Error('table expected');
    const cols = src.columns.slice(1);
    const N = (i: number) => cell(src, 'Number of respondents', cols[i]);
    const rows = P(p, 'rows') as string[];
    const share = (i: number) => rows.reduce((s, r) => s + cell(src, r, cols[i]), 0);
    switch (P(p, 'q') as string) {
      case 'count': {
        const i = P(p, 'year') as number;
        return (share(i) * N(i)) / 100;
      }
      case 'diff':
        return (share(1) * N(1) - share(0) * N(0)) / 100;
      default:
        return (share(0) * N(0) + share(1) * N(1)) / (N(0) + N(1));
    }
  },
};

export const RECIPES: Recipe[] = [pctChange, pctShare, ratio, average, currency, growth, chart, perCapita, combined, survey];
export const RECIPE_BY_NAME: Record<string, Recipe> = Object.fromEntries(RECIPES.map((r) => [r.name, r]));

export function formatAnswer(v: Value, params: Params): string {
  return fmtValue(v, params.fmt as Fmt);
}
