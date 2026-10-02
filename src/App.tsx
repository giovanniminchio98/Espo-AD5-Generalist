import { CATEGORIES, SETTINGS } from '../config/settings';
import { type Bank, useBank } from './data/bank';
import { navigate, useRoute } from './lib/router';
import { ExamPage } from './modes/Exam';
import { MistakesPage, PracticePage } from './modes/Practice';
import { SpeedPage } from './modes/Speed';
import { StatsPage } from './modes/Stats';
import { estimate } from './stats/selectors';
import { CATEGORY_LABEL, dueItems, useStore } from './stats/store';

const NAV: [string, string][] = [
  ['/', 'Home'],
  ['/practice', 'Practice'],
  ['/exam', 'Exam'],
  ['/mock', 'Full mock'],
  ['/mistakes', 'Mistakes'],
  ['/speed', 'Speed drill'],
  ['/stats', 'Stats'],
];

function Stars() {
  return (
    <svg className="stars" viewBox="0 0 40 40" aria-hidden="true">
      {Array.from({ length: 12 }, (_, k) => {
        const a = (k * Math.PI) / 6;
        return <circle key={k} cx={20 + 13 * Math.sin(a)} cy={20 - 13 * Math.cos(a)} r={2.1} fill="#FFCC00" />;
      })}
    </svg>
  );
}

function Home({ bank }: { bank: Bank }) {
  const store = useStore();
  const due = dueItems().length;
  const counts = Object.fromEntries(CATEGORIES.map((c) => [c, bank.items.filter((i) => i.category === c).length]));
  const modes: [string, string, string][] = [
    ['/practice', 'Practice', 'Pick a category, question type and difficulty. Instant feedback and a full explanation after each answer.'],
    ['/exam', 'Exam simulation', 'One test with the official question count and timer. No feedback until the end, then a full review.'],
    ['/mock', 'Full Part 1 mock', 'Verbal, numerical and abstract in one sitting, checked against the pass marks.'],
    ['/mistakes', `Mistakes review${due ? ` (${due} due)` : ''}`, 'Wrong answers come back after 1, 3 and 7 days until you get them right.'],
    ['/speed', 'Speed drill', 'One category against a countdown, to train your pacing.'],
    ['/stats', 'Statistics', 'Accuracy, timing, the traps you fall for, your trend and an exam score estimate.'],
  ];
  return (
    <div className="page">
      <section className="hero">
        <div>
          <h1>AD5 Reasoning Trainer</h1>
          <p className="lead">
            Practice for the EPSO AD5 Part 1 reasoning tests: {counts.verbal} verbal, {counts.numerical} numerical and {counts.abstract} abstract items, all original,
            each with a worked explanation. The verbal test is in {SETTINGS.TEST_LANGUAGE}.
          </p>
        </div>
        <div className="estimates">
          {CATEGORIES.map((c) => {
            const e = estimate(store, c);
            return (
              <div key={c} className="est">
                <span>{CATEGORY_LABEL[c]}</span>
                <strong>{e ? `≈ ${e.score}/${e.of}` : '—'}</strong>
              </div>
            );
          })}
          <small>Estimated exam scores from your recent answers</small>
        </div>
      </section>
      <div className="mode-grid">
        {modes.map(([to, title, desc]) => (
          <button key={to} className="mode-card" onClick={() => navigate(to)}>
            <span className="mode-title">{title}</span>
            <span className="mode-desc">{desc}</span>
          </button>
        ))}
      </div>
      <div className="card info">
        <h3>The real test, as configured</h3>
        <ul className="plain">
          {CATEGORIES.map((c) => (
            <li key={c}>
              <strong>{CATEGORY_LABEL[c]}</strong>: {SETTINGS.EXAM_TIMINGS[c].questions} questions in {SETTINGS.EXAM_TIMINGS[c].minutes} minutes
            </li>
          ))}
          <li>
            Pass marks: verbal ≥ {SETTINGS.PASS_MARKS.verbal}/20; numerical + abstract combined ≥ {SETTINGS.PASS_MARKS.numericalAbstract}/20.
          </li>
        </ul>
        <p className="muted small">Timings and pass marks are set in config/settings.ts. Check them against your Notice of Competition.</p>
      </div>
    </div>
  );
}

export function App() {
  const route = useRoute();
  const bank = useBank();
  const path = route.split('?')[0];
  let page;
  if (!bank) page = <div className="page loading">Loading question banks…</div>;
  else if (path === '/practice') page = <PracticePage bank={bank} />;
  else if (path === '/exam') page = <ExamPage key="exam" bank={bank} full={false} />;
  else if (path === '/mock') page = <ExamPage key="mock" bank={bank} full />;
  else if (path === '/mistakes') page = <MistakesPage bank={bank} />;
  else if (path === '/speed') page = <SpeedPage bank={bank} />;
  else if (path === '/stats') page = <StatsPage bank={bank} />;
  else page = <Home bank={bank} />;
  return (
    <>
      <header className="topbar">
        <a className="brand" href="#/">
          <Stars />
          <span>
            AD5 Reasoning Trainer <small>Verbal · Numerical · Abstract</small>
          </span>
        </a>
        <nav className="mainnav" aria-label="Main">
          {NAV.map(([to, label]) => (
            <a key={to} href={`#${to}`} className={path === to ? 'on' : ''}>
              {label}
            </a>
          ))}
        </nav>
      </header>
      <main>{page}</main>
      <footer className="footer">
        Unofficial practice tool, not affiliated with or endorsed by EPSO or any EU institution. All questions and data are original and fictional.
        {bank && bank.invalid > 0 && <span className="bad-text"> {bank.invalid} invalid items were skipped.</span>}
      </footer>
    </>
  );
}
