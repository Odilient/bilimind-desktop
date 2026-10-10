// Course log crew/log.jsonl (one LogEvent per line); receipts and REPORT.md are computed only from it.
// Owner: WP1. Keep the export names and types (src/contracts.ts); replace the stubs in place.
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { LogEvent } from '@bilimind/core';
import { BilimindError } from './contracts.ts';
import type { AppendLog, Note, ReadLog } from './contracts.ts';
import { coursePaths } from './course.ts';
import { redact } from './config.ts';

/** Appends one line. Strings are redacted (no key ever lands in a log). */
export const appendLog: AppendLog = (course, event) => {
  const path = coursePaths(course).log;
  mkdirSync(dirname(path), { recursive: true });
  const clean: LogEvent = { ...event };
  if (clean.args) clean.args = redact(clean.args);
  if (clean.result) clean.result = redact(clean.result);
  appendFileSync(path, JSON.stringify(clean) + '\n');
};

/** Every event in order; torn or foreign lines are skipped. */
export const readLog: ReadLog = course => {
  const path = coursePaths(course).log;
  if (!existsSync(path)) return [];
  const out: LogEvent[] = [];
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line) as LogEvent;
      if (e && typeof e.cmd === 'string' && typeof e.ts === 'string') out.push(e);
    } catch { /* skip */ }
  }
  return out;
};

/**
 * `note --text`: a decision line for REPORT.md and the receipts' per-agent log. The CLI's runCommand writes the
 * log line itself (result = the text), so this only validates; it returns {} as the contract says.
 */
export const note: Note = async (_ctx, opts) => {
  const text = (opts.text ?? '').trim();
  if (!text) throw new BilimindError('note needs --text "<decision>".', 'Example: note --text "Cut AVL rotations: no exam question uses them."');
  if (text.length > 600) throw new BilimindError('A note is one decision line (600 characters at most).', 'Shorten it to one sentence.');
  return { text };
};
