// OpenAI-compatible JSON call, port of LlmClient::json (engine-port §3.0). The ONLY place that calls a model.
// Owner: WP1. Keep the export names and types (src/contracts.ts); replace the stubs in place.
//
// Behaviour (PLAN §2.3 llm.ts, engine-port §3.0):
// - response_format json_object; the schema is rendered into the system prompt (describeSchema = SchemaValidator::describe).
// - JSON repair: trimmed text -> ```json fence -> first '{' .. last '}' -> trailing commas removed.
// - Schema subset check + req.validate; a failure gets ONE corrective turn. A truncated reply (finish_reason
//   'length') restarts once from the original two messages with the budget override.
// - Transport errors, 429 and 5xx back off and retry (3 HTTP attempts in all); any other 4xx stops at once.
// - Reasoning/thinking only when req.reasoning (outline/relabel). DeepSeek direct: thinking {type}, cost from the
//   price table below. OpenRouter: usage.include, provider {require_parameters, max_price}, reasoning {enabled}.
// - Ledger check before every HTTP attempt, ledger record + ctx.spend after every billed reply, cache by
//   sha256(provider:model:mode + messages) unless ctx.noCache. A cache hit costs $0.
import { BilimindError } from './contracts.ts';
import type { CallJson, Ctx, EngineConfig, LlmRequest, LlmResult, ProviderId } from './contracts.ts';
import { keyHint, loadConfig, providerLabel, redact } from './config.ts';
import { checkBudget, recordSpend, round6 } from './ledger.ts';
import { cacheGet, cacheKey, cacheSet } from './cache.ts';
import { coursePaths } from './course.ts';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------- config for this process
let configOverride: EngineConfig | null = null;
let configMemo: EngineConfig | null = null;
/** Harness/test hook: use this config instead of loadConfig(). Pass null to go back to loadConfig(). */
export function setEngineConfig(cfg: EngineConfig | null): void { configOverride = cfg; configMemo = null; }
export function activeConfig(): EngineConfig {
  if (configOverride) return configOverride;
  configMemo ??= loadConfig();
  return configMemo;
}

// ---------------------------------------------------------------- prices
/**
 * DeepSeek direct, USD per 1M tokens, PEAK rates, from https://api-docs.deepseek.com/quick_start/pricing (read 2026-10-10).
 * Off-peak is half. Peak = Mon-Fri 01:00-04:00 and 06:00-10:00 UTC (Chinese public holidays are off-peak; we
 * ignore them, which can only over-count). The time comes from the API's own Date header, because this PC's clock is off.
 */
export const DEEPSEEK_PRICES: Record<string, { hit: number; miss: number; out: number }> = {
  'deepseek-flash': { hit: 0.006, miss: 0.30, out: 1.20 },
  'deepseek-v4-pro': { hit: 0.044, miss: 1.32, out: 3.96 },
};
/** OpenRouter fallback when usage.cost is missing (pinned endpoints, engine-port §7.2), USD per 1M. */
export const OPENROUTER_PRICES: Record<string, { in: number; out: number }> = {
  'deepseek/deepseek-v4-flash': { in: 0.09, out: 0.19 },
  'deepseek/deepseek-v4-pro': { in: 0.95, out: 1.9 },
};
const UNKNOWN_PRICE = { in: 1.5, out: 4 };

export function isDeepseekPeak(at: Date): boolean {
  const day = at.getUTCDay();
  if (day === 0 || day === 6) return false;
  const h = at.getUTCHours();
  return (h >= 1 && h < 4) || (h >= 6 && h < 10);
}

export interface RawUsage {
  prompt_tokens?: number; completion_tokens?: number; cost?: number;
  prompt_cache_hit_tokens?: number; prompt_cache_miss_tokens?: number;
  completion_tokens_details?: { reasoning_tokens?: number };
}

