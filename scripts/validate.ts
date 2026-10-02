// npm run validate [-- --category verbal] [-- --partial]
import { runChecks } from './checks.ts';

const args = process.argv.slice(2);
const ci = args.indexOf('--category');
const category = ci >= 0 ? args[ci + 1] : undefined;
const partial = args.includes('--partial');

const { errors, warnings, items } = runChecks({ category, partial });
for (const w of warnings) console.warn(`warn  ${w}`);
for (const e of errors) console.error(`FAIL  ${e}`);
const by = (c: string) => items.filter((i) => i.category === c).length;
console.log(`\nChecked ${items.length} items (verbal ${by('verbal')}, numerical ${by('numerical')}, abstract ${by('abstract')}).`);
if (errors.length) {
  console.error(`${errors.length} check(s) failed.`);
  process.exit(1);
}
console.log('All checks passed.');
