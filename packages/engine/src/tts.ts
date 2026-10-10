// `narrate`: msedge-tts with the clock-skew fix, cues from core lessonSentences() of the COURSE-SHAPED lesson
// (core fromSaasLesson(draft, meta)), waveform peaks from word timings; writes crew/narration.json (NarrationIndex).
// Owner: WP4. Keep the export names and types (src/contracts.ts); replace the stubs in place.
import type { NarrationIndex } from '@bilimind/core';
import type { Synthesize, NarrateFn, ReadClips, ReadNarration } from './contracts.ts';
import { coursePaths, readJsonOrNull } from './course.ts';

export const synthesize: Synthesize = async () => { throw new Error('not implemented: synthesize'); };
export const narrate: NarrateFn = async () => { throw new Error('not implemented: narrate'); };

export const readNarration: ReadNarration = course => readJsonOrNull<NarrationIndex>(coursePaths(course).narrationJson);
export const readClips: ReadClips = course => readNarration(course)?.clips ?? [];
