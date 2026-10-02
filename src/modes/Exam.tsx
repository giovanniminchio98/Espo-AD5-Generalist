import { useState } from 'react';
import { CATEGORIES, SETTINGS, type Category } from '../../config/settings';
import type { Bank } from '../data/bank';
import { ExamRunner, type Section, type SectionResult } from '../components/ExamRunner';
import { Review, passCheck, scoreOf } from '../components/Review';
import { makeAttempt } from '../components/Session';
import { navigate } from '../lib/router';
import { pickExam } from '../lib/select';
import { CATEGORY_LABEL, getStore, recordAttempts, recordSession } from '../stats/store';

function save(results: SectionResult[], kind: 'exam' | 'mock', label: string) {
  const attempts = results.flatMap((r) => r.items.map((it) => makeAttempt(it, kind, r.answers[it.id], r.times[it.id] ?? 0)));
  recordAttempts(attempts);
  const checks = kind === 'mock' ? passCheck(results) : [];
  recordSession({
    id: `s${Date.now()}`,
    kind,
    ts: Date.now(),
    label,
    scores: results.map((r) => ({ category: r.category, correct: scoreOf(r), total: r.items.length })),
    ...(checks.length ? { passed: checks.every((c) => c.pass) } : {}),
  });
}

function sectionFor(bank: Bank, c: Category): Section {
  const t = SETTINGS.EXAM_TIMINGS[c];
  return { category: c, items: pickExam(bank.items, c, t.questions, getStore().attempts), seconds: t.minutes * 60 };
}

export function ExamPage({ bank, full }: { bank: Bank; full: boolean }) {
  const [sections, setSections] = useState<Section[] | null>(null);
  const [results, setResults] = useState<SectionResult[] | null>(null);
  const title = full ? 'Full Part 1 mock' : sections ? `${CATEGORY_LABEL[sections[0].category]} exam` : 'Exam simulation';

  if (results) return <Review results={results} title={title} showPass={full} onDone={() => navigate('/')} />;
  if (sections)
    return (
      <ExamRunner
        sections={sections}
        onAbort={() => setSections(null)}
        onFinish={(r) => {
          save(r, full ? 'mock' : 'exam', title);
          setResults(r);
        }}
      />
    );

  const short = (c: Category) => bank.items.filter((i) => i.category === c && i.mode === 'interactive').length < SETTINGS.EXAM_TIMINGS[c].questions;
  return (
    <div className="page">
      <h1>{full ? 'Full Part 1 mock' : 'Exam simulation'}</h1>
      {full ? (
        <>
          <p className="lead">
            Verbal, then numerical, then abstract reasoning in one sitting, with the official question counts and timers. No feedback until the end; once a
            section is submitted you cannot go back. At the end your result is checked against the pass marks.
          </p>
          <ul className="plan">
            {CATEGORIES.map((c) => (
              <li key={c}>
                <strong>{CATEGORY_LABEL[c]}</strong>: {SETTINGS.EXAM_TIMINGS[c].questions} questions, {SETTINGS.EXAM_TIMINGS[c].minutes} minutes
              </li>
            ))}
          </ul>
          <p className="muted">
            Pass marks: verbal ≥ {SETTINGS.PASS_MARKS.verbal}/{SETTINGS.EXAM_TIMINGS.verbal.questions}; numerical + abstract combined ≥ {SETTINGS.PASS_MARKS.numericalAbstract}/
            {SETTINGS.EXAM_TIMINGS.numerical.questions + SETTINGS.EXAM_TIMINGS.abstract.questions}. Total time:{' '}
            {CATEGORIES.reduce((s, c) => s + SETTINGS.EXAM_TIMINGS[c].minutes, 0)} minutes.
          </p>
          <button className="btn primary big" disabled={CATEGORIES.some(short)} onClick={() => setSections(CATEGORIES.map((c) => sectionFor(bank, c)))}>
            Start the mock
          </button>
        </>
      ) : (
        <>
          <p className="lead">
            One test under real conditions: official question count and timer, free navigation and flagging within the test, no feedback until you submit, then a
            full review with every explanation.
          </p>
          <div className="mode-grid">
            {CATEGORIES.map((c) => (
              <button key={c} className="mode-card" disabled={short(c)} onClick={() => setSections([sectionFor(bank, c)])}>
                <span className="mode-title">{CATEGORY_LABEL[c]}</span>
                <span className="mode-desc">
                  {SETTINGS.EXAM_TIMINGS[c].questions} questions · {SETTINGS.EXAM_TIMINGS[c].minutes} min
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