/** Cost of one reply. OpenRouter: its own usage.cost when present. */
export function costOf(provider: ProviderId, model: string, u: RawUsage, at: Date | null): number {
  const pt = u.prompt_tokens ?? 0, ct = u.completion_tokens ?? 0;
  if (provider === 'openrouter') {
    if (typeof u.cost === 'number') return u.cost;
    const p = OPENROUTER_PRICES[model] ?? UNKNOWN_PRICE;
    return (pt * p.in + ct * p.out) / 1e6;
  }
  const p = DEEPSEEK_PRICES[model];
  if (!p) return (pt * UNKNOWN_PRICE.in + ct * UNKNOWN_PRICE.out) / 1e6;
  const factor = at && !isDeepseekPeak(at) ? 0.5 : 1;
  const hit = u.prompt_cache_hit_tokens ?? 0;
  const miss = u.prompt_cache_miss_tokens ?? Math.max(0, pt - hit);
  return factor * (hit * p.hit + miss * p.miss + ct * p.out) / 1e6;
}

/** Conservative pre-call estimate (peak price, output guessed from the stage). */
export function estimateCost(provider: ProviderId, model: string, inputChars: number, maxTokens: number, reasoning: boolean): number {
  const tin = Math.ceil(inputChars / 3.2);
  const tout = Math.min(maxTokens, reasoning ? 9000 : 5000);
  return costOf(provider, model, { prompt_tokens: tin, completion_tokens: tout, prompt_cache_miss_tokens: tin }, null);
}

// ---------------------------------------------------------------- schema subset (port of SchemaValidator)
export type JsonSchema = Record<string, unknown>;

const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const cpLen = (s: string): number => [...s].length;

function shortValue(v: unknown): string {
  if (typeof v === 'string') { const cps = [...v]; return '"' + (cps.length > 40 ? cps.slice(0, 40).join('') + '…' : v) + '"'; }
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (v === null) return 'null';
  if (typeof v === 'number') return String(v);
  return describeValue(v);
}
function describeValue(v: unknown): string {
  if (v === null) return 'null';
  if (typeof v === 'boolean') return 'boolean';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  if (typeof v === 'string') return 'string';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'object') return 'object';
  return typeof v;
}
function matchesType(v: unknown, t: string): boolean {
  switch (t) {
    case 'object': return isPlainObject(v);
    case 'array': return Array.isArray(v);
    case 'string': return typeof v === 'string';
    case 'integer': return typeof v === 'number' && Number.isInteger(v);
    case 'number': return typeof v === 'number' && Number.isFinite(v);
    case 'boolean': return typeof v === 'boolean';
    case 'null': return v === null;
    default: return true;
  }
}
const typesOf = (s: JsonSchema): string[] => s.type === undefined ? [] : (Array.isArray(s.type) ? s.type : [s.type]).map(String);

/** Human-readable error paths; fed back to the model verbatim, so they read like instructions. */
export function validateSchema(value: unknown, schema: JsonSchema, path = '$'): string[] {
  if (!schema || Object.keys(schema).length === 0) return [];
  const errors: string[] = [];
  const types = typesOf(schema);
  if (types.length && !types.some(t => matchesType(value, t))) {
    return [`${path}: expected ${types.join(' or ')}, got ${describeValue(value)}`];
  }
  if (Array.isArray(schema.enum)) {
    const ok = schema.enum.some(c => c === value || ((typeof c !== 'object' || c === null) && (typeof value !== 'object' || value === null) && String(c) === String(value)));
    if (!ok) errors.push(`${path}: value ${shortValue(value)} is not one of the allowed values [${schema.enum.map(shortValue).join(', ')}]`);
  }
  if (isPlainObject(value)) {
    const required = Array.isArray(schema.required) ? schema.required.map(String) : [];
    for (const k of required) {
      if (!(k in value)) errors.push(`${path}: missing required key "${k}"`);
      else if (value[k] === null) errors.push(`${path}.${k}: is required but was null`);
    }
    if (isPlainObject(schema.properties)) {
      for (const [k, child] of Object.entries(schema.properties)) {
        if (!(k in value) || !isPlainObject(child) || value[k] === null || value[k] === undefined) continue;
        errors.push(...validateSchema(value[k], child, `${path}.${k}`));
      }
    }
  }
  if (Array.isArray(value)) {
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) errors.push(`${path}: needs at least ${schema.minItems} items (got ${value.length})`);
    if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) errors.push(`${path}: allows at most ${schema.maxItems} items (got ${value.length})`);
    if (isPlainObject(schema.items)) value.forEach((v, i) => errors.push(...validateSchema(v, schema.items as JsonSchema, `${path}[${i}]`)));
  }
  if (typeof value === 'string') {
    const n = cpLen(value);
    if (typeof schema.minLength === 'number' && n < schema.minLength) errors.push(`${path}: must be at least ${schema.minLength} characters long (got ${n})`);
    if (typeof schema.maxLength === 'number' && n > schema.maxLength) errors.push(`${path}: must be at most ${schema.maxLength} characters long (got ${n})`);
  }
  if (typeof value === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) errors.push(`${path}: must be >= ${shortValue(schema.minimum)} (got ${shortValue(value)})`);
    if (typeof schema.maximum === 'number' && value > schema.maximum) errors.push(`${path}: must be <= ${shortValue(schema.maximum)} (got ${shortValue(value)})`);
  }
  return errors;
}

