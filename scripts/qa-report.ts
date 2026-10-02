// Final QA pass: prints a report and writes docs/QA_REPORT.md.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SETTINGS } from '../config/settings.ts';
import type { Item } from '../src/schema/item.ts';
import { runChecks } from './checks.ts';

const { errors, warnings, items } = runChecks();
const cats = ['verbal', 'numerical', 'abstract'] as const;
const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(1)}%` : '—');
const count = <T extends string | number>(list: Item[], key: (i: Item) => T) => {
  const m = new Map<T, number>();
  for (const i of list) m.set(key(i), (m.get(key(i)) ?? 0) + 1);
  return m;
};

const lines: string[] = [];
const out = (s = '') => lines.push(s);
out('# QA report');
out();
out(`Generated ${new Date().toISOString().slice(0, 10)} by \`npm run qa\`.`);
out();
out('## Counts');
out();
out('| Category | Items | Target | Interactive | Reveal (self-assessed) |');
out('|---|---|---|---|---|');
for (const c of cats) {
  const l = items.filter((i) => i.category === c);
  const target = SETTINGS[`${c.toUpperCase()}_COUNT` as 'VERBAL_COUNT'];
  const r = l.filter((i) => i.mode === 'reveal').length;
  out(`| ${c} | ${l.length} | ${target} | ${l.length - r} | ${r} (${pct(r, l.length)}) |`);
}
out(`| **total** | **${items.length}** | | | |`);
out();
out('## Correct-answer letters (interactive items)');
out();
out('| Category | A | B | C | D | E | Allowed per letter |');
out('|---|---|---|---|---|---|---|');
for (const c of cats) {
  const l = items.filter((i) => i.category === c && i.mode === 'interactive');
  const m = count(l, (i) => i.correct);
  const n = c === 'verbal' ? 4 : 5;
  const [lo, hi] = SETTINGS.LETTER_BALANCE[n];
  out(`| ${c} | ${'ABCDE'.split('').map((L, k) => (k < n ? `${m.get(L) ?? 0} (${pct(m.get(L) ?? 0, l.length)})` : '—')).join(' | ')} | ${lo * 100}–${hi * 100}% |`);
}
out();
out('## Difficulty mix');
out();
out('| Category | Easy | Medium | Hard |');
out('|---|---|---|---|');
for (const c of cats) {
  const l = items.filter((i) => i.category === c);
  const m = count(l, (i) => i.difficulty);
  out(`| ${c} | ${[1, 2, 3].map((d) => `${m.get(d as 1) ?? 0} (${pct(m.get(d as 1) ?? 0, l.length)})`).join(' | ')} |`);
}
out(`| target | ${SETTINGS.DIFFICULTY_MIX[1] * 100}% | ${SETTINGS.DIFFICULTY_MIX[2] * 100}% | ${SETTINGS.DIFFICULTY_MIX[3] * 100}% |`);
out();
out('## Subtypes');
for (const c of cats) {
  out();
  out(`**${c}**: ` + [...count(items.filter((i) => i.category === c), (i) => i.subtype).entries()].map(([k, v]) => `${k} ${v}`).join(', '));
}
out();
out('## Trap tags used by distractors');
for (const c of cats) {
  const m = new Map<string, number>();
  for (const i of items.filter((x) => x.category === c)) for (const o of i.options ?? []) if (o.trap) m.set(o.trap, (m.get(o.trap) ?? 0) + 1);
  out();
  out(`**${c}**: ` + [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '));
}
const verbal = items.filter((i) => i.category === 'verbal');
const topics = count(verbal, (i) => (i.category === 'verbal' ? i.topic : ''));
out();
out(`**verbal topics**: ` + [...topics.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '));
out();
out('## Checks');
out();
out('- Schema validity (Zod) and structural rules for every item');
out('- Unique IDs; no near-duplicate passages (5-gram similarity ≤ 0.30); no duplicate figure series or numerical items');
out('- Item counts, letter balance, difficulty mix and reveal share against config/settings.ts');
out('- Numerical: every answer recomputed from the item’s own data; options at least 3% apart after rounding');
out('- Abstract: rule engine re-run; exactly one option fits; each distractor breaks exactly one rule');
out('- Verbal: 180–280 words per passage; every evidence quote appears verbatim in its passage');
out();
out(`**Failed checks: ${errors.length}**${warnings.length ? `, warnings: ${warnings.length}` : ''}`);
for (const e of errors) out(`- FAIL ${e}`);
for (const w of warnings) out(`- warn ${w}`);

const text = lines.join('\n') + '\n';
mkdirSync(join(import.meta.dirname, '..', 'docs'), { recursive: true });
writeFileSync(join(import.meta.dirname, '..', 'docs', 'QA_REPORT.md'), text);
console.log(text);
if (errors.length) process.exit(1);
