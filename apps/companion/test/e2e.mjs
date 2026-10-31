// The app end to end: no account, no network, and everything still there after a restart. Nothing reaches the screen
// (Chromium's headless Ozone platform, no X or Wayland) and nothing plays sound. Needs `pnpm spa` and `pnpm build` first.

import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright-core'
import { fakeProvider, inPieces } from './fake-provider.ts'

const require = createRequire(import.meta.url)
const appDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const home = mkdtempSync(join(tmpdir(), 'bm-companion-e2e-'))

const folder = join(home, 'a-folder')
mkdirSync(folder)
writeFileSync(join(folder, 'notes.md'), '# Heaps\n\nA heap keeps the smallest key at the root. '.repeat(40))

// Nothing here spends money: the "provider" is this script.
const block = (actions) => `\n\`\`\`actions\n${JSON.stringify(actions)}\n\`\`\``
const svg = '<svg viewBox="0 0 800 500"><rect x="40" y="40" width="200" height="100" fill="#2740E0"/></svg>'
const PROPOSAL = {
  title: 'Italian basics', kind: 'self', summary: 'You will order food in Italian.', finish: { kind: 'none', label: '' }, minutes_per_week: 120,
  units: [{ title: 'First words', topics: [{ title: 'Ordering food', summary: 'Asking for what you want.' }, { title: 'Numbers and prices', summary: 'Paying the bill.' }] }],
  deadlines: [],
}
const LESSON = { blocks: [
  { type: 'explainer', payload: { markdown: 'Vorrei is the polite way to ask: it means I would like.' } },
  { type: 'diagram', payload: { format: 'mermaid', source: 'flowchart TD\n  A[Vorrei] --> B[un caffe]', caption: 'Asking' } },
  { type: 'analogy', payload: { markdown: 'Vorrei is the please of Italian.', breaks_down_when: 'It is a verb, not a courtesy word.' } },
  { type: 'quiz', payload: { intro: 'Check it.' }, assessments: [
    { kind: 'mcq', prompt: 'How do you politely ask for a coffee?', bloom: 'apply', grader: 'deterministic', options: [{ id: 'a', text: 'Voglio un caffe' }, { id: 'b', text: 'Vorrei un caffe' }], answer_key: { correct_option_ids: ['b'] }, max_score: 100 },
  ] },
] }
const llm = await fakeProvider((body) => {
  const system = body.messages[0].content
  const last = body.messages.at(-1).content
  if (system.includes('You turn what a learner gives you')) return { pieces: inPieces(JSON.stringify(PROPOSAL)), delayMs: 5 }
  if (system.includes('You classify one lesson')) return { pieces: [JSON.stringify({ archetype: 'conceptual' })] }
  if (last.includes('ARCHETYPE:')) return { pieces: inPieces(JSON.stringify(LESSON), 24), thinking: ['What to ask for'], delayMs: 60 }
  if (/QUESTION\nMake me an Italian course/.test(last)) return { pieces: inPieces(`Let me draft Italian basics from what you told me.${block([{ type: 'propose_course' }])}`) }
  if (body.messages[0].content.startsWith('You draw one teaching graphic')) return { pieces: inPieces(svg, 16), delayMs: 40 }
  if (/QUESTION\nExplain joins/.test(last)) return { pieces: inPieces('A join combines rows from two tables. It matches them on a key.\n'), delayMs: 10 }
  if (/QUESTION\nKeep a note/.test(last)) return { pieces: inPieces(`Here is a note to keep.${block([{ type: 'create_page', title: 'Joins cheat sheet', markdown: '# Joins\nInner keeps matches.', subject_id: null }])}`), delayMs: 10 }
  if (/QUESTION\nShow me a join/.test(last)) return { pieces: inPieces(`Here it is.${block([{ type: 'draw', title: 'A join', mode: '2d', caption: 'Two tables', brief: 'Two tables meeting on a key' }])}`) }
  if (/QUESTION\nWrite my essay/.test(last)) return { pieces: inPieces(`This is graded work, so have a go first.${block([{ type: 'attempt_first', deadline_id: null, subject_id: null }])}`) }
  if (/QUESTION\nTell me everything/.test(last)) return { pieces: inPieces('word '.repeat(2000), 5), delayMs: 5 }
  return { pieces: ['Ok.'] }
})

