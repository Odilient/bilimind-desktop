// `export`: Obsidian markdown, Anki CSV, .ics, REPORT.md, receipts. Split into markdown.ts / anki-csv.ts / ics.ts / report.ts / receipts.ts freely.
// Owner: WP4. Keep the export names and types (src/contracts.ts); replace the stubs in place.
import type { ToMarkdown, AnkiCsv, Ics, Report, ComputeReceipts, ExportFn } from '../contracts.ts';

export const toMarkdown: ToMarkdown = () => { throw new Error('not implemented: toMarkdown'); };
export const ankiCsv: AnkiCsv = () => { throw new Error('not implemented: ankiCsv'); };
export const ics: Ics = () => { throw new Error('not implemented: ics'); };
export const report: Report = () => { throw new Error('not implemented: report'); };
export const computeReceipts: ComputeReceipts = () => { throw new Error('not implemented: computeReceipts'); };
export const exportAll: ExportFn = async () => { throw new Error('not implemented: exportAll'); };
