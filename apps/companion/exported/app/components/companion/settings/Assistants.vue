<script setup lang="ts">
/**
 * Settings → "Use BiliMind in ChatGPT or Claude". BiliMind is an
 * MCP server at the API's origin (`/mcp`, backend routes/ai.php); a learner
 * pastes that address into ChatGPT or Claude, signs in with BiliMind there, and
 * can then ask about their deadlines, plan and notes and save notes, tasks and
 * deadlines back. Their subscription runs the model, so it costs them no credits.
 *
 * The address is the same for everyone and holds no secret: access is granted
 * on the consent page, per learner. So it is shown, not made on a press.
 *
 * Below the how-to, the assistants this learner has connected (Passport clients
 * holding live tokens for them, by the name they registered under), each with
 * Disconnect: their access and refresh tokens on that client are revoked, so the
 * assistant can't read or add anything until they connect again. Nothing to
 * confirm: connecting again is the undo. Backend: Mcp\AssistantsController.
 *
 * The body of the ChatGPT and Claude sheets in Settings → Integrations.
 */
import { useApi } from '~/composables/useApi'

const toast = useToast()
const api = useApi()
const { t } = useI18n()

/**
 * `https://api.bilimind.com/api` → `https://api.bilimind.com/mcp`. Read on the
 * device: on the server the API base is the renderer's internal address.
 */
const url = ref('')

interface Connected { id: string, name: string, connected_at: string | null }
const connected = ref<Connected[]>([])
const leaving = ref<string | null>(null)

onMounted(async () => {
  try {
    url.value = `${new URL(api.base, window.location.origin).origin}/mcp`
  } catch {
    url.value = ''
  }
  try {
    connected.value = await api.get<Connected[]>('/companion/mcp/connections')
  } catch {
    // Offline or signed out: the list just isn't shown; connecting still works.
  }
})

/** "7 Nov", in the learner's own locale. */
function since(iso: string | null): string {
  return iso ? fmtDate(iso, { day: 'numeric', month: 'short' }) : ''
}

async function disconnect(item: Connected): Promise<void> {
  if (leaving.value) return
  leaving.value = item.id
  try {
    await api.del(`/companion/mcp/connections/${item.id}`)
    connected.value = connected.value.filter((row) => row.id !== item.id)
    toast.success(t('settings.assistants.disconnected', { name: item.name }))
  } catch {
    toast.error(t('settings.assistants.errDisconnect', { name: item.name }))
  } finally {
    leaving.value = null
  }
}

function selectAll(event: FocusEvent): void {
  (event.target as HTMLInputElement).select()
}

async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(url.value)
    toast.success(t('settings.assistants.copied'))
  } catch {
    toast.error(t('settings.assistants.errCopy'))
  }
}
</script>

<template>
  <!-- The ChatGPT and Claude sheet in Settings → Integrations, where every
       "out of AI" line links (usage.ts MORE_AI.apps). -->
  <div class="grid gap-3">
    <p class="text-[14px] leading-relaxed text-text-muted">
      {{ t('settings.assistants.intro') }}
    </p>

    <div
      v-if="url"
      class="flex min-w-0 items-center gap-2"
    >
      <input
        :value="url"
        readonly
        :aria-label="t('settings.assistants.addressAria')"
        class="h-9 min-w-0 flex-1 truncate rounded-[10px] bg-surface-sunken px-3 text-[13.5px] text-text-soft outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--brand)]"
        @focus="selectAll"
      >
      <UiBtn
        variant="secondary"
        size="md"
        icon="link"
        @click="copy"
      >
        {{ t('settings.assistants.copyLink') }}
      </UiBtn>
    </div>

    <ul class="grid gap-1 text-[13.5px] leading-relaxed text-text-muted">
      <li>
        <span class="font-semibold text-text-soft">ChatGPT:</span>
        {{ t('settings.assistants.chatgpt') }}
      </li>
      <li>
        <span class="font-semibold text-text-soft">Claude:</span>
        {{ t('settings.assistants.claude') }}
      </li>
    </ul>

    <ul
      v-if="connected.length"
      class="grid gap-1 text-[14px]"
      :aria-label="t('settings.assistants.connectedAria')"
    >
      <li
        v-for="item in connected"
        :key="item.id"
        class="flex min-w-0 items-center justify-between gap-3"
      >
        <span class="min-w-0 truncate">
          <span class="font-semibold">{{ item.name }}</span>
          <span
            v-if="item.connected_at"
            class="text-text-muted"
          > · {{ t('settings.assistants.connectedOn', { date: since(item.connected_at) }) }}</span>
        </span>
        <button
          type="button"
          class="shrink-0 cursor-pointer text-[13.5px] font-semibold text-danger-text hover:underline disabled:cursor-wait"
          :disabled="leaving === item.id"
          @click="disconnect(item)"
        >
          {{ t('settings.assistants.disconnect') }}
        </button>
      </li>
    </ul>
  </div>
</template>
