// Fills the derived fields of hand-written verbal items (category, trap_tags, polarity, timing)
// so authors only write the content. Safe to run repeatedly.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR } from './io.ts';

const EST = { 1: 90, 2: 105, 3: 120 } as Record<number, number>;
const ORDER = ['id', 'category', 'subtype', 'difficulty', 'mode', 'topic', 'passage', 'polarity', 'prompt', 'task', 'options', 'correct', 'evidence', 'explanation', 'trap_tags', 'est_time_sec'];
const dir = join(DATA_DIR, 'verbal');
const only = process.argv[2];
for (const f of readdirSync(dir).filter((x) => x.endsWith('.json') && (!only || x.includes(only)))) {
  const items = JSON.parse(readFileSync(join(dir, f), 'utf8')) as Record<string, unknown>[];
  const out = items.map((it) => {
    const opts = (it.options as { trap?: string }[] | undefined) ?? [];
    const filled: Record<string, unknown> = {
      ...it,
      category: 'verbal',
      polarity: it.polarity ?? (it.subtype === 'incorrect_statement' ? 'incorrect' : 'correct'),
      trap_tags: [...new Set(opts.map((o) => o.trap).filter(Boolean))],
      est_time_sec: it.mode === 'reveal' ? 150 : EST[it.difficulty as number],
    };
    if (it.mode === 'reveal' && !opts.length) delete filled.options;
    return Object.fromEntries(ORDER.filter((k) => k in filled).map((k) => [k, filled[k]]));
  });
  writeFileSync(join(dir, f), JSON.stringify(out, null, 1) + '\n');
  console.log(`${f}: ${out.length} items`);
}
