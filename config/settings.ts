// Edit these before running. Verify exam timings against the Notice of Competition.

export const SETTINGS = {
  TEST_LANGUAGE: 'English',

  VERBAL_COUNT: 150, // verbal carries 40% of the AD5 ranking, so it gets the most items
  NUMERICAL_COUNT: 120,
  ABSTRACT_COUNT: 120,

  EXAM_TIMINGS: {
    verbal: { questions: 20, minutes: 35 },
    numerical: { questions: 10, minutes: 20 },
    abstract: { questions: 10, minutes: 10 },
  },

  PASS_MARKS: {
    verbal: 10, // out of 20
    numericalAbstract: 10, // numerical + abstract combined, out of 20
  },

  // Quality targets checked by `npm run validate`.
  DIFFICULTY_MIX: { 1: 0.3, 2: 0.45, 3: 0.25 } as Record<1 | 2 | 3, number>,
  DIFFICULTY_TOLERANCE: 0.05,
  REVEAL_SHARE: 0.15,
  REVEAL_TOLERANCE: 0.05,
  // Allowed share of each correct-answer letter among interactive items, by option count.
  LETTER_BALANCE: {
    4: [0.2, 0.3],
    5: [0.15, 0.25],
  } as Record<number, [number, number]>,

  // Spaced repetition intervals for the mistakes review, in days.
  SRS_INTERVALS_DAYS: [1, 3, 7],
} as const;

export type Category = 'verbal' | 'numerical' | 'abstract';
export const CATEGORIES: Category[] = ['verbal', 'numerical', 'abstract'];