/** Commented pseudo-JSON the model reads (port of SchemaValidator::describe). */
export function describeSchema(schema: JsonSchema, depth = 0): string {
  const indent = '  '.repeat(depth);
  const types = typesOf(schema);
  const primary = types[0] ?? ((schema.properties || schema.required) ? 'object' : 'any');
  if (primary === 'object') {
    const props = isPlainObject(schema.properties) ? schema.properties : {};
    const entries = Object.entries(props);
    if (!entries.length) return '{ ... }';
    const required = Array.isArray(schema.required) ? schema.required.map(String) : [];
    const lines = entries.map(([name, child], i) => {
      const c = isPlainObject(child) ? child : {};
      const notes: string[] = [];
      if (required.includes(name)) notes.push('REQUIRED');
      if (c.description !== undefined) notes.push(String(c.description));
      const text = `${indent}  "${name}": ${describeSchema(c, depth + 1)}`;
      return text + (i === entries.length - 1 ? '' : ',') + (notes.length ? '   // ' + notes.join(' — ') : '');
    });
    return '{\n' + lines.join('\n') + '\n' + indent + '}';
  }
  if (primary === 'array') {
    const items = isPlainObject(schema.items) ? schema.items : {};
    const bounds: string[] = [];
    if (schema.minItems !== undefined) bounds.push('min ' + Number(schema.minItems));
    if (schema.maxItems !== undefined) bounds.push('max ' + Number(schema.maxItems));
    return '[' + describeSchema(items, depth) + ']' + (bounds.length ? ' /* ' + bounds.join(', ') + ' items */' : '');
  }
  let label = (types.length ? types : ['any']).join('|');
  if (Array.isArray(schema.enum)) label += ' one of [' + schema.enum.map(shortValue).join('|') + ']';
  const bounds: string[] = [];
  if (schema.minLength !== undefined) bounds.push('min length ' + Number(schema.minLength));
  if (schema.maxLength !== undefined) bounds.push('max length ' + Number(schema.maxLength) + ' chars — HARD LIMIT, count them');
  if (schema.minimum !== undefined) bounds.push('>= ' + shortValue(schema.minimum));
  if (schema.maximum !== undefined) bounds.push('<= ' + shortValue(schema.maximum));
  return label + (bounds.length ? ' /* ' + bounds.join(', ') + ' */' : '');
}

// ---------------------------------------------------------------- verbatim prompt strings (engine-port §3.0)
export const outputContract = (shape: string): string => `OUTPUT CONTRACT — non-negotiable:
Reply with ONE JSON object and nothing else. No markdown fences, no commentary,
no trailing text. Keys marked REQUIRED must always be present and non-null.
Use exactly these key names, in this shape:

${shape}`;

export const corrective = (errors: string[]): string => `Your previous reply did not satisfy the output contract. Problems found:

${errors.slice(0, 25).map(e => '- ' + e).join('\n')}

Fix every problem above and reply again with the COMPLETE corrected JSON object.
Output raw JSON only — no markdown fences, no explanation, no partial patch.`;

export const budgetOverride = (attempt: number): string => `BUDGET OVERRIDE — your previous reply hit the output token limit and was discarded
before it could be parsed, so none of that work survived.

${attempt >= 2
    ? 'Cut hard: emit the MINIMUM number of items the contract allows, and keep every string short.'
    : 'Aim for roughly half the length you were about to produce.'} Prefer fewer, denser items over many thin ones. Prose blocks lose their
least important paragraph; lists lose their least important entries. Every REQUIRED
key still has to be present and every enum value still has to be legal — completeness
of the JSON object beats richness of its contents. Finish the closing brace.`;

