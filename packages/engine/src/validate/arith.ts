// G2 review: recompute the simple arithmetic a model writes ("69 mod 10 = 9", "9/11 = 0.82", "1/2(1 + 1/(1-0.75)^2) = 8.5").
// Used on a numeric item's `work` (draft normaliser, check Q9, rewrite-item) so a derivation that says 69 mod 10 = 5
// never ships as an answer key. Conservative: anything that is not plain numbers and + - * / % ^ ( ) is skipped.

export interface ArithSlip { expr: string; said: number; real: number }

/** A tiny recursive-descent evaluator: + - * / % ^, parentheses, unary minus, implicit multiply "2(3+4)". null = not plain arithmetic. */
export function evalArith(src: string): number | null {
  const s = src.replace(/\s+/g, '');
  let i = 0;
  const peek = () => s[i];
  const num = (): number | null => {
    const m = /^\d+(?:\.\d+)?|^\.\d+/.exec(s.slice(i));
    if (!m) return null;
    i += m[0].length;
    return Number(m[0]);
  };
  const primary = (): number | null => {
    if (peek() === '-') { i++; const v = primary(); return v === null ? null : -v; }
    if (peek() === '(') {
      i++;
      const v = sum();
      if (v === null || peek() !== ')') return null;
      i++;
      return v;
    }
    return num();
  };
  const power = (): number | null => {
    const b = primary();
    if (b === null) return null;
    if (peek() === '^') { i++; const e = power(); return e === null ? null : b ** e; }
    return b;
  };
  const product = (): number | null => {
    let v = power();
    while (v !== null) {
      const op = peek();
      if (op === '*' || op === '/' || op === '%') {
        i++;
        const r = power();
        if (r === null) return null;
        if ((op === '/' || op === '%') && r === 0) return null;
        v = op === '*' ? v * r : op === '/' ? v / r : v % r;
      } else if (op === '(') {               // implicit multiply: 1/2(1 + a)
        const r = power();
        if (r === null) return null;
        v = v * r;
      } else break;
    }
    return v;
  };
  const sum = (): number | null => {
    let v = product();
    while (v !== null && (peek() === '+' || peek() === '-')) {
      const op = s[i++];
      const r = product();
      if (r === null) return null;
      v = op === '+' ? v + r : v - r;
    }
    return v;
  };
  if (!s) return null;
  const v = sum();
  return v !== null && i === s.length && Number.isFinite(v) ? v : null;
}

/** Words and symbols models use for operators, rewritten to the evaluator's. */
export function plainArith(text: string): string {
  return String(text ?? '')
    .replace(/(\d),(\d{3})(?!\d)/g, '$1$2')                 // 1,234 -> 1234
    .replace(/[−–]/g, '-')
    .replace(/(\d|\))\s*[×x·]\s*(?=[\d(])/g, '$1*')
    .replace(/÷/g, '/')
    .replace(/\s+mod\s+/gi, ' % ')
    .replace(/\*\*/g, '^');
}

const decimals = (n: string) => (n.split('.')[1] ?? '').length;

/**
 * Every "<arithmetic> = <number>" (or ≈) in a text whose left side is plain arithmetic with at least one operator,
 * where the number is wrong at the precision it is written with (rounded or truncated: 9/11 = 0.82 or 0.81, 5/2 = 2).
 */
export function arithmeticSlips(text: string): ArithSlip[] {
  const out: ArithSlip[] = [];
  for (const seg of plainArith(text).split(/[;\n→⇒]|=>|\.\s+(?=[A-Za-z])/)) {
    const parts = seg.split(/(=|≈)/);
    for (let p = 0; p + 2 < parts.length; p += 2) {
      const left = parts[p]!, rel = parts[p + 1]!, right = parts[p + 2]!;
      const m = /[\d\s.+\-*/%^()]+$/.exec(left);
      if (!m) continue;
      const expr = m[0].replace(/^[\s+*/%^)]+/, '').trim();
      if (!/[\d)]\s*[+\-*/%^(]\s*[-(.\d]/.test(expr)) continue;   // needs a binary operator between operands
      const said = /^\s*(-?\d+(?:\.\d+)?)(?!\s*[+\-*/%^(\d]|\.\d)/.exec(right);
      if (!said) continue;
      const real = evalArith(expr);
      if (real === null) continue;
      const n = Number(said[1]);
      const d = decimals(said[1]!);
      const scale = 10 ** d;
      const ok = rel === '≈'
        ? Math.abs(real - n) <= Math.max(Math.abs(real) * 0.02, 0.5 / scale) + 1e-9
        : Math.abs(real - n) <= 0.5 / scale + 1e-9 || Math.abs(Math.trunc(real * scale + 1e-9) / scale - n) < 1e-9;   // rounded or truncated (5/2 = 2)
      if (!ok) out.push({ expr, said: n, real: Math.round(real * 1e6) / 1e6 });
    }
  }
  return out;
}

/** The last number written in a derivation ("...; 1 probe" -> 1). */
export function lastNumber(work: string): number | null {
  const tail = plainArith(work).replace(/(\s*\((?:[^()]|\([^()]*\))*\)[\s.]*)+$/, '');   // "... 2.5 probes (alpha = 0.5)." ends in 2.5
  const all = [...tail.matchAll(/(?:(?<=^|[\s=(:,])-)?\d+(?:\.\d+)?/g)].map(m => Number(m[0]));   // "0-8" is a range, not -8
  const v = all.pop();
  return v !== undefined && Number.isFinite(v) ? v : null;
}

/** Problems with a numeric item's `work` against its key value: [] when it checks out (or there is no work). */
export function workProblems(work: unknown, value: number, tolerance?: number | null): string[] {
  if (typeof work !== 'string' || !work.trim()) return [];
  const out: string[] = [];
  for (const sl of arithmeticSlips(work)) out.push(`its working says ${sl.expr} = ${sl.said}, but that is ${sl.real}`);
  const last = lastNumber(work);
  const tol = Math.max(tolerance ?? 0, Number.isInteger(value) ? 0 : Math.abs(value) * 0.01, 1e-9);
  if (last !== null && Math.abs(last - value) > tol) out.push(`its working ends in ${last} but the key says ${value}`);
  return out;
}
