// bilimind CLI (PLAN §2.5): every command prints exactly ONE JSON line on stdout, progress on stderr, exit 0/1.
//   node bilimind.mjs <command> [--course <dir>] [--as "<agent>"] [--no-cache] [--model <id>] [--max-usd <n>] [flags]
// Global options may come before or after the command. `run` is a builders-only harness (never in SKILL.md).
import { format } from 'node:util';
import { Command, CommanderError } from 'commander';
import { emit, hasEmitted, oneLine } from './output.ts';
import type { GlobalOpts } from './output.ts';
import { exportLocations } from './paths.ts';
import { registerSetup } from './commands/setup.ts';
import { registerPlanning } from './commands/planning.ts';
import { registerLessons } from './commands/lessons.ts';
import { registerChecker } from './commands/checker.ts';
import { registerPackage } from './commands/package.ts';

// stdout belongs to the JSON line: anything a library logs goes to stderr instead.
for (const k of ['log', 'info', 'debug'] as const) console[k] = (...a: unknown[]) => { process.stderr.write(format(...a) + '\n'); };

exportLocations();

export const program = new Command('bilimind')
  .description('BiliMind for WorkBuddy: one sentence in, a course out, checked against your slides.')
  .option('--course <dir>', 'course folder (default: newest under ./bilimind-out/)')
  .option('--as <agent>', 'agent label for the log, e.g. "Writer · Hashing"', 'Lead')
  .option('--no-cache', 'skip the LLM response cache (every rehearsal and stage run)')
  .option('--model <id>', 'model override')
  .option('--max-usd <n>', 'refuse a command that would spend more than this')
  .showHelpAfterError(false)
  .configureOutput({ writeOut: s => process.stderr.write(s), writeErr: s => process.stderr.write(s) })
  .exitOverride();

const g = (): GlobalOpts => program.opts<GlobalOpts>();
registerSetup(program, g);
registerPlanning(program, g);
registerLessons(program, g);
registerChecker(program, g);
registerPackage(program, g);
for (const c of program.commands) c.exitOverride().configureOutput({ writeOut: s => process.stderr.write(s), writeErr: s => process.stderr.write(s) });

const KNOWN = new Set(program.commands.map(c => c.name()));
const argv = process.argv.slice(2);
const cmdName = argv.find(a => KNOWN.has(a)) ?? argv.find(a => !a.startsWith('-')) ?? '';

try {
  if (!argv.length) {
    program.outputHelp();
    emit({ ok: false, cmd: '', error: 'No command given.', hint: 'Start with `doctor`, then `init --src <folder> --sentence "<text>"`.' });
    process.exitCode = 1;
  } else {
    await program.parseAsync(process.argv);
  }
} catch (e) {
  const code = e instanceof CommanderError ? e.code : '';
  if (/helpDisplayed|commander\.help$|version/.test(code)) {
    // --help: help text went to stderr; stdout stays empty (exit 0)
  } else if (!hasEmitted()) {
    const msg = oneLine((e instanceof Error ? e.message : String(e)).replace(/^error: /, ''));
    emit({ ok: false, cmd: cmdName, error: msg, hint: KNOWN.has(cmdName) ? `Run \`${cmdName} --help\` to see its flags.` : 'Run `--help` to see the commands.' });
    process.exitCode = 1;
  }
}

// A library may leave a socket or timer open (TTS, keep-alive fetch): never let the agent wait on it.
setTimeout(() => process.exit(), 1500).unref();
