// The folder dialog and the process the pipeline runs in. Its key goes to it in the environment of that one process, and
// it writes to the same ledger, so its caps and the Spending screen are the ones everything else uses.
import { BilimindError } from '@bilimind/engine/contracts'
import { app, dialog, utilityProcess, type BrowserWindow, type UtilityProcess } from 'electron'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { FolderDeps } from '../api/lessons/folder.ts'

const KEY_ENV = { deepseek: 'DEEPSEEK_API_KEY', openrouter: 'OPENROUTER_API_KEY' } as Record<string, string>

export function folderHost(windowOf: () => BrowserWindow | null, settingsDir: string): FolderDeps {
  let proc: UtilityProcess | null = null
  return {
    async pick() {
      if (process.env.BILIMIND_E2E && process.env.BILIMIND_E2E_FOLDER) return process.env.BILIMIND_E2E_FOLDER
      const win = windowOf()
      const options = { title: 'Build a course from a folder', properties: ['openDirectory'] as ('openDirectory')[] }
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
