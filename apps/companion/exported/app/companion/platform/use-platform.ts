/**
 * `usePlatform()`: the one door to what the device can do (see ./types).
 *
 * Chosen once per tab at runtime: the desktop shell announces itself as
 * `window.bilimind` before any app code runs; everything else is the web.
 * Call it from a setup (it captures `useApi` there, like the http repo does);
 * the instance is shared after that.
 */
import { useApi } from '~/composables/useApi'
import { createElectronPlatform } from './electron'
import type { DesktopBridge, Platform } from './types'
import { createWebPlatform } from './web'

let instance: Platform | null = null

function desktopBridge(): DesktopBridge | null {
  if (!import.meta.client) return null
  const bridge = (window as unknown as { bilimind?: DesktopBridge }).bilimind
  return bridge?.kind === 'electron' ? bridge : null
}

/**
 * The desktop app, asked without creating the platform: for lists built
 * outside a component's setup (the New menu's "Record screen", the palette).
 */
export function isDesktopApp(): boolean {
  return desktopBridge() !== null
}

export function usePlatform(): Platform {
  if (instance) return instance
  const bridge = desktopBridge()
  if (bridge) {
    const api = useApi()
    instance = createElectronPlatform(bridge, () => api)
  } else {
    instance = createWebPlatform()
  }
  return instance
}
