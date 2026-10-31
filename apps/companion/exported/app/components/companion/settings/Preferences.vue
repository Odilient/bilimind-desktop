<script setup lang="ts">
/**
 * The switches a learner reaches for mid-semester. Quiet AI first, because it is
 * the one people look for (see app/companion/quiet-ai.ts).
 *
 * The switches after Quiet AI follow the account, not the device
 * (`users.preferences.companion`, the design notes):
 *  - "Make me try first" in every course. It can only make the assistant
 *    stricter: there is deliberately no switch that loosens graded work.
 *  - "Share my results with my class", on unless turned off: anonymous
 *    counts that make the class numbers on a deadline possible.
 * A switch moves at once and goes back, with a toast, if the save fails.
 * The sample has no account, so there they are kept in the tab and say
 * nothing.
 */
import { useCompanion } from '~/companion/store'
import { useQuietAi } from '~/companion/quiet-ai'
import { currentZone } from '~/companion/time'

const c = useCompanion()
const { quiet, toggle } = useQuietAi()
const auth = useAuth()
const toast = useToast()

type CompanionPrefs = NonNullable<NonNullable<AuthUser['preferences']>['companion']>
type PrefKey = keyof CompanionPrefs

const local = reactive<CompanionPrefs>({})
const prefs = computed<CompanionPrefs>(() =>
  c.status.mode === 'demo' ? local : auth.user.value?.preferences?.companion ?? {},
)
const saving = reactive<Partial<Record<PrefKey, boolean>>>({})

async function setPref(key: PrefKey, on: boolean): Promise<void> {
  if (c.status.mode === 'demo') {
    local[key] = on
    return
  }
  const user = auth.user.value
  if (!user || saving[key]) return
  const before = user.preferences ?? null
  auth.user.value = { ...user, preferences: { ...before, companion: { ...before?.companion, [key]: on } } }
  saving[key] = true
  try {
    // The server merges `companion` key by key: send only this one.
    await auth.updateProfile({ preferences: { companion: { [key]: on } } })
  } catch {
    if (auth.user.value) auth.user.value = { ...auth.user.value, preferences: before }
    toast.error('That setting didn\'t save. Try again.')
  } finally {
    saving[key] = false
  }
}

const switches = computed(() => [
  {
    id: 'cp-quiet-label',
    label: 'Quiet AI',
    sub: 'No AI buttons in your pages and boards. Your notes stay exactly as you write them. Cards and the plan keep working.',
    on: quiet.value,
    flip: toggle,
  },
  {
    id: 'cp-try-first-label',
    label: 'Make me try first',
    sub: 'The assistant asks for your attempt before it answers, in every course. Graded work always works this way.',
    on: prefs.value.try_first === true,
    flip: () => setPref('try_first', prefs.value.try_first !== true),
  },
  {
    id: 'cp-share-label',
    label: 'Share my results with my class',
    sub: 'Anonymous: counts only, never your name or answers. Class numbers show once 5 classmates are here.',
    on: prefs.value.share_results !== false,
    flip: () => setPref('share_results', prefs.value.share_results === false),
  },
])

/** Mac shows ⌘ and ⌥; everything else names the keys. */
const mac = ref(false)
const zone = ref('')
onMounted(() => {
  mac.value = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
  zone.value = currentZone().replace(/_/g, ' ')
})
const shortcuts = computed(() => [
  { keys: mac.value ? '⌥Space' : 'Alt Space', what: 'New chat' },
  { keys: mac.value ? '⌘K' : 'Ctrl K', what: 'Search, or ask BiliMind' },
  { keys: mac.value ? '⌘J' : 'Ctrl J', what: 'Open or close the assistant' },
  { keys: '[', what: 'Collapse or expand the sidebar' },
  { keys: 'g t · g c · g n', what: 'Today, Courses, Notes' },
  { keys: 'g k · g a', what: 'Calendar, the chat' },
])
</script>

<template>
  <ul class="divide-y divide-border-rule border-y border-border-rule">
    <li
      v-for="row in switches"
      :key="row.id"
      class="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 py-3.5"
    >
      <div class="grid gap-1">
        <p
          :id="row.id"
          class="text-[16px] font-semibold"
        >
          {{ row.label }}
        </p>
        <p class="text-[14px] leading-relaxed text-text-muted">
          {{ row.sub }}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        :aria-checked="row.on"
        :aria-labelledby="row.id"
        class="relative mt-0.5 h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
        :class="row.on ? 'bg-ink dark:bg-brand-strong' : 'bg-cream-4 dark:bg-surface-track'"
        @click="row.flip"
      >
        <span
          class="absolute top-1 left-1 size-5 rounded-full bg-white shadow-[0_1px_3px_rgb(11_13_16/0.25)] transition-transform motion-reduce:transition-none"
          :class="row.on ? 'translate-x-5' : ''"
        />
      </button>
    </li>
    <!-- Here, not under Account: it lives in a cookie on this device (see `useTheme`),
         so the sample, which has no account, can change it too. -->
    <li class="grid gap-3 py-3.5">
      <div class="grid gap-1">
        <p class="text-[16px] font-semibold">
          Theme
        </p>
        <p class="text-[14px] leading-relaxed text-text-muted">
          System follows your device. The choice is saved on this device only.
        </p>
      </div>
      <ShellThemeSwitch class="justify-self-start" />
    </li>
    <li>
      <NuxtLink
        to="/app/connect"
        class="group -mx-2 flex items-center justify-between gap-3 rounded-[12px] px-2 py-3.5 transition-colors hover:bg-surface-mute"
      >
        <span class="grid gap-0.5">
          <span class="text-[16px] font-semibold">Connected apps</span>
          <span class="text-[14px] text-text-muted">An exam timetable PDF</span>
        </span>
        <CompanionIcon
          name="chevron-right"
          :size="18"
          class="text-text-faint transition-colors group-hover:text-text-soft"
        />
      </NuxtLink>
    </li>
    <li class="flex items-center justify-between gap-3 py-3.5 text-[15px]">
      <span class="text-text-soft">Times are shown in</span>
      <span class="font-semibold">{{ zone }}</span>
    </li>
    <li class="grid gap-2 py-3.5 max-[899px]:hidden">
      <p class="text-[15px] font-semibold">
        Keyboard
      </p>
      <dl class="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-1.5 text-[13.5px]">
        <template
          v-for="k in shortcuts"
          :key="k.keys"
        >
          <dt>
            <kbd class="rounded-[6px] border border-border-field px-1.5 py-0.5 text-[12px] text-text-soft">{{ k.keys }}</kbd>
          </dt>
          <dd class="text-text-muted">
            {{ k.what }}
          </dd>
        </template>
      </dl>
    </li>
  </ul>
</template>
