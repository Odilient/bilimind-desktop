// The CLI's one-JSON-line contract (PLAN §2.5) and the command wrapper every command uses.
// stdout: exactly one line {"ok":true,"cmd","data","cost_usd","ms"} or {"ok":false,"cmd","error","hint"}; exit 0/1.
// Progress goes to stderr. Every command (except doctor/init/run) appends one LogEvent to crew/log.jsonl.
import { BilimindError, appendLog, resolveCourse } from '@bilimind/engine';
import type { Ctx } from '@bilimind/engine';

export interface GlobalOpts { course?: string; as?: string; cache?: boolean; model?: string; maxUsd?: string }

export function emit(line: Record<string, unknown>): void {
  process.stdout.write(JSON.stringify(line) + '\n');
}

export function makeCtx(g: GlobalOpts, course: string): Ctx {
  return {
    course,
    agent: g.as ?? 'Lead',
    noCache: g.cache === false,
    model: g.model,
    maxUsd: g.maxUsd ? Number(g.maxUsd) : undefined,
    spend: { usd: 0, calls: 0 },
    now: () => new Date(),
    progress: line => process.stderr.write(line + '\n'),
  };
}

/**
 * Run one course command: resolve --course, build ctx, call fn, print the JSON line, append the log.
 * `summary` turns data into the one-line result that REPORT.md and the receipts log show.
 */
export async function runCommand<D>(cmd: string, g: GlobalOpts, fn: (ctx: Ctx) => Promise<D>,
  opts: { needsCourse?: boolean; args?: string; summary?: (d: D) => string; lesson?: string } = {}): Promise<void> {
  const t0 = Date.now();
  let ctx: Ctx | null = null;
  try {
    const course = opts.needsCourse === false ? (g.course ?? process.cwd()) : resolveCourse(g.course, process.cwd());
    ctx = makeCtx(g, course);
    const data = await fn(ctx);
    const ms = Date.now() - t0;
    const cost = Math.round(ctx.spend.usd * 1e6) / 1e6;
    if (opts.needsCourse !== false) {
      try {
        appendLog(course, { ts: new Date().toISOString(), agent: ctx.agent, cmd, args: opts.args, ok: true,
          result: opts.summary?.(data), ms, cost_usd: cost, lesson: opts.lesson, data: data as Record<string, unknown> });
      } catch { /* log.ts not implemented yet: never fail a command on logging */ }
    }
    emit({ ok: true, cmd, data, cost_usd: cost, ms });
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    const hint = e instanceof BilimindError ? e.hint : undefined;
    if (ctx) {
      try {
        appendLog(ctx.course, { ts: new Date().toISOString(), agent: ctx.agent, cmd, args: opts.args, ok: false,
          result: err.message, ms: Date.now() - t0, cost_usd: ctx.spend.usd, lesson: opts.lesson });
      } catch { /* ignore */ }
    }
    emit({ ok: false, cmd, error: err.message, hint: hint ?? 'Run `status` to see which step is missing.' });
    process.exitCode = 1;
  }
}
