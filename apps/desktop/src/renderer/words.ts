// Engine step results -> learner words. The engine's own result strings carry internal terms (keys with
// underscores, "chunks", "blocks", "reference/starter"); nothing on screen should. Each function returns a short
// plain sentence, or null when the step is bookkeeping not worth a line in the feed.

export type Role = 'lead' | 'writer' | 'coder' | 'checker' | 'narrator' | 'packager';

export function roleOf(agent: string, cmd: string): Role {
  const a = agent.toLowerCase();
  if (a.startsWith('writer')) return 'writer';
  if (a.startsWith('coder')) return 'coder';
  if (a.startsWith('checker')) return 'checker';
  if (a.startsWith('narrator') || cmd === 'narrate') return 'narrator';
  if (a.startsWith('packager') || cmd === 'export' || cmd === 'build') return 'packager';
  return 'lead';
}

export const ROLE_NAME: Record<Role, string> = {
  lead: 'Lead', writer: 'Writer', coder: 'Coder', checker: 'Checker', narrator: 'Narrator', packager: 'Packager',
};

const n = (re: RegExp, s: string, i = 1) => { const m = re.exec(s); return m ? Number(m[i]) : undefined; };
const plural = (k: number, one: string, many = one + 's') => `${k} ${k === 1 ? one : many}`;

function day(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(+d)) return iso;
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Remove internal keys (snake_case words) from any leftover text. */
export function scrub(s: string, titles?: Map<string, string>): string {
  return s
    .replace(/\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g, (k) => titles?.get(k) ?? k.replace(/_/g, ' '))
    .replace(/\bchunks?\b/gi, 'passages')
    .replace(/\bnodes?\b/gi, 'topics')
    .replace(/\bblocks?\b/gi, 'sections')
    .replace(/\bLLM\b/g, 'AI')
    .replace(/crew\/\S+/g, 'the course folder');
}

