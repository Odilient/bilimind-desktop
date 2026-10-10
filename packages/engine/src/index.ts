// @bilimind/engine: everything the CLI calls. Signatures live in contracts.ts (see CONTRACTS.md).
export * from './contracts.ts';
export * from './config.ts';
export * from './llm.ts';
export * from './ledger.ts';
export * from './cache.ts';
export * from './log.ts';
export * from './course.ts';
export * from './doctor.ts';
export * from './ingest/index.ts';
export * from './retrieve.ts';
export * from './outline.ts';
export * from './exam.ts';
export * from './plan.ts';
export * from './draft.ts';
export * from './normalise/index.ts';
export * from './validate/index.ts';
export * from './codework.ts';
export * from './evidence.ts';
export * from './verdict.ts';
export * from './rewrite.ts';
export * from './plant.ts';
export * from './tts.ts';
export * from './review.ts';
export * from './export/index.ts';
export * from './build.ts';
export * from './run.ts';

// G2 review: the unattended Checker passes (verdict --auto, fact-check) and grounding helpers
export { autoCheck, factCheck, agrees, replaceOnce } from './autocheck.ts';
export type { AutoCheckData, FactCheckData } from './autocheck.ts';
export { isFrontMatter, slideMentions, resolveMentions, refineLessonChunks } from './sources.ts';
export { clockSkewMs, skewedNow } from './clock.ts';
