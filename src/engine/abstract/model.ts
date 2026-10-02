import type { Element, Figure, Rule } from '../../schema/item';

// 3×3 grid, cells numbered 0–8 in reading order.
export const PATH_CELLS: Record<string, number[]> = {
  perimeter_cw: [0, 1, 2, 5, 8, 7, 6, 3],
  perimeter_ccw: [0, 3, 6, 7, 8, 5, 2, 1],
  reading: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  reading_reverse: [8, 7, 6, 5, 4, 3, 2, 1, 0],
  column: [0, 3, 6, 1, 4, 7, 2, 5, 8],
};

export const CELL_NAMES = ['top left', 'top centre', 'top right', 'middle left', 'centre', 'middle right', 'bottom left', 'bottom centre', 'bottom right'];

/** Rotation period of each shape: rotating by a multiple of it changes nothing visible. 0 = rotation never matters. */
export const SYMMETRY: Record<Element['shape'], number> = {
  circle: 0, square: 90, triangle: 120, hexagon: 60, cross: 90,
  arrow: 360, lshape: 360, wedge: 360, pips: 0, spokes: 360,
};

const mod = (x: number, m: number) => ((x % m) + m) % m;

export function applyRules(base: Figure, rules: Rule[], t: number): Figure {
  const els = base.elements.map((e) => ({ ...e }));
  const byId = (id: string) => {
    const e = els.find((x) => x.id === id);
    if (!e) throw new Error(`rule refers to unknown element ${id}`);
    return e;
  };
  for (const r of rules) {
    if (r.type === 'static') continue;
    const e = byId(r.el);
    const b = base.elements.find((x) => x.id === r.el)!;
    switch (r.type) {
      case 'rotate':
        e.rotation = mod(b.rotation + r.step * t, 360);
        break;
      case 'move': {
        const path = PATH_CELLS[r.path];
        const i = path.indexOf(b.cell);
        if (i < 0) throw new Error(`cell ${b.cell} not on path ${r.path}`);
        e.cell = path[mod(i + r.step * t, path.length)];
        break;
      }
      case 'count':
      case 'add_remove':
        e.count = b.count + r.delta * t;
        break;
      case 'alternate':
      case 'cycle':
        (e as Record<string, unknown>)[r.attr] = r.values[t % r.values.length];
        break;
    }
  }
  return { elements: els };
}

/** Attributes of an element that are actually visible (so two figures can be compared by appearance). */
export function visualAttrs(e: Element): Record<string, unknown> {
  const out: Record<string, unknown> = { cell: e.cell, shape: e.shape, colour: e.colour };
  if (e.shape === 'pips') {
    out.count = e.count;
    return out;
  }
  if (e.shape === 'spokes') {
    out.dirs = Array.from({ length: e.count }, (_, k) => mod(e.rotation + 45 * k, 360)).sort((a, b) => a - b).join(',');
    return out;
  }
  const p = SYMMETRY[e.shape];
  out.rotation = p === 0 ? 0 : mod(e.rotation, p);
  out.fill = e.fill;
  out.size = e.size;
  if (e.fill === 'empty') delete out.colour;
  return out;
}

export function visualKey(f: Figure): string {
  return f.elements
    .map((e) => JSON.stringify(visualAttrs(e)))
    .sort()
    .join('|');
}

export function sameFigure(a: Figure, b: Figure): boolean {
  return visualKey(a) === visualKey(b);
}

/** Which rule governs a given (element, attribute) pair. Every pair maps to exactly one rule. */
export function governingRule(rules: Rule[], el: string, attr: string): number {
  const active = rules.findIndex((r) => {
    if (r.type === 'static' || r.el !== el) return false;
    switch (r.type) {
      case 'rotate':
        return attr === 'rotation';
      case 'move':
        return attr === 'cell';
      case 'count':
        return attr === 'count';
      case 'add_remove':
        return attr === 'count' || attr === 'dirs';
      default:
        return r.attr === attr;
    }
  });
  if (active >= 0) return active;
  const st = rules.findIndex((r) => r.type === 'static' && r.el === el);
  if (st < 0) throw new Error(`no rule governs ${el}.${attr}`);
  return st;
}

/** Indices of the rules an option breaks, judged against the expected next figure. */
export function brokenRules(rules: Rule[], expected: Figure, option: Figure): number[] {
  const broken = new Set<number>();
  for (const e of expected.elements) {
    const o = option.elements.find((x) => x.id === e.id);
    if (!o) {
      broken.add(governingRule(rules, e.id, 'count'));
      continue;
    }
    const va = visualAttrs(e);
    const vb = visualAttrs(o);
    for (const k of new Set([...Object.keys(va), ...Object.keys(vb)])) {
      // Colour is invisible on an empty shape, so a fill change to or from empty is a fill difference only.
      if (k === 'colour' && (e.fill === 'empty' || o.fill === 'empty') && e.shape !== 'pips' && e.shape !== 'spokes') continue;
      if (JSON.stringify(va[k]) !== JSON.stringify(vb[k])) {
        // A spoke figure's directions depend on both count and start angle: blame the add/remove rule if any.
        broken.add(governingRule(rules, e.id, k === 'dirs' ? 'dirs' : k));
      }
    }
  }
  if (option.elements.some((o) => !expected.elements.find((e) => e.id === o.id))) broken.add(-1);
  return [...broken].sort((a, b) => a - b);
}

export function collisions(f: Figure): boolean {
  const cells = f.elements.map((e) => e.cell);
  return new Set(cells).size !== cells.length;
}

export function validElement(e: Element): boolean {
  if (e.shape === 'pips') return e.count >= 1 && e.count <= 9;
  if (e.shape === 'spokes') return e.count >= 0 && e.count <= 8;
  return true;
}
