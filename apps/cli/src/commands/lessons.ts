// Writer and Coder: draft, check, code-test.
import type { Command } from 'commander';
import { BLOCK_TYPES } from '@bilimind/core';
import type { BlockType } from '@bilimind/core';
import { BilimindError, check, codeTest, draft } from '@bilimind/engine';
import { argSummary, int } from '../args.ts';
import { runCommand } from '../output.ts';
import type { GlobalOpts } from '../output.ts';

export function registerLessons(program: Command, g: () => GlobalOpts): void {
  program.command('draft').description('one expand call for one lesson -> crew/lessons/<key>.json')
    .requiredOption('--lesson <key>', 'lesson key from the plan')
    .option('--note <instruction>', 'your repair instruction, appended to the prompt')
    .option('--only <type>', 'regenerate one block type and merge it (keeps its id)')
    .action((o: { lesson: string; note?: string; only?: string }) => runCommand('draft', g(), ctx => {
      if (o.only && !(BLOCK_TYPES as readonly string[]).includes(o.only))
        throw new BilimindError(`Unknown block type "${o.only}"`, 'Use a type from the check report or the lesson formats, e.g. --only walkthrough');
      return draft(ctx, { lesson: o.lesson, note: o.note, only: o.only as BlockType | undefined });
    }, { args: argSummary(o), lesson: o.lesson }));

  program.command('check').description('Q1-Q17 checks on one lesson (schema, formats, citations, code tests) -> crew/checks/<key>.json')
    .requiredOption('--lesson <key>', 'lesson key')
    .action((o: { lesson: string }) => runCommand('check', g(), ctx => check(ctx, { lesson: o.lesson }), { args: argSummary(o), lesson: o.lesson }));

  program.command('code-test').description('run, dump, apply or disable the code exercises of one lesson')
    .requiredOption('--lesson <key>', 'lesson key')
    .option('--block <n>', 'block number (b3 -> 3); default: every code block')
    .option('--dump', 'write crew/code/<key>-b<n>/{instructions.md,starter.js,solution.js,tests.json}')
    .option('--apply', 'read the edited files back into the lesson and re-run the tests')
    .option('--disable', 'make the exercise self-marked (needs --reason)')
    .option('--reason <text>', 'why it is disabled')
    .action((o: { lesson: string; block?: string; dump?: boolean; apply?: boolean; disable?: boolean; reason?: string }) =>
      runCommand('code-test', g(), ctx => {
        const modes = (['dump', 'apply', 'disable'] as const).filter(m => o[m]);
        if (modes.length > 1) throw new BilimindError(`Pick one of --dump, --apply, --disable (got ${modes.join(', ')})`, 'Run them one after the other.');
        const mode = modes[0] ?? 'run';
        if (mode === 'disable' && !o.reason?.trim()) throw new BilimindError('--disable needs --reason', 'Example: --disable --reason "tests contradict the slide after 3 rounds"');
        const block = o.block !== undefined ? int(String(o.block).replace(/^b/i, ''), '--block', 1, 999) : undefined;
        return codeTest(ctx, { lesson: o.lesson, block, mode, reason: o.reason });
      }, { args: argSummary(o), lesson: o.lesson }));
}
