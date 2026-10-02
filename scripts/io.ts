import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Item } from '../src/schema/item.ts';

export const DATA_DIR = join(import.meta.dirname, '..', 'data');

export function writeBatches(category: string, items: unknown[], size = 25) {
  const dir = join(DATA_DIR, category);
  mkdirSync(dir, { recursive: true });
  for (const f of readdirSync(dir)) if (f.endsWith('.json')) rmSync(join(dir, f));
  for (let i = 0; i < items.length; i += size) {
    const n = String(i / size + 1).padStart(2, '0');
    writeFileSync(join(dir, `batch-${n}.json`), JSON.stringify(items.slice(i, i + size), null, 1) + '\n');
  }
}

export function readBank(category?: string): { file: string; items: Item[] }[] {
  const cats = category ? [category] : ['verbal', 'numerical', 'abstract'];
  const out: { file: string; items: Item[] }[] = [];
  for (const c of cats) {
    const dir = join(DATA_DIR, c);
    let files: string[] = [];
    try {
      files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
    } catch {
      continue;
    }
    for (const f of files) out.push({ file: `${c}/${f}`, items: JSON.parse(readFileSync(join(dir, f), 'utf8')) });
  }
  return out;
}
