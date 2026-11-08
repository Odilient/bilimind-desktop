<script lang="ts">
/** Shared by every mounted bell — see the note above `notifications`. */
let bells = 0
let poll: ReturnType<typeof setInterval> | undefined
</script>

<script setup lang="ts">
import type { Notification } from '~/types/api'

const { t } = useI18n()

/**
 * The activity bell and its panel. Lives in the rail on desktop and in the top
 * bar on mobile, so it owns its own polling rather than having each layout
 * repeat it.
 *
 * Polling, not a stream: the daily digest lands once a day. A socket for this
 * would be a socket held open for months to deliver one message.
 */
withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })

/* Two roots — the bell and its modal — so a `class` from the parent has to be
   aimed at the bell by hand rather than falling through. */
defineOptions({ inheritAttrs: false })

const api = useApi()

/*
 * One list and one poll, however many bells are mounted. The rail, the phone
 * top bar and Today's header each render one, and each used to fetch on its
 * own — three identical requests on every page, and three more every 45s.
 * The first bell to mount starts the poll; the last to leave stops it.
 */
const notifications = useState<Notification[]>('activity:notifications', () => [])
const loaded = useState<boolean>('activity:loaded', () => false)
const open = ref(false)

const unread = computed(() => notifications.value.filter((n) => !n.read_at))

async function load(): Promise<void> {
  try {
    notifications.value = await api.get<Notification[]>('/notifications')
    loaded.value = true
  } catch {
    // The API may not be up yet; the bell simply stays quiet.
  }
}

async function markRead(notification: Notification): Promise<void> {
  if (notification.read_at) return
  notification.read_at = new Date().toISOString() // optimistic
  try {
    await api.post(`/notifications/${notification.id}/read`)
  } catch {
    notification.read_at = null
  }
}

async function markAllRead(): Promise<void> {
  await Promise.all(unread.value.slice(0, 50).map(markRead))
}

onMounted(() => {
  bells += 1
  if (bells > 1) return
  void load()
  poll = setInterval(() => void load(), 45_000)
})

onBeforeUnmount(() => {
  bells -= 1
  if (bells > 0 || !poll) return
  clearInterval(poll)
  poll = undefined
})

const relative = fmtRelative
</script>

<template>
  <button
    type="button"
    v-bind="$attrs"
    :class="[
      'relative grid cursor-pointer place-items-center text-text-faint transition-colors hover:bg-[rgb(var(--wash-rgb)/0.065)] hover:text-text',
      compact ? 'size-9 rounded-[10px]' : 'size-[38px] rounded-[12px]',
      ($attrs.class as string) ?? '',
    ]"
    :aria-label="t('shell.activity')"
    @click="open = true"
  >
    <UiIcon
      name="bell"
      :size="compact ? 16 : 18"
      :stroke="1.9"
    />
    <span
      v-if="unread.length"
      :class="[
        'absolute size-2 rounded-full bg-rose ring-2 ring-bg',
        compact ? 'top-1.5 right-1.5' : 'top-2 right-2',
      ]"
    />
  </button>

  <UiModal
    v-model:open="open"
    :title="t('shell.activity')"
    :description="t('shell.activityHint')"
    size="md"
  >
    <div
      v-if="!loaded"
      class="flex flex-col gap-3 py-2"
    >
      <UiSkeleton
        v-for="i in 3"
        :key="i"
        h="2.5rem"
        rounded="md"
      />
    </div>

    <UiEmptyState
      v-else-if="notifications.length === 0"
      icon="inbox"
      size="inline"
      :title="t('shell.nothingYet')"
      :description="t('shell.nothingYetHint')"
    />

    <ul
      v-else
      class="om-scroll -mx-1 flex max-h-[52vh] flex-col gap-0.5 overflow-y-auto"
    >
      <li
        v-for="notification in notifications"
        :key="notification.id"
      >
        <button
          type="button"
          class="flex w-full cursor-pointer items-start gap-3 rounded-[12px] px-2.5 py-2.5 text-left transition-colors hover:bg-surface-mute"
          @click="markRead(notification)"
        >
          <span
            :class="[
              'mt-1.5 size-1.5 shrink-0 rounded-full',
              notification.read_at ? 'bg-border-dashed' : 'bg-brand',
            ]"
          />
          <span class="min-w-0 flex-1">
            <span class="flex items-baseline justify-between gap-3">
              <span
                :class="[
                  'truncate text-[13.5px] font-medium',
                  notification.read_at ? 'text-text-muted' : 'text-text',
                ]"
                >{{ notification.title }}</span
              >
              <span class="num shrink-0 text-[11px] text-text-ghost">{{
                relative(notification.created_at)
              }}</span>
            </span>
            <span
              v-if="notification.body"
              class="mt-0.5 block text-[12.5px] leading-relaxed text-text-muted"
              >{{ notification.body }}</span
            >
          </span>
        </button>
      </li>
    </ul>

    <template
      v-if="unread.length"
      #footer
    >
      <UiBtn
        variant="ghost"
        size="sm"
        @click="markAllRead"
        >{{ t('shell.markAllRead') }}</UiBtn
      >
      <UiBtn
        variant="secondary"
        size="sm"
        @click="open = false"
        >{{ t('common.close') }}</UiBtn
      >
    </template>
  </UiModal>
</template>
