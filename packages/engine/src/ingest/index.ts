// Ingest: pdf (unpdf, Page N / Slide N), pptx (fflate, Slide N + notes), docx (mammoth), md; chunker; digest; roles. Split into pdf.ts/pptx.ts/... freely, keep these exports.
// Owner: WP1. Keep the export names and types (src/contracts.ts); replace the stubs in place.
import type { ExtractFile, DetectRole, ChunkSections, BuildDigest, Ingest, ReadIngest } from '../contracts.ts';
import type { IngestResult } from '@bilimind/core';
import { coursePaths, readJson } from '../course.ts';

export const extractFile: ExtractFile = async () => { throw new Error('not implemented: extractFile'); };
export const detectRole: DetectRole = () => { throw new Error('not implemented: detectRole'); };
export const chunkSections: ChunkSections = () => { throw new Error('not implemented: chunkSections'); };
export const buildDigest: BuildDigest = () => { throw new Error('not implemented: buildDigest'); };
export const ingest: Ingest = async () => { throw new Error('not implemented: ingest'); };

export const readIngest: ReadIngest = course => readJson<IngestResult>(coursePaths(course).ingest);
