// The CLI's one-JSON-line contract (PLAN §2.5) and the command wrapper every command uses.
// stdout: exactly one line {"ok":true,"cmd","data","cost_usd","ms"} or {"ok":false,"cmd","error","hint"}; exit 0/1.
// Progress goes to stderr. Every course command appends one LogEvent to crew/log.jsonl (doctor and run excepted:
// doctor has no course; run logs each of its own steps). init logs into the folder it just created.
import { BilimindError, clockSkewMs, logStep, resolveCourse, skewedNow, summarize } from '@bilimind/engine';
import type { Ctx } from '@bilimind/engine';

export interface GlobalOpts { course?: string; as?: string; cache?: boolean; model?: string; maxUsd?: string }

let emitted = false;
/** Writes THE stdout line. A second call is a bug: it goes to stderr instead, so stdout stays one line. */
export function emit(line: Record<string, unknown>): void {
  let s = JSON.stringify(line);
  // BILIMIND_ASCII=1: \u-escape non-ASCII, for a reader that decodes stdout with a legacy code page (Windows PowerShell 5.1)
  if (process.env.BILIMIND_ASCII === '1') s = s.replace(/[\u007f-￿]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
  s += '\n';
  if (emitted) { process.stderr.write(`[bilimind] extra output suppressed: ${s}`); return; }
  emitted = true;
  process.stdout.write(s);
}
export const hasEmitted = () => emitted;

export function maxUsdOf(g: GlobalOpts): number | undefined {
  if (g.maxUsd === undefined || g.maxUsd === '') return undefined;
  const x = Number(g.maxUsd);
  if (!Number.isFinite(x) || x < 0) throw new BilimindError(`--max-usd must be a number >= 0, got ${g.maxUsd}`, 'Example: --max-usd 0.05');
  return x;
}

export function makeCtx(g: GlobalOpts, course: string, skewMs = 0): Ctx {
  return {
    course,
    agent: (g.as ?? 'Lead').trim() || 'Lead',
    noCache: g.cache === false,
    model: g.model,
    maxUsd: maxUsdOf(g),
    spend: { usd: 0, calls: 0 },
    now: skewedNow(skewMs),            // G2: the PC clock may be hours off; dates use the server time
    progress: line => process.stderr.write(line + '\n'),
  };
}

/** A stub engine function throws `not implemented: <name>`; say so plainly. */
export function hintFor(err: Error): string {
  if (err instanceof BilimindError && err.hint) return err.hint;
  if (/^not implemented/i.test(err.message)) return 'This engine step is still being built (stub). Skip it for now and continue with the next step.';
  if (/ENOENT|Missing /.test(err.message)) return 'A file from an earlier step is missing: run `status` to see which step to run next.';
  return 'Run `status` to see which step is missing, or retry once; if it fails again, `note` the problem and continue.';
}

const round6 = (x: number) => Math.round(x * 1e6) / 1e6;

export interface RunOpts<D> {
  needsCourse?: boolean;                 // false: doctor, init, run
  args?: string;                         // argument summary for the log
  lesson?: string;
  log?: boolean;                         // default: needsCourse !== false
  logCourse?: (d: D) => string | null;   // init: log into the folder it created
}

/** Run one command: resolve --course, build ctx, call fn, print the JSON line, append the log. */
export async function runCommand<D>(cmd: string, g: GlobalOpts, fn: (ctx: Ctx) => Promise<D>, opts: RunOpts<D> = {}): Promise<void> {
  const t0 = Date.now();
  let ctx: Ctx | null = null;
  const shouldLog = opts.log ?? opts.needsCourse !== false;
  try {
    const course = opts.needsCourse === false ? (g.course ?? process.cwd()) : resolveCourse(g.course, process.cwd());
    ctx = makeCtx(g, course, await clockSkewMs(course));
    const data = await fn(ctx);
    const ms = Date.now() - t0;
    const cost = round6(ctx.spend.usd);
    const logCourse = opts.logCourse ? opts.logCourse(data) : shouldLog ? course : null;
    if (logCourse) {
      logStep(logCourse, { ts: ctx.now().toISOString(), agent: ctx.agent, cmd, args: opts.args, ok: true, result: summarize(cmd, data), ms, cost_usd: cost,
        lesson: opts.lesson, data: data as Record<string, unknown> });
    }
    emit({ ok: true, cmd, data, cost_usd: cost, ms });
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    if (process.env.BILIMIND_DEBUG && err.stack) process.stderr.write(err.stack + '\n');
    if (ctx && shouldLog && !opts.logCourse) {
      logStep(ctx.course, { ts: ctx.now().toISOString(), agent: ctx.agent, cmd, args: opts.args, ok: false, result: err.message, ms: Date.now() - t0,
        cost_usd: round6(ctx.spend.usd), lesson: opts.lesson });
    }
    emit({ ok: false, cmd, error: oneLine(err.message), hint: hintFor(err) });
    process.exitCode = 1;
  }
}

/** Errors are "one sentence": collapse whitespace and cap the length. */
export const oneLine = (s: string) => {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > 400 ? t.slice(0, 397) + '...' : t;
};