const env = {
  ...process.env,
  BILIMIND_LLM_BASE_URL: llm.url,
  BILIMIND_E2E: '1',
  BILIMIND_E2E_FOLDER: folder,
  BILIMIND_USER_DATA: join(home, 'profile'),
  BILIMIND_HOME: join(home, 'settings'),
  BILIMIND_NATIVE_TRAY: '0',
  DBUS_SESSION_BUS_ADDRESS: 'unix:path=/nonexistent',
}
delete env.DISPLAY
delete env.WAYLAND_DISPLAY
delete env.ELECTRON_RUN_AS_NODE

let failed = 0
const check = (name, ok, extra = '') => {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? `  ${extra}` : ''}`)
}

const TINY_PDF = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 400 200]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 44>>stream
BT /F1 14 Tf 20 100 Td (Phantom reads) Tj ET
endstream endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
trailer<</Root 1 0 R>>
%%EOF`
const FAKE_KEY = `sk-${'f'.repeat(20)}wxyz`
const waitFor = async (ok) => {
  for (let i = 0; i < 50 && !ok(); i++) await new Promise((r) => setTimeout(r, 100))
}

const problems = []
const outside = []

async function launch() {
  const app = await electron.launch({
    // BILIMIND_E2E_EXE runs a packaged build instead of this folder.
    executablePath: process.env.BILIMIND_E2E_EXE || require('electron'),
    args: ['--no-sandbox', '--ozone-platform=headless', '--ozone-override-screen-size=1440,900', '--disable-gpu', ...(process.env.BILIMIND_E2E_EXE ? [] : [appDir])],
    env,
    timeout: 60_000,
  })
  // Anything that tries to leave this computer is blocked and written down.
  await app.evaluate(({ session }) => {
    globalThis.__outside = []
    session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (details, done) => {
      globalThis.__outside.push(details.url)
      done({ cancel: true })
    })
  })
  const page = await app.firstWindow({ timeout: 30_000 })
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text().slice(0, 200)}`) })
  page.on('pageerror', (e) => problems.push(`exception: ${String(e).slice(0, 300)}`))
  page.on('response', (r) => { if (r.status() >= 400) problems.push(`${r.status()} ${r.request().method()} ${r.url()}`) })
  return { app, page }
}

async function stop(app) {
  outside.push(...await app.evaluate(() => globalThis.__outside))
  await app.evaluate(({ app: a }) => { a.exit(0) }).catch(() => undefined)
  await app.close().catch(() => undefined)
}

const NOTE = 'Spaced practice beats cramming'

try {
  // ---------- first run ----------
  let { app, page } = await launch()
  await page.waitForLoadState('domcontentloaded')
  await page.getByText('Add a task').first().waitFor({ timeout: 30_000 })
  check('opens on Today with no account', new URL(page.url()).pathname === '/app', page.url())
  check('no sign-in page', !(await page.getByText('Sign in').first().isVisible().catch(() => false)))
  check('the session is the seeded local one', (await page.evaluate(() => document.cookie)).includes('bilimind_token=local'))
  const me = await page.evaluate(async () => (await fetch('/api/auth/me')).json())
  check('/auth/me answers for one local user', me.user?.id === 1 && me.subscription?.plan === 'local')

  // ---------- own task ----------
  await page.getByText('Add a task').first().click()
  await page.getByLabel('Something to do today').fill('Read chapter 3, 30 min')
  await page.getByLabel('Something to do today').press('Enter')
  await page.getByText('Read chapter 3').first().waitFor({ timeout: 10_000 })
  await page.waitForFunction(async () => {
    const { data } = await (await fetch('/api/companion/plan-tasks')).json()
    return data.some((t) => t.kind === 'own' && t.title === 'Read chapter 3' && t.minutes === 30)
  }, undefined, { timeout: 10_000, polling: 200 })
  check('an own task is saved in the database', true)

  // ---------- a note ----------
  await page.goto('app://bilimind/app/p/new?template=blank')
  await page.waitForURL(/\/app\/notes\/[0-9a-f-]{36}/, { timeout: 30_000 })
  const noteId = page.url().match(/notes\/([0-9a-f-]{36})/)[1]
  const editor = page.locator('.ProseMirror[contenteditable="true"]').first()
  await editor.waitFor({ timeout: 30_000 })
  await editor.click()
  await page.keyboard.type(NOTE)
  // Saved means it reached the API, not only this window's IndexedDB.
  await page.waitForFunction(async (id) => {
    const doc = (await (await fetch(`/api/companion/items/${id}/doc`)).json()).data
    return doc.snapshot || doc.updates.length > 0
  }, noteId, { timeout: 30_000, polling: 500 })
  check('a note saves its document', true)

  // ---------- a whiteboard ----------
  await page.goto('app://bilimind/app/b/new')
  await page.waitForURL(/\/app\/notes\/[0-9a-f-]{36}/, { timeout: 30_000 })
  const boardId = page.url().match(/notes\/([0-9a-f-]{36})/)[1]
  await page.locator('canvas').first().waitFor({ timeout: 30_000 })
  const box = await page.locator('canvas').first().boundingBox()
  await page.keyboard.press('r')
  await page.mouse.move(box.x + box.width / 2 - 100, box.y + box.height / 2 - 60)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 60, { steps: 8 })
  await page.mouse.up()
  await page.waitForFunction(async (id) => {
    const doc = (await (await fetch(`/api/companion/items/${id}/doc`)).json()).data
    return doc.snapshot || doc.updates.length > 0
  }, boardId, { timeout: 30_000, polling: 500 })
  const board = await page.evaluate(async (id) => (await (await fetch(`/api/companion/items/${id}`)).json()).data, boardId)
  check('a whiteboard is made and saves its document', board.kind === 'board')

  // ---------- courses, the plan and Today, through the API the SPA uses ----------
  const seeded = await page.evaluate(async () => {
    const post = async (path, body) => (await (await fetch(`/api/companion/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json()).data
    const s = await post('subjects', { id: crypto.randomUUID(), title: 'Databases' })
    const due = new Date(Date.now() + 2 * 86_400_000).toISOString()
    const d = await post('deadlines', { id: crypto.randomUUID(), subject_id: s.id, kind: 'lab', title: 'Lab 4', due_at: due, weight_pct: 20 })
    await fetch('/api/companion/plan/rebuild', { method: 'POST' })
    return { subject: s.id, deadline: d.id }
  })
  await page.goto('app://bilimind/app')
  await page.getByText('Work on Lab 4').first().waitFor({ timeout: 30_000 })
  check('Today shows the plan the planner wrote', true)
  await page.goto(`app://bilimind/app/courses/${seeded.subject}`)
  await page.getByText('Databases').first().waitFor({ timeout: 30_000 })
  check('a course page opens', true)

  // ---------- every other screen opens without an error ----------
  for (const path of ['/app/notes', '/app/calendar', '/app/practice', '/app/courses', '/app/inbox', '/app/connect', `/app/d/${seeded.deadline}`, '/sandbox']) {
    await page.goto(`app://bilimind${path}`)
    await page.waitForLoadState('networkidle')
    const body = await page.locator('body').innerText()
    check(`${path} opens`, body.trim().length > 0 && !/Nothing here\.|That did not load\./.test(body))
  }

  // ---------- settings ----------
  await page.goto('app://bilimind/app/settings')
  await page.getByRole('button', { name: 'AI key' }).waitFor({ timeout: 20_000 })
  check('settings has the AI key and preferences', await page.getByRole('button', { name: 'Preferences' }).isVisible())
  check('no plan, team or account sections', !(await page.getByRole('button', { name: 'Plan & billing' }).isVisible().catch(() => false)))
  await page.getByRole('button', { name: 'Preferences' }).click()
  await page.getByText('Make me try first').first().waitFor({ timeout: 10_000 })

  // ---------- the chat, with no key ----------
  const ask = async (words) => {
    const box = page.getByLabel('Ask BiliMind').first()
    await box.waitFor({ timeout: 20_000 })
    await box.fill(words)
    await box.press('Enter')
  }
  await page.goto('app://bilimind/app/chat')
  await ask('Explain joins')
  await page.getByText('Add a DeepSeek or OpenRouter key in Settings').first().waitFor({ timeout: 20_000 })
  check('with no key the chat says how to add one, and calls nobody', llm.requests.length === 0)
  await page.getByRole('button', { name: 'Open' }).first().click()
  await page.waitForURL(/\/app\/settings\?section=keys/, { timeout: 10_000 })
  check('its link opens the key screen', true)

  // ---------- the key screen ----------
  // Headless, with no session bus: Chromium's basic_text backend, which is what "no keychain" looks like here.
  await page.getByText('This computer has no system keychain').waitFor({ timeout: 10_000 })
  check('with no keychain the screen says so', true)
  await page.getByRole('button', { name: 'Add a key' }).click()
  await page.locator('#cred-provider').selectOption('deepseek')
  await page.getByLabel('Secret key').fill(FAKE_KEY)
  await page.getByRole('button', { name: 'Save key' }).click()
  await page.getByText('In use').waitFor({ timeout: 10_000 })
  const screen = await page.locator('body').innerText()
  check('the key shows by its last four, never whole', screen.includes('wxyz') && !screen.includes(FAKE_KEY))
  const keyFile = join(home, 'profile', 'data', 'keys.json')
  check('the key file is this user\'s alone', (statSync(keyFile).mode & 0o777) === 0o600)

  // ---------- the chat, with one ----------
  await page.goto('app://bilimind/app/chat')
  await ask('Explain joins')
  await page.getByText('It matches them on a key').first().waitFor({ timeout: 20_000 })
  check('an answer streams in', llm.requests.at(-1).authorization === `Bearer ${FAKE_KEY}`)
  check('the model reads the learner\'s week', llm.requests.at(-1).body.messages[0].content.includes('Lab 4'))

  await page.goto('app://bilimind/app/chat')
  await ask('Keep a note')
  await page.getByRole('button', { name: 'Save note' }).first().click({ timeout: 20_000 })
  await page.waitForFunction(async () => {
    const { data } = await (await fetch('/api/companion/items?kind=page')).json()
    return data.some((i) => i.title === 'Joins cheat sheet')
  }, undefined, { timeout: 15_000, polling: 300 })
  check('an action card makes the note when pressed', true)
  check('the actions block never reached the screen', !(await page.locator('body').innerText()).includes('create_page'))

  await page.goto('app://bilimind/app/chat')
  await ask('Show me a join')
  await page.locator('img[src^="data:image/svg"], img[src^="blob:"]').first().waitFor({ timeout: 20_000 })
  check('a graphic is drawn under the answer', llm.requests.at(-1).body.thinking?.type === 'disabled')

  await page.goto('app://bilimind/app/chat')
  await ask('Write my essay')
  await page.getByRole('button', { name: 'Check my attempt' }).first().waitFor({ timeout: 20_000 })
  check('graded work asks for an attempt first', await page.getByRole('button', { name: "I'm stuck, show me" }).first().isVisible())

  await page.goto('app://bilimind/app/chat')
  await ask('Tell me everything')
  await page.getByText('word word').first().waitFor({ timeout: 20_000 })
  await page.getByLabel('Stop answering').first().click()
  await waitFor(() => llm.dropped() > 0)
  check('Stop cuts the provider\'s reply off', llm.dropped() > 0)

  // The PDF reader is bundled into main, so this is the one place it can break that the unit tests can't see.
  const threadId = await page.evaluate(async (pdf) => {
    const form = new FormData()
    form.append('file', new File([pdf], 'lecture.pdf'))
    const { data: item } = await (await fetch('/api/companion/items/upload', { method: 'POST', body: form })).json()
    const res = await fetch('/api/companion/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
      body: JSON.stringify({ message: 'Teach me from this', scope: 'everything', context: { kind: 'everything' }, attachments: [{ kind: 'file', item_id: item.id, label: 'lecture.pdf' }] }),
    })
    return (await res.text()).match(/"thread_id":"([^"]+)"/)[1]
  }, TINY_PDF)
  check('a PDF attachment is read', Boolean(threadId) && llm.requests.at(-1).body.messages.at(-1).content.includes('Phantom reads'))

  await page.goto('app://bilimind/app/chat')
  await ask('Teach me Italian')
  await page.getByText('Ok.').first().waitFor({ timeout: 20_000 })
  const threads = await page.evaluate(async () => (await (await fetch('/api/companion/ask/threads')).json()).data)
  check('the chats are listed', threads.some((x) => x.title === 'Explain joins'))

  // ---------- a course from the chat, through to a marked answer ----------
  await page.goto('app://bilimind/app/chat')
  await ask('Make me an Italian course')
  await page.getByRole('button', { name: /^Create/ }).first().click({ timeout: 30_000 })
  await page.waitForFunction(async () => {
    const { data } = await (await fetch('/api/companion/subjects')).json()
    return data.some((s) => s.title === 'Italian basics')
  }, undefined, { timeout: 15_000, polling: 300 })
  check('a draft in the chat becomes a course', true)
  const made = await page.evaluate(async () => {
    const subjects = (await (await fetch('/api/companion/subjects')).json()).data
    const topics = (await (await fetch('/api/companion/topics')).json()).data
    const subject = subjects.find((x) => x.title === 'Italian basics')
    return { subject: subject.id, topic: topics.find((t) => t.subject_id === subject.id && t.title === 'Ordering food').id }
  })
  await page.goto(`app://bilimind/app/courses/${made.subject}`)
  await page.getByText('Ordering food').first().click({ timeout: 30_000 })
  await page.getByRole('button', { name: /Write (this|the) lesson/ }).first().click({ timeout: 20_000 })
  await page.getByText('Vorrei is the polite way').first().waitFor({ timeout: 60_000 })
  check('a lesson is written and appears on its page', true)
  await page.getByRole('radio', { name: 'Vorrei un caffe' }).first().click({ timeout: 30_000 }).catch(async () => { await page.getByText('Vorrei un caffe').first().click() })
  await page.getByRole('button', { name: /^Submit/ }).first().click({ timeout: 10_000 })
  await page.getByText('Passed').first().waitFor({ timeout: 15_000 })
  check('an answer is marked on the lesson page', true)

  await page.goto('app://bilimind/app/settings?section=spending')
  await page.getByText('Writing a lesson').first().waitFor({ timeout: 20_000 })
  check('the Spending screen shows what the lesson cost', (await page.locator('body').innerText()).includes('Italian basics'))

  // ---------- a folder, through the pipeline's own process ----------
  const folderReply = await page.evaluate(async () => {
    const picked = (await (await fetch('/api/companion/folders/pick', { method: 'POST' })).json()).data
    const res = await fetch('/api/companion/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
      body: JSON.stringify({ message: 'Get me ready', scope: 'everything', context: { kind: 'everything' }, attachments: [{ kind: 'moodle', label: picked.title, subject_id: picked.id }] }),
    })
    return res.text()
  })
  // The fake provider can't write a course, so the build stops at the outline: what this proves is that the
  // process starts from where packaging puts it, reads the folder and reports back in words.
  check('building from a folder runs its own process and reports back', folderReply.includes('Reading your files') && folderReply.includes('finish building'), folderReply.slice(-300))

  await stop(app)

  // ---------- restart ----------
  ;({ app, page } = await launch())
  await page.getByText('Read chapter 3').first().waitFor({ timeout: 30_000 })
  check('after a restart the own task is there', true)
  const kept = await page.evaluate(async () => (await (await fetch('/api/companion/ask/threads')).json()).data)
  check('after a restart the chats are there', kept.some((x) => x.title === 'Explain joins'))
  await page.getByText('Work on Lab 4').first().waitFor({ timeout: 10_000 })
  check('after a restart the plan is there', true)
  await page.goto(`app://bilimind/app/notes/${noteId}`)
  await page.locator('.ProseMirror').getByText(NOTE).first().waitFor({ timeout: 30_000 })
  check('after a restart the note has its words', true)
  // The document comes from SQLite, not this window's IndexedDB: prove the row and updates survived.
  const doc = await page.evaluate(async (id) => (await (await fetch(`/api/companion/items/${id}/doc`)).json()).data, noteId)
  check('the note document is in the database', Boolean(doc.snapshot) || doc.updates.length > 0)
  await page.goto(`app://bilimind/app/notes/${boardId}`)
  await page.locator('canvas').first().waitFor({ timeout: 30_000 })
  check('after a restart the whiteboard opens', true)
  await stop(app)
} catch (error) {
  failed++
  console.log(`FAIL ${String(error).slice(0, 800)}`)
}

// shortcut: the code sandbox still fetches its Python and SQL runtimes from a CDN, and only that page does. Vendor them with offline export.
const left = [...new Set(outside)].filter((url) => !url.startsWith('https://cdn.jsdelivr.net/'))
check('nothing tried to leave this computer', left.length === 0, left.slice(0, 5).join(' '))
const unexpected = [...new Set(problems)]
check('no failed requests or page errors', unexpected.length === 0)
for (const p of unexpected) console.log(`     ${p}`)

await llm.close()
rmSync(home, { recursive: true, force: true })
console.log(failed ? `${failed} FAILED` : 'ALL PASS')
process.exit(failed ? 1 : 0)
