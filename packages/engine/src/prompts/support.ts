// Shared prompt fragments: port of PromptSupport.php (engine-port.md §3.1). The heredocs come verbatim from
// src/prompts/php.ts (generated from the backend); this file only composes them.
import type { Chunk, CourseBrief } from '@bilimind/core';
import { PHP_PROMPTS } from './php.ts';
import type { PhpPromptKey } from './php.ts';

/** A verbatim heredoc with its PHP placeholders ({$name}) filled. Throws when a placeholder is left unfilled. */
export function php(key: PhpPromptKey, vars: Record<string, string | number> = {}): string {
  let text: string = PHP_PROMPTS[key];
  for (const [k, v] of Object.entries(vars)) text = text.split(`{$${k}}`).join(String(v));
  const left = text.match(/\{\$\w+\}/);
  if (left) throw new Error(`prompt ${key}: unfilled placeholder ${left[0]}`);
  return text;
}

/**
 * A deliberate HACKATHON edit to a verbatim prompt: exact replacement that must hit, so a backend wording change
 * can never silently skip one of our edits (the golden test re-runs every edit).
 */
export function edit(text: string, from: string | RegExp, to: string, label: string): string {
  const hit = typeof from === 'string' ? text.includes(from) : from.test(text);
  if (!hit) throw new Error(`HACKATHON prompt edit "${label}" did not match`);
  return typeof from === 'string' ? text.split(from).join(to) : text.replace(from, to);
}

/** Laravel Str::limit: cut to `n` code points (right-trimmed) and append `end`. */
export function limit(value: string, n: number, end = '...'): string {
  const cps = [...value];
  return cps.length <= n ? value : cps.slice(0, n).join('').trimEnd() + end;
}

export const HOUSE_STYLE = php('PromptSupport.houseStyle.0');
export const GROUNDING_RULES = php('PromptSupport.groundingRules.0');

/** "Spanish (BCP-47 tag "es")"; fallback `the language with BCP-47 tag "xx"`. */
export function languageLabel(tag = 'en'): string {
  const t = tag.trim() || 'en';
  let name: string | undefined;
  try { name = new Intl.DisplayNames(['en'], { type: 'language' }).of(t); } catch { name = undefined; }
  return name && name.toLowerCase() !== t.toLowerCase() ? `${name} (BCP-47 tag "${t}")` : `the language with BCP-47 tag "${t}"`;
}

const field = (label: string, v?: string | null) => (v && v.trim() ? `- ${label}: ${limit(v.trim(), 1500)}` : null);

/** LEARNER BRIEF. HACKATHON: the SaaS line "Time budget: N minutes per week" becomes per day + the deadline. */
export function courseBrief(b: CourseBrief): string {
  return 'LEARNER BRIEF\n' + [
    field('Topic as the learner wrote it', b.topic),
    field('Working title', b.title),
    field('Content language', languageLabel(b.language)),
    field('Self-reported level', b.level),
    field('Why they are learning it', b.goal),
    field('Time budget', b.minutes_per_day ? `${b.minutes_per_day} minutes per day` : null),          // HACKATHON
    field('Deadline', b.deadline ? `${b.deadline} — everything must be studiable before this date` : null),  // HACKATHON
    field('Source of truth', b.source_type === 'materials' ? 'their own attached materials'
      : b.source_type === 'mixed' ? 'their own attached materials plus your knowledge' : 'your knowledge of the topic'),
    field('Preferred formats', b.settings?.formats_preferred?.join(', ')),
    field('Requested depth', b.settings?.depth),
    field('Include code exercises', b.settings?.include_code === undefined ? null : b.settings.include_code ? 'yes' : 'no'),
  ].filter(Boolean).join('\n');
}

export function clarificationTranscript(qa?: { question: string; answer: string }[]): string | null {
  const lines = (qa ?? []).filter(x => x.answer?.trim())
    .map(x => `Q: ${x.question || '(unlabelled question)'}\nA: ${x.answer.trim()}`);
  return lines.length ? 'WHAT THE LEARNER TOLD US WHEN ASKED\n' + lines.join('\n\n') : null;
}

/**
 * MATERIAL EXCERPTS. engine-port §3.1 option (a): the CHUNK id is printed as material_id, so a block's
 * source_material_ids point at the exact slide/page and build.ts can resolve a citation chip from it.
 */
export function materialExcerpts(chunks: Chunk[]): string | null {
  const lines = chunks.filter(c => c.content.trim()).map(c =>
    `[material_id=${c.id} · ${c.title || 'untitled material'} · ${c.locator?.trim() || 'chunk ' + c.ordinal}]\n${c.content.trim()}`);
  return lines.length ? "MATERIAL EXCERPTS (the learner's own source — cite by material_id)\n" + lines.join('\n\n---\n\n') : null;
}

/** Join the non-empty sections of a prompt with blank lines between them. */
export const assemble = (parts: (string | null | undefined)[]): string =>
  parts.filter((p): p is string => typeof p === 'string' && p.trim() !== '').map(p => p.trim()).join('\n\n');
