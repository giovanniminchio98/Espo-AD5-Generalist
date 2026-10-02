// Number formatting shared by the generators, the validator and the UI (English conventions).

export function round(x: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round((x + Number.EPSILON * Math.sign(x)) * f) / f;
}

export function num(x: number, dp = 0): string {
  return round(x, dp).toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

export function pct(x: number, dp = 1): string {
  return `${num(x, dp)}%`;
}

export function signedPct(x: number, dp = 1): string {
  const s = num(Math.abs(x), dp);
  return `${x < 0 ? '−' : '+'}${s}%`;
}

export function money(x: number, unit: string, dp = 0, suffix = ''): string {
  const s = num(x, dp);
  return unit.length === 1 ? `${unit}${s}${suffix}` : `${s}${suffix} ${unit}`;
}

export function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

export function normaliseSpace(s: string): string {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Natural formatting: as many decimals as the number has (up to 6). */
export function nat(x: number): string {
  return x.toLocaleString('en-GB', { maximumFractionDigits: 6 });
}

/** Adds "the" to country names that take it in English. */
export function the(country: string): string {
  return ['Netherlands', 'Czech Republic'].includes(country) ? `the ${country}` : country;
}