/** One plain sentence for a finished step (null = skip in the feed). */
export function sayStep(cmd: string, result: string | undefined, ok: boolean, lessonTitle?: string, error?: string): string | null {
  const r = result ?? '';
  if (!ok) return `Hit a problem${lessonTitle ? ` on “${lessonTitle}”` : ''}: ${scrub(error || r || 'no details')}`;
  const L = lessonTitle ? `“${lessonTitle}”` : 'the lesson';
  switch (cmd) {
    case 'init': return 'Opened a fresh folder for your course';
    case 'goal': {
      const m = /exam (\S+?)T(\d\d:\d\d)/.exec(r);
      const mins = n(/(\d+) min\/day/, r);
      if (m) return `Read your sentence: ready by ${day(m[1])}, ${m[2]}${mins ? `, ${mins} min a day` : ''}`;
      return 'Read your sentence and set the goal';
    }
    case 'ingest': {
      const f = n(/(\d+) files?/, r); const p = n(/(\d+) past papers?/, r);
      return `Read ${plural(f ?? 0, 'file')}${p ? `, including ${plural(p, 'past paper')}` : ''}`;
    }
    case 'outline': { const t = n(/(\d+) topics/, r); return `Mapped ${plural(t ?? 0, 'topic')} across your files`; }
    case 'exam-map': {
      const qn = n(/(\d+) questions/, r); const mk = n(/(\d+) marks/, r);
      return `Matched ${plural(qn ?? 0, 'past-paper question')}${mk ? ` (${mk} marks)` : ''} to topics`;
    }
    case 'note': return null;
    case 'plan': {
      const l = n(/(\d+) lessons?/, r); const m = /(\d+)\/(\d+) min/.exec(r);
      return `Planned ${plural(l ?? 0, 'lesson')}${m ? ` in ${m[1]} of your ${m[2]} minutes` : ''}`;
    }
    case 'draft': {
      const b = n(/(\d+) blocks?/, r); const qn = n(/(\d+) questions?/, r);
      const c = n(/(\d+) code exercises?/, r); const ci = n(/(\d+) citations?/, r);
      const bits = [b && plural(b, 'section'), qn && plural(qn, 'question'), c && plural(c, 'code exercise'), ci && plural(ci, 'quote') + ' from your files'].filter(Boolean);
      return `Drafted ${L}: ${bits.join(', ')}`;
    }
    case 'check': {
      const m = /(\d+)\/(\d+) checks/.exec(r);
      if (!m) return `Checked ${L}`;
      const [p, t] = [Number(m[1]), Number(m[2])];
      return p === t ? `${L}: all ${t} checks passed` : `${L}: ${p} of ${t} checks passed, sent back to fix`;
    }
    case 'code-test': {
      if (/self-marked/.test(r)) return `A code exercise in ${L} is marked by you, not by tests`;
      const m = /reference (\d+)\/(\d+)/.exec(r);
      if (!m) return `Ran the code exercise in ${L}`;
      return m[1] === m[2] ? `Ran the code in ${L}: the worked answer passes ${m[1]}/${m[2]} tests`
        : `Ran the code in ${L}: ${m[1]} of ${m[2]} tests pass, fixing it`;
    }
    case 'fact-check': {
      const m = /(\d+) of (\d+) errors? fixed/.exec(r);
      if (!m || m[2] === '0') return `Checked every fact in ${L} against your files`;
      return `Checked facts in ${L} against your files: ${m[2]} flagged`;
    }
    case 'verdict': {
      const m = /re-solved (\d+): (\d+) agree/.exec(r);
      const rej = n(/(\d+) wrong keys? rejected/, r) ?? 0;
      if (m) return rej
        ? `Re-solved ${plural(Number(m[1]), 'answer')} in ${L}: ${rej} contradicted your files, rejected and rewritten`
        : `Re-solved ${plural(Number(m[1]), 'answer')} in ${L} on its own: all agree with your files`;
      const a = n(/(\d+) applied/, r);
      return a ? `Applied ${plural(a, 'ruling')} to ${L}` : null;
    }
    case 'evidence': { const i = n(/(\d+) items?/, r); return i ? `Saved ${plural(i, 'quote')} from your files as proof for ${L}` : null; }
    case 'rewrite-item': return `Rewrote the rejected question in ${L} from your files`;
    case 'narrate': {
      const m = /(\d+) clips?, ([\d.]+) min/.exec(r);
      return m ? `Recorded ${m[2]} minutes of narration` : 'Recorded the narration';
    }
    case 'export': return 'Wrote your study plan, flashcard deck and calendar';
    case 'build': return 'Packed the course into one page that works offline';
    default: return r ? scrub(r) : null;
  }
}

/** What a role is doing right now (shown on a working card). */
export function doingNow(cmd: string, lessonTitle?: string): string {
  const L = lessonTitle ? `“${lessonTitle}”` : 'the lesson';
  switch (cmd) {
    case 'init': return 'Opening a folder';
    case 'goal': return 'Reading your sentence';
    case 'ingest': return 'Reading your files';
    case 'outline': return 'Mapping the topics in your files';
    case 'exam-map': return 'Matching past-paper questions';
    case 'plan': return 'Planning the path';
    case 'draft': return `Writing ${L}`;
    case 'check': return `Checking ${L}`;
    case 'code-test': return 'Running the code exercises';
    case 'fact-check': return 'Checking facts against your files';
    case 'verdict': return 'Re-solving every answer';
    case 'evidence': return 'Collecting quotes as proof';
    case 'rewrite-item': return 'Rewriting a rejected question';
    case 'narrate': return 'Recording the voice';
    case 'export': return 'Writing plan, deck and calendar';
    case 'build': return 'Packing the course';
    default: return 'Working';
  }
}

export function fmtDuration(ms: number): string {
  if (ms < 1000) return `${Math.max(0.1, ms / 1000).toFixed(1)} s`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  const m = Math.floor(s / 60);
  return `${m} min ${Math.round(s - m * 60)} s`;
}
export function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
export function fmtCost(usd: number): string {
  if (usd === 0) return '$0.00';
  return usd < 0.1 ? `$${usd.toFixed(4)}` : `$${usd.toFixed(2)}`;
}
export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(+d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
export const ROLE_LABEL: Record<string, string> = {
  lecture: 'Lecture', past_paper: 'Past paper', sop: 'SOP', notes: 'Notes', other: 'File',
};
