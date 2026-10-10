// lessons/NN-<key>.md: Obsidian notes. Callouts, task lists, mermaid fences, and every citation as a
// `> [!quote]- Source:` callout that links to the page in sources/. Answers sit in collapsed callouts.
// Owner: WP4.
import { LEARNER_TAG } from '@bilimind/core';
import type { Cite, Course, CourseAssessment, CourseBlock, CourseLesson } from '@bilimind/core';
import type { ToMarkdown } from '../contracts.ts';
import { shortDay } from './time.ts';

const yaml = (s: string) => JSON.stringify(s);
const quoteLines = (text: string, prefix = '> ') => text.split(/\r?\n/).map(l => (l.trim() ? prefix + l : prefix.trimEnd())).join('\n');
const cell = (s: unknown) => String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const LANG_FENCE: Record<string, string> = { javascript: 'js', python: 'python', sql: 'sql', html: 'html' };

function sourceLabel(course: Course, file: string): string {
  const s = course.sources.find(x => x.file === file);
  return s?.short || s?.title || file.replace(/^sources\//, '');
}
function citeCallout(course: Course, c: Cite): string {
  const href = `../${c.file}${c.page ? `#page=${c.page}` : ''}`;
  return [
    `> [!quote]- Source: ${sourceLabel(course, c.file)} · ${c.locator}`,
    quoteLines(`"${c.quote}"`),
    ...(c.excerpt && c.excerpt !== c.quote ? ['>', quoteLines(c.excerpt)] : []),
    `> [Open the page](<${href}>)`,
  ].join('\n');
}

function answerText(a: CourseAssessment): string {
  const opt = (id: string) => {
    const o = 'options' in a ? a.options?.find(x => x.id === id) : undefined;
    return o ? `${o.id}) ${o.text}` : id;
  };
  switch (a.kind) {
    case 'mcq': case 'multi_select': return a.answer_key.correct_option_ids.map(opt).join('; ');
    case 'ordering': return a.answer_key.correct_order.map(opt).join(' → ');
    case 'numeric': return `${a.answer_key.value}${a.answer_key.unit ? ` ${a.answer_key.unit}` : ''}${a.answer_key.tolerance ? ` (± ${a.answer_key.tolerance})` : ''}`;
    case 'cloze': return a.answer_key.accepted.join(' / ');
    case 'code': return 'Run the tests in the course page.';
    default: return a.answer_key?.reference_answer ?? 'Mark it yourself against the rubric.';
  }
}

function itemMd(course: Course, a: CourseAssessment, i: number): string {
  const out: string[] = [`> [!question] Q${i + 1} · ${a.kind.replace('_', ' ')}`, quoteLines(a.prompt)];
  if ('options' in a && a.options?.length && a.kind !== 'ordering') out.push('>', ...a.options.map(o => `> - ${o.id}) ${o.text}`));
  if (a.kind === 'ordering') out.push('>', '> Put in order:', ...a.options.map(o => `> - ${o.id}) ${o.text}`));
  if (a.labels?.includes('beyond_slides')) out.push('>', '> *Beyond your slides: the Checker found no support for this in your files.*');
  const ans = [`> [!success]- Answer`, quoteLines(answerText(a))];
  if (a.explanation) ans.push('>', quoteLines(a.explanation));
  if (a.rubric?.length) ans.push('>', '> | Criterion | Excellent | Acceptable |', '> |---|---|---|', ...a.rubric.map(r => `> | ${cell(r.criterion)} | ${cell(r.excellent)} | ${cell(r.acceptable)} |`));
  return [out.join('\n'), ans.join('\n'), ...(a.cites ?? []).map(c => citeCallout(course, c))].join('\n\n');
}

function blockBody(b: CourseBlock): string[] {
  const p = b.payload as Record<string, unknown>;
  switch (b.type) {
    case 'explainer': return [b.payload.markdown];
    case 'example': return [b.payload.markdown];
    case 'analogy': return [b.payload.markdown, `> [!warning] Where it breaks down\n${quoteLines(b.payload.breaks_down_when)}`];
    case 'key_points': return [b.payload.points.map(x => `- ${x}`).join('\n')];
    case 'misconception': return [
      `> [!failure] The belief\n${quoteLines(b.payload.belief)}`,
      `**Why it seems right.** ${b.payload.why_it_seems_right}`,
      `> [!success] What is true\n${quoteLines(b.payload.what_is_true)}`,
      ...(b.payload.tell ? [`**How to spot it.** ${b.payload.tell}`] : []),
    ];
    case 'walkthrough': return [
      ...(b.payload.intro ? [b.payload.intro] : []),
      ...b.payload.steps.map(s => [`### ${s.n}. ${s.title}`, s.detail_markdown,
        ...(s.warning ? [`> [!warning]\n${quoteLines(s.warning)}`] : []), ...(s.check ? [`> [!check] Check\n${quoteLines(s.check)}`] : [])].join('\n\n')),
    ];
    case 'checklist': return [`**${b.payload.title}**`, b.payload.items.map(i => `- [ ] ${i.text}${i.why ? `\n  - *${i.why}*` : ''}`).join('\n'),
      ...(b.payload.note ? [`> [!note]\n${quoteLines(b.payload.note)}`] : [])];
    case 'project': return [`**${b.payload.title}**`, b.payload.brief_markdown, ...(b.payload.deliverables.length ? ['Deliverables:', b.payload.deliverables.map(d => `- [ ] ${d}`).join('\n')] : [])];
    case 'code': {
      const fence = LANG_FENCE[b.payload.language] ?? '';
      return [b.payload.instructions_markdown,
        ...(b.payload.symptom_markdown ? [`> [!bug] Symptom\n${quoteLines(b.payload.symptom_markdown)}`] : []),
        '```' + fence + '\n' + b.payload.starter_code.replace(/\s+$/, '') + '\n```',
        ...(b.payload.tests.length ? ['Tests:', b.payload.tests.map(t => `- ${t.name}${t.call ? `: \`${t.call}\`` : ''}${t.expect !== undefined ? ` → \`${JSON.stringify(t.expect)}\`` : ''}`).join('\n')] : []),
        ...(b.payload.hints?.length ? [`> [!tip]- Hints\n${b.payload.hints.map(h => `> - ${h}`).join('\n')}`] : [])];
    }
    case 'diagram': return ['```mermaid\n' + b.payload.source.replace(/\s+$/, '') + '\n```', ...(b.payload.caption ? [`*${b.payload.caption}*`] : []), `> [!abstract]- Text version\n${quoteLines(b.payload.alt_text)}`];
    case 'timeline': return [b.payload.events.map(e => `- **${e.when}** · ${e.title}${e.detail ? `: ${e.detail}` : ''}`).join('\n')];
    case 'comparison': return [
      ...(b.payload.intro ? [b.payload.intro] : []),
      [`| | ${b.payload.axes.map(cell).join(' | ')} |`, `|---|${b.payload.axes.map(() => '---').join('|')}|`,
        ...b.payload.items.map(i => `| **${cell(i.name)}** | ${i.values.map(cell).join(' | ')} |`)].join('\n'),
      ...b.payload.items.filter(i => i.best_for).map(i => `- **${i.name}** is best for ${i.best_for}`),
    ];
    case 'reference_table': return [`**${b.payload.title}**`,
      [`| ${b.payload.columns.map(cell).join(' | ')} |`, `|${b.payload.columns.map(() => '---').join('|')}|`, ...b.payload.rows.map(r => `| ${r.map(cell).join(' | ')} |`)].join('\n'),
      ...(b.payload.note ? [`*${b.payload.note}*`] : [])];
    case 'flashcards': return [b.payload.cards.map(c => `${c.front} :: ${c.back}`).join('\n')];
    case 'scenario': return [b.payload.setup_markdown,
      ...b.payload.steps.map(s => [`**${s.prompt}**`, s.options.map(o => `- ${o.text}`).join('\n'),
        `> [!example]- Outcomes\n${s.options.map(o => `> - ${o.correct ? '✓' : '✗'} ${o.text}: ${o.outcome_markdown.replace(/\r?\n/g, ' ')}`).join('\n')}`].join('\n\n')),
      ...(b.payload.debrief_markdown ? [`> [!summary] Debrief\n${quoteLines(b.payload.debrief_markdown)}`] : [])];
    case 'worked_example': return [b.payload.problem_markdown,
      b.payload.steps.map((s, i) => `${i + 1}. \`${s.expression}\`${s.explanation ? ` · ${s.explanation}` : ''}`).join('\n'),
      `> [!success]- Answer\n${quoteLines(b.payload.answer)}`,
      ...(b.payload.common_mistakes.length ? [`> [!warning] Common mistakes\n${b.payload.common_mistakes.map(m => `> - ${m}`).join('\n')}`] : [])];
    case 'playground': return [b.payload.guidance_markdown,
      b.payload.inputs.map(i => `- ${i.label}: ${i.min} to ${i.max}${i.unit ? ` ${i.unit}` : ''} (default ${i.default})`).join('\n'),
      '```js\n' + b.payload.formula_js + '\n```', `Output: ${b.payload.output_label}${b.payload.output_unit ? ` (${b.payload.output_unit})` : ''}. Try it in the course page.`];
    case 'speaking': return [...(b.payload.intro_markdown ? [b.payload.intro_markdown] : []),
      b.payload.items.map(i => `- **${i.text}**${i.translation ? ` · ${i.translation}` : ''}${i.phonetic ? ` (${i.phonetic})` : ''}${i.audio ? ` [listen](<../${i.audio}>)` : ''}`).join('\n')];
    case 'dialogue': return [b.payload.scenario_markdown, `You are the ${b.payload.learner_role}; the other person is the ${b.payload.ai_role}. Goal: ${b.payload.goal}`,
      ...(b.payload.opening_line ? [`> [!quote] ${b.payload.ai_role}\n${quoteLines(b.payload.opening_line)}`] : []),
      ...(b.payload.hints?.length ? [`> [!tip]- Hints\n${b.payload.hints.map(h => `> - ${h}`).join('\n')}`] : [])];
    case 'audio': return [b.payload.script_markdown, ...(b.payload.src ? [`[Listen](<../${b.payload.src}>)`] : [])];
    case 'reflection': return [`> [!question] Reflect\n${quoteLines(b.payload.prompt)}`];
    case 'quiz': return typeof p.intro === 'string' && p.intro ? [p.intro] : [];
    default: return [];
  }
}

const DEFAULT_TITLE: Record<string, string> = {
  analogy: 'Analogy', key_points: 'Key points', misconception: 'A common mix-up', flashcards: 'Flashcards', quiz: 'Check yourself',
  timeline: 'Timeline', speaking: 'Say it', dialogue: 'Talk it through', audio: 'Listen', reflection: 'Reflect', diagram: 'Diagram',
  walkthrough: 'Step by step', checklist: 'Checklist', comparison: 'Comparison', scenario: 'Scenario', worked_example: 'Worked example',
  playground: 'Playground', code: 'Exercise', explainer: 'Explainer', example: 'Example', reference_table: 'Reference', project: 'Project',
};

export const toMarkdown: ToMarkdown = (lesson: CourseLesson, course: Course) => {
  const tag = LEARNER_TAG[lesson.archetype]?.tag ?? lesson.archetype;
  const front = [
    '---',
    `title: ${yaml(lesson.title)}`,
    `course: ${yaml(course.title)}`,
    `lesson: ${lesson.n}`,
    `kind: ${yaml(tag)}`,
    ...(lesson.day ? [`day: ${lesson.day}`] : []),
    `minutes: ${lesson.minutes}`,
    `tags: [bilimind, ${lesson.id}]`,
    '---',
  ].join('\n');
  const parts: string[] = [front, `# ${lesson.title}`,
    `> [!info] ${tag} · ${lesson.minutes} min${lesson.day ? ` · study ${shortDay(lesson.day)}` : ''}${lesson.summary ? `\n${quoteLines(lesson.summary)}` : ''}`];
  if (lesson.thin) parts.push('> [!warning] Thin sources\n> Your files say little about this topic, so this lesson is short. Check it against your notes.');
  let qn = 0;
  for (const b of lesson.blocks) {
    parts.push(`## ${b.title || (b.type === 'example' ? b.payload.title : null) || DEFAULT_TITLE[b.type] || b.type}`);
    parts.push(...blockBody(b).filter(s => s && s.trim()));
    for (const a of b.assessments) parts.push(itemMd(course, a, qn++));
    for (const c of b.cites) parts.push(citeCallout(course, c));
  }
  parts.push('---', `*Made with BiliMind from your own files. Course: ${course.title}.*`);
  return parts.join('\n\n') + '\n';
};
