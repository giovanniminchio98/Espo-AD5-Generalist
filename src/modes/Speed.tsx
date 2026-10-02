import { useEffect, useRef, useState } from 'react';
import { CATEGORIES, SETTINGS, type Category } from '../../config/settings';
import type { Bank } from '../data/bank';
import { Calculator } from '../components/Calculator';
import { ItemView } from '../components/ItemView';
import { makeAttempt, TimerBadge, useCountdown } from '../components/Session';
import { fmtTime } from '../lib/labels';
import { pickItems } from '../lib/select';
import type { Item } from '../schema/item';
import { type Attempt, CATEGORY_LABEL, getStore, recordAttempts, recordSession } from '../stats/store';

export function SpeedPage({ bank }: { bank: Bank }) {
  const [category, setCategory] = useState<Category>('numerical');
  const [minutes, setMinutes] = useState(5);
  const [run, setRun] = useState<{ items: Item[]; endAt: number } | null>(null);
  const [log, setLog] = useState<{ item: Item; a: Attempt }[] | null>(null);

  if (log) {
    const right = log.filter((l) => l.a.correct).length;
    const avg = log.length ? log.reduce((s, l) => s + l.a.timeMs, 0) / log.length / 1000 : 0;
    const t = SETTINGS.EXAM_TIMINGS[category];
    return (
      <div className="page">
        <div className="card summary">
          <h2>Speed drill: {CATEGORY_LABEL[category]}</h2>
          <p className="big">
            {right} / {log.length} correct in {minutes} min
          </p>
          <p>
            Average {fmtTime(avg)} per question; exam pace is {fmtTime((t.minutes * 60) / t.questions)} per question.
          </p>
          <button className="btn primary" onClick={() => setLog(null)}>
            Again
          </button>
        </div>
        <ul className="review-list">
          {log.map(({ item, a }, k) => (
            <li key={k} className={a.correct ? 'ok' : 'bad'}>
              <details>
                <summary className="review-row">
                  <span className="mark">{a.correct ? '✓' : '✗'}</span> Question {k + 1}
                  <span className="muted">
                    Your answer {a.chosen} · correct {item.correct} · {fmtTime(a.timeMs / 1000)} (target {fmtTime(item.est_time_sec)})
                  </span>
                </summary>
                <ItemView item={item} chosen={a.chosen ?? null} feedback showMeta />
              </details>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (run)
    return (
      <Drill
        items={run.items}
        endAt={run.endAt}
        onEnd={(l) => {
          recordAttempts(l.map((x) => x.a));
          recordSession({
            id: `s${Date.now()}`,
            kind: 'speed',
            ts: Date.now(),
            label: `Speed drill: ${CATEGORY_LABEL[category]} (${minutes} min)`,
            scores: [{ category, correct: l.filter((x) => x.a.correct).length, total: l.length }],
          });
          setRun(null);
          setLog(l);
        }}
      />
    );

  return (
    <div className="page">
      <h1>Speed drill</h1>
      <p className="lead">One category against a countdown. Answer as many as you can; each answer is marked instantly and you move straight on. A pacing bar shows the target time for each question.</p>
      <div className="card form">
        <fieldset>
          <legend>Category</legend>
          <div className="seg">
            {CATEGORIES.map((c) => (
              <button key={c} className={c === category ? 'on' : ''} onClick={() => setCategory(c)}>
                {CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Countdown</legend>
          <div className="seg">
            {[3, 5, 10, 15].map((m) => (
              <button key={m} className={m === minutes ? 'on' : ''} onClick={() => setMinutes(m)}>
                {m} min
              </button>
            ))}
          </div>
        </fieldset>
        <button
          className="btn primary big"
          onClick={() => setRun({ items: pickItems(bank.items, { category, mode: 'interactive' }, 60, getStore().attempts), endAt: Date.now() + minutes * 60000 })}
        >
          Start
        </button>
      </div>
    </div>
  );
}

function Drill({ items, endAt, onEnd: finish }: { items: Item[]; endAt: number; onEnd: (l: { item: Item; a: Attempt }[]) => void }) {
  const ended = useRef(false);
  const onEnd = (l: { item: Item; a: Attempt }[]) => {
    if (ended.current) return;
    ended.current = true;
    finish(l);
  };
  const [idx, setIdx] = useState(0);
  const [flash, setFlash] = useState<null | boolean>(null);
  const [calc, setCalc] = useState(false);
  const log = useRef<{ item: Item; a: Attempt }[]>([]);
  const shown = useRef(Date.now());
  const [now, setNow] = useState(Date.now());
  const left = useCountdown(endAt, () => onEnd(log.current));
  const item = items[idx];
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!item) onEnd(log.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]);
  if (!item) return null;
  const spent = (now - shown.current) / 1000;
  const choose = (k: string) => {
    if (flash !== null) return;
    const a = makeAttempt(item, 'speed', k, Date.now() - shown.current);
    log.current.push({ item, a });
    setFlash(a.correct ?? false);
    setTimeout(() => {
      setFlash(null);
      shown.current = Date.now();
      setIdx((i) => i + 1);
    }, 650);
  };
  return (
    <div className="session">
      <div className="session-bar">
        <span className="session-title">Speed drill</span>
        <span className="progress-text">
          {log.current.filter((l) => l.a.correct).length} correct · {log.current.length} answered
        </span>
        <TimerBadge seconds={left} warnAt={30} />
        {item.category === 'numerical' && (
          <button className="btn small" onClick={() => setCalc(!calc)}>
            Calculator
          </button>
        )}
        <button className="btn small ghost" onClick={() => onEnd(log.current)}>
          Stop
        </button>
      </div>
      <div className={`pace ${spent > item.est_time_sec ? 'over' : ''}`} title="Time on this question vs target">
        <div style={{ width: `${Math.min(100, (spent / item.est_time_sec) * 100)}%` }} />
        <span>
          {fmtTime(spent)} / {fmtTime(item.est_time_sec)}
        </span>
      </div>
      {flash !== null && <div className={`flash ${flash ? 'ok' : 'bad'}`}>{flash ? '✓ Correct' : `✗ Answer: ${item.correct}`}</div>}
      <ItemView key={item.id} item={item} chosen={null} onChoose={choose} />
      {calc && <Calculator onClose={() => setCalc(false)} />}
    </div>
  );
}
