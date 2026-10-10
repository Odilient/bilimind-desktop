// Checker: evidence, verdict, rewrite-item.
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import type { Command } from 'commander';
import { VERDICTS } from '@bilimind/core';
import type { VerdictKind } from '@bilimind/core';
import { BilimindError, autoCheck, evidence, factCheck, rewriteItem, verdict } from '@bilimind/engine';
import type { VerdictInput } from '@bilimind/engine';
import { argSummary } from '../args.ts';
import { runCommand } from '../output.ts';
import type { GlobalOpts } from '../output.ts';

const asKind = (v: unknown, where: string): VerdictKind => {
  const s = String(v ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!(VERDICTS as readonly string[]).includes(s)) throw new BilimindError(`${where}: verdict must be ${VERDICTS.join(' | ')}, got "${String(v)}"`, 'Rule supported, contradicted or not_covered.');
  return s as VerdictKind;
};

/** `--file`: a JSON array of {item, verdict, quote, reason} or {"rulings": [...]}; path relative to cwd, else to the course. */
export function readRulings(file: string, course: string): VerdictInput[] {
  const path = [resolve(file), isAbsolute(file) ? file : join(course, file)].find(p => existsSync(p));
  if (!path) throw new BilimindError(`Rulings file not found: ${file}`, 'Write the JSON file first (Write tool), then pass its path to --file.');
  let raw: unknown;
  try { raw = JSON.parse(readFileSync(path, 'utf8').replace(/^﻿/, '')); } catch (e) {
    throw new BilimindError(`Rulings file is not valid JSON: ${(e as Error).message}`, 'Fix the JSON: an array of {"item","verdict","quote","reason"}.');
  }
  const list = Array.isArray(raw) ? raw : (raw as { rulings?: unknown })?.rulings;
  if (!Array.isArray(list) || !list.length) throw new BilimindError('The rulings file has no rulings', 'Use [{"item":"q3","verdict":"supported","quote":"...","reason":"..."}].');
  return list.map((r, i) => {
    const x = (r ?? {}) as Record<string, unknown>;
    const item = String(x.item ?? x.id ?? '').trim();
    if (!item) throw new BilimindError(`Ruling ${i + 1} has no "item"`, 'Every ruling needs the item id, e.g. "q3".');
    return { item, verdict: asKind(x.verdict, `ruling ${item}`), quote: String(x.quote ?? ''), reason: String(x.reason ?? '') };
  });
}

export function registerChecker(program: Command, g: () => GlobalOpts): void {
  program.command('evidence').description("one packet per quiz item with its cited slide text -> crew/evidence/<key>.md")
    .requiredOption('--lesson <key>', 'lesson key')
    .action((o: { lesson: string }) => runCommand('evidence', g(), ctx => evidence(ctx, { lesson: o.lesson }), { args: argSummary(o), lesson: o.lesson }));

  program.command('verdict').description("apply the Checker's rulings (quotes must be verbatim in the cited chunks)")
    .requiredOption('--lesson <key>', 'lesson key')
    .option('--item <id>', 'item id, e.g. q3')
    .option('--verdict <kind>', VERDICTS.join(' | '))
    .option('--quote <text>', 'the shortest deciding phrase, verbatim from the packet')
    .option('--reason <text>', 'why, at most 25 words')
    .option('--file <json>', 'many rulings: JSON array of {item, verdict, quote, reason}')
    .option('--auto', 're-solve every unchecked auto-marked item with the fast model (no key shown) and rule on it; rewrites the ones whose key is wrong')
    .action((o: { lesson: string; item?: string; verdict?: string; quote?: string; reason?: string; file?: string; auto?: boolean }) =>
      runCommand('verdict', g(), ctx => {
        if (o.auto) return autoCheck(ctx, { lesson: o.lesson });
        let rulings: VerdictInput[];
        if (o.file) {
          if (o.item) throw new BilimindError('Use either --file or --item, not both', 'Put every ruling in the file.');
          rulings = readRulings(o.file, ctx.course);
        } else {
          if (!o.item || !o.verdict) throw new BilimindError('verdict needs --item and --verdict (or --file)', 'Example: --item q3 --verdict supported --quote "..." --reason "..."');
          rulings = [{ item: o.item.trim(), verdict: asKind(o.verdict, o.item), quote: o.quote ?? '', reason: o.reason ?? '' }];
        }
        return verdict(ctx, { lesson: o.lesson, rulings });
      }, { args: argSummary({ lesson: o.lesson, item: o.item, verdict: o.verdict, file: o.file, auto: o.auto }), lesson: o.lesson }));

  program.command('fact-check').description('fast-model proof-read of one lesson against its cited slides: arithmetic, traces, slide attributions; fixes verbatim quotes in place')
    .requiredOption('--lesson <key>', 'lesson key')
    .action((o: { lesson: string }) => runCommand('fact-check', g(), ctx => factCheck(ctx, { lesson: o.lesson }), { args: argSummary(o), lesson: o.lesson }));

  program.command('rewrite-item').description('rewrite one contradicted item from its chunks (new item, status pending)')
    .requiredOption('--lesson <key>', 'lesson key')
    .requiredOption('--item <id>', 'the contradicted item id')
    .requiredOption('--reason <text>', "the Checker's reason")
    .action((o: { lesson: string; item: string; reason: string }) =>
      runCommand('rewrite-item', g(), ctx => rewriteItem(ctx, { lesson: o.lesson, item: o.item.trim(), reason: o.reason }), { args: argSummary(o), lesson: o.lesson }));
}
