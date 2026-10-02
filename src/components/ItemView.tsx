import { type ReactNode, useState } from 'react';
import type { AbstractItem, Item, NumericalItem, VerbalItem } from '../schema/item';
import { ruleHint } from '../engine/abstract/explain';
import { applyRules } from '../engine/abstract/model';
import { DIFFICULTY_LABEL, SUBTYPE_LABEL, TRAP_LABEL } from '../lib/labels';
import { Chart, DataTable } from './svg/Charts';
import { Figure, QuestionMarkFigure } from './svg/Figure';

// ------------------------------------------------------------------ stimulus
function highlight(passage: string, quotes: string[]): ReactNode[] {
  const marks: [number, number][] = [];
  for (const q of quotes) {
    const i = passage.indexOf(q);
    if (i >= 0) marks.push([i, i + q.length]);
  }
  marks.sort((a, b) => a[0] - b[0]);
  const out: ReactNode[] = [];
  let pos = 0;
  marks.forEach(([s, e], k) => {
    if (s < pos) return;
    out.push(passage.slice(pos, s), <mark key={k}>{passage.slice(s, e)}</mark>);
    pos = e;
  });
  out.push(passage.slice(pos));
  return out;
}

function VerbalStimulus({ item, showEvidence }: { item: VerbalItem; showEvidence: boolean }) {
  const paras = item.passage.split(/\n\s*\n/);
  return (
    <article className="passage">
      {paras.map((p, i) => (
        <p key={i}>{showEvidence ? highlight(p, item.evidence) : p}</p>
      ))}
    </article>
  );
}

export function NumericalStimulus({ item }: { item: NumericalItem }) {
  const s = item.source;
  if (s.kind === 'table') return <DataTable src={s} />;
  if (s.kind === 'text')
    return (
      <div className="text-source">
        <p>{s.body}</p>
        <p className="note">{s.caption}</p>
      </div>
    );
  return <Chart src={s} />;
}

function hasGrid(item: AbstractItem) {
  return item.rules.some((r) => r.type === 'move');
}

