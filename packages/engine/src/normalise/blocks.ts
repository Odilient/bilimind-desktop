// Port of BlockPayloadNormaliser.php for the enabled block types (engine-port.md §4 table). Aliases are folded
// into the canonical keys of core PAYLOAD_SCHEMAS; a payload that cannot be repaired returns null (the block is
// dropped, never the lesson). Optional keys are OMITTED rather than null, because the core schemas are
// `.optional()`. HACKATHON: code exercises are JavaScript `function`/`debug` only (the page and the Coder's
// node:vm run JavaScript; Python/SQL/HTML exercises are P2), and playground keys are lower-cased.
import type { EnabledBlockType } from '@bilimind/core';
import { cap, compact, isObj, letter, number, stringList, text, textOf, words } from './util.ts';
import type { Raw } from './util.ts';

export interface PayloadContext {
  /** BCP-47 tag used when a speaking/dialogue/audio block names no language. */
  language: string;
}
export interface PayloadResult { payload: Raw | null; why?: string }

/** Mermaid diagram headers we are willing to persist (BlockPayloadNormaliser::MERMAID_HEADERS). */
export const MERMAID_HEADERS = ['flowchart', 'graph', 'sequencediagram', 'statediagram', 'statediagram-v2', 'classdiagram',
  'erdiagram', 'journey', 'gantt', 'pie', 'mindmap', 'timeline', 'quadrantchart', 'gitgraph', 'requirementdiagram'];

/** BlockPayloadNormaliser::isPlausibleMermaid (WP3's validate has its own copy for `check`). */
export function plausibleMermaid(source: string): boolean {
  if (source === '' || [...source].length > 6000) return false;
  const lines = source.split(/\r?\n/);
  if (lines.length > 60) return false;
  const header = (lines[0] ?? '').trim().toLowerCase().split(' ')[0]!.replace(/^[\s;]+|[\s;]+$/g, '');
  if (!MERMAID_HEADERS.includes(header)) return false;
  if (/<\s*(script|iframe|object|embed)/i.test(source)) return false;
  for (const [o, c] of [['[', ']'], ['(', ')'], ['{', '}']] as const) if (source.split(o).length !== source.split(c).length) return false;
  return (source.split('"').length - 1) % 2 === 0;
}

const FORBIDDEN_JS = ['import', 'require(', 'fetch(', 'xmlhttprequest', 'while', 'eval(', 'function(', '=>', 'settimeout',
  'setinterval', 'document', 'window', 'globalthis', 'localstorage', 'postmessage', 'worker', 'math.random', 'new function', 'constructor'];

/** BlockPayloadNormaliser::isSafeFormula: exactly `function compute(p) {...}`, no banned tokens, every p.x is an input. */
export function safeFormula(formula: string, keys: string[]): boolean {
  if (formula === '' || [...formula].length > 1200) return false;
  const m = /^function\s+compute\s*\(\s*([a-z_][a-z0-9_]*)\s*\)\s*\{([\s\S]+)\}\s*$/i.exec(formula);
  if (!m) return false;
  const [, param, body] = m as unknown as [string, string, string];
  const lower = body.toLowerCase();
  if (FORBIDDEN_JS.some(b => lower.includes(b)) || !lower.includes('return')) return false;
  const reads = [...body.matchAll(new RegExp(`\\b${param}\\s*\\.\\s*([a-z_][a-z0-9_]*)`, 'gi'))].map(r => r[1]!);
  return reads.length > 0 && reads.every(r => keys.includes(r));
}

const LANGUAGE_ALIASES: Record<string, string> = {
  js: 'javascript', node: 'javascript', nodejs: 'javascript', ecmascript: 'javascript', vanillajs: 'javascript',
  py: 'python', python3: 'python', py3: 'python', cpython: 'python',
  sqlite: 'sql', sqlite3: 'sql', postgres: 'sql', postgresql: 'sql', psql: 'sql', mysql: 'sql', tsql: 'sql', plsql: 'sql',
  htm: 'html', html5: 'html', css: 'html', markup: 'html',
};
const RUNNABLE = ['javascript', 'python', 'sql', 'html'];

