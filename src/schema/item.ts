import { z } from 'zod';

export const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;
export const Letter = z.enum(LETTERS);
export type Letter = z.infer<typeof Letter>;

export const VERBAL_TRAPS = [
  'outside_knowledge',
  'overgeneralisation',
  'wrong_quantifier',
  'causal_vs_correlation',
  'time_shift',
  'partially_true',
  'reversed_relation',
  'cannot_be_determined',
  'extreme_wording',
] as const;
export const NUMERICAL_TRAPS = [
  'wrong_base',
  'added_percentages',
  'misread_row',
  'unit_slip',
  'rounding_trap',
  'wrong_period',
  'reversed_operation',
] as const;
export const ABSTRACT_TRAPS = [
  'breaks_rotation',
  'breaks_movement',
  'breaks_count',
  'breaks_alternation',
  'breaks_add_remove',
  'breaks_cycle',
  'breaks_static',
] as const;
export const TrapTag = z.enum([...VERBAL_TRAPS, ...NUMERICAL_TRAPS, ...ABSTRACT_TRAPS]);
export type TrapTag = z.infer<typeof TrapTag>;

export const VERBAL_SUBTYPES = [
  'explicit_detail',
  'inference',
  'main_idea',
  'incorrect_statement',
  'summary',
  'explain_non_inference',
] as const;
export const NUMERICAL_SUBTYPES = [
  'percentage_change',
  'percentage_share',
  'ratio',
  'average',
  'currency_conversion',
  'multi_period_growth',
  'chart_reading',
  'per_capita',
  'combined_units',
  'survey_percentages',
] as const;
export const ABSTRACT_SUBTYPES = [
  'rotation',
  'movement',
  'count',
  'alternation',
  'add_remove',
  'cycle',
  'two_rules',
  'three_rules',
] as const;

const Explanation = z.object({
  steps: z.array(z.string().min(1)).min(1),
  shortcut: z.string().optional(),
});

const OptionBase = {
  key: Letter,
  trap: TrapTag.optional(), // set on every distractor
  note: z.string().min(1), // one line: why this option is right or wrong
};

const Common = {
  id: z.string().regex(/^(VR|NR|AR)-\d{3}$/),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  mode: z.enum(['interactive', 'reveal']),
  prompt: z.string().min(1),
  task: z.string().optional(), // reveal items: what to do before showing the solution
  correct: z.string().min(1), // a letter for interactive items, the model solution for reveal items
  explanation: Explanation,
  trap_tags: z.array(TrapTag),
  est_time_sec: z.number().int().positive(),
};

// ---------- Verbal ----------
export const VerbalOption = z.object({ ...OptionBase, text: z.string().min(1) });
export const VerbalItem = z.object({
  ...Common,
  category: z.literal('verbal'),
  subtype: z.enum(VERBAL_SUBTYPES),
  topic: z.string().min(1),
  passage: z.string().min(1),
  polarity: z.enum(['correct', 'incorrect']).optional(),
  evidence: z.array(z.string().min(1)).min(1),
  options: z.array(VerbalOption).optional(),
});
export type VerbalItem = z.infer<typeof VerbalItem>;

// ---------- Numerical ----------
const Cell = z.union([z.number(), z.string()]);
export const DataSource = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('table'),
    caption: z.string(),
    columns: z.array(z.string()).min(2),
    rows: z.array(z.array(Cell)).min(1),
    unit: z.string().optional(),
    note: z.string().optional(),
    dp: z.array(z.number().int()).optional(), // decimals per column
  }),
  z.object({
    kind: z.enum(['bar', 'line']),
    caption: z.string(),
    categories: z.array(z.string()).min(2),
    series: z.array(z.object({ name: z.string(), values: z.array(z.number()) })).min(1),
    unit: z.string(),
    dp: z.number().int().optional(),
  }),
  z.object({
    kind: z.literal('text'),
    caption: z.string(),
    body: z.string().min(1),
    facts: z.record(z.string(), z.number()),
  }),
]);
export type DataSource = z.infer<typeof DataSource>;

export const NumericalOption = z.object({ ...OptionBase, text: z.string().min(1) });
export const NumericalItem = z.object({
  ...Common,
  category: z.literal('numerical'),
  subtype: z.enum(NUMERICAL_SUBTYPES),
  source: DataSource,
  recipe: z.object({
    name: z.string(),
    seed: z.number().int(),
    params: z.record(z.string(), z.unknown()),
  }),
  answer_value: z.union([z.number(), z.string()]),
  answer_text: z.string(),
  options: z.array(NumericalOption).optional(),
});
export type NumericalItem = z.infer<typeof NumericalItem>;

