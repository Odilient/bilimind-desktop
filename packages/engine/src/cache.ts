// LLM response cache by sha256(model + messages) in crew/cache/.
// Owner: WP1. Keep the export names and types (src/contracts.ts); replace the stubs in place.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CacheGet, CacheKey, CacheSet } from './contracts.ts';
import { coursePaths } from './course.ts';

export const cacheKey: CacheKey = (model, messages) => {
  const h = createHash('sha256');
  h.update(model);
  for (const m of messages) { h.update('\u0000' + m.role + '\u0000'); h.update(m.content); }
  return h.digest('hex');
};

const fileFor = (course: string, key: string): string => join(coursePaths(course).cache, `${key.replace(/[^a-f0-9]/gi, '').slice(0, 64)}.json`);

export const cacheGet: CacheGet = (course, key) => {
  const f = fileFor(course, key);
  if (!existsSync(f)) return null;
  try { return JSON.parse(readFileSync(f, 'utf8')) as unknown; } catch { return null; }
};

export const cacheSet: CacheSet = (course, key, value) => {
  const dir = coursePaths(course).cache;
  mkdirSync(dir, { recursive: true });
  const f = fileFor(course, key);
  const tmp = `${f}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(value));
  renameSync(tmp, f);
};
