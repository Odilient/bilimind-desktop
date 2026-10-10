// bilimind CLI. SKELETON (WP0): global options, the JSON-line wrapper (output.ts) and two commands wired as the
// pattern. Owner WP6: register every command of PLAN §2.5 the same way (one file per command if you like).
import { Command } from 'commander';
import { doctor, note } from '@bilimind/engine';
import { emit, runCommand } from './output.ts';
import type { GlobalOpts } from './output.ts';

const program = new Command('bilimind')
  .description('BiliMind for WorkBuddy: one sentence in, a course out, checked against your slides.')
  .option('--course <dir>', 'course folder (default: newest under ./bilimind-out/)')
  .option('--as <agent>', 'agent label for the log, e.g. "Writer · Hashing"', 'Lead')
  .option('--no-cache', 'skip the LLM response cache (every rehearsal and stage run)')
  .option('--model <id>', 'model override')
  .option('--max-usd <n>', 'refuse a command that would spend more than this')
  .showHelpAfterError(false)
  .exitOverride();

const g = (): GlobalOpts => program.opts<GlobalOpts>();

program.command('doctor').description('check node, key, balance, clock skew, Edge TTS')
  .action(() => runCommand('doctor', g(), () => doctor({ cwd: process.cwd() }), { needsCourse: false }));

program.command('note').description('record a decision in REPORT.md and the receipts log')
  .requiredOption('--text <decision>', 'the decision, one sentence')
  .action((o: { text: string }) => runCommand('note', g(), ctx => note(ctx, { text: o.text }), { args: o.text, summary: () => o.text }));

try {
  await program.parseAsync(process.argv);
} catch (e) {
  // commander usage errors (unknown command / missing option) still answer with one JSON line
  const msg = e instanceof Error ? e.message : String(e);
  if (!/outputHelp|help|version/i.test(String((e as { code?: string }).code ?? ''))) {
    emit({ ok: false, cmd: process.argv[2] ?? '', error: msg.replace(/^error: /, ''), hint: 'Run with --help to see the commands.' });
    process.exitCode = 1;
  }
}
