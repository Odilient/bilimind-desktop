/**
 * The speech model, and what the page and the transcriber's worker say to
 * each other (worker.ts, index.ts).
 *
 * Whisper base: multilingual (English, Russian, and Uzbek at its usual poor
 * quality), small enough to download in a minute or two and to run on a
 * laptop without a usable GPU. A bigger Whisper reads better and runs much
 * slower there; Parakeet would mean a
 * native module in the desktop shell, which it doesn't ship.
 */
import type { WhisperChunk } from './lines'

export const MODEL_ID = 'onnx-community/whisper-base'

export type SpeechDevice = 'webgpu' | 'wasm'

/**
 * The files' precision per device:
 *  - webgpu: the encoder at full precision and the decoder at 4 bits, the
 *    pairing transformers.js's own WebGPU Whisper demo uses;
 *  - wasm (the processor): both 8-bit, the smallest that keeps base's accuracy.
 */
export const DTYPES = {
  webgpu: { encoder_model: 'fp32', decoder_model_merged: 'q4' },
  wasm: { encoder_model: 'q8', decoder_model_merged: 'q8' },
} as const

/**
 * What the learner downloads, said before they agree: those ONNX files on the
 * Hub (82.5 + 123.6 MB, 23.2 + 53.7 MB, checked 7 Nov 2026) plus about 3 MB of
 * tokenizer and config. Change both together.
 */
export const MODEL_MB: Record<SpeechDevice, number> = { webgpu: 210, wasm: 80 }

export type ToWorker =
  | { type: 'status' }
  | { type: 'load' }
  | { type: 'run'; id: number; audio: Float32Array }

export type FromWorker =
  | { type: 'status'; device: SpeechDevice; cached: boolean }
  | { type: 'progress'; loaded: number; total: number }
  | { type: 'ready'; device: SpeechDevice }
  | { type: 'result'; id: number; chunks: WhisperChunk[] }
  | { type: 'error'; id: number | null; message: string }
