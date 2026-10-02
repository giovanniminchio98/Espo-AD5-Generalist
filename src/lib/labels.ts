export const TRAP_LABEL: Record<string, string> = {
  outside_knowledge: 'Outside knowledge',
  overgeneralisation: 'Overgeneralisation',
  wrong_quantifier: 'Wrong quantifier',
  causal_vs_correlation: 'Cause vs correlation',
  time_shift: 'Time shift',
  partially_true: 'Partially true',
  reversed_relation: 'Reversed relation',
  cannot_be_determined: 'Cannot be determined',
  extreme_wording: 'Extreme wording',
  wrong_base: 'Wrong base',
  added_percentages: 'Added percentages',
  misread_row: 'Misread row/column',
  unit_slip: 'Unit slip',
  rounding_trap: 'Rounding / near miss',
  wrong_period: 'Wrong period',
  reversed_operation: 'Reversed operation',
  breaks_rotation: 'Breaks rotation rule',
  breaks_movement: 'Breaks movement rule',
  breaks_count: 'Breaks count rule',
  breaks_alternation: 'Breaks alternation rule',
  breaks_add_remove: 'Breaks add/remove rule',
  breaks_cycle: 'Breaks cycle rule',
  breaks_static: 'Changes a fixed element',
};

export const SUBTYPE_LABEL: Record<string, string> = {
  explicit_detail: 'Explicit detail',
  inference: 'Inference',
  main_idea: 'Main idea',
  incorrect_statement: 'Find the incorrect statement',
  summary: 'Summary (reveal)',
  explain_non_inference: 'Explain a non-inference (reveal)',
  percentage_change: 'Percentage change',
  percentage_share: 'Percentage share',
  ratio: 'Ratios',
  average: 'Averages',
  currency_conversion: 'Currency conversion',
  multi_period_growth: 'Growth over several periods',
  chart_reading: 'Reading charts',
  per_capita: 'Per-capita values',
  combined_units: 'Combined units',
  survey_percentages: 'Survey percentages',
  rotation: 'Rotation',
  movement: 'Movement',
  count: 'Count',
  alternation: 'Alternation',
  add_remove: 'Add / remove',
  cycle: 'Cycling attributes',
  two_rules: 'Two rules combined',
  three_rules: 'Three rules combined',
};

export const DIFFICULTY_LABEL: Record<number, string> = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };

export function fmtTime(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