// ---------- Abstract ----------
export const SHAPES = ['circle', 'square', 'triangle', 'arrow', 'lshape', 'wedge', 'pips', 'spokes', 'cross', 'hexagon'] as const;
export const FILLS = ['empty', 'solid', 'striped'] as const;
export const COLOURS = ['black', 'grey'] as const;
export const SIZES = [1, 2, 3] as const;

export const Element = z.object({
  id: z.string(),
  label: z.string(), // plain-language name used in explanations, e.g. "arrow", "dots"
  shape: z.enum(SHAPES),
  cell: z.number().int().min(0).max(8),
  rotation: z.number().int(),
  fill: z.enum(FILLS),
  colour: z.enum(COLOURS),
  size: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  count: z.number().int().min(0).max(9), // pips: dots shown; spokes: lines shown; otherwise 1
});
export type Element = z.infer<typeof Element>;
export const Figure = z.object({ elements: z.array(Element) });
export type Figure = z.infer<typeof Figure>;

export const PATHS = ['perimeter_cw', 'perimeter_ccw', 'reading', 'reading_reverse', 'column'] as const;
export const Rule = z.discriminatedUnion('type', [
  z.object({ type: z.literal('rotate'), el: z.string(), step: z.number().int() }),
  z.object({ type: z.literal('move'), el: z.string(), path: z.enum(PATHS), step: z.number().int() }),
  z.object({ type: z.literal('count'), el: z.string(), delta: z.number().int() }),
  z.object({ type: z.literal('add_remove'), el: z.string(), delta: z.number().int() }),
  z.object({
    type: z.literal('alternate'),
    el: z.string(),
    attr: z.enum(['fill', 'colour', 'size', 'shape']),
    values: z.array(z.union([z.string(), z.number()])).length(2),
  }),
  z.object({
    type: z.literal('cycle'),
    el: z.string(),
    attr: z.enum(['fill', 'colour', 'size', 'shape']),
    values: z.array(z.union([z.string(), z.number()])).min(3).max(4),
  }),
  z.object({ type: z.literal('static'), el: z.string() }),
]);
export type Rule = z.infer<typeof Rule>;

export const AbstractOption = z.object({
  ...OptionBase,
  figure: Figure,
  breaks: z.number().int().min(0).optional(), // index into rules for distractors
});
export const AbstractItem = z.object({
  ...Common,
  category: z.literal('abstract'),
  subtype: z.enum(ABSTRACT_SUBTYPES),
  seed: z.number().int(),
  base: Figure, // figure at t = 0, before any rule is applied
  rules: z.array(Rule).min(1),
  series: z.array(Figure).length(5),
  answer: Figure,
  options: z.array(AbstractOption).optional(),
});
export type AbstractItem = z.infer<typeof AbstractItem>;

export const Item = z.discriminatedUnion('category', [VerbalItem, NumericalItem, AbstractItem]);
export type Item = z.infer<typeof Item>;

export const Bank = z.array(Item);

// Structural checks shared by the app and the validator.
export function structuralProblems(item: Item): string[] {
  const p: string[] = [];
  const expectedOptions = item.category === 'verbal' ? 4 : 5;
  if (item.mode === 'interactive') {
    if (!item.options) p.push('interactive item without options');
    else {
      if (item.options.length !== expectedOptions) p.push(`expected ${expectedOptions} options, got ${item.options.length}`);
      const keys = item.options.map((o) => o.key).join('');
      if (keys !== LETTERS.slice(0, item.options.length).join('')) p.push(`option keys out of order: ${keys}`);
      if (!item.options.some((o) => o.key === item.correct)) p.push(`correct "${item.correct}" is not an option key`);
      for (const o of item.options) if (o.key !== item.correct && !o.trap) p.push(`distractor ${o.key} has no trap tag`);
      const tags = new Set(item.options.filter((o) => o.trap).map((o) => o.trap));
      for (const t of tags) if (!item.trap_tags.includes(t!)) p.push(`trap_tags missing ${t}`);
    }
  } else if (LETTERS.includes(item.correct as Letter)) {
    p.push('reveal item must carry a model solution in "correct", not a letter');
  }
  return p;
}
