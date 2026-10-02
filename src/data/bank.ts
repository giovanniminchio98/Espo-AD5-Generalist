import { useEffect, useState } from 'react';
import { Item, structuralProblems } from '../schema/item';

// Every batch file under /data is bundled; each category is loaded on first use.
const files = import.meta.glob('/data/*/*.json', { import: 'default' }) as Record<string, () => Promise<unknown[]>>;

export interface Bank {
  items: Item[];
  byId: Map<string, Item>;
  invalid: number;
}

let cache: Promise<Bank> | null = null;

export function loadBank(): Promise<Bank> {
  if (!cache) {
    cache = Promise.all(Object.keys(files).sort().map((k) => files[k]())).then((batches) => {
      const items: Item[] = [];
      let invalid = 0;
      for (const raw of batches.flat()) {
        const r = Item.safeParse(raw);
        if (r.success && structuralProblems(r.data).length === 0) items.push(r.data);
        else {
          invalid++;
          console.warn('Skipping invalid item', (raw as { id?: string }).id, r.success ? structuralProblems(r.data) : r.error.issues);
        }
      }
      return { items, byId: new Map(items.map((i) => [i.id, i])), invalid };
    });
  }
  return cache;
}

export function useBank(): Bank | null {
  const [bank, setBank] = useState<Bank | null>(null);
  useEffect(() => {
    let live = true;
    loadBank().then((b) => live && setBank(b));
    return () => {
      live = false;
    };
  }, []);
  return bank;
}