/** Learner-facing failure sentences (FailureNotice.php). */
export const FAILURE = {
  transport: 'The model took too long to answer. Try again — it usually lands on the second attempt.',
  http: 'The service that writes lessons could not be reached — that is on our side, not on anything you typed. Try again in a few minutes; if it keeps happening, tell us.',
  shape: 'The model answered in a shape BiliMind could not use. Trying again almost always fixes it.',
};

// ---------------------------------------------------------------- JSON repair
/** trimmed -> ```json fence -> first '{' .. last '}' -> trailing commas removed. Objects only; null otherwise. */
export function decodeJsonObject(content: string, opts: { brackets?: boolean } = {}): Record<string, unknown> | null {
  const text = content.replace(/^﻿/, '').trim();
  if (!text) return null;
  const candidates: string[] = [text];
  const fence = /```(?:json|JSON)?\s*\n?([\s\S]*?)```/.exec(text);
  if (fence) candidates.push(fence[1]!.trim());
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a >= 0 && b > a) candidates.push(text.slice(a, b + 1));
  for (const c of candidates) {
    const noTrailing = c.replace(/,\s*([}\]])/g, '$1');
    for (const variant of [c, noTrailing, repairStringEscapes(noTrailing)]) {
      try {
        const v = JSON.parse(variant) as unknown;
        if (isPlainObject(v)) return v;
      } catch { /* next */ }
    }
  }
  // last resort: the model miscounted its brackets ("}]}" one too many, a missing "]"): repair by parse errors
  if (opts.brackets === false) return null;
  const last = candidates[candidates.length - 1]!;
  const fixed = repairBrackets(repairStringEscapes(last.replace(/,\s*([}\]])/g, '$1')));
  return fixed !== undefined && isPlainObject(fixed) ? fixed : null;
}

const errorPos = (s: string): number => {
  try { JSON.parse(s); return Infinity; } catch (e) {
    const m = /position (\d+)/.exec(e instanceof Error ? e.message : '');
    return m ? Number(m[1]) : -1;
  }
};

/**
 * Bracket repair driven by JSON.parse error positions (at most 12 edits): at each error try inserting "]" or "}",
 * or deleting the last closer before it, and keep the edit that moves the next error furthest. undefined if stuck.
 */
export function repairBrackets(input: string): unknown {
  let s = input;
  for (let i = 0; i < 12; i++) {
    const p = errorPos(s);
    if (p === Infinity) return JSON.parse(s) as unknown;
    if (p < 0) return undefined;
    const q = Math.max(s.lastIndexOf('}', p - 1), s.lastIndexOf(']', p - 1));
    const options = [s.slice(0, p) + ']' + s.slice(p), s.slice(0, p) + '}' + s.slice(p)];
    if (q >= 0) options.push(s.slice(0, q) + s.slice(q + 1));
    let best: string | null = null, bestPos = p;
    for (const o of options) {
      const op = errorPos(o);
      if (op === Infinity) return JSON.parse(o) as unknown;
      if (op > bestPos) { best = o; bestPos = op; }
    }
    if (best === null) return undefined;
    s = best;
  }
  return undefined;
}

/**
 * Inside JSON strings only: raw control characters (a literal newline/tab in code or prose) become escapes, and a
 * backslash before a character JSON cannot escape (LaTeX "\alpha", regex "\d") is doubled. Outside strings nothing changes.
 */
export function repairStringEscapes(s: string): string {
  let out = '';
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (!inStr) { out += ch; if (ch === '"') inStr = true; continue; }
    if (ch === '\\') {
      const nx = s[i + 1];
      if (nx !== undefined && '"\\/bfnrt'.includes(nx)) { out += ch + nx; i++; continue; }
      if (nx === 'u' && /^[0-9a-fA-F]{4}$/.test(s.slice(i + 2, i + 6))) { out += s.slice(i, i + 6); i += 5; continue; }
      out += '\\\\';
      continue;
    }
    if (ch === '"') { out += ch; inStr = false; continue; }
    const code = ch.charCodeAt(0);
    if (code < 0x20) out += ch === '\n' ? '\\n' : ch === '\r' ? '\\r' : ch === '\t' ? '\\t' : `\\u${code.toString(16).padStart(4, '0')}`;
    else out += ch;
  }
  return out;
}

