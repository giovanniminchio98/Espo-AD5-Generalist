import { useCallback, useEffect, useRef, useState } from 'react';

type Op = '+' | '−' | '×' | '÷' | null;

function apply(a: number, b: number, op: Op): number {
  switch (op) {
    case '+':
      return a + b;
    case '−':
      return a - b;
    case '×':
      return a * b;
    case '÷':
      return b === 0 ? NaN : a / b;
    default:
      return b;
  }
}

function show(x: number): string {
  if (!Number.isFinite(x)) return 'Error';
  const s = Number(x.toPrecision(12)).toString();
  return s.length > 14 ? x.toExponential(8) : s;
}

/** A basic four-function calculator, like the one available on screen in the real test. */
export function Calculator({ onClose }: { onClose: () => void }) {
  const [display, setDisplay] = useState('0');
  const [acc, setAcc] = useState<number | null>(null);
  const [op, setOp] = useState<Op>(null);
  const [fresh, setFresh] = useState(true);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  const digit = useCallback(
    (d: string) => {
      if (fresh || display === '0' || display === 'Error') {
        setDisplay(d === '.' ? '0.' : d);
        setFresh(false);
      } else if (!(d === '.' && display.includes('.')) && display.length < 14) setDisplay(display + d);
    },
    [display, fresh],
  );

  const operator = useCallback(
    (o: Op) => {
      const cur = Number(display);
      if (acc !== null && op && !fresh) {
        const r = apply(acc, cur, op);
        setAcc(r);
        setDisplay(show(r));
      } else setAcc(cur);
      setOp(o);
      setFresh(true);
    },
    [acc, display, fresh, op],
  );

  const equals = useCallback(() => {
    if (acc === null || !op) return;
    const r = apply(acc, Number(display), op);
    setDisplay(show(r));
    setAcc(null);
    setOp(null);
    setFresh(true);
  }, [acc, display, op]);

  const clear = () => {
    setDisplay('0');
    setAcc(null);
    setOp(null);
    setFresh(true);
  };
  const back = () => {
    if (fresh) return;
    setDisplay(display.length > 1 ? display.slice(0, -1) : '0');
  };
  const percent = () => {
    const cur = Number(display);
    // a + b% → a + (a × b / 100), as on most desk calculators; otherwise b / 100.
    const v = acc !== null && (op === '+' || op === '−') ? (acc * cur) / 100 : cur / 100;
    setDisplay(show(v));
    setFresh(false);
  };
  const negate = () => setDisplay(show(-Number(display)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'TEXTAREA' || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (/^[0-9.]$/.test(e.key)) digit(e.key);
      else if (e.key === '+') operator('+');
      else if (e.key === '-') operator('−');
      else if (e.key === '*') operator('×');
      else if (e.key === '/') {
        e.preventDefault();
        operator('÷');
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        equals();
      } else if (e.key === 'Backspace') back();
      else if (e.key === 'Escape') clear();
      else return;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const onPointerDown = (e: React.PointerEvent) => {
    const box = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    drag.current = { dx: e.clientX - box.left, dy: e.clientY - box.top };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setPos({ x: Math.max(0, e.clientX - drag.current.dx), y: Math.max(0, e.clientY - drag.current.dy) });
  };

  const keys: [string, () => void, string?][] = [
    ['C', clear, 'fn'], ['←', back, 'fn'], ['%', percent, 'fn'], ['÷', () => operator('÷'), 'op'],
    ['7', () => digit('7')], ['8', () => digit('8')], ['9', () => digit('9')], ['×', () => operator('×'), 'op'],
    ['4', () => digit('4')], ['5', () => digit('5')], ['6', () => digit('6')], ['−', () => operator('−'), 'op'],
    ['1', () => digit('1')], ['2', () => digit('2')], ['3', () => digit('3')], ['+', () => operator('+'), 'op'],
    ['±', negate, 'fn'], ['0', () => digit('0')], ['.', () => digit('.')], ['=', equals, 'eq'],
  ];

  return (
    <div className="calculator" style={pos ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' } : undefined} role="dialog" aria-label="Calculator">
      <div className="calc-head" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={() => (drag.current = null)}>
        <span>Calculator</span>
        <button className="icon-btn" onClick={onClose} aria-label="Close calculator">
          ×
        </button>
      </div>
      <div className="calc-display" aria-live="polite">
        <small>{acc !== null && op ? `${show(acc)} ${op}` : ' '}</small>
        {display}
      </div>
      <div className="calc-keys">
        {keys.map(([k, fn, cls]) => (
          <button key={k} className={`calc-key ${cls ?? ''}`} onClick={fn}>
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}
