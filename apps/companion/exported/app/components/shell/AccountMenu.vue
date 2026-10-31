<script setup lang="ts">
/**
 * Who you are, the theme, and the way back out.
 *
 * The rail's avatar was a decorative div with two hardcoded letters, so nothing
 * in the product pointed at settings or sign-out — `/account` could only be
 * reached by typing it. This is that entrance: the same two destinations in a
 * popover on desktop and a bottom sheet on a phone, because a 224px popover
 * hung off a 30px avatar is not a thumb target.
 *
 * Under `/app` the same avatar opens the companion's settings page instead:
 * Quiet AI, connected apps, the time zone, and a sign-out that also wipes this
 * device's copy of your courses, which the old one does not know about. The
 * sample account has no session, so there it wears the sample's name.
 * The theme sits here as well as in Settings because it is the one setting
 * people change on a whim (the room got dark), and a whim does not survive a
 * trip to a settings page.
 */
import { useCompanion } from '~/companion/store'

const auth = useAuth()
const isPhone = useIsPhone()
const route = useRoute()

const onApp = (path: string) => path === '/app' || path.startsWith('/app/')
const inApp = computed(() => onApp(route.path))
// Asking for the companion's store loads it, so only its own screens ask. The
// layout changes on the way in or out of `/app`, which mounts a new avatar.
const c = onApp(route.path) ? useCompanion() : null

const props = withDefaults(defineProps<{ size?: 'sm' | 'md' }>(), { size: 'sm' })

const open = ref(false)
const signingOut = ref(false)
const root = ref<HTMLElement | null>(null)

const name = computed(() =>
  inApp.value && c?.status.mode === 'demo' ? c.userName.value : (auth.user.value?.name?.trim() ?? ''),
)
const email = computed(() => auth.user.value?.email ?? '')

/** Two letters at most: "Ada Lovelace" → AL, "ada@x.dev" → AD. */
const initials = computed(() => {
  const words = name.value.split(/\s+/).filter(Boolean)
  const source =
    words.length >= 2 ? `${words[0]![0]}${words[1]![0]}` : (words[0] ?? email.value).slice(0, 2)
  return source.toUpperCase() || '?'
})

// The phone bar's 34px avatar answers a 44px thumb: the ring of 5px around it
// is invisible and still the button.
const trigger = computed(() =>
  props.size === 'md'
    ? 'relative size-[34px] text-[12px] before:absolute before:-inset-[5px]'
    : 'size-[30px] text-[11px]',
)

function press(): void {
  if (inApp.value) void navigateTo('/app/settings')
  else open.value = !open.value
}

async function signOut(): Promise<void> {
  if (signingOut.value) return
  signingOut.value = true
  open.value = false
  try {
    await auth.logout()
  } finally {
    signingOut.value = false
  }
}

function onDocumentPointerDown(event: PointerEvent): void {
  if (!root.value?.contains(event.target as Node)) open.value = false
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') open.value = false
}

watch(open, (isOpen) => {
  if (!import.meta.client) return
  // Only the popover needs a dismiss layer. The sheet teleports out of `root`
  // and brings its own scrim, so this listener would close it on the way down
  // and swallow the tap that opened an item.
  const method = isOpen && !isPhone.value ? 'addEventListener' : 'removeEventListener'
  document[method]('pointerdown', onDocumentPointerDown as EventListener)
  document[method]('keydown', onKeydown as EventListener)
})

onBeforeUnmount(() => {
  if (!import.meta.client) return
  document.removeEventListener('pointerdown', onDocumentPointerDown as EventListener)
  document.removeEventListener('keydown', onKeydown as EventListener)
})

/* The sheet teleports to `body`, so which of the two shows cannot be a
   responsive class on this element. Safe here: both are closed at hydration. */
const sheetOpen = computed({
  get: () => open.value && isPhone.value,
  set: (value) => {
    open.value = value
  },
})
</script>

<template>
  <div
    ref="root"
    class="relative shrink-0"
  >
    <button
      type="button"
      :aria-label="inApp ? `Settings · ${name || 'You'}` : name ? `Account · ${name}` : 'Your account'"
      :aria-expanded="inApp ? undefined : open"
      :aria-haspopup="inApp ? 'dialog' : 'menu'"
      :class="[
        'grid cursor-pointer place-items-center rounded-full bg-brand-soft font-display font-semibold text-brand transition-shadow',
        open ? 'ring-2 ring-brand-line' : 'hover:ring-2 hover:ring-brand-line',
        trigger,
      ]"
      @click="press()"
    >
      {{ initials }}
    </button>

    <!-- Desktop popover. Opens upward: the avatar lives at the foot of the rail. -->
    <Transition
      enter-active-class="duration-120 ease-out"
      enter-from-class="opacity-0 scale-95"
      leave-active-class="duration-100 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open && !isPhone"
        role="menu"
        class="absolute bottom-full left-0 z-50 mb-2 w-[232px] origin-bottom-left rounded-[18px] bg-surface p-1.5 shadow-pop ring-1 ring-border"
      >
        <div class="px-2.5 pt-2 pb-2.5">
          <p class="truncate font-display text-[14px] font-semibold tracking-[-0.01em] text-text">
            {{ name || 'Signed in' }}
          </p>
          <p
            v-if="email"
            class="truncate text-[12px] text-text-muted"
          >
            {{ email }}
          </p>
        </div>

        <div class="mb-1 border-t border-border-rule" />

        <div class="flex items-center justify-between gap-2 py-1 pr-1 pl-2.5">
          <span class="text-[13px] font-medium text-text-dim">Theme</span>
          <ShellThemeSwitch compact />
        </div>

        <NuxtLink
          to="/app/settings"
          role="menuitem"
          class="flex w-full items-center gap-2.5 rounded-[12px] px-2.5 py-2 text-left text-[13px] font-medium text-text-dim transition-colors hover:bg-surface-mute"
          @click="open = false"
        >
          <UiIcon
            name="settings"
            :size="15"
            class="shrink-0"
          />
          Settings
        </NuxtLink>

        <button
          type="button"
          role="menuitem"
          class="flex w-full cursor-pointer items-center gap-2.5 rounded-[12px] px-2.5 py-2 text-left text-[13px] font-medium text-text-dim transition-colors hover:bg-surface-mute"
          @click="signOut()"
        >
          <UiIcon
            name="logout"
            :size="15"
            class="shrink-0"
          />
          Sign out
        </button>
      </div>
    </Transition>

    <!-- Phone sheet -->
    <UiSheet
      v-model:open="sheetOpen"
      :title="name || 'Your account'"
      :description="email || undefined"
    >
      <div class="mt-4 flex flex-col gap-1">
        <div class="flex items-center justify-between gap-3 px-3.5 py-2.5">
          <span class="text-[15px] text-text-dim">Theme</span>
          <ShellThemeSwitch />
        </div>

        <NuxtLink
          to="/app/settings"
          class="flex w-full items-center gap-3 rounded-xl px-3.5 py-3.5 text-left text-[15px] text-text-dim transition-colors active:bg-surface-sunken"
          @click="open = false"
        >
          <UiIcon
            name="settings"
            :size="19"
            class="shrink-0 text-text-faint"
          />
          Settings
        </NuxtLink>

        <button
          type="button"
          class="flex w-full items-center gap-3 rounded-xl px-3.5 py-3.5 text-left text-[15px] text-text-dim transition-colors active:bg-surface-sunken"
          @click="signOut()"
        >
          <UiIcon
            name="logout"
            :size="19"
            class="shrink-0 text-text-faint"
          />
          Sign out
        </button>
      </div>
    </UiSheet>
  </div>
</template>
