<script setup lang="ts">
import type { MenuAction } from '~/components/ui/Menu.vue'
import { ApiError, toApiError } from '~/composables/useApi'
import type { Credential } from '~/composables/useCredentials'

/**
 * Bring your own key. The secret is only ever sent up — the list shows the last four characters, never the whole thing.
 */
const credentials = useCredentials()
const toast = useToast()

/**
 * OpenRouter is first because it is the route lessons are actually written
 * through — a key is only ever used by the provider it was stored for, so a
 * DeepSeek key saved today sits idle until that route is switched back on.
 */
const PROVIDERS = [
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'deepseek', label: 'DeepSeek' },
] as const

const DEFAULT_PROVIDER = 'openrouter'

const adding = ref(false)
const provider = ref<string>(DEFAULT_PROVIDER)
const key = ref('')
const label = ref('')

const addError = ref<string | null>(null)
const fieldError = ref<string | null>(null)

onMounted(() => {
  if (credentials.items.value.length === 0) void credentials.load()
})

function providerLabel(value: string): string {
  return PROVIDERS.find((p) => p.value === value)?.label ?? value
}

function reset(): void {
  key.value = ''
  label.value = ''
  provider.value = DEFAULT_PROVIDER
  addError.value = null
  fieldError.value = null
  adding.value = false
}

async function submit(): Promise<void> {
  if (credentials.working.value) return
  addError.value = null
  fieldError.value = null

  if (key.value.trim().length < 8) {
    fieldError.value = 'That key looks too short.'
    return
  }

  try {
    await credentials.add({
      provider: provider.value,
      key: key.value.trim(),
      label: label.value.trim() || undefined,
    })
    toast.success('Key added. On Pro, new lessons use it.')
    reset()
  } catch (raw) {
    const error = raw instanceof ApiError ? raw : toApiError(raw)
    fieldError.value = error.first('key') ?? null
    if (!fieldError.value) addError.value = error.message
  }
}

async function activate(item: Credential): Promise<void> {
  try {
    await credentials.activate(item.id)
    toast.success('That key is now the one in use.')
  } catch {
    toast.error('Could not switch to that key.')
  }
}

async function remove(item: Credential): Promise<void> {
  try {
    await credentials.remove(item.id)
    toast.info('Key removed.')
  } catch {
    toast.error('Could not remove that key.')
  }
}

function menuFor(item: Credential): MenuAction[] {
  return [
    {
      label: 'Remove key',
      icon: 'trash',
      destructive: true,
      run: () => remove(item),
    },
  ]
}
</script>

<template>
  <section>
    <header class="mb-5">
      <h2 class="text-[16px] font-semibold tracking-[-0.015em] text-text">API keys</h2>
      <p class="mt-1 max-w-[60ch] text-[13px] leading-relaxed text-text-muted">
        Lessons and answers are written with your own key. It stays on this computer, in BiliMind's settings file.
      </p>
    </header>

    <div
      v-if="credentials.loading.value && credentials.items.value.length === 0"
      class="flex flex-col gap-2.5"
    >
      <UiSkeleton
        v-for="n in 2"
        :key="n"
        class="h-16 w-full rounded-xl"
      />
    </div>

    <template v-else>
      <ul
        v-if="credentials.items.value.length"
        class="flex flex-col gap-2.5"
      >
        <li
          v-for="item in credentials.items.value"
          :key="item.id"
          class="flex items-center gap-3.5 rounded-[20px] bg-surface shadow-[inset_0_0_0_1px_var(--border),0_24px_48px_-36px_rgb(11_13_16/0.3)] p-3.5"
        >
          <span
            class="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand"
          >
            <UiIcon
              name="key"
              :size="17"
            />
          </span>

          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <p class="truncate text-[13.5px] font-medium text-text">
                {{ item.label || providerLabel(item.provider) }}
              </p>
              <UiBadge
                v-if="item.active"
                tone="success"
                dot
              >
                In use
              </UiBadge>
            </div>
            <p class="mt-0.5 text-[12.5px] text-text-muted">
              {{ providerLabel(item.provider) }}
              <span class="text-text-faint">· ends in</span>
              <span class="code-chip ml-1">{{ item.last_four }}</span>
            </p>
          </div>

          <UiBtn
            v-if="!item.active"
            variant="secondary"
            size="sm"
            :loading="credentials.working.value"
            @click="activate(item)"
          >
            Use this key
          </UiBtn>

          <UiMenu
            :actions="menuFor(item)"
            title="Key options"
          />
        </li>
      </ul>

      <UiEmptyState
        v-else
        icon="key"
        title="No key yet"
        description="Add a key to write lessons without touching the free cap."
        size="inline"
      />
    </template>

    <!-- Add a key -->
    <div class="mt-4">
      <UiBtn
        v-if="!adding"
        variant="secondary"
        icon="plus"
        @click="adding = true"
      >
        Add a key
      </UiBtn>

      <form
        v-else
        class="rounded-[20px] bg-surface shadow-[inset_0_0_0_1px_var(--border),0_24px_48px_-36px_rgb(11_13_16/0.3)] p-4 sm:p-5"
        novalidate
        @submit.prevent="submit"
      >
        <p
          v-if="addError"
          class="mb-3 flex items-start gap-2 rounded-[12px] border border-danger-line bg-danger-soft px-3 py-2 text-[12.5px] text-danger-text"
          role="alert"
        >
          <UiIcon
            name="alert"
            :size="14"
            class="mt-px shrink-0"
          />
          {{ addError }}
        </p>

        <div class="flex flex-col gap-3.5">
          <div class="flex w-full flex-col gap-1.5">
            <label
              for="cred-provider"
              class="text-[12.5px] font-medium text-text-muted"
            >
              Provider
            </label>
            <div
              class="relative flex items-center rounded-[14px] border border-border-field bg-surface-mute"
            >
              <select
                id="cred-provider"
                v-model="provider"
                class="h-9.5 w-full cursor-pointer appearance-none bg-transparent pr-9 pl-3 text-[13.5px] outline-none"
              >
                <option
                  v-for="p in PROVIDERS"
                  :key="p.value"
                  :value="p.value"
                >
                  {{ p.label }}
                </option>
              </select>
              <UiIcon
                name="chevron-down"
                :size="15"
                class="pointer-events-none absolute right-3 text-text-faint"
              />
            </div>
            <p class="text-[12px] leading-relaxed text-text-faint">
              Lessons are written through OpenRouter.
            </p>
          </div>

          <UiTextField
            v-model="key"
            label="Secret key"
            type="password"
            placeholder="Paste your key"
            autocomplete="off"
            icon="lock"
            :error="fieldError"
          />

          <UiTextField
            v-model="label"
            label="Label"
            placeholder="Optional — e.g. Personal key"
            hint="Just so you can tell your keys apart."
          />
        </div>

        <div class="mt-4 flex items-center gap-2">
          <UiBtn
            type="submit"
            variant="primary"
            :loading="credentials.working.value"
          >
            Save key
          </UiBtn>
          <UiBtn
            variant="ghost"
            @click="reset"
          >
            Cancel
          </UiBtn>
        </div>
      </form>
    </div>
  </section>
</template>
