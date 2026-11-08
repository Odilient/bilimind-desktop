/**
 * The on-device transcriber: Whisper through transformers.js, in a worker so
 * that a long lecture never freezes the app. Started by index.ts with
 *   new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
 *
 * It runs on the GPU through WebGPU when the computer has one that answers,
 * and on the processor (WebAssembly) otherwise; a GPU that answers but can't
 * run the model falls back too. The model comes from the Hugging Face Hub
 * the first time only (index.ts asks the learner first) and is kept in the
 * browser cache, where `status` finds it next time.
 *
 * The page sends one cut of sound at a time, 16 kHz mono and under 30 s
 * (recorder.ts makes them), and gets back Whisper's chunks with their times.
 */
import { ModelRegistry, env, pipeline, type ProgressInfo } from '@huggingface/transformers'
import ortMjs from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url'
import ortWasm from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url'
import type { WhisperChunk } from './lines'
import { DTYPES, MODEL_ID, type FromWorker, type SpeechDevice, type ToWorker } from './model'

// The runtime's own files ship with the app rather than coming from a CDN (transformers.js's default): the
// desktop's policy runs scripts from the app itself only. For the same reason they are imported from their
// address, not copied into blob: scripts first (`useWasmCache`), which that policy refuses too.
env.allowLocalModels = false
env.useWasmCache = false
env.backends.onnx.wasm!.wasmPaths = {
  mjs: new URL(ortMjs, self.location.href).href,
  wasm: new URL(ortWasm, self.location.href).href,
}

// Typed as the worker it is (the app's TypeScript is the page's, without the worker library), as sandbox/runner.worker.ts does.
const scope = self as unknown as Worker
const post = (message: FromWorker) => scope.postMessage(message)

type Asr = (audio: Float32Array, options: Record<string, unknown>) => Promise<{ text: string; chunks?: WhisperChunk[] }>

let device: SpeechDevice | null = null
let asr: Promise<Asr> | null = null

async function pickDevice(): Promise<SpeechDevice> {
  if (device) return device
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu
    device = gpu && (await gpu.requestAdapter()) ? 'webgpu' : 'wasm'
  } catch {
    device = 'wasm'
  }
  return device
}

function progress(info: ProgressInfo): void {
  if (info.status === 'progress_total') post({ type: 'progress', loaded: info.loaded, total: info.total })
}

function open(on: SpeechDevice): Promise<Asr> {
  return pipeline('automatic-speech-recognition', MODEL_ID, {
    device: on,
    dtype: DTYPES[on],
    progress_callback: progress,
  }) as unknown as Promise<Asr>
}

function load(): Promise<Asr> {
  asr ??= (async () => {
    const on = await pickDevice()
    try {
      return await open(on)
    } catch (error) {
      if (on !== 'webgpu') throw error
      device = 'wasm'
      return await open('wasm')
    }
  })()
  // A failed load (offline, say) is tried afresh next time.
  asr.catch(() => (asr = null))
  return asr
}

function words(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

scope.onmessage = async (event: MessageEvent<ToWorker>) => {
  const m = event.data
  if (m.type === 'status') {
    const on = await pickDevice()
    let cached = false
    try {
      cached = await ModelRegistry.is_cached(MODEL_ID, { device: on, dtype: DTYPES[on] })
    } catch {
      // unknown counts as not here: the learner is asked, which is the safe side
    }
    post({ type: 'status', device: on, cached })
    return
  }
  if (m.type === 'load') {
    try {
      await load()
      post({ type: 'ready', device: device ?? 'wasm' })
    } catch (error) {
      post({ type: 'error', id: null, message: words(error) })
    }
    return
  }
  try {
    const run = await load()
    // chunk_length_s lets a cut a little over 30 s through whole instead of cut off at Whisper's window.
    const out = await run(m.audio, { return_timestamps: true, chunk_length_s: 30 })
    post({ type: 'result', id: m.id, chunks: out.chunks ?? [{ text: out.text, timestamp: [0, null] }] })
  } catch (error) {
    post({ type: 'error', id: m.id, message: words(error) })
  }
}
