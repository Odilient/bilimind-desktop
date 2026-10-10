// Global spend ledger %USERPROFILE%/.bilimind/ledger.jsonl; caps $0.25/run, $2/day, provider reserve floor.
// Owner: WP1. Keep the export names and types (src/contracts.ts); replace the stubs in place.
import type { CheckBudget, RecordSpend, SpentToday, SpentForCourse, Balance } from './contracts.ts';

export const checkBudget: CheckBudget = async () => { throw new Error('not implemented: checkBudget'); };
export const recordSpend: RecordSpend = () => { throw new Error('not implemented: recordSpend'); };
export const spentToday: SpentToday = () => { throw new Error('not implemented: spentToday'); };
export const spentForCourse: SpentForCourse = () => { throw new Error('not implemented: spentForCourse'); };
export const balance: Balance = async () => { throw new Error('not implemented: balance'); };
