# QA report

Generated 2026-10-02 by `npm run qa`.

## Counts

| Category | Items | Target | Interactive | Reveal (self-assessed) |
|---|---|---|---|---|
| verbal | 150 | 150 | 128 | 22 (14.7%) |
| numerical | 120 | 120 | 102 | 18 (15.0%) |
| abstract | 120 | 120 | 102 | 18 (15.0%) |
| **total** | **390** | | | |

## Correct-answer letters (interactive items)

| Category | A | B | C | D | E | Allowed per letter |
|---|---|---|---|---|---|---|
| verbal | 31 (24.2%) | 32 (25.0%) | 32 (25.0%) | 33 (25.8%) | — | 20–30% |
| numerical | 20 (19.6%) | 21 (20.6%) | 21 (20.6%) | 20 (19.6%) | 20 (19.6%) | 15–25% |
| abstract | 21 (20.6%) | 20 (19.6%) | 21 (20.6%) | 20 (19.6%) | 20 (19.6%) | 15–25% |

## Difficulty mix

| Category | Easy | Medium | Hard |
|---|---|---|---|
| verbal | 45 (30.0%) | 68 (45.3%) | 37 (24.7%) |
| numerical | 36 (30.0%) | 54 (45.0%) | 30 (25.0%) |
| abstract | 36 (30.0%) | 54 (45.0%) | 30 (25.0%) |
| target | 30% | 45% | 25% |

## Subtypes

**verbal**: inference 48, explicit_detail 30, incorrect_statement 30, main_idea 20, summary 12, explain_non_inference 10

**numerical**: chart_reading 12, ratio 12, survey_percentages 12, percentage_change 12, currency_conversion 12, average 12, per_capita 12, multi_period_growth 12, combined_units 12, percentage_share 12

**abstract**: three_rules 30, two_rules 54, rotation 6, add_remove 6, cycle 6, count 6, movement 6, alternation 6

## Trap tags used by distractors

**verbal**: reversed_relation 102, partially_true 44, extreme_wording 44, time_shift 44, wrong_quantifier 40, overgeneralisation 38, causal_vs_correlation 32, cannot_be_determined 25, outside_knowledge 15

**numerical**: misread_row 107, wrong_base 84, reversed_operation 74, wrong_period 58, unit_slip 41, added_percentages 26, rounding_trap 18

**abstract**: breaks_static 117, breaks_movement 53, breaks_add_remove 52, breaks_count 52, breaks_rotation 49, breaks_cycle 46, breaks_alternation 39

**verbal topics**: Economics 15, Environment 13, Science 13, Culture 13, Health 13, Technology 12, Law 11, EU policy 9, Transport 8, Public administration 8, History 7, Agriculture 7, Energy 7, Demography 6, Education 6, Urban planning 2

## Checks

- Schema validity (Zod) and structural rules for every item
- Unique IDs; no near-duplicate passages (5-gram similarity ≤ 0.30); no duplicate figure series or numerical items
- Item counts, letter balance, difficulty mix and reveal share against config/settings.ts
- Numerical: every answer recomputed from the item’s own data; options at least 3% apart after rounding
- Abstract: rule engine re-run; exactly one option fits; each distractor breaks exactly one rule
- Verbal: 180–280 words per passage; every evidence quote appears verbatim in its passage

**Failed checks: 0**
