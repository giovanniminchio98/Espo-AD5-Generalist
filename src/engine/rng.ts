// Seeded pseudo-random generator (mulberry32) so every generated bank is reproducible.
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
  /** Random multiple of `step` in [min, max]. */
  step(min: number, max: number, step: number): number {
    return this.int(Math.ceil(min / step), Math.floor(max / step)) * step;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  shuffle<T>(arr: readonly T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  sample<T>(arr: readonly T[], n: number): T[] {
    return this.shuffle(arr).slice(0, n);
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
}

/** Deterministic order of `n` letters so that each letter is used about equally often. */
export function balancedLetters(n: number, optionCount: number, seed: number): string[] {
  const letters = 'ABCDE'.slice(0, optionCount).split('');
  const out: string[] = [];
  const rng = new Rng(seed);
  while (out.length < n) out.push(...rng.shuffle(letters));
  return out.slice(0, n);
}