export function codeLanguageOf(payload: Raw): string | null {
  const lower = (text(payload, 'language') ?? 'javascript').toLowerCase();
  // "Python 3", "JavaScript (ES6)": the whole token stripped, then its first word, then the aliases
  for (const raw of [lower.replace(/[^a-z0-9]/g, ''), (lower.split(/[\s(/,]+/)[0] ?? '').replace(/[^a-z0-9]/g, '')]) {
    const lang = LANGUAGE_ALIASES[raw] ?? raw;
    if (RUNNABLE.includes(lang)) return lang;
  }
  return null;
}

/** Unique test names (core: grading counts passed names): a repeat gets " (2)", " (3)". */
function uniqueNames<T extends { name: string }>(tests: T[]): T[] {
  const seen = new Map<string, number>();
  return tests.map(t => {
    const n = (seen.get(t.name) ?? 0) + 1;
    seen.set(t.name, n);
    return n === 1 ? t : { ...t, name: `${t.name} (${n})` };
  });
}

/** codeTests(): function/debug tests {name, call, expect}; `expect` must be present (null is a value). */
function codeTests(v: unknown): { name: string; call: string; expect: unknown }[] {
  if (!Array.isArray(v)) return [];
  const out: { name: string; call: string; expect: unknown }[] = [];
  v.forEach((row, i) => {
    if (!isObj(row) || out.length >= 12) return;
    const call = text(row, 'call');
    if (call === null || !('expect' in row) || row.expect === undefined) return;
    out.push({ name: cap(text(row, 'name') ?? `test ${i + 1}`, 190, ''), call, expect: row.expect });
  });
  return uniqueNames(out);
}

/**
 * G2 review: a "Done looks like ..." line the model writes in prose contradicted its own tests (insert 49 "returns 2
 * at index 0" while the test expects 4 probes at index 2). The line is rebuilt from the first test, so it cannot.
 */
const DONE_LINE = /^[ \t>*_-]*(?:\*\*|__)?\s*done looks like\b.*$/gim;
export function doneFromTests(instructions: string, tests: { call: string; expect: unknown }[]): string {
  if (!DONE_LINE.test(instructions)) return instructions;
  DONE_LINE.lastIndex = 0;
  const t = tests[0];
  if (!t) return instructions.replace(DONE_LINE, '').replace(/\n{3,}/g, '\n\n').trim();
  let shown: string;
  try { shown = JSON.stringify(t.expect) ?? String(t.expect); } catch { shown = String(t.expect); }
  return instructions.replace(DONE_LINE, `**Done looks like:** \`${t.call}\` returns \`${cap(shown, 160)}\`.`);
}

function code(p: Raw): PayloadResult {
  const instructions0 = text(p, 'instructions_markdown');
  const instructions = instructions0 === null ? null : doneFromTests(instructions0, codeTests(p.tests));
  const language = codeLanguageOf(p);
  if (instructions === null) return { payload: null, why: 'a code block had no instructions' };
  if (language === null) return { payload: null, why: `a code block in ${text(p, 'language') ?? 'an unknown language'} was dropped (the sandbox runs javascript only)` };
  if (language !== 'javascript') return { payload: null, why: `a ${language} code block was dropped (HACKATHON: the page runs JavaScript only)` };
  let mode = (text(p, 'mode') ?? 'function').toLowerCase();
  if (mode !== 'function' && mode !== 'debug') {
    if (mode === 'script' || mode === 'query' || mode === 'build') return { payload: null, why: `a javascript ${mode} exercise was dropped (only function mode runs in the page)` };
    mode = 'function';
  }
  const starter = text(p, 'starter_code') ?? '';
  const symptom = textOf(p, 'symptom_markdown', 'symptom');
  if (mode === 'debug' && (symptom === null || starter.trim() === '')) mode = 'function';
  const hints = stringList(p.hints, 3).map(h => cap(h, 200));
  return {
    payload: compact({
      mode, language, starter_code: starter, instructions_markdown: instructions,
      tests: codeTests(p.tests),
      hints: hints.length ? hints : null,
      symptom_markdown: mode === 'debug' ? symptom : null,
    }),
  };
}

/** G2 review: "Four items. Two of them ..." goes stale when an item is excluded: count sentences are dropped. */
const COUNT_SENTENCE = /\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(items?|questions?|of them|of these)\b/i;
export function quizIntro(intro: string | null): string | null {
  if (!intro || !COUNT_SENTENCE.test(intro)) return intro;
  const kept = intro.split(/(?<=[.!?])\s+/).filter(sn => !COUNT_SENTENCE.test(sn)).join(' ').trim();
  return kept || null;
}

function walkthrough(p: Raw): PayloadResult {
  if (!Array.isArray(p.steps)) return { payload: null, why: 'a walkthrough had no steps' };
  const steps: Raw[] = [];
  p.steps.forEach((row, i) => {
    if (!isObj(row) || steps.length >= 12) return;
    const detail = textOf(row, 'detail_markdown', 'detail', 'markdown');
    if (detail === null) return;
    steps.push(compact({ n: steps.length + 1, title: text(row, 'title') ?? `Step ${i + 1}`, detail_markdown: detail,
      warning: text(row, 'warning'), check: textOf(row, 'check', 'verify') }));
  });
  return steps.length < 3 ? { payload: null, why: `a walkthrough had ${steps.length} usable steps (needs 3)` }
    : { payload: compact({ intro: text(p, 'intro'), steps }) };
}

function checklist(p: Raw): PayloadResult {
  if (!Array.isArray(p.items)) return { payload: null, why: 'a checklist had no items' };
  const items: Raw[] = [];
  for (const row of p.items) {
    const t = isObj(row) ? text(row, 'text') : typeof row === 'string' ? row.trim() : null;
    if (!t) continue;
    items.push(compact({ text: cap(t, 300), why: isObj(row) ? text(row, 'why') : null }));
    if (items.length >= 14) break;
  }
  return items.length < 3 ? { payload: null, why: `a checklist had ${items.length} usable items (needs 3)` }
    : { payload: compact({ title: text(p, 'title') ?? 'Before you move on', items, note: text(p, 'note') }) };
}

function diagram(p: Raw): PayloadResult {
  let source = textOf(p, 'source', 'mermaid', 'code');
  if (source === null) return { payload: null, why: 'a diagram had no Mermaid source' };
  source = source.replace(/^```(?:mermaid)?\s*|\s*```$/gm, '').trim();
  if (!plausibleMermaid(source)) return { payload: null, why: 'a diagram was dropped: its Mermaid source would not parse' };
  const caption = text(p, 'caption');
  return { payload: compact({ format: 'mermaid', source, caption,
    alt_text: textOf(p, 'alt_text', 'alt') ?? caption ?? 'A diagram of the mechanism this lesson explains.' }) };
}

/** G2 review: the player prints "<name> is best for <best_for>": "You cannot predict n" -> "you cannot predict n" (acronyms kept). */
export function bestFor(v: string | null): string | null {
  if (!v) return v;
  const t = v.replace(/^best for:?\s*/i, '');
  return /^[A-Z][a-z'’]*(\s|$|,)/.test(t) && !/^I(\s|')/.test(t) ? t[0]!.toLowerCase() + t.slice(1) : t;
}

function comparison(p: Raw): PayloadResult {
  const axes = stringList(p.axes, 6);
  if (axes.length < 2 || !Array.isArray(p.items)) return { payload: null, why: 'a comparison needs at least 2 axes and a list of items' };
  const items: Raw[] = [];
  for (const row of p.items) {
    if (!isObj(row)) continue;
    const name = textOf(row, 'name', 'title');
    if (name === null) continue;
    let values = stringList(row.values, axes.length);
    if (!values.length) continue;
    values = [...values.slice(0, axes.length), ...Array(Math.max(0, axes.length - values.length)).fill('—')];
    items.push(compact({ name, values, best_for: bestFor(textOf(row, 'best_for', 'use_when')) }));
    if (items.length >= 5) break;
  }
  return items.length < 2 ? { payload: null, why: 'a comparison had fewer than 2 usable items' }
    : { payload: compact({ intro: text(p, 'intro'), axes, items }) };
}

function cells(row: unknown[], width: number): string[] | null {
  const c = row.map(x => (typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean' ? String(x).trim() : ''));
  if (!c.some(x => x !== '')) return null;
  return [...c.slice(0, width), ...Array(Math.max(0, width - c.length)).fill('')];
}

function referenceTable(p: Raw): PayloadResult {
  const columns = stringList(p.columns, 8);
  if (columns.length < 2 || !Array.isArray(p.rows)) return { payload: null, why: 'a reference table needs 2+ columns and rows' };
  const rows: string[][] = [];
  for (const row of p.rows) {
    const c = Array.isArray(row) ? cells(row, columns.length)
      : isObj(row) ? cells(columns.map(col => row[col] ?? ''), columns.length) : null;   // {"Column": "value"} rows
    if (c) rows.push(c);
    if (rows.length >= 20) break;
  }
  return rows.length < 2 ? { payload: null, why: 'a reference table had fewer than 2 rows' }
    : { payload: compact({ title: text(p, 'title') ?? 'Quick reference', columns, rows, note: text(p, 'note') }) };
}

function scenario(p: Raw): PayloadResult {
  const setup = textOf(p, 'setup_markdown', 'setup');
  if (setup === null || !Array.isArray(p.steps)) return { payload: null, why: 'a scenario had no setup or steps' };
  const steps: { id: string; prompt: string; options: Raw[] }[] = [];
  const ids = new Set<string>();
  p.steps.forEach((row, i) => {
    if (!isObj(row) || steps.length >= 6) return;
    const prompt = textOf(row, 'prompt', 'question');
    const options = scenarioOptions(row.options);
    if (prompt === null || options.length < 2) return;
    let id = text(row, 'id') ?? `s${i + 1}`;
    if (ids.has(id)) id = `s${i + 1}_${steps.length + 1}`;
    ids.add(id);
    steps.push({ id, prompt, options });
  });
  if (!steps.length) return { payload: null, why: 'a scenario had no step with 2+ options' };
  for (const st of steps) for (const o of st.options) if (o.next_id != null && !ids.has(String(o.next_id))) o.next_id = null;   // never a dead end
  return { payload: compact({ setup_markdown: setup, steps, debrief_markdown: textOf(p, 'debrief_markdown', 'debrief') }) };
}

function scenarioOptions(v: unknown): Raw[] {
  if (!Array.isArray(v)) return [];
  const out: Raw[] = [];
  const seen = new Set<string>();
  v.forEach((row, i) => {
    if (!isObj(row) || out.length >= 5) return;
    const t = textOf(row, 'text', 'label');
    if (t === null) return;
    const id = text(row, 'id') ?? letter(i);
    if (seen.has(id)) return;
    seen.add(id);
    const correct = row.correct === true || row.correct === 'true' || row.correct === 1 || row.correct === '1';
    out.push({ id, text: t, correct,
      outcome_markdown: textOf(row, 'outcome_markdown', 'outcome') ?? (correct ? 'This is the right call here.' : 'This is not the best call here.'),
      next_id: text(row, 'next_id') });
  });
  let seenCorrect = false;   // exactly one right answer per step: later ones are demoted
  for (const o of out) { if (o.correct && seenCorrect) o.correct = false; if (o.correct) seenCorrect = true; }
  return out;
}

function workedExample(p: Raw): PayloadResult {
  const problem = textOf(p, 'problem_markdown', 'problem');
  if (problem === null || !Array.isArray(p.steps)) return { payload: null, why: 'a worked example had no problem or steps' };
  const steps: { expression: string; explanation: string }[] = [];
  for (const row of p.steps) {
    if (!isObj(row)) continue;
    const expression = textOf(row, 'expression', 'math', 'code');
    const explanation = textOf(row, 'explanation', 'why');
    if (expression === null && explanation === null) continue;
    steps.push({ expression: expression ?? explanation ?? '', explanation: explanation ?? '' });
    if (steps.length >= 12) break;
  }
  if (steps.length < 2) return { payload: null, why: 'a worked example had fewer than 2 steps' };
  return { payload: { problem_markdown: problem, steps, answer: text(p, 'answer') ?? steps[steps.length - 1]!.expression,
    common_mistakes: stringList(p.common_mistakes, 5) } };
}

function playground(p: Raw): PayloadResult {
  let formula = textOf(p, 'formula_js', 'formula');
  const inputs: Raw[] = [];
  const seen = new Set<string>();
  const renames: [string, string][] = [];
  for (const row of Array.isArray(p.inputs) ? p.inputs : []) {
    if (!isObj(row) || inputs.length >= 3) continue;
    const raw = textOf(row, 'key', 'name');
    if (raw === null || !/^[a-z_][a-z0-9_]{0,31}$/i.test(raw)) continue;
    const key = raw.toLowerCase();                       // HACKATHON: core requires lower-case keys
    if (seen.has(key)) continue;
    const min = number(row.min) ?? 0;
    const max = number(row.max) ?? min + 100;
    if (max <= min) continue;
    const step = number(row.step) ?? Math.round(((max - min) / 100) * 1e4) / 1e4;
    const def = number(row.default) ?? Math.round(((min + max) / 2) * 1e4) / 1e4;
    seen.add(key);
    if (key !== raw) renames.push([raw, key]);
    inputs.push(compact({ key, label: text(row, 'label') ?? key, min, max, step: step > 0 ? step : 1, default: Math.max(min, Math.min(max, def)), unit: text(row, 'unit') }));
  }
  if (formula === null || !inputs.length) return { payload: null, why: 'a playground had no formula or no usable inputs' };
  formula = formula.replace(/^```(?:js|javascript)?\s*|\s*```$/gm, '').trim();
  for (const [from, to] of renames) formula = formula.replace(new RegExp(`\\.\\s*${from}\\b`, 'g'), `.${to}`);
  if (!safeFormula(formula, inputs.map(i => String(i.key)))) return { payload: null, why: 'a playground was dropped: its formula is not a safe `function compute(i) {...}`' };
  return { payload: compact({ inputs, formula_js: formula, output_label: text(p, 'output_label') ?? 'Result', output_unit: text(p, 'output_unit'),
    guidance_markdown: textOf(p, 'guidance_markdown', 'guidance') ?? 'Drag the sliders and watch where the result changes fastest.' }) };
}

function timeline(p: Raw): PayloadResult {
  if (!Array.isArray(p.events)) return { payload: null, why: 'a timeline had no events' };
  const events: Raw[] = [];
  for (const row of p.events) {
    if (!isObj(row)) continue;
    const when = textOf(row, 'when', 'date', 'year');
    const title = textOf(row, 'title', 'event');
    if (when === null || title === null) continue;
    events.push({ when: cap(when, 60, ''), title, detail: textOf(row, 'detail', 'description') ?? '' });
    if (events.length >= 12) break;
  }
  return events.length < 3 ? { payload: null, why: 'a timeline had fewer than 3 events' } : { payload: { events } };
}

const languageTag = (p: Raw, ctx: PayloadContext) => cap(textOf(p, 'language', 'lang') ?? ctx.language, 32, '');

function audio(p: Raw, ctx: PayloadContext): PayloadResult {
  const script = textOf(p, 'script_markdown', 'script');
  if (script === null || words(script) < 20) return { payload: null, why: 'an audio script was under 20 words' };
  const spoken = script.replace(/```[\s\S]*?```/g, '').replace(/[*_`#>]+/g, '').replace(/\[(.*?)\]\(.*?\)/g, '$1').replace(/\s{2,}/g, ' ').trim();
  if (!spoken) return { payload: null, why: 'an audio script was empty once markdown was stripped' };
  return { payload: compact({ script_markdown: spoken, voice_hint: text(p, 'voice_hint'), language: languageTag(p, ctx),
    duration_estimate_s: Math.max(15, Math.round(words(spoken) / 2.5)) }) };
}

function speaking(p: Raw, ctx: PayloadContext): PayloadResult {
  const raw = Array.isArray(p.items) ? p.items : Array.isArray(p.phrases) ? p.phrases : null;
  if (!raw) return { payload: null, why: 'a speaking block had no items' };
  const items: Raw[] = [];
  for (const row of raw) {
    const t = isObj(row) ? textOf(row, 'text', 'phrase') : typeof row === 'string' ? row.trim() : null;
    if (!t) continue;
    items.push(compact({ text: cap(t, 240, ''), translation: isObj(row) ? textOf(row, 'translation', 'gloss') : null,
      phonetic: isObj(row) ? textOf(row, 'phonetic', 'ipa') : null }));
    if (items.length >= 12) break;
  }
  return items.length < 2 ? { payload: null, why: 'a speaking block had fewer than 2 phrases' }
    : { payload: compact({ intro_markdown: textOf(p, 'intro_markdown', 'intro'), language: languageTag(p, ctx), items, voice_hint: text(p, 'voice_hint') }) };
}

function dialogue(p: Raw, ctx: PayloadContext): PayloadResult {
  const scenarioText = textOf(p, 'scenario_markdown', 'scenario');
  const goal = textOf(p, 'goal', 'objective');
  if (scenarioText === null || goal === null) return { payload: null, why: 'a dialogue had no scenario or goal' };
  const hints = stringList(Array.isArray(p.hints) ? p.hints : p.useful_phrases, 6);
  return { payload: compact({
    scenario_markdown: scenarioText, language: languageTag(p, ctx),
    ai_role: textOf(p, 'ai_role', 'tutor_role') ?? 'your conversation partner',
    learner_role: textOf(p, 'learner_role', 'your_role') ?? 'you',
    goal, opening_line: textOf(p, 'opening_line', 'opener'), hints: hints.length ? hints : null,
  }) };
}

function misconception(p: Raw): PayloadResult {
  const belief = textOf(p, 'belief', 'misconception');
  const seems = textOf(p, 'why_it_seems_right', 'grain_of_truth');
  const isTrue = textOf(p, 'what_is_true', 'correction_markdown');
  if (belief === null || seems === null || isTrue === null) return { payload: null, why: 'a misconception lacked its belief, grain of truth or correction' };
  return { payload: compact({ belief, why_it_seems_right: seems, what_is_true: isTrue, tell: textOf(p, 'tell', 'how_to_catch_it') }) };
}

const need = (p: Raw, key: string, build: () => Raw, what: string): PayloadResult =>
  text(p, key) === null ? { payload: null, why: what } : { payload: build() };

/** One payload, by type. Unknown/disabled types are the caller's business (they never reach here). */
export function normalisePayload(type: EnabledBlockType, payload: unknown, ctx: PayloadContext): PayloadResult {
  const p: Raw = isObj(payload) ? payload : {};
  switch (type) {
    case 'explainer': return need(p, 'markdown', () => ({ markdown: text(p, 'markdown')! }), 'an explainer was empty');
    case 'example': return need(p, 'markdown', () => ({ title: text(p, 'title') ?? 'Worked example', markdown: text(p, 'markdown')! }), 'an example had no markdown');
    case 'key_points': { const points = stringList(p.points, 12); return points.length ? { payload: { points } } : { payload: null, why: 'key points were empty' }; }
    case 'analogy': {
      const md = textOf(p, 'markdown', 'analogy_markdown'), lim = textOf(p, 'breaks_down_when', 'limits');
      return md === null || lim === null ? { payload: null, why: 'an analogy without `breaks_down_when` was dropped' } : { payload: { markdown: md, breaks_down_when: lim } };
    }
    case 'misconception': return misconception(p);
    case 'walkthrough': return walkthrough(p);
    case 'checklist': return checklist(p);
    case 'project': return need(p, 'brief_markdown', () => ({ title: text(p, 'title') ?? 'Project', brief_markdown: text(p, 'brief_markdown')!,
      deliverables: stringList(p.deliverables, 8) }), 'a project had no brief');
    case 'code': return code(p);
    case 'diagram': return diagram(p);
    case 'timeline': return timeline(p);
    case 'comparison': return comparison(p);
    case 'reference_table': return referenceTable(p);
    case 'flashcards': {
      const cards: { front: string; back: string }[] = [];
      for (const row of Array.isArray(p.cards) ? p.cards : []) {
        const front = text(row, 'front'), back = text(row, 'back');
        if (front !== null && back !== null) cards.push({ front, back });
        if (cards.length >= 20) break;
      }
      return cards.length ? { payload: { cards } } : { payload: null, why: 'flashcards had no complete card' };
    }
    case 'scenario': return scenario(p);
    case 'worked_example': return workedExample(p);
    case 'playground': return playground(p);
    case 'speaking': return speaking(p, ctx);
    case 'dialogue': return dialogue(p, ctx);
    case 'quiz': return { payload: compact({ intro: quizIntro(text(p, 'intro')) }) };
    case 'audio': return audio(p, ctx);
    case 'reflection': return need(p, 'prompt', () => ({ prompt: text(p, 'prompt')! }), 'a reflection had no prompt');
  }
}
