import { useEffect, useRef, useState } from 'react';
import type { Item } from '../schema/item';
import { type Attempt, recordAttempts, recordSession } from '../stats/store';
import { fmtTime } from '../lib/labels';
import { Calculator } from './Calculator';
import { ItemView } from './ItemView';

export type AttemptMode = Attempt['mode'];

export function makeAttempt(item: Item, mode: AttemptMode, chosen: string | null, timeMs: number): Attempt {
  const correct = chosen === item.correct;
  const trap = !correct && chosen ? item.options?.find((o) => o.key === chosen)?.trap : undefined;
  return {
    itemId: item.id,
    category: item.category,
    subtype: item.subtype,
    difficulty: item.difficulty,
    mode,
    ts: Date.now(),
    timeMs,
    targetSec: item.est_time_sec,
    chosen,
    correct,
    ...(trap ? { trap } : {}),
  };
}

export function useStopwatch(resetKey: unknown) {
  const start = useRef(Date.now());
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    start.current = Date.now();
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [resetKey]);
  return { elapsedMs: now - start.current, read: () => Date.now() - start.current };
}

/** Countdown that survives re-renders; calls onEnd once when time runs out. */
export function useCountdown(endAt: number | null, onEnd: () => void) {
  const [now, setNow] = useState(Date.now());
  const fired = useRef(false);
  const cb = useRef(onEnd);
  cb.current = onEnd;
  useEffect(() => {
    fired.current = false;
    if (!endAt) return;
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= endAt && !fired.current) {
        fired.current = true;
        cb.current();
      }
    }, 250);
    return () => clearInterval(t);
  }, [endAt]);
  return endAt ? Math.max(0, (endAt - now) / 1000) : 0;
}

export function TimerBadge({ seconds, warnAt = 60 }: { seconds: number; warnAt?: number }) {
  return (
    <span className={`timer ${seconds <= warnAt ? 'warn' : ''}`} role="timer" aria-live="off">
      ⏱ {fmtTime(seconds)}
    </span>
  );
}

// ------------------------------------------------------------------ reveal items
export function RevealPanel({ item, onRate }: { item: Item; onRate: (r: 'got' | 'partly' | 'missed') => void }) {
  const [notes, setNotes] = useState('');
  const [shown, setShown] = useState(false);
  const [rated, setRated] = useState<string | null>(null);
  useEffect(() => {
    setNotes('');
    setShown(false);
    setRated(null);
  }, [item.id]);
  return (
    <div className="reveal">
      <label className="reveal-notes">
        <span>Your answer (not graded; for your own reference)</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Work it out here or on paper…" />
      </label>
      {!shown ? (
        <button className="btn primary" onClick={() => setShown(true)}>
          Show solution
        </button>
      ) : (
        <>
          <div className="model-answer">
            <h4>Model answer</h4>
            <p>{item.correct}</p>
          </div>
          <div className="rate">
            <span>How did you do?</span>
            {(
              [
                ['got', 'Got it'],
                ['partly', 'Partly'],
                ['missed', 'Missed'],
              ] as const
            ).map(([k, label]) => (
              <button key={k} className={`btn rate-${k} ${rated === k ? 'on' : ''}`} disabled={!!rated} onClick={() => (setRated(k), onRate(k))}>
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ practice / mistakes session
export function PracticeSession({ items, mode, title, onExit }: { items: Item[]; mode: 'practice' | 'mistakes'; title: string; onExit: () => void }) {
  const [idx, setIdx] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [revealDone, setRevealDone] = useState(false);
  const [calc, setCalc] = useState(false);
  const [log, setLog] = useState<Attempt[]>([]);
  const item = items[idx];
  const sw = useStopwatch(idx);
  const done = idx >= items.length;

  useEffect(() => {
    if (done && log.length) {
      const scored = log.filter((a) => a.correct !== undefined && a.selfRating === undefined);
      recordSession({
        id: `s${Date.now()}`,
        kind: mode,
        ts: Date.now(),
        label: title,
        scores: (['verbal', 'numerical', 'abstract'] as const)
          .map((c) => ({ category: c, correct: scored.filter((a) => a.category === c && a.correct).length, total: scored.filter((a) => a.category === c).length }))
          .filter((s) => s.total > 0),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  if (done) {
    const scored = log.filter((a) => a.selfRating === undefined);
    const right = scored.filter((a) => a.correct).length;
    const rated = log.filter((a) => a.selfRating);
    return (
      <div className="card summary">
        <h2>Session complete</h2>
        {scored.length > 0 && (
          <p className="big">
            {right} / {scored.length} correct ({Math.round((right / scored.length) * 100)}%)
          </p>
        )}
        {rated.length > 0 && (
          <p>
            Self-rated items: {rated.filter((a) => a.selfRating === 'got').length} got it, {rated.filter((a) => a.selfRating === 'partly').length} partly,{' '}
            {rated.filter((a) => a.selfRating === 'missed').length} missed.
          </p>
        )}
        <p className="muted">Wrong answers (and reveal items rated Partly or Missed) are scheduled for the mistakes review after 1, 3 and 7 days.</p>
        <button className="btn primary" onClick={onExit}>
          Back
        </button>
      </div>
    );
  }

  const isReveal = item.mode === 'reveal';
  const check = () => {
    if (!chosen) return;
    const a = makeAttempt(item, mode, chosen, sw.read());
    recordAttempts([a]);
    setLog((l) => [...l, a]);
    setChecked(true);
  };
  const rate = (r: 'got' | 'partly' | 'missed') => {
    const a: Attempt = { ...makeAttempt(item, mode, null, sw.read()), correct: undefined, chosen: undefined, selfRating: r };
    delete a.correct;
    delete a.chosen;
    recordAttempts([a]);
    setLog((l) => [...l, a]);
    setRevealDone(true);
  };
  const next = () => {
    setIdx(idx + 1);
    setChosen(null);
    setChecked(false);
    setRevealDone(false);
  };

  return (
    <div className="session">
      <div className="session-bar">
        <span className="session-title">{title}</span>
        <span className="progress-text">
          Question {idx + 1} of {items.length}
        </span>
        <span className="timer subtle">⏱ {fmtTime(sw.elapsedMs / 1000)} <small>/ target {fmtTime(item.est_time_sec)}</small></span>
        {item.category === 'numerical' && (
          <button className="btn small" onClick={() => setCalc(!calc)}>
            Calculator
          </button>
        )}
        <button className="btn small ghost" onClick={() => (log.length ? setIdx(items.length) : onExit())}>
          End session
        </button>
      </div>
      <div className="progress">
        <div style={{ width: `${(idx / items.length) * 100}%` }} />
      </div>
      <ItemView
        item={item}
        chosen={chosen}
        onChoose={!isReveal && !checked ? setChosen : undefined}
        feedback={checked || revealDone}
        showMeta
        footer={
          isReveal ? (
            <RevealPanel item={item} onRate={rate} />
          ) : !checked ? (
            <div className="actions">
              <button className="btn primary" disabled={!chosen} onClick={check}>
                Check answer
              </button>
            </div>
          ) : (
            <div className={`verdict ${chosen === item.correct ? 'ok' : 'bad'}`}>{chosen === item.correct ? '✓ Correct' : `✗ Incorrect — the answer is ${item.correct}`}</div>
          )
        }
      />
      {(checked || revealDone) && (
        <div className="actions sticky">
          <button className="btn primary" onClick={next}>
            {idx + 1 < items.length ? 'Next question →' : 'Finish'}
          </button>
        </div>
      )}
      {calc && <Calculator onClose={() => setCalc(false)} />}
    </div>
  );
}
