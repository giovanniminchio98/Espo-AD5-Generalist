import { useRef, useState } from 'react';
import type { Category } from '../../config/settings';
import type { Item } from '../schema/item';
import { CATEGORY_LABEL } from '../stats/store';
import { Calculator } from './Calculator';
import { ItemView } from './ItemView';
import { TimerBadge, useCountdown } from './Session';

export interface Section {
  category: Category;
  items: Item[];
  seconds: number;
}

export interface SectionResult {
  category: Category;
  items: Item[];
  answers: Record<string, string | null>;
  times: Record<string, number>;
  timeUsed: number;
}

/**
 * Computer-based-test style runner: free navigation and flagging within a section,
 * no feedback, and no way back once a section is submitted (or its time runs out).
 */
export function ExamRunner({ sections, onFinish, onAbort }: { sections: Section[]; onFinish: (r: SectionResult[]) => void; onAbort: () => void }) {
  const [si, setSi] = useState(0);
  const [qi, setQi] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | null>>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [confirm, setConfirm] = useState(false);
  const [calc, setCalc] = useState(false);
  const [between, setBetween] = useState(false);
  const [endAt, setEndAt] = useState(() => Date.now() + sections[0].seconds * 1000);
  const results = useRef<SectionResult[]>([]);
  const times = useRef<Record<string, number>>({});
  const shownAt = useRef(Date.now());
  const sectionStart = useRef(Date.now());

  const section = sections[si];
  const item = section.items[qi];

  const bank = () => {
    const now = Date.now();
    times.current[item.id] = (times.current[item.id] ?? 0) + (now - shownAt.current);
    shownAt.current = now;
  };

  const submitSection = () => {
    bank();
    results.current.push({
      category: section.category,
      items: section.items,
      answers: Object.fromEntries(section.items.map((i) => [i.id, answers[i.id] ?? null])),
      times: Object.fromEntries(section.items.map((i) => [i.id, times.current[i.id] ?? 0])),
      timeUsed: Math.min(section.seconds, (Date.now() - sectionStart.current) / 1000),
    });
    setConfirm(false);
    setCalc(false);
    if (si + 1 < sections.length) setBetween(true);
    else onFinish(results.current);
  };

  const left = useCountdown(between ? null : endAt, submitSection);

  if (between) {
    const nextS = sections[si + 1];
    return (
      <div className="card summary">
        <h2>{CATEGORY_LABEL[section.category]} submitted</h2>
        <p>
          Next: <strong>{CATEGORY_LABEL[nextS.category]}</strong>: {nextS.items.length} questions in {Math.round(nextS.seconds / 60)} minutes.
        </p>
        <p className="muted">You cannot return to the previous section. Results are shown at the end.</p>
        <button
          className="btn primary"
          onClick={() => {
            setSi(si + 1);
            setQi(0);
            setBetween(false);
            setEndAt(Date.now() + nextS.seconds * 1000);
            sectionStart.current = Date.now();
            shownAt.current = Date.now();
          }}
        >
          Start {CATEGORY_LABEL[nextS.category].toLowerCase()}
        </button>
      </div>
    );
  }

  const go = (k: number) => {
    bank();
    setQi(k);
    window.scrollTo(0, 0);
  };
  const answered = section.items.filter((i) => answers[i.id]).length;

  return (
    <div className="exam">
      <header className="exam-bar">
        <div className="exam-title">
          <strong>{CATEGORY_LABEL[section.category]}</strong>
          {sections.length > 1 && (
            <span className="muted-inv">
              Section {si + 1} of {sections.length}
            </span>
          )}
        </div>
        <div className="exam-q">
          Question {qi + 1} / {section.items.length}
        </div>
        <TimerBadge seconds={left} warnAt={section.seconds > 900 ? 300 : 120} />
        <div className="exam-tools">
          {section.category === 'numerical' && (
            <button className="btn small inv" onClick={() => setCalc(!calc)}>
              Calculator
            </button>
          )}
          <button className={`btn small inv ${flags[item.id] ? 'flagged' : ''}`} onClick={() => setFlags({ ...flags, [item.id]: !flags[item.id] })}>
            {flags[item.id] ? '★ Flagged' : '☆ Flag'}
          </button>
        </div>
      </header>
      <ItemView item={item} chosen={answers[item.id] ?? null} onChoose={(k) => setAnswers({ ...answers, [item.id]: k })} />
      <nav className="exam-nav" aria-label="Questions">
        <button className="btn" disabled={qi === 0} onClick={() => go(qi - 1)}>
          ← Previous
        </button>
        <div className="qgrid">
          {section.items.map((it, k) => (
            <button
              key={it.id}
              className={`q ${k === qi ? 'current' : ''} ${answers[it.id] ? 'done' : ''} ${flags[it.id] ? 'flag' : ''}`}
              onClick={() => go(k)}
              aria-label={`Question ${k + 1}${answers[it.id] ? ', answered' : ''}${flags[it.id] ? ', flagged' : ''}`}
            >
              {k + 1}
            </button>
          ))}
        </div>
        {qi + 1 < section.items.length ? (
          <button className="btn primary" onClick={() => go(qi + 1)}>
            Next →
          </button>
        ) : (
          <button className="btn primary" onClick={() => setConfirm(true)}>
            Submit section
          </button>
        )}
      </nav>
      <div className="exam-foot">
        <span>
          {answered} of {section.items.length} answered
        </span>
        <button className="btn small" onClick={() => setConfirm(true)}>
          Submit section
        </button>
        <button className="btn small ghost" onClick={() => window.confirm('Leave the test? Nothing will be saved.') && onAbort()}>
          Quit
        </button>
      </div>
      {confirm && (
        <div className="modal-back" role="dialog" aria-modal="true">
          <div className="modal">
            <h3>Submit this section?</h3>
            <p>
              You have answered {answered} of {section.items.length} questions
              {Object.values(flags).some(Boolean) ? ` and flagged ${section.items.filter((i) => flags[i.id]).length}` : ''}. Once submitted, you cannot come back to this
              section.
            </p>
            <div className="actions">
              <button className="btn" onClick={() => setConfirm(false)}>
                Keep working
              </button>
              <button className="btn primary" onClick={submitSection}>
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
      {calc && <Calculator onClose={() => setCalc(false)} />}
    </div>
  );
}
