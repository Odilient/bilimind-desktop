// deck.csv: every flashcard and every cloze item as Front,Back,Tags. The `#` header lines are Anki's own
// import directives (2.1.54+); older Anki skips them as comments.
// Owner: WP4.
import type { AnkiCsv } from '../contracts.ts';

/** RFC 4180 field: quoted when it holds a comma, quote or newline. */
export const csvField = (s: string): string => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
const tag = (s: string) => s.replace(/[^\p{L}\p{N}_-]+/gu, '_').replace(/^_+|_+$/g, '');

export const ankiCsv: AnkiCsv = course => {
  const rows = deckRows(course);
  const head = ['#separator:Comma', '#html:false', '#notetype:Basic', `#deck:${course.title.replace(/[\r\n]+/g, ' ')}`, '#columns:Front,Back,Tags', '#tags column:3'];
  return [...head, ...rows.map(r => r.map(csvField).join(','))].join('\r\n') + '\r\n';
};

/** deck.csv rows [front, back, tags]: flashcards, cloze items, then every quiz item with a short answer (deduped).
 * The receipts' card count is the length of this list, so the page and the deck always agree. */
export function deckRows(course: { id?: string; lessons: CourseLike['lessons'] }): string[][] {
  const rows: string[][] = [];
  for (const l of course.lessons) {
    const tags = ['bilimind', tag(course.id ?? ''), tag(l.id)].filter(Boolean).join(' ');
    for (const b of l.blocks) {
      if (b.type === 'flashcards') for (const c of b.payload.cards ?? []) rows.push([c.front, c.back, tags]);
      for (const a of b.assessments) {
        if (a.kind !== 'cloze') continue;
        const accepted = a.answer_key?.accepted ?? [];
        if (!accepted.length) continue;
        const back = accepted.length > 1 ? `${accepted[0]} (also: ${accepted.slice(1).join(', ')})` : accepted[0]!;
        rows.push([a.prompt, a.explanation ? `${back}\n${a.explanation}` : back, `${tags} cloze`]);
      }
    }
  }
  // A course with no flashcards and no cloze items (common for exam courses) would ship an empty deck:
  // fall back to the quiz items that have a short, checkable answer.
  // G2 review: always add the quiz items with a short checkable answer (a single cloze used to switch this off and
  // ship a 1-card deck); skip any whose front is already in the deck.
  const fronts = new Set(rows.map(r => r[0]));
  for (const r of quizRows(course)) if (!fronts.has(r[0])) { rows.push(r); fronts.add(r[0]); }
  return rows;
}

type CourseLike = Parameters<AnkiCsv>[0];
type ItemLike = CourseLike['lessons'][number]['blocks'][number]['assessments'][number];
interface LooseItem {
  kind: string; prompt: string; explanation?: string | null; options?: { id: string; text: string }[];
  answer_key?: { correct_option_ids?: string[]; value?: number; tolerance?: number; unit?: string | null; reference_answer?: string };
}

/** Front/back for an mcq, multi_select, numeric or short_answer item; null when it has no usable answer. */
export function quizCard(item: ItemLike): { front: string; back: string } | null {
  const a = item as unknown as LooseItem;
  const k = a.answer_key ?? {};
  const opt = (id: string) => a.options?.find(o => o.id === id)?.text;
  let back: string | undefined;
  if ((a.kind === 'mcq' || a.kind === 'multi_select') && k.correct_option_ids?.length) {
    const texts = k.correct_option_ids.map(opt).filter((t): t is string => !!t);
    if (texts.length) back = texts.join('; ');
  } else if (a.kind === 'numeric' && typeof k.value === 'number') {
    back = `${k.value}${k.tolerance ? ` (± ${k.tolerance})` : ''}${k.unit ? ` ${k.unit}` : ''}`;
  } else if (a.kind === 'short_answer' && k.reference_answer) {
    back = k.reference_answer;
  }
  if (!back) return null;
  const options = (a.kind === 'mcq' || a.kind === 'multi_select') && a.options?.length
    ? '\n' + a.options.map(o => `${o.id}) ${o.text}`).join('\n') : '';
  return { front: a.prompt + options, back: a.explanation ? `${back}\n${a.explanation}` : back };
}

function quizRows(course: { id?: string; lessons: CourseLike['lessons'] }): string[][] {
  const rows: string[][] = [];
  for (const l of course.lessons) {
    const tags = ['bilimind', tag(course.id ?? ''), tag(l.id), 'quiz'].filter(Boolean).join(' ');
    for (const b of l.blocks) for (const a of b.assessments) {
      const c = quizCard(a);
      if (c) rows.push([c.front, c.back, tags]);
    }
  }
  return rows;
}