/** Best effort: keep an undecodable reply in crew/cache/bad-replies/ so a builder can see why it failed. */
function dumpBadReply(ctx: Ctx, stage: string, attempt: number, finish: unknown, content: string): void {
  try {
    if (!ctx.course) return;
    const dir = join(coursePaths(ctx.course).cache, 'bad-replies');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${stage}-${Date.now()}-a${attempt}.txt`), `finish_reason: ${String(finish)}

${content.slice(0, 200_000)}`);
  } catch { /* diagnostics only */ }
}

// ---------------------------------------------------------------- the call
type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

interface CachedReply { data: unknown; model: string; provider: ProviderId; usage: LlmResult<unknown>['usage'] }

const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));
const backoffMs = (attempt: number): number => Math.min(4000, 250 * 2 ** (attempt - 1));
const MAX_ATTEMPTS = 3;

function requestBody(cfg: EngineConfig, model: string, messages: Msg[], req: LlmRequest, thinking: boolean): Record<string, unknown> {
  const maxTokens = req.maxTokens ?? 32768;
  const temperature = req.temperature ?? 0.6;
  if (cfg.provider === 'deepseek') {
    const body: Record<string, unknown> = {
      model, messages, max_tokens: maxTokens, stream: false,
      response_format: { type: 'json_object' },
      thinking: { type: thinking ? 'enabled' : 'disabled' },
    };
    if (thinking) { const effort = process.env.BILIMIND_REASONING_EFFORT; if (effort) body.reasoning_effort = effort; }
    else body.temperature = temperature;   // thinking mode ignores temperature
    return body;
  }
  const body: Record<string, unknown> = {
    model, messages, temperature, max_tokens: maxTokens,
    response_format: { type: 'json_object' },
    usage: { include: true },
    reasoning: { enabled: thinking },
  };
  // Pin the route price for DeepSeek models (PLAN §6.3): never the $1.28/M-output endpoints.
  if (model.startsWith('deepseek/')) body.provider = { require_parameters: true, max_price: { prompt: 0.2, completion: 0.4 }, allow_fallbacks: true };
  return body;
}

/** Request keys that may be dropped (once) when the endpoint refuses them with a 400. */
// Never 'provider': OpenRouter 400s often say "Provider returned error", and dropping the price pin could land on a $1.28/M route.
const OPTIONAL_PARAMS: [string, RegExp][] = [['response_format', /response[_ ]?format|json[_ ]?object|json mode/i], ['thinking', /thinking/i], ['reasoning_effort', /reasoning[_ ]?effort/i]];
function withoutKeys(body: Record<string, unknown>, drop: Set<string>): Record<string, unknown> {
  if (!drop.size) return body;
  return Object.fromEntries(Object.entries(body).filter(([k]) => !drop.has(k)));
}

function headers(cfg: EngineConfig): Record<string, string> {
  const h: Record<string, string> = { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' };
  if (cfg.provider === 'openrouter') { h['HTTP-Referer'] = 'https://bilimind.com'; h['X-Title'] = 'BiliMind for WorkBuddy'; }
  return h;
}

function httpFailure(cfg: EngineConfig, status: number, detail: string): BilimindError {
  const who = providerLabel(cfg.provider);
  if (status === 401 || status === 403) return new BilimindError(`Your ${who} key was rejected (${status}).`, keyHint(cfg.provider));
  if (status === 402) return new BilimindError(`The ${who} balance is empty (402).`, cfg.provider === 'deepseek'
    ? 'Top up DeepSeek, or switch pools with BILIMIND_PROVIDER=openrouter.' : 'Top up OpenRouter, or switch back with BILIMIND_PROVIDER=deepseek.');
  return new BilimindError(`${FAILURE.http} (${who} HTTP ${status}${detail ? ': ' + redact(detail).slice(0, 160) : ''})`,
    status === 400 ? 'The request was refused as malformed; check --model and the prompt size.' : 'Run the same command again in a minute.');
}

function guardExpensive(cfg: EngineConfig, model: string): void {
  const expensive = model === cfg.models.reasoning || /(^|\/)deepseek-v4-pro\b/.test(model);
  if (expensive && process.env.BILIMIND_ALLOW_EXPENSIVE !== '1') {
    throw new BilimindError(`${model} is the expensive model and is off by default (PLAN §6.3).`,
      'Use the default fast model, or set BILIMIND_ALLOW_EXPENSIVE=1 deliberately.');
  }
}

function checkAll(data: Record<string, unknown>, req: LlmRequest): string[] {
  const errs = req.schema ? validateSchema(data, req.schema) : [];
  if (errs.length) return errs;
  try { return req.validate ? req.validate(data) : []; } catch (e) { return [`$: ${(e as Error).message}`]; }
}

export const callJson: CallJson = async <T = unknown>(ctx: Ctx, req: LlmRequest): Promise<LlmResult<T>> => {
  const cfg = activeConfig();
  const who = providerLabel(cfg.provider);
  if (!cfg.apiKey) throw new BilimindError(`No ${who} API key found.`, keyHint(cfg.provider));
  const model = req.model ?? ctx.model ?? cfg.models.fast;
  guardExpensive(cfg, model);
  const thinking = req.reasoning === true;
  const maxTokens = req.maxTokens ?? 32768;

  let system = req.system.trim();
  if (req.schema) system += '\n\n' + outputContract(describeSchema(req.schema));
  else if (!/json/i.test(system + req.user)) system += '\n\nReply with ONE JSON object and nothing else.';
  const base: Msg[] = [{ role: 'system', content: system }, { role: 'user', content: req.user }];
  const key = cacheKey(`${cfg.provider}:${model}:${thinking ? 'think' : 'plain'}`, base);
  const t0 = Date.now();

  if (!ctx.noCache) {
    const hit = cacheGet(ctx.course, key) as CachedReply | null;
    if (hit && isPlainObject(hit.data) && checkAll(hit.data, req).length === 0) {
      recordSpend(cfg, { ts: new Date().toISOString(), course: ctx.course, cmd: req.stage, provider: cfg.provider, model,
        prompt_tokens: 0, completion_tokens: 0, cost_usd: 0, cached: true });
      ctx.progress(`llm: ${req.stage} · cache hit · $0`);
      return { data: hit.data as T, model: hit.model, provider: hit.provider, usage: hit.usage, cost_usd: 0, ms: Date.now() - t0, cached: true, attempts: 0 };
    }
  }

  const usage = { prompt_tokens: 0, completion_tokens: 0, reasoning_tokens: 0 };
  let cost = 0, attempts = 0, corrected = false, restarted = false, paramRetry = false;
  const dropped = new Set<string>();
  let messages = base;
  let lastErrors: string[] = [];
  let lastFailure: BilimindError | null = null;
  let servedModel = model;
  const url = cfg.baseUrl + '/chat/completions';
  const timeoutMs = Number(process.env.BILIMIND_LLM_TIMEOUT_MS) || 240_000;

  while (attempts < MAX_ATTEMPTS) {
    attempts++;
    const chars = messages.reduce((n, m) => n + m.content.length, 0);
    await checkBudget(ctx, cfg, estimateCost(cfg.provider, model, chars, maxTokens, thinking));

    let res: Response;
    try {
      res = await fetch(url, { method: 'POST', headers: headers(cfg), body: JSON.stringify(withoutKeys(requestBody(cfg, model, messages, req, thinking), dropped)),
        signal: AbortSignal.timeout(timeoutMs) });
    } catch (e) {
      lastFailure = new BilimindError(FAILURE.transport, `${who} did not answer (${redact((e as Error).message).slice(0, 120)}). Run the command again.`);
      ctx.progress(`llm: ${req.stage} · attempt ${attempts} transport error`);
      await sleep(backoffMs(attempts));
      continue;
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      lastFailure = httpFailure(cfg, res.status, detail);
      ctx.progress(`llm: ${req.stage} · attempt ${attempts} HTTP ${res.status}`);
      // A 400 that names an optional parameter we sent (response_format with thinking, thinking on an older model):
      // drop that parameter once and retry. The JSON contract is still in the system prompt and decodeJsonObject
      // repairs fences, so the call stays correct without it.
      if (res.status === 400 && !paramRetry) {
        // First match in priority order only: "json_object is not supported in thinking mode" drops response_format, not thinking.
        const offending = OPTIONAL_PARAMS.find(([, re]) => re.test(detail))?.[0];
        if (offending) {
          paramRetry = true;
          dropped.add(offending);
          ctx.progress(`llm: ${req.stage} · ${who} refused ${offending}; retrying without it`);
          attempts--;
          continue;
        }
      }
      if (res.status >= 400 && res.status < 500 && res.status !== 429) throw lastFailure;
      const retryAfter = Number(res.headers.get('retry-after'));
      await sleep(res.status === 429 && retryAfter > 0 ? Math.min(20_000, retryAfter * 1000) : backoffMs(attempts));
      continue;
    }

    let body: { choices?: { message?: { content?: string | null }; finish_reason?: string }[]; usage?: RawUsage; error?: unknown; model?: string };
    try { body = await res.json() as typeof body; } catch {
      lastFailure = new BilimindError(FAILURE.http, 'The reply was not JSON. Run the command again.');
      await sleep(backoffMs(attempts));
      continue;
    }
    const at = res.headers.get('date');
    const u = body.usage ?? {};
    const c = costOf(cfg.provider, model, u, at ? new Date(at) : null);
    usage.prompt_tokens += u.prompt_tokens ?? 0;
    usage.completion_tokens += u.completion_tokens ?? 0;
    usage.reasoning_tokens += u.completion_tokens_details?.reasoning_tokens ?? 0;
    cost += c;
    if (u.prompt_tokens || u.completion_tokens || c > 0) {
      ctx.spend.usd = round6(ctx.spend.usd + c);
      ctx.spend.calls += 1;
      recordSpend(cfg, { ts: new Date().toISOString(), course: ctx.course, cmd: req.stage, provider: cfg.provider, model,
        prompt_tokens: u.prompt_tokens ?? 0, completion_tokens: u.completion_tokens ?? 0, cost_usd: round6(c), cached: false });
    }
    if (typeof body.model === 'string') servedModel = body.model;

    if (body.error || !body.choices?.length) {          // upstream error on a 200: the model never saw it, no corrective turn
      lastFailure = new BilimindError(FAILURE.http, 'The provider returned an error inside a 200 reply. Run the command again.');
      await sleep(backoffMs(attempts));
      continue;
    }
    const content = body.choices[0]!.message?.content ?? '';   // never read reasoning_content
    const finish = body.choices[0]!.finish_reason;
    // a reply cut off by max_tokens keeps the 'retry shorter' path: never close its brackets for it
    const decoded = decodeJsonObject(content, { brackets: finish !== 'length' });
    if (decoded === null) {
      if (finish === 'length' && !restarted) {
        restarted = true;
        messages = [base[0]!, { role: 'user', content: base[1]!.content + '\n\n' + budgetOverride(attempts) }];
        lastErrors = ['The response was cut off before the JSON object was complete. Return a shorter answer that still satisfies the schema.'];
        ctx.progress(`llm: ${req.stage} · reply truncated, retrying shorter`);
        continue;
      }
      lastErrors = ['The response was not a single valid JSON object. Return raw JSON only — no prose, no markdown fences.'];
      dumpBadReply(ctx, req.stage, attempts, finish, content);
    } else {
      lastErrors = checkAll(decoded, req);
      if (lastErrors.length === 0) {
        const result: LlmResult<T> = {
          data: decoded as T, model: servedModel, provider: cfg.provider,
          usage: thinking || usage.reasoning_tokens ? usage : { prompt_tokens: usage.prompt_tokens, completion_tokens: usage.completion_tokens },
          cost_usd: round6(cost), ms: Date.now() - t0, cached: false, attempts,
        };
        try { cacheSet(ctx.course, key, { data: decoded, model: servedModel, provider: cfg.provider, usage: result.usage } satisfies CachedReply); } catch { /* cache is best effort */ }
        ctx.progress(`llm: ${req.stage} · ${servedModel} · ${Math.round(result.ms / 100) / 10} s · ${usage.prompt_tokens}/${usage.completion_tokens} tok · $${result.cost_usd.toFixed(5)}`);
        return result;
      }
    }
    lastFailure = new BilimindError(`${FAILURE.shape} (${req.stage}: ${lastErrors.slice(0, 3).join('; ').slice(0, 300)})`,
      'Run the same command again, or add a --note that names the problem.');
    if (corrected) break;                                 // one corrective turn only
    corrected = true;
    messages = [...messages, { role: 'assistant', content }, { role: 'user', content: corrective(lastErrors) }];
    ctx.progress(`llm: ${req.stage} · ${lastErrors.length} contract problem(s), one corrective turn`);
  }
  throw lastFailure ?? new BilimindError(FAILURE.http, 'Run the same command again in a minute.');
};
