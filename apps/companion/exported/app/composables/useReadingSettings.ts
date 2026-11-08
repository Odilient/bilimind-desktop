import type { ReadingFont, ReadingSettings, ReadingTheme, ReadingWidth } from '~/types/api'

/**
 * READING — zoom, typeface, background and width for the lesson column.
 *
 * Two layers. The account holds the *default* (`users.preferences.reading`),
 * so it follows the person to every device. On top of it sits a session-local
 * working copy that the controls change immediately — turning the zoom
 * slider is a preview, not a request — and "Set as default" is the one
 * moment the account is written. That keeps the controls instant, keeps a
 * phone from silently overwriting the laptop's choice, and gives a
 * signed-out reader the same controls without anywhere to save them.
 */
export const READING_DEFAULTS: ReadingSettings = { scale: 1, font: 'sans', theme: 'paper', width: 'normal' }

export const READING_SCALE_MIN = 0.75
export const READING_SCALE_MAX = 1.6
export const READING_SCALE_STEP = 0.05

export const READING_FONTS: Array<{ value: ReadingFont; label: string }> = [
  { value: 'sans', label: 'Sans' },
  { value: 'serif', label: 'Serif' },
]

/**
 * The column's widest; the pane beside a sidebar and the assistant may still be narrower.
 * 760px read as cramped (11-09), so 960 is the normal one now and Full is the whole pane.
 * The stored values didn't change, so a saved "normal" simply reads wider.
 */
export const READING_WIDTHS: Array<{ value: ReadingWidth; label: string; measure: string }> = [
  { value: 'normal', label: 'Normal', measure: '960px' },
  { value: 'wide', label: 'Wide', measure: '1240px' },
  { value: 'full', label: 'Full', measure: '100%' },
]

/** Paper is no theme of its own: it is the app's palette, so its swatch is too. */
export const READING_THEMES: Array<{ value: ReadingTheme; label: string; swatch: string; ink: string }> = [
  { value: 'paper', label: 'Paper', swatch: 'var(--surface)', ink: 'var(--text)' },
  { value: 'warm', label: 'Warm', swatch: '#f6efe2', ink: '#2b2418' },
  { value: 'dim', label: 'Dim', swatch: '#0b0d10', ink: '#f4f5f9' },
]

function clampScale(value: number): number {
  const stepped = Math.round(value / READING_SCALE_STEP) * READING_SCALE_STEP
  return Math.min(READING_SCALE_MAX, Math.max(READING_SCALE_MIN, Math.round(stepped * 100) / 100))
}

export function useReadingSettings() {
  const { user, isAuthenticated, updateProfile } = useAuth()
  const toast = useToast()

  /** What the account says. */
  const saved = computed<ReadingSettings>(() => {
    const reading = user.value?.preferences?.reading ?? {}
    return {
      scale: typeof reading.scale === 'number' ? clampScale(reading.scale) : READING_DEFAULTS.scale,
      font: reading.font ?? READING_DEFAULTS.font,
      theme: reading.theme ?? READING_DEFAULTS.theme,
      width: reading.width ?? READING_DEFAULTS.width,
    }
  })

  /** What this session has changed since. App-wide, so every lesson pane agrees. */
  const local = useState<Partial<ReadingSettings> | null>('reading:local', () => null)

  const settings = computed<ReadingSettings>(() => ({ ...saved.value, ...(local.value ?? {}) }))

  const isDefault = computed(
    () =>
      settings.value.scale === saved.value.scale &&
      settings.value.font === saved.value.font &&
      settings.value.theme === saved.value.theme &&
      settings.value.width === saved.value.width,
  )

  const saving = ref(false)

  function set(patch: Partial<ReadingSettings>): void {
    const next = { ...(local.value ?? {}), ...patch }
    if (typeof next.scale === 'number') next.scale = clampScale(next.scale)
    local.value = next
  }

  function zoom(delta: number): void {
    set({ scale: settings.value.scale + delta })
  }

  /** Back to the account's default. */
  function reset(): void {
    local.value = null
  }

  /** Make the current choice the account's default. */
  async function setAsDefault(): Promise<void> {
    if (!isAuthenticated.value || saving.value) return
    saving.value = true

    try {
      await updateProfile({ preferences: { reading: { ...settings.value } } })
      local.value = null
      toast.success('Saved as your default')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save your reading settings.')
    } finally {
      saving.value = false
    }
  }

  /** Put these on the element that holds the lesson column. */
  const classes = computed(() => [
    'reading-surface',
    `reading-font-${settings.value.font}`,
    `reading-theme-${settings.value.theme}`,
  ])

  const style = computed(() => ({
    '--reading-zoom': String(settings.value.scale),
    '--reading-measure': (READING_WIDTHS.find((w) => w.value === settings.value.width) ?? READING_WIDTHS[0]!).measure,
  }))

  return {
    settings,
    saved,
    isDefault,
    saving,
    canSave: isAuthenticated,
    set,
    zoom,
    reset,
    setAsDefault,
    classes,
    style,
  }
}
