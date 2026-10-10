// `plan`: the Lead's keep/cut; capacity = days x minutes (60% new, 40% reviews); review dates from core reviewDatesBackwardsFromExam; plan.json + plan.md.
// Owner: WP2. Keep the export names and types (src/contracts.ts); replace the stubs in place.
import type { PlanFn, ReadPlan } from './contracts.ts';
import type { PlanResult } from '@bilimind/core';
import { coursePaths, readJsonOrNull } from './course.ts';

export const plan: PlanFn = async () => { throw new Error('not implemented: plan'); };

export const readPlan: ReadPlan = course => readJsonOrNull<PlanResult>(coursePaths(course).plan);
