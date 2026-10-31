/**
 * The platform layer: `usePlatform()` for what the device can do, and
 * `usePlatformHooks()` for the app shell to wire the device into the app
 * (the tray's deadline, the capture hotkey, dropped files). See ./types.
 */
export * from './types'
export { usePlatform } from './use-platform'
export { usePlatformHooks } from './hooks'
