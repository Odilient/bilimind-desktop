export type ToastTone = 'neutral' | 'success' | 'warn' | 'danger'

export interface ToastAction {
  label: string
  handler: () => void
}

export interface Toast {
  id: number
  tone: ToastTone
  title: string
  body?: string
  /** 0 keeps the toast until it is dismissed. */
  duration: number
  action?: ToastAction
}

export interface ToastInput {
  title: string
  body?: string
  tone?: ToastTone
  duration?: number
  action?: ToastAction
}

let nextId = 1

/** Client-only; never populated during SSR, so it is safe at module scope. */
const timers = new Map<number, ReturnType<typeof setTimeout>>()

/**
 * App-wide toasts. `<UiToast />` (mounted once in `app.vue`) renders them.
 *
 *   const toast = useToast()
 *   toast.success('Course created')
 *   toast.error(err.message)
 */
export function useToast() {
  const toasts = useState<Toast[]>('bilimind-toasts', () => [])

  function dismiss(id: number): void {
    const timer = timers.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.delete(id)
    }
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  function push(input: ToastInput | string, tone: ToastTone = 'neutral'): number {
    const base: ToastInput = typeof input === 'string' ? { title: input } : input
    const toast: Toast = {
      id: nextId++,
      tone: base.tone ?? tone,
      title: base.title,
      body: base.body,
      action: base.action,
      duration: base.duration ?? (base.tone === 'danger' || tone === 'danger' ? 7000 : 4200),
    }

    toasts.value = [...toasts.value, toast]

    if (import.meta.client && toast.duration > 0) {
      timers.set(
        toast.id,
        setTimeout(() => dismiss(toast.id), toast.duration),
      )
    }

    return toast.id
  }

  return {
    toasts,
    push,
    dismiss,
    clear: () => {
      toasts.value = []
    },
    success: (input: ToastInput | string) => push(input, 'success'),
    error: (input: ToastInput | string) => push(input, 'danger'),
    warn: (input: ToastInput | string) => push(input, 'warn'),
    info: (input: ToastInput | string) => push(input, 'neutral'),
  }
}
