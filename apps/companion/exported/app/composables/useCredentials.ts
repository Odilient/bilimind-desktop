import type { ApiError } from '~/composables/useApi'

/**
 * Bring-your-own-key.
 *
 * A learner can hand BiliMind their own model key (pasted, or from "Sign in with
 * OpenRouter", companion/openrouter.ts), and what it writes is never counted.
 * Since 7 Nov 2026 that holds on Free too, where it is one of the ways to AI at
 * all — the API decides that (App\Services\Billing\OwnKey), not this composable. The secret only ever travels one way: it goes up when added
 * and never comes back — the list only carries the last four characters, enough
 * to recognise which key is which.
 */

export type CredentialProvider = 'openrouter' | 'deepseek' | string

export interface Credential {
  id: number
  provider: CredentialProvider
  label?: string | null
  /** Last four characters of the secret — all the API will ever return of it. */
  last_four: string
  active: boolean
  created_at?: string
  last_used_at?: string | null
}

export interface AddCredentialPayload {
  provider: CredentialProvider
  key: string
  label?: string
}

/**
 * The API names it `is_active` (CredentialResource); the screens read `active`.
 * Without this the key in use never showed as "In use".
 */
function normalise(raw: Credential & { is_active?: boolean }): Credential {
  return { ...raw, active: Boolean(raw.active ?? raw.is_active) }
}

export function useCredentials() {
  const api = useApi()

  const items = useState<Credential[]>('credentials:list', () => [])
  const loading = ref(false)
  const working = ref(false)
  const error = ref<ApiError | null>(null)

  const active = computed(() => items.value.find((c) => c.active) ?? null)
  const hasActive = computed(() => Boolean(active.value))

  async function load(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      items.value = (await api.get<Credential[]>('/credentials')).map(normalise)
    } catch (raw) {
      error.value = raw as ApiError
    } finally {
      loading.value = false
    }
  }

  async function add(payload: AddCredentialPayload): Promise<Credential> {
    working.value = true
    try {
      const created = normalise(await api.post<Credential>('/credentials', payload))
      // A freshly added key is the one you want to use, so reflect it locally as
      // active and demote the rest until the next reload confirms the server view.
      items.value = [
        ...items.value.map((c) => ({ ...c, active: created.active ? false : c.active })),
        created,
      ]
      return created
    } finally {
      working.value = false
    }
  }

  async function activate(id: number): Promise<void> {
    working.value = true
    try {
      await api.post(`/credentials/${id}/activate`)
      items.value = items.value.map((c) => ({ ...c, active: c.id === id }))
    } finally {
      working.value = false
    }
  }

  async function remove(id: number): Promise<void> {
    working.value = true
    try {
      await api.del(`/credentials/${id}`)
      items.value = items.value.filter((c) => c.id !== id)
    } finally {
      working.value = false
    }
  }

  return { items, active, hasActive, loading, working, error, load, add, activate, remove }
}
