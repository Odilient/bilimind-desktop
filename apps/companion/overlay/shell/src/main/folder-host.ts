// The folder dialog and the process the pipeline runs in. Its key goes to it in the environment of that one process, and
// it writes to the same ledger, so its caps and the Spending screen are the ones everything else uses.
import { BilimindError } from '@bilimind/engine/contracts'
import { app, dialog, utilityProcess, type BrowserWindow, type UtilityProcess } from 'electron'
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { FolderDeps } from '../api/lessons/folder.ts'

const KEY_ENV = { deepseek: 'DEEPSEEK_API_KEY', openrouter: 'OPENROUTER_API_KEY' } as Record<string, string>

/** Packaged beside the app; from source, wherever the player was built. */
const template = () => (app.isPackaged ? join(process.resourcesPath, 'templates', 'player.html') : join(app.getAppPath(), '..', '..', 'packages', 'player', 'dist', 'player.html'))
const assets = () => join(dirname(template()), 'img')

export function exporter(windowOf: () => BrowserWindow | null) {
  return {
    template() {
      if (!existsSync(template())) throw new BilimindError('The offline player is missing from this build.')
      return readFileSync(template(), 'utf8')
    },
    /** A folder of their choosing gets `<course>/index.html` and the player's images. */
    async save(name: string, html: string): Promise<string | null> {
      const win = windowOf()
      const options = { title: 'Choose where to save the course', properties: ['openDirectory', 'createDirectory'] as ('openDirectory' | 'createDirectory')[] }
      const folder = process.env.BILIMIND_E2E && process.env.BILIMIND_E2E_FOLDER ? process.env.BILIMIND_E2E_FOLDER
        : (await (win ? dialog.showOpenDialog(win, options) : dialog.showOpenDialog(options))).filePaths[0]
      if (!folder) return null
      const target = join(folder, name)
      mkdirSync(target, { recursive: true })
      writeFileSync(join(target, 'index.html'), html)
      if (existsSync(assets())) cpSync(assets(), join(target, 'img'), { recursive: true })
      return target
    },
  }
}

export function folderHost(windowOf: () => BrowserWindow | null, settingsDir: string): FolderDeps {
  let proc: UtilityProcess | null = null
  return {
    async pick(title = 'Build a course from a folder') {
      if (process.env.BILIMIND_E2E && process.env.BILIMIND_E2E_FOLDER) return process.env.BILIMIND_E2E_FOLDER
      const win = windowOf()
      const options = { title, properties: ['openDirectory', 'createDirectory'] as ('openDirectory' | 'createDirectory')[] }
      const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
      return result.canceled ? null : result.filePaths[0] ?? null
    },

    build({ src, sentence, outRoot, config, progress }) {
      mkdirSync(outRoot, { recursive: true })
      const env: Record<string, string> = {}
      for (const [k, v] of Object.entries(process.env)) if (typeof v === 'string') env[k] = v
      delete env.ELECTRON_RUN_AS_NODE
      env.BILIMIND_HOME = settingsDir
      env.BILIMIND_PROVIDER = config.provider
      env.BILIMIND_BASE_URL = config.baseUrl
      // The offline page each built course also gets.
      if (existsSync(template())) env.BILIMIND_TEMPLATE = template()
      if (existsSync(assets())) env.BILIMIND_ASSETS = assets()
      if (KEY_ENV[config.provider]) env[KEY_ENV[config.provider]!] = config.apiKey
      return new Promise((resolve, reject) => {
        const worker = utilityProcess.fork(join(app.getAppPath().replace(/app\.asar$/, 'app.asar.unpacked'), 'dist/worker/build.cjs'), [], {
          serviceName: 'BiliMind course build', env, cwd: outRoot,
        })
        proc = worker
        let finished = false
        worker.on('message', (m: { type: string; text?: string; course?: string; message?: string }) => {
          if (m.type === 'progress' && m.text) progress(m.text)
          if (m.type === 'done' && m.course) { finished = true; resolve({ course: m.course }) }
          if (m.type === 'error') { finished = true; reject(new BilimindError(m.message ?? 'The build stopped.')) }
        })
        worker.on('exit', () => {
          proc = null
          if (!finished) reject(new BilimindError('The build was stopped before it finished.'))
        })
        worker.postMessage({ type: 'start', src, sentence, outRoot, zone: Intl.DateTimeFormat().resolvedOptions().timeZone })
      })
    },

    stop() {
      proc?.kill()
    },
  }
}
