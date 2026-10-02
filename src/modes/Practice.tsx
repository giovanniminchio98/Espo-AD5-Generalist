import { useMemo, useState } from 'react';
import { CATEGORIES, type Category } from '../../config/settings';
import type { Bank } from '../data/bank';
import { PracticeSession } from '../components/Session';
import { DIFFICULTY_LABEL, SUBTYPE_LABEL } from '../lib/labels';
import { navigate } from '../lib/router';
import { type Filter, matches, pickItems } from '../lib/select';
import type { Item } from '../schema/item';
import { CATEGORY_LABEL, dueItems, getStore, useStore } from '../stats/store';

export function PracticePage({ bank }: { bank: Bank }) {
  const [category, setCategory] = useState<Category>('verbal');
  const [subtype, setSubtype] = useState('');
  const [difficulty, setDifficulty] = useState(0);
  const [mode, setMode] = useState<Filter['mode']>('any');
  const [count, setCount] = useState(10);
  const [session, setSession] = useState<Item[] | null>(null);

  const subtypes = useMemo(() => [...new Set(bank.items.filter((i) => i.category === category).map((i) => i.subtype))], [bank, category]);
  const filter: Filter = { category, subtype: subtype || undefined, difficulty: difficulty || undefined, mode };
  const available = bank.items.filter((i) => matches(i, filter)).length;

  if (session) return <PracticeSession items={session} mode="practice" title={`Practice: ${CATEGORY_LABEL[category]}`} onExit={() => setSession(null)} />;

  return (
    <div className="page">
      <h1>Practice</h1>
      <p className="lead">Choose what to train. You get instant feedback and the full explanation after every question. Items you have not seen yet come first.</p>
      <div className="card form">
        <fieldset>
          <legend>Category</legend>
          <div className="seg">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                className={c === category ? 'on' : ''}
                onClick={() => {
                  setCategory(c);
                  setSubtype('');
                }}
              >
                {CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="form-row">
          <label>
            Question type
            <select value={subtype} onChange={(e) => setSubtype(e.target.value)}>
              <option value="">All types</option>
              {subtypes.map((s) => (
                <option key={s} value={s}>
                  {SUBTYPE_LABEL[s] ?? s}
                </option>
              ))}
            </select>
          </label>
          <label>
            Difficulty
            <select value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))}>
              <option value={0}>Any</option>
              {[1, 2, 3].map((d) => (
                <option key={d} value={d}>
                  {DIFFICULTY_LABEL[d]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Format
            <select value={mode} onChange={(e) => setMode(e.target.value as Filter['mode'])}>
              <option value="any">Multiple choice and self-assessed</option>
              <option value="interactive">Multiple choice only</option>
              <option value="reveal">Self-assessed tasks only</option>
            </select>
          </label>
          <label>
            Questions
            <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {[5, 10, 20, 40].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="muted">{available} matching items in the bank.</p>
        <button className="btn primary big" disabled={!available} onClick={() => setSession(pickItems(bank.items, filter, count, getStore().attempts))}>
          Start practice
        </button>
      </div>
    </div>
  );
}

export function MistakesPage({ bank }: { bank: Bank }) {
  const store = useStore();
  const [session, setSession] = useState<Item[] | null>(null);
  const due = dueItems().filter((id) => bank.byId.has(id));
  const all = Object.keys(store.srs).filter((id) => bank.byId.has(id));
  const upcoming = Object.entries(store.srs)
    .filter(([id, e]) => bank.byId.has(id) && e.due > Date.now())
    .sort((a, b) => a[1].due - b[1].due);
  const byDay = new Map<string, number>();
  for (const [, e] of upcoming) {
    const d = new Date(e.due).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    byDay.set(d, (byDay.get(d) ?? 0) + 1);
  }
  if (session) return <PracticeSession items={session} mode="mistakes" title="Mistakes review" onExit={() => setSession(null)} />;
  return (
    <div className="page">
      <h1>Mistakes review</h1>
      <p className="lead">
        Every item you get wrong (or rate Partly / Missed) comes back after 1 day. Get it right and it returns after 3 days, then 7 days; after that it leaves the
        queue. Get it wrong again and it starts over.
      </p>
      <div className="score-tiles">
        <div className="tile">
          <div className="tile-label">Due now</div>
          <div className="tile-value">{due.length}</div>
        </div>
        <div className="tile">
          <div className="tile-label">In the queue</div>
          <div className="tile-value">{all.length}</div>
        </div>
      </div>
      <div className="actions">
        <button className="btn primary big" disabled={!due.length} onClick={() => setSession(due.map((id) => bank.byId.get(id)!))}>
          Review {due.length} due item{due.length === 1 ? '' : 's'}
        </button>
        <button className="btn" disabled={!all.length} onClick={() => setSession(all.map((id) => bank.byId.get(id)!))}>
          Practise the whole queue now
        </button>
      </div>
      {byDay.size > 0 && (
        <div className="card">
          <h3>Coming up</h3>
          <ul className="plain">
            {[...byDay.entries()].map(([d, n]) => (
              <li key={d}>
                {d}: {n} item{n === 1 ? '' : 's'}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!all.length && (
        <p className="muted">
          No mistakes yet. <a onClick={() => navigate('/practice')}>Start practising</a>.
        </p>
      )}
    </div>
  );
}
