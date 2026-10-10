// Lead, planning: outline, exam-map, plan.
import type { Command } from 'commander';
import { BilimindError, examMap, outline, plan } from '@bilimind/engine';
import { argSummary, collect, csv, int, pairs } from '../args.ts';
import { runCommand } from '../output.ts';
import type { GlobalOpts } from '../output.ts';

export function registerPlanning(program: Command, g: () => GlobalOpts): void {
  program.command('outline').description('one reasoning call: topics, archetypes, derived block formats -> crew/outline.json')
    .option('--max-topics <n>', 'most core topics (default 8)')
    .action((o: { maxTopics?: string }) => runCommand('outline', g(),
      ctx => outline(ctx, { maxTopics: o.maxTopics ? int(o.maxTopics, '--max-topics', 2, 12) : undefined }),
      { args: argSummary(o) }));

  program.command('exam-map').description('past paper -> questions -> topic weights (crew/exam-map.json + .md)')
    .option('--assign <Q=key>', 'assign a question to a topic, e.g. "Q3=hash_tables" (repeatable)', collect, [])
    .action((o: { assign: string[] }) => runCommand('exam-map', g(),
      ctx => examMap(ctx, { assign: pairs(o.assign, '--assign', 'Q3=hash_tables') }), { args: argSummary(o) }));

  program.command('plan').description("the Lead's keep/cut decision -> crew/plan.json + plan.md")
    .requiredOption('--keep <keys>', 'lesson keys to teach, comma-separated')
    .option('--cut <key=reason>', 'a topic you cut and why (repeatable)', collect, [])
    .option('--order <keys>', 'teaching order, comma-separated (default: outline order)')
    .option('--start <date>', 'first study day YYYY-MM-DD (default: today)')
    .action((o: { keep: string; cut: string[]; order?: string; start?: string }) => runCommand('plan', g(), ctx => {
      const keep = csv(o.keep);
      if (!keep.length) throw new BilimindError('--keep is empty', 'Pass the lesson keys from `outline`, e.g. --keep hash_tables,binary_heaps');
      if (o.start && !/^\d{4}-\d{2}-\d{2}$/.test(o.start)) throw new BilimindError(`--start must be YYYY-MM-DD, got ${o.start}`, 'Example: --start 2026-10-11');
      const order = o.order ? csv(o.order) : undefined;
      return plan(ctx, { keep, cut: pairs(o.cut, '--cut', 'avl_rotations=no marks in the past paper'), order, start: o.start });
    }, { args: argSummary(o) }));
}
