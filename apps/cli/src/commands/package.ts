// Lead, packaging: narrate, export, build. Coach (P2): due, grade. Builders: plant, plant-score, run.
import type { Command } from 'commander';
import { BilimindError, build, defaultTimeZone, due, exportAll, grade, narrate, plant, plantScore, runPipeline } from '@bilimind/engine';
import { argSummary, csv, int } from '../args.ts';
import { maxUsdOf, runCommand } from '../output.ts';
import type { GlobalOpts } from '../output.ts';
import { findTemplate, templateCandidates } from '../paths.ts';

export function registerPackage(program: Command, g: () => GlobalOpts): void {
  program.command('narrate').description('Edge TTS narration per lesson + "Hear the plan" -> audio/, crew/narration.json')
    .option('--lessons <keys>', 'only these lessons, comma-separated')
    .option('--voice <id>', 'Edge voice, e.g. en-US-AvaMultilingualNeural')
    .option('--langs <codes>', 'languages for speaking drills, e.g. en,ms')
    .action((o: { lessons?: string; voice?: string; langs?: string }) => runCommand('narrate', g(), ctx => narrate(ctx, {
      lessons: o.lessons ? csv(o.lessons) : undefined, voice: o.voice, langs: o.langs ? csv(o.langs) : undefined,
    }), { args: argSummary(o) }));

  program.command('export').description('review schedule, lessons/*.md (Obsidian), deck.csv (Anki), reviews.ics, REPORT.md')
    .action(() => runCommand('export', g(), ctx => exportAll(ctx)));

  program.command('build').description('assemble + validate course.json and paste it into the player -> index.html')
    .option('--template <html>', 'player template (default: the skill\'s templates/player.html)')
    .action((o: { template?: string }) => runCommand('build', g(), ctx => {
      const template = findTemplate(o.template);
      if (!template) {
        throw new BilimindError(o.template ? `Template not found: ${o.template}` : 'The player template is missing.',
          `Expected one of: ${templateCandidates().join(' | ')}. Reinstall the skill (templates/player.html).`);
      }
      return build(ctx, { template });
    }, { args: argSummary(o) }));

  program.command('due').description('(P2) pick due review questions -> review/today.html')
    .option('--n <n>', 'how many', '3')
    .action((o: { n: string }) => runCommand('due', g(), ctx => due(ctx, { n: int(o.n, '--n', 1, 50) }), { args: argSummary(o) }));

  program.command('grade').description('(P2) grade typed answers to the last `due`, reschedule, refresh reviews.ics')
    .requiredOption('--answers <reply>', 'e.g. "1 b, 2 chaining, 3 O(n)"')
    .action((o: { answers: string }) => runCommand('grade', g(), ctx => grade(ctx, { answers: o.answers }), { args: argSummary(o) }));

  program.command('plant').description('(benchmark) flip N answer keys in a COPY of a course, record them in a hidden key')
    .option('--lesson <key>', 'only this lesson')
    .option('--n <n>', 'how many errors to plant', '10')
    .action((o: { lesson?: string; n: string }) =>
      runCommand('plant', g(), ctx => plant(ctx, { lesson: o.lesson, n: int(o.n, '--n', 1, 200) }), { args: argSummary(o), lesson: o.lesson }));

  program.command('plant-score').description("(benchmark) score the Checker's verdicts against the planted key")
    .action(() => runCommand('plant-score', g(), ctx => plantScore(ctx)));

  program.command('run').description('(builders only) the whole pipeline without agents: fixtures, regression, cost')
    .requiredOption('--src <folder>', 'source folder')
    .requiredOption('--sentence <text>', "the user's request")
    .option('--timezone <tz>', 'IANA time zone', defaultTimeZone())
    .option('--slug <slug>', 'course folder name')
    .option('--out <dir>', 'output root (default: ./bilimind-out)')
    .option('--concurrency <n>', 'parallel lesson drafts', '4')
    .option('--max-lessons <n>', 'most lessons to keep', '6')
    .option('--repair-rounds <n>', 're-draft rounds for lessons that fail checks', '1')
    .option('--no-narrate', 'skip Edge TTS')
    .option('--template <html>', 'player template')
    .action((o: { src: string; sentence: string; timezone: string; slug?: string; out?: string; concurrency: string; maxLessons: string; repairRounds: string; narrate: boolean; template?: string }) =>
      runCommand('run', g(), async ctx => {
        const gl = g();
        const template = findTemplate(o.template);
        const d = await runPipeline({
          src: o.src, sentence: o.sentence, slug: o.slug, outRoot: o.out, noCache: gl.cache === false,
          concurrency: int(o.concurrency, '--concurrency', 1, 12), maxLessons: int(o.maxLessons, '--max-lessons', 1, 20),
          repairRounds: int(o.repairRounds, '--repair-rounds', 0, 3), narrate: o.narrate, template,
          model: gl.model, maxUsd: maxUsdOf(gl), timezone: o.timezone,
        });
        ctx.spend.usd = d.cost_usd;   // the JSON line's cost_usd = the whole run
        return d;
      }, { needsCourse: false, args: argSummary({ src: o.src, slug: o.slug, concurrency: o.concurrency }) }));
}
