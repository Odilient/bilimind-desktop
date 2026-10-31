// The pipeline, in a utility process: minutes of work that must not sit on the main thread, and cancel is killing this.
// One start message in; progress lines, then done or error, out.
import { runPipeline } from '@bilimind/engine/run'

type Port = { postMessage(m: unknown): void; on(ev: 'message', cb: (e: { data: any }) => void): void }
const port = (process as unknown as { parentPort: Port }).parentPort

const WORDS: [RegExp, string][] = [
  [/^\[run\] .*: ingest/, 'Reading your files'],
  [/^\[run\] .*: outline/, 'Drawing the path'],
  [/^\[run\] .*: exam-map/, 'Matching the past paper to the topics'],
  [/^\[run\] .*: plan/, 'Planning your days'],
  [/^\[run\] (.+): draft/, 'Writing the lessons'],
  [/^\[run\] .*: (check|code-test)/, 'Testing the lessons'],
  [/^\[run\] .*: (fact-check|verdict|evidence)/, 'Checking every answer against your files'],
  [/^\[run\] .*: build/, 'Putting the course together'],
]

let said = ''
function progress(line: string) {
  const words = WORDS.find(([re]) => re.test(line))?.[1]
  if (!words || words === said) return
  said = words
  port.postMessage({ type: 'progress', text: `${words}…` })
}

port.on('message', ({ data }) => {
  if (data?.type !== 'start') return
  runPipeline({ src: data.src, sentence: data.sentence, outRoot: data.outRoot, narrate: false, timezone: data.zone, progress }).then((out) => {
    port.postMessage({ type: 'done', course: out.course })
    setTimeout(() => process.exit(0), 200)
  }).catch((error: { message?: string }) => {
    port.postMessage({ type: 'error', message: String(error?.message ?? error) })
    setTimeout(() => process.exit(1), 200)
  })
})
