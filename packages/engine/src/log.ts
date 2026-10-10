// Course log crew/log.jsonl (one LogEvent per line); receipts and REPORT.md are computed only from it.
// Owner: WP1. Keep the export names and types (src/contracts.ts); replace the stubs in place.
import type { AppendLog, ReadLog, Note } from './contracts.ts';

export const appendLog: AppendLog = () => { throw new Error('not implemented: appendLog'); };
export const readLog: ReadLog = () => { throw new Error('not implemented: readLog'); };
export const note: Note = async () => { throw new Error('not implemented: note'); };
