// Port of BlockPayloadNormaliser + normaliseAssessment (engine-port §4 table, §5.1). Canonical payload shapes = core PAYLOAD_SCHEMAS.
// Owner: WP2. The pieces live in blocks.ts (payloads), assessment.ts (items) and lesson.ts (singleton rule, orphans,
// strip code, MCQ cap, ids). Only normaliseLesson is exported from the engine index (contracts.ts).
import type { NormaliseLesson } from '../contracts.ts';
import { normaliseLessonDraft } from './lesson.ts';

export const normaliseLesson: NormaliseLesson = (raw, opts) => normaliseLessonDraft(raw, opts);
