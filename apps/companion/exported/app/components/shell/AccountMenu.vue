<script setup lang="ts">
const { t } = useI18n()
/**
 * Who you are, the theme, and the way back out.
 *
 * The rail's avatar was a decorative div with two hardcoded letters, so nothing
 * in the product pointed at settings or sign-out — `/account` could only be
 * reached by typing it. This is that entrance: the same two destinations in a
 * popover on desktop and a bottom sheet on a phone, because a 224px popover
 * hung off a 30px avatar is not a thumb target.
 *
 * Under `/app` the menu is also the one place to switch modes, like Slack's
 * workspaces under your name: your own study and each institution you belong
 * to (InstitutionModeMenu), shown to anyone in an institution and on the
 * institution's own pages. The study sidebar and the institution's column pass
 * their name row as the `trigger` slot; everywhere else it is the avatar. The
 * popover is teleported and placed from the trigger, because the study
 * sidebar's column clips (the 58px rail) and the trigger sits at the foot of a
 * column or the top of a page. The theme sits here as well as in Settings because it is the one setting
 * people change on a whim (the room got dark), and a whim does not survive a
 * trip to a settings page.
 */
import { useOrg } from '~/institution/org'
import { useSidebar } from '~/companion/sidebar'

const auth = useAuth()
const isPhone = useIsPhone()
const route = useRoute()
const orgs = useOrg()

const onApp = (path: string) => path === '/app' || path.startsWith('/app/')
const inApp = computed(() => onApp(route.path))

const props = withDefaults(defineProps<{ size?: 'sm' | 'md' }>(), { size: 'sm' })

const open = ref(false)
const signingOut = ref(false)
const root = ref<HTMLElement | null>(null)
const pop = ref<HTMLElement | null>(null)

/** The modes show to anyone in an institution, and on its own pages (Start a centre has none yet). */
const modes = computed(() => inApp.value && (Boolean(orgs.orgs.value?.length)))
onMounted(() => {
  if (inApp.value && auth.user.value && !orgs.orgs.value) {
    orgs.list().catch(() => {
      orgs.orgs.value = []
    })
  }
})

/** A pick leaves the page: the menu and the phone's drawer it may sit in both go. */
function done(): void {
  open.value = false
  useSidebar().close()
}

/** Beside the trigger: upward from the foot of a column, downward from the top of a page, kept on screen. */
const pos = ref<Record<string, string>>({})
function place(): void {
  const r = root.value?.getBoundingClientRect()
  if (!r) return
  const up = r.top > window.innerHeight / 2
  const right = r.left + 264 > window.innerWidth
  pos.value = {
    [up ? 'bottom' : 'top']: `${up ? window.innerHeight - r.top + 8 : r.bottom + 8}px`,
    [right ? 'right' : 'left']: `${right ? window.innerWidth - r.right : r.left}px`,
  }
}

const name = computed(() => auth.user.value?.name?.trim() ?? '')
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
  if (!open.value) place()
  open.value = !open.value
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
  const target = event.target as Node
  if (!root.value?.contains(target) && !pop.value?.contains(target)) open.value = false
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
    :class="['relative', !$slots.trigger && 'shrink-0']"
  >
    <slot
      name="trigger"
      :press="press"
      :open="open"
    />
    <button
      v-if="!$slots.trigger"
      type="button"
      :aria-label="name ? t('shell.account', { name }) : t('shell.yourAccount')"
      :aria-expanded="open"
      aria-haspopup="menu"
      :class="[
        // The same face as the sidebar's you row: apricot, Daylight 2's avatar wash.
        'grid cursor-pointer place-items-center rounded-full bg-apricot-soft font-display font-semibold text-apricot-ink transition-shadow',
        open ? 'ring-2 ring-[var(--border-strong)]' : 'hover:ring-2 hover:ring-[var(--border-strong)]',
        trigger,
      ]"
      @click="press()"
    >
      {{ initials }}
    </button>

    <!-- Desktop popover, on the body and placed from the trigger (see `place`). -->
    <Teleport to="body">
      <Transition
        enter-active-class="duration-120 ease-out"
        enter-from-class="opacity-0 scale-95"
        leave-active-class="duration-100 ease-in"
        leave-to-class="opacity-0"
      >
        <div
          v-if="open && !isPhone"
          ref="pop"
          role="menu"
          class="fixed z-[70] w-[256px] rounded-[12px] bg-surface p-1.5 shadow-pop"
          :style="pos"
        >
          <div class="px-2.5 pt-2 pb-2.5">
            <p class="truncate font-display text-[14px] font-semibold tracking-[-0.01em] text-text">
              {{ name || t('shell.signedIn') }}
            </p>
            <p
              v-if="email"
              class="truncate text-[12px] text-text-muted"
            >
              {{ email }}
            </p>
          </div>

          <template v-if="modes">
            <div class="mb-1 border-t border-border-rule" />
            <InstitutionModeMenu @pick="done()" />
          </template>

          <div class="my-1 border-t border-border-rule" />

          <div class="flex items-center justify-between gap-2 py-1 pr-1 pl-2.5">
            <span class="text-[13px] font-medium text-text-dim">{{ t('shell.theme') }}</span>
            <ShellThemeSwitch compact />
          </div>

          <NuxtLink
            to="/app/settings"
            role="menuitem"
            class="flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left text-[13px] font-medium text-text-dim transition-colors hover:bg-[rgb(var(--wash-rgb)/0.065)]"
            @click="done()"
          >
            <UiIcon
              name="settings"
              :size="15"
              class="shrink-0"
            />
            {{ t('shell.settings') }}
          </NuxtLink>

          <button
            type="button"
            role="menuitem"
            class="flex w-full cursor-pointer items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left text-[13px] font-medium text-text-dim transition-colors hover:bg-[rgb(var(--wash-rgb)/0.065)]"
            @click="signOut()"
          >
            <UiIcon
              name="logout"
              :size="15"
              class="shrink-0"
            />
            {{ t('shell.signOut') }}
          </button>
        </div>
      </Transition>
    </Teleport>

    <!-- Phone sheet -->
    <UiSheet
      v-model:open="sheetOpen"
      :title="name || t('shell.yourAccount')"
      :description="email || undefined"
    >
      <div class="mt-4 flex flex-col gap-1">
        <template v-if="modes">
          <InstitutionModeMenu
            touch
            @pick="done()"
          />
          <div class="my-1 border-t border-border-rule" />
        </template>
        <div class="flex items-center justify-between gap-3 px-3.5 py-2.5">
          <span class="text-[15px] text-text-dim">{{ t('shell.theme') }}</span>
          <ShellThemeSwitch />
        </div>

        <NuxtLink
          to="/app/settings"
          class="flex w-full items-center gap-3 rounded-xl px-3.5 py-3.5 text-left text-[15px] text-text-dim transition-colors active:bg-surface-sunken"
          @click="done()"
        >
          <UiIcon
            name="settings"
            :size="19"
            class="shrink-0 text-text-faint"
          />
          {{ t('shell.settings') }}
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
          {{ t('shell.signOut') }}
        </button>
      </div>
    </UiSheet>
  </div>
</template>