function AbstractSeries({ item, annotate, showAnswer }: { item: AbstractItem; annotate: boolean; showAnswer: boolean }) {
  const grid = hasGrid(item);
  const frames = annotate ? [0, 1, 2, 3, 4, 5].map((t) => applyRules(item.base, item.rules, t)) : [];
  const active = item.rules.filter((r) => r.type !== 'static');
  return (
    <div className="series" role="group" aria-label="Figure series">
      {item.series.map((f, i) => (
        <div className="series-cell" key={i}>
          <Figure figure={f} grid={grid} title={`Figure ${i + 1}`} />
          <span className="fig-label">{i + 1}</span>
          {annotate && (
            <ul className="hints">
              {active.map((r, k) => {
                const h = ruleHint(r, frames[i], item.base);
                return h ? <li key={k}>{h}</li> : null;
              })}
            </ul>
          )}
        </div>
      ))}
      <div className="series-cell next">
        {showAnswer ? <Figure figure={item.answer} grid={grid} title="Answer" /> : <QuestionMarkFigure />}
        <span className="fig-label">{showAnswer ? 'answer' : '?'}</span>
        {annotate && (
          <ul className="hints">
            {active.map((r, k) => {
              const h = ruleHint(r, frames[5], item.base);
              return h ? <li key={k}>{h}</li> : null;
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ options
export function Options({ item, chosen, onChoose, feedback }: { item: Item; chosen: string | null; onChoose?: (k: string) => void; feedback: boolean }) {
  if (!item.options) return null;
  const isAbstract = item.category === 'abstract';
  const grid = isAbstract && hasGrid(item as AbstractItem);
  return (
    <div className={isAbstract ? 'options figure-options' : 'options'} role="radiogroup" aria-label="Answer options">
      {item.options.map((o) => {
        const state = feedback ? (o.key === item.correct ? 'right' : o.key === chosen ? 'wrong' : '') : o.key === chosen ? 'chosen' : '';
        return (
          <button
            key={o.key}
            role="radio"
            aria-checked={o.key === chosen}
            className={`option ${state}`}
            disabled={!onChoose}
            onClick={() => onChoose?.(o.key)}
          >
            <span className="letter">{o.key}</span>
            {'figure' in o && o.figure ? <Figure figure={o.figure} grid={grid} size={96} title={`Option ${o.key}`} /> : <span className="text">{'text' in o ? o.text : ''}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ explanation
export function Explanation({ item, chosen }: { item: Item; chosen?: string | null }) {
  return (
    <section className="explanation">
      <h3>Explanation</h3>
      {item.category === 'verbal' && (
        <div className="evidence">
          <h4>What the passage says</h4>
          {item.evidence.map((q, i) => (
            <blockquote key={i}>“{q}”</blockquote>
          ))}
        </div>
      )}
      {item.category === 'abstract' && (
        <div className="annotated">
          <h4>The series, annotated</h4>
          <AbstractSeries item={item} annotate showAnswer />
        </div>
      )}
      <ol className="steps">
        {item.explanation.steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      {item.explanation.shortcut && (
        <p className="shortcut">
          <strong>Faster:</strong> {item.explanation.shortcut}
        </p>
      )}
      {item.options && (
        <div className="option-notes">
          <h4>Every option</h4>
          <ul>
            {item.options.map((o) => (
              <li key={o.key} className={o.key === item.correct ? 'right' : o.key === chosen ? 'wrong' : ''}>
                <span className="letter">{o.key}</span>
                <div>
                  {'text' in o && item.category !== 'numerical' && <div className="opt-text">{o.text}</div>}
                  {'text' in o && item.category === 'numerical' && <strong>{o.text} </strong>}
                  {o.trap && <span className="chip">{TRAP_LABEL[o.trap] ?? o.trap}</span>} <span className="opt-note">{o.note}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ whole item
export function ItemMeta({ item }: { item: Item }) {
  return (
    <div className="item-meta">
      <span className="chip">{SUBTYPE_LABEL[item.subtype] ?? item.subtype}</span>
      <span className={`chip diff-${item.difficulty}`}>{DIFFICULTY_LABEL[item.difficulty]}</span>
      {item.category === 'verbal' && <span className="chip subtle">{item.topic}</span>}
      <span className="chip subtle">{item.id}</span>
    </div>
  );
}

export function ItemView({
  item,
  chosen,
  onChoose,
  feedback = false,
  showMeta = false,
  footer,
}: {
  item: Item;
  chosen: string | null;
  onChoose?: (k: string) => void;
  feedback?: boolean;
  showMeta?: boolean;
  footer?: ReactNode;
}) {
  const [showStim, setShowStim] = useState(true);
  const prompt = (
    <div className="prompt">
      {item.task && item.mode === 'reveal' && <p className="task">{item.task}</p>}
      <p>{item.prompt}</p>
    </div>
  );
  if (item.category === 'abstract') {
    return (
      <div className="item abstract">
        {showMeta && <ItemMeta item={item} />}
        <AbstractSeries item={item} annotate={false} showAnswer={false} />
        {prompt}
        <Options item={item} chosen={chosen} onChoose={onChoose} feedback={feedback} />
        {footer}
        {feedback && <Explanation item={item} chosen={chosen} />}
      </div>
    );
  }
  return (
    <div className="item two-pane">
      {showMeta && <ItemMeta item={item} />}
      <div className="panes">
        <div className={`stimulus ${showStim ? '' : 'collapsed'}`}>
          <button className="stim-toggle" onClick={() => setShowStim(!showStim)}>
            {showStim ? 'Hide' : 'Show'} {item.category === 'verbal' ? 'passage' : 'data'}
          </button>
          <div className="stim-body">
            {item.category === 'verbal' ? <VerbalStimulus item={item} showEvidence={feedback} /> : <NumericalStimulus item={item} />}
          </div>
        </div>
        <div className="question">
          {prompt}
          <Options item={item} chosen={chosen} onChoose={onChoose} feedback={feedback} />
          {footer}
        </div>
      </div>
      {feedback && <Explanation item={item} chosen={chosen} />}
    </div>
  );
}

