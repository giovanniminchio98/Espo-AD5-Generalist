# AD5 Reasoning Trainer

An unofficial practice app for the EPSO AD5 Part 1 reasoning tests: **verbal**, **numerical** and **abstract** reasoning. It contains 390 original items (150 verbal, 120 numerical, 120 abstract), each with a worked explanation, and an interface modelled on a computer-based test.

> Not affiliated with or endorsed by EPSO or any EU institution. All questions and data are original and fictional.

## Features

- **Practice**: choose a category, question type and difficulty; instant feedback with a full explanation after each answer.
- **Exam simulation**: official question counts and timers, flagging and free navigation within the test, no feedback until you submit, then a full review.
- **Full Part 1 mock**: verbal, then numerical, then abstract in one sitting, checked against the pass marks. A submitted section cannot be reopened.
- **Mistakes review**: wrong answers come back after 1, 3 and 7 days (simple spaced repetition).
- **Speed drill**: one category against a countdown, with a pacing bar per question.
- **Statistics**: accuracy by category, question type and difficulty; average time against target; the traps you fall for most; a daily trend; an estimated exam score.
- **Self-assessed (“reveal”) tasks** (about 15% of each bank): write your answer, show the model solution, then rate yourself Got it / Partly / Missed.
- On-screen basic calculator for numerical items (draggable, keyboard support).
- Progress is stored in your browser (localStorage), with JSON export and import.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173/Espo-AD5-Generalist/
```

## Publish on GitHub Pages

The workflow in `.github/workflows/pages.yml` validates the banks, builds the site and deploys it on every push to `main`.

1. Merge this branch into `main`.
2. In the repository, go to **Settings → Pages** and set **Source** to **GitHub Actions** (one-time).
3. The site is published at `https://<user>.github.io/Espo-AD5-Generalist/`.

The base path is set in `vite.config.ts`. The workflow sets it to the repository name automatically, so renaming the repository also works.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Type-check and build the static site into `dist/` |
| `npm run validate` | Validate every bank (add `-- --category verbal` or `-- --partial` while authoring) |
| `npm run qa` | Print the QA report and write `docs/QA_REPORT.md` |
| `npm run generate` | Regenerate the numerical and abstract banks from their seeded generators |

## Settings

Edit `config/settings.ts`: test language, bank sizes, exam timings, pass marks and quality targets. **Check timings and pass marks against your Notice of Competition.**

## How the banks are built and checked

- **Verbal** (`data/verbal/`): hand-written passages of 180–280 words with four statements. Each distractor is tagged with an EPSO-style trap (outside knowledge, overgeneralisation, wrong quantifier, cause vs correlation, time shift, partially true, reversed relation, cannot be determined, extreme wording). Every item carries the exact evidence quotes from its passage. `scripts/fill-verbal.ts` fills in the derived fields.
- **Numerical** (`data/numerical/`): every number comes from a seeded generator (`src/engine/numerical/recipes.ts`), and every answer is computed in code. Distractors come from typical errors: wrong base, added percentages, misread row, unit slip, wrong period and similar.
- **Abstract** (`data/abstract/`): figures are produced by a rule engine (`src/engine/abstract/`) from a base figure plus rules (rotation, movement, count, add/remove, alternation, cycling), and drawn as inline SVG. Each distractor breaks exactly one rule.
- `npm run validate` checks:
  - schemas (Zod) and unique IDs;
  - no near-duplicate passages or figures;
  - item counts, answer-letter balance, difficulty mix and reveal share;
  - numerical answers recomputed from each item’s own data;
  - the abstract rule engine re-run, with exactly one option fitting;
  - verbal evidence quotes appearing verbatim in their passages.

## Project structure

```
index.html                 Vite entry
config/settings.ts         your settings
data/{verbal,numerical,abstract}/batch-XX.json   question banks
src/schema/                Zod schemas
src/engine/                seeded RNG, numerical recipes, abstract rule engine
src/components/            exam shell, item renderers, SVG charts and figures, calculator
src/modes/                 practice, exam/mock, mistakes, speed drill, stats
src/stats/                 localStorage store, spaced repetition, selectors
scripts/                   generators, validator, QA report
docs/QA_REPORT.md          latest QA report
```
