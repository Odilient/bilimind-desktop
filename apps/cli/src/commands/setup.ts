// Lead, first steps: doctor, init, goal, ingest, status, note.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Command } from 'commander';
import { FILE_ROLES } from '@bilimind/core';
import type { FileRole } from '@bilimind/core';
import { BilimindError, doctor, ingest, init, note, setGoal, status } from '@bilimind/engine';
import { argSummary, collect, int, pairs } from '../args.ts';
import { runCommand } from '../output.ts';
import type { GlobalOpts } from '../output.ts';

export function registerSetup(program: Command, g: () => GlobalOpts): void {
  program.command('doctor').description('check node, key (present or not), balance vs reserve, spend today, clock skew, Edge TTS')
    .action(() => runCommand('doctor', g(), () => doctor({ cwd: process.cwd() }), { needsCourse: false }));

  program.command('init').description('create the course folder under ./bilimind-out/ and copy the source files into sources/')
    .option('--src <folder>', 'folder with slides, notes, past papers (default: current folder)', '.')
    .requiredOption('--sentence <text>', "the user's request, verbatim")
    .option('--slug <slug>', 'course folder name (default: from the source folder)')
    .option('--out <dir>', 'output root (default: ./bilimind-out)')
    .action((o: { src: string; sentence: string; slug?: string; out?: string }) =>
      runCommand('init', g(), ctx => init({ src: o.src, sentence: o.sentence, slug: o.slug, outRoot: o.out }, ctx.now()), {
        needsCourse: false, args: argSummary({ src: o.src, slug: o.slug }), logCourse: d => d.course,
      }));

  program.command('goal').description("record the Lead's reading of the sentence in crew/goal.json")
    .option('--deadline <iso>', 'exam or deadline date, e.g. 2026-10-14 (or 2026-10-14T09:00)')
    .option('--exam-time <HH:MM>', 'exam time, 24 h, local time')
    .requiredOption('--minutes-per-day <n>', 'study minutes per day')
    .option('--audience <who>', 'student | staff', 'student')
    .option('--lang <code>', 'course language', 'en')
    .option('--code-lang <lang>', 'js | none', 'js')
    .option('--timezone <tz>', 'IANA time zone', 'Asia/Kuala_Lumpur')
    .option('--assume <text>', 'an assumption you made (repeatable)', collect, [])
    .action((o: { deadline?: string; examTime?: string; minutesPerDay: string; audience: string; lang: string; codeLang: string; timezone: string; assume: string[] }) =>
      runCommand('goal', g(), ctx => {
        // G2 review: SKILL and PLAN allow js or none only (the sandbox runs JavaScript)
        const lang = String(o.codeLang ?? '').trim().toLowerCase();
        if (!['js', 'javascript', 'none'].includes(lang)) throw new BilimindError(`--code-lang must be js or none (got "${o.codeLang}")`, 'Use --code-lang js for programming subjects, --code-lang none otherwise.');
        return setGoal(ctx, {
        deadline: o.deadline, examTime: o.examTime, minutesPerDay: int(o.minutesPerDay, '--minutes-per-day', 5, 720),
        audience: o.audience as 'student' | 'staff', lang: o.lang, codeLang: lang === 'javascript' ? 'js' : lang, assume: o.assume, timezone: o.timezone,
      }); }, { args: argSummary({ deadline: o.deadline, examTime: o.examTime, minutesPerDay: o.minutesPerDay, audience: o.audience, assume: o.assume }) }));

  program.command('ingest').description('read sources/: text, roles, scanned pages, chunks -> crew/ingest.json')
    .option('--role <file=role>', `override a file's role (${FILE_ROLES.join('|')}), repeatable`, collect, [])
    .action((o: { role: string[] }) => runCommand('ingest', g(), ctx => {
      const roles = pairs(o.role, '--role', 'past-paper.pdf=past_paper') as Record<string, FileRole>;
      for (const [f, r] of Object.entries(roles))
        if (!(FILE_ROLES as readonly string[]).includes(r)) throw new BilimindError(`Unknown role "${r}" for ${f}`, `Roles: ${FILE_ROLES.join(', ')}.`);
      // G2 review: a mistyped file name used to be accepted silently
      const files = existsSync(join(ctx.course, 'sources')) ? readdirSync(join(ctx.course, 'sources')).map(f => f.toLowerCase()) : null;
      const unknown = files ? Object.keys(roles).filter(f => !files.includes(f.trim().toLowerCase())) : [];
      if (unknown.length) throw new BilimindError(`--role names ${unknown.map(f => `"${f}"`).join(', ')}, which ${unknown.length === 1 ? 'is' : 'are'} not in sources/`, `Files: ${files!.join(', ')}`);
      return ingest(ctx, { roles });
    }, { args: argSummary({ role: o.role }) }));

  program.command('status').description('which stages and lessons are done; what to run next (resume)')
    .action(() => runCommand('status', g(), ctx => status(ctx), { log: false }));

  program.command('note').description('record a decision in REPORT.md and the receipts log')
    .requiredOption('--text <decision>', 'the decision, one sentence')
    .option('--lesson <key>', 'the lesson it is about')
    .action((o: { text: string; lesson?: string }) =>
      runCommand('note', g(), ctx => note(ctx, { text: o.text }), { args: o.text, lesson: o.lesson }));
}
