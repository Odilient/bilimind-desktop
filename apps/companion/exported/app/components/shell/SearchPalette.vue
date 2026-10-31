<script setup lang="ts">
import type { SearchHit } from '~/types/api'

/**
 * The one search surface: ⌘K from anywhere, mounted once by `app.vue`.
 *
 * It does not use `UiModal`, and that is deliberate. A dialog is centred and
 * grows around its content, so every arriving result would nudge the whole
 * panel upward — the rows would move under the pointer at the exact moment
 * somebody is aiming at one. A palette is pinned near the top instead, and its
 * list scrolls inside a fixed box. On a phone it pins to the very top for a
 * second reason: the on-screen keyboard covers the bottom half of the screen,
 * which is precisely where a bottom sheet would put the results.
 *
 * The combobox pattern rather than roving focus: the caret never leaves the
 * field, the list is a `listbox`, and the current row is named by
 * `aria-activedescendant`. Typing and choosing are one gesture here, and moving
 * real focus into the list would mean every arrow key had to hand it back
 * before the next letter could be typed.
 */
const {
  open,
  query,
  within,
  offered,
  activeIndex,
  recent,
  groups,
  flat,
  state,
  stale,
  degraded,
  failure,
  setQuery,
  widen,
  narrow,
  retry,
  close,
  move,
  choose,
} = useSearch()

const input = useTemplateRef<HTMLInputElement>('input')
const list = useTemplateRef<HTMLElement>('list')

const uid = useId()
const optionId = (index: number): string => `${uid}-option-${index}`

/**
 * The groups, flattened enough for the template: every row already knows its
 * position in the keyboard list, so nothing has to add offsets inline. Groups
 * the server returned empty are dropped here rather than rendered as a heading
 * with nothing under it — they contribute no rows, so the indices still line up
 * with `flat`.
 */
const sections = computed(() => {
  let running = 0

  return groups.value
    .filter((group) => group.results.length > 0)
    .map((group) => ({
      key: group.key,
      label: group.label,
      hasMore: group.has_more,
      rows: group.results.map((hit) => ({ hit, index: running++ })),
    }))
})

const busy = computed(() => state.value === 'loading' || state.value === 'slow')

/**
 * Spoken once per settled answer. A result list that exists only visually is a
 * result list a screen reader user has no way of knowing arrived.
 */
const announcement = computed(() => {
  if (state.value === 'ready') return plural(flat.value.length, 'result')
  if (state.value === 'empty') return 'No results'
  if (state.value === 'failed') return 'Search failed'

  return ''
})

/**
 * Which input last moved the cursor.
 *
 * Only a keyboard move scrolls the list. A pointer move that scrolled would
 * feed back on itself: the row under a stationary pointer shifts, which fires
 * another `mousemove`, which selects the next row, and the list walks away on
 * its own.
 */
let pointerDriven = false

function hover(index: number): void {
  pointerDriven = true
  activeIndex.value = index
}

function onKeydown(event: KeyboardEvent): void {
  if (event.isComposing) return

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      pointerDriven = false
      move(1)
      break
    case 'ArrowUp':
      event.preventDefault()
      pointerDriven = false
      move(-1)
      break
    case 'Enter':
      event.preventDefault()
      choose(undefined, event.metaKey || event.ctrlKey)
      break
    case 'Escape':
      event.preventDefault()
      close()
      break
    case 'Tab':
      // Nothing inside is reachable by Tab — the list is driven by the arrows —
      // so Tab means "I am done here" rather than "move to the next control".
      event.preventDefault()
      close()
      break
    case 'Backspace':
      // Backspace in an empty box widens the search back out. Same gesture as
      // deleting a chip from a mail client's To: field.
      if (query.value === '' && within.value) {
        event.preventDefault()
        widen()
      }
      break
  }
}

/* -- Focus, scroll lock, keeping the cursor in view ------------------------ */

let restoreFocusTo: HTMLElement | null = null

watch(open, async (isOpen) => {
  if (!import.meta.client) return

  document.body.style.overflow = isOpen ? 'hidden' : ''

  if (isOpen) {
    restoreFocusTo = document.activeElement as HTMLElement | null
    await nextTick()
    input.value?.focus()
    return
  }

  // Back where they were. Not for the mouse — for the person who opened this
  // with ⌘K in the middle of a lesson and expects the page to still be theirs.
  restoreFocusTo?.focus?.()
  restoreFocusTo = null
})

watch(activeIndex, async () => {
  if (!import.meta.client || pointerDriven) return

  await nextTick()
  list.value?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
})

onBeforeUnmount(() => {
  if (import.meta.client) document.body.style.overflow = ''
})

function pick(hit: SearchHit, event: MouseEvent): void {
  choose(hit, event.metaKey || event.ctrlKey)
}
</script>

<template>
  <ClientOnly>
    <Teleport to="body">
      <Transition
        enter-active-class="duration-150 ease-out"
        enter-from-class="opacity-0"
        leave-active-class="duration-100 ease-in"
        leave-to-class="opacity-0"
      >
        <div
          v-if="open"
          class="fixed inset-0 z-100 flex items-start justify-center sm:px-6 sm:pt-[9vh]"
          role="presentation"
          @keydown="onKeydown"
        >
          <div
            class="fixed inset-0 bg-[rgb(6_9_30/0.55)] backdrop-blur-[6px]"
            @click="close()"
          />

          <div
            class="pop-in relative flex max-h-full w-full max-w-[640px] flex-col overflow-hidden rounded-b-[22px] bg-surface shadow-pop ring-1 ring-border sm:rounded-[24px]"
            role="dialog"
            aria-modal="true"
            aria-label="Search"
          >
            <!-- The field ------------------------------------------------- -->
            <div class="relative flex items-center gap-2 border-b border-border px-4 py-3">
              <UiIcon
                name="search"
                :size="17"
                class="shrink-0 text-text-faint"
              />

              <!-- The scope chip. Removable, because a search you cannot widen
                   is a trap, and "everything" is one backspace away. The × is
                   its own round target rather than a glyph tucked into the
                   label: a chip that is one flat button reads as a label, and
                   nobody tries to click a label away. -->
              <span
                v-if="within"
                class="flex max-w-[45%] shrink-0 items-center gap-1 rounded-full bg-brand-soft py-[3px] pr-[3px] pl-2.5 text-[12px] font-semibold text-brand"
              >
                <span class="truncate">
                  <span class="font-medium opacity-70">In</span>
                  {{ within.title }}
                </span>
                <button
                  type="button"
                  class="grid size-5 shrink-0 cursor-pointer place-items-center rounded-full transition-colors hover:bg-brand hover:text-white"
                  :title="`Search everywhere, not only in ${within.title}`"
                  aria-label="Search everywhere"
                  @click="widen(); input?.focus()"
                >
                  <UiIcon
                    name="x"
                    :size="11"
                    :stroke="2.4"
                  />
                </button>
              </span>

              <!-- Widened from inside a course: the way back is a ghost of the
                   chip that was removed, so the two states look like one switch. -->
              <button
                v-else-if="offered"
                type="button"
                class="flex max-w-[38%] shrink-0 cursor-pointer items-center gap-1 rounded-full py-[3px] pr-2.5 pl-2 text-[12px] font-medium text-text-faint shadow-[inset_0_0_0_1px_rgb(var(--wash-rgb)/0.16)] transition-colors hover:text-brand hover:shadow-[inset_0_0_0_1px_var(--brand)]"
                :title="`Search only in ${offered.title}`"
                @click="narrow(); input?.focus()"
              >
                <UiIcon
                  name="plus"
                  :size="11"
                  :stroke="2.4"
                />
                <span class="truncate">Only {{ offered.title }}</span>
              </button>

              <input
                ref="input"
                :value="query"
                type="text"
                class="min-w-0 flex-1 bg-transparent py-1 text-[15.5px] text-text outline-none placeholder:text-[#8e93a0] dark:placeholder:text-text-faint"
                :placeholder="within ? 'Search this course' : 'Search courses, lessons and files'"
                autocomplete="off"
                autocorrect="off"
                spellcheck="false"
                role="combobox"
                aria-expanded="true"
                :aria-label="within ? `Search in ${within.title}` : 'Search everything'"
                :aria-controls="`${uid}-list`"
                :aria-activedescendant="flat.length ? optionId(activeIndex) : undefined"
                @input="setQuery(($event.target as HTMLInputElement).value)"
              />

              <button
                v-if="query"
                type="button"
                class="grid size-6 shrink-0 place-items-center rounded-md text-text-faint hover:bg-surface-sunken hover:text-text-soft"
                aria-label="Clear search"
                @click="setQuery('')"
              >
                <UiIcon
                  name="x"
                  :size="14"
                  :stroke="2"
                />
              </button>

              <button
                type="button"
                class="grid size-7 shrink-0 place-items-center rounded-md text-text-faint hover:bg-surface-sunken hover:text-text-soft sm:hidden"
                aria-label="Close search"
                @click="close()"
              >
                <UiIcon
                  name="x"
                  :size="17"
                  :stroke="2"
                />
              </button>

              <!-- One hairline is the whole loading indication. A spinner in a
                   box that usually answers in 40ms is a flicker, not feedback. -->
              <span
                v-if="busy"
                class="absolute inset-x-0 -bottom-px h-[2px] animate-pulse-dot bg-brand"
              />
            </div>

            <p
              class="sr-only"
              aria-live="polite"
            >
              {{ announcement }}
            </p>

            <!--
              The results.

              No padding on the TOP of this box: a sticky group heading measures
              its offset from the scroll container's padding edge, so any would
              leave a sliver of the scrolled row showing above the heading.
            -->
            <div
              :id="`${uid}-list`"
              ref="list"
              role="listbox"
              aria-label="Search results"
              :class="[
                'min-h-0 max-h-[min(58vh,25rem)] flex-1 overflow-y-auto overscroll-contain px-1.5 pb-1.5 transition-opacity duration-150',
                stale && busy ? 'opacity-55' : 'opacity-100',
              ]"
            >
              <template v-if="sections.length">
                <div
                  v-for="section in sections"
                  :key="section.key"
                >
                  <p
                    class="sticky top-0 z-1 bg-surface px-2 pt-2.5 pb-1 text-[11px] font-semibold tracking-[0.08em] text-text-faint uppercase"
                  >
                    {{ section.label }}
                  </p>

                  <div
                    v-for="row in section.rows"
                    :id="optionId(row.index)"
                    :key="row.hit.id"
                    role="option"
                    :aria-selected="activeIndex === row.index"
                    class="cursor-pointer"
                    @click="pick(row.hit, $event)"
                    @mousemove="hover(row.index)"
                  >
                    <ShellSearchResultRow
                      :hit="row.hit"
                      :active="activeIndex === row.index"
                    />
                  </div>

                  <!-- Honest rather than clickable: the API paginates a single
                       group, but nothing has a screen for it yet. -->
                  <p
                    v-if="section.hasMore"
                    class="px-3 pt-0.5 pb-1.5 text-[11.5px] text-text-ghost"
                  >
                    More in {{ section.label.toLowerCase() }} — narrow the search to see them.
                  </p>
                </div>
              </template>

              <!-- Nothing typed yet -->
              <template v-else-if="state === 'idle'">
                <template v-if="recent.length">
                  <p
                    class="px-2 pt-2.5 pb-1 text-[11px] font-semibold tracking-[0.08em] text-text-faint uppercase"
                  >
                    Recent
                  </p>
                  <button
                    v-for="term in recent"
                    :key="term"
                    type="button"
                    class="flex w-full items-center gap-3 rounded-[12px] px-2.5 py-2 text-left hover:bg-surface-mute"
                    @click="setQuery(term)"
                  >
                    <UiIcon
                      name="clock"
                      :size="15"
                      class="text-text-faint"
                    />
                    <span class="min-w-0 flex-1 truncate text-[13.5px] text-text-soft">
                      {{ term }}
                    </span>
                  </button>
                </template>

                <p
                  v-else
                  class="px-3 py-6 text-center text-[13px] leading-relaxed text-text-muted"
                >
                  Search across every course, every lesson and every file you have added.
                </p>
              </template>

              <!-- Typed, but not yet enough to search for -->
              <p
                v-else-if="state === 'short'"
                class="px-3 py-6 text-center text-[13px] text-text-muted"
              >
                Keep typing — two letters is enough.
              </p>

              <!-- The first search of a session: nothing to keep on screen -->
              <div
                v-else-if="busy"
                class="space-y-2 p-1.5"
              >
                <UiSkeleton
                  v-for="i in 3"
                  :key="i"
                  h="2.9rem"
                  rounded="lg"
                />
                <p
                  v-if="state === 'slow'"
                  class="pt-1 text-center text-[12.5px] text-text-muted"
                >
                  Still looking. A large library takes a moment.
                </p>
              </div>

              <!-- A real answer with nothing in it -->
              <div
                v-else-if="state === 'empty'"
                class="px-3 py-7 text-center"
              >
                <p class="text-[13.5px] text-text-soft">
                  Nothing matches
                  <span class="font-medium text-text">“{{ query.trim() }}”</span>
                </p>
                <p
                  v-if="within"
                  class="mt-1 text-[12.5px] text-text-muted"
                >
                  This search is limited to {{ within.title }}.
                </p>
                <p
                  v-else
                  class="mt-1 text-[12.5px] text-text-muted"
                >
                  Lessons nobody has written yet have nothing to search.
                </p>
                <UiBtn
                  v-if="within"
                  variant="secondary"
                  size="sm"
                  class="mt-3"
                  @click="widen(); input?.focus()"
                  >Search everywhere</UiBtn
                >
              </div>

              <!-- The request did not come back -->
              <div
                v-else-if="state === 'failed'"
                class="px-3 py-7 text-center"
              >
                <UiIcon
                  name="alert"
                  :size="18"
                  class="mx-auto text-warn"
                />
                <p class="mt-2 text-[13.5px] text-text-soft">
                  {{ failure ?? 'Search could not run.' }}
                </p>
                <UiBtn
                  variant="secondary"
                  size="sm"
                  icon="refresh"
                  class="mt-3"
                  @click="retry()"
                  >Try again</UiBtn
                >
              </div>
            </div>

            <!-- The footer ------------------------------------------------ -->
            <div
              class="flex items-center gap-3 border-t border-border bg-surface-chrome px-4 py-2.5 text-[11.5px] text-text-faint"
            >
              <span class="hidden items-center gap-1 sm:flex">
                <kbd class="rounded-[6px] bg-surface px-1.5 py-px shadow-[inset_0_0_0_1px_rgb(var(--wash-rgb)/0.12)]">↑</kbd>
                <kbd class="rounded-[6px] bg-surface px-1.5 py-px shadow-[inset_0_0_0_1px_rgb(var(--wash-rgb)/0.12)]">↓</kbd>
                to move
              </span>
              <span class="hidden items-center gap-1 sm:flex">
                <kbd class="rounded-[6px] bg-surface px-1.5 py-px shadow-[inset_0_0_0_1px_rgb(var(--wash-rgb)/0.12)]">↵</kbd>
                to open
              </span>
              <span class="hidden items-center gap-1 sm:flex">
                <kbd class="rounded-[6px] bg-surface px-1.5 py-px shadow-[inset_0_0_0_1px_rgb(var(--wash-rgb)/0.12)]">esc</kbd>
                to close
              </span>
              <!-- Only while it would work: Backspace widens from an empty box. -->
              <span
                v-if="within && query === ''"
                class="hidden items-center gap-1 sm:flex"
              >
                <kbd class="rounded-[6px] bg-surface px-1.5 py-px shadow-[inset_0_0_0_1px_rgb(var(--wash-rgb)/0.12)]">⌫</kbd>
                to search everywhere
              </span>

              <span class="flex-1" />

              <!-- Degradation, said quietly. A search that has silently stopped
                   using its index and a search over an empty library otherwise
                   look identical, and only one of them is worth reporting.
                   `degraded`, not `retrieval === 'like'`: the plain scan also
                   answers a two-letter word, and saying "rebuilding" then made
                   a working search look broken. -->
              <span
                v-if="degraded"
                class="truncate"
                title="The search index is rebuilding. Results are still real, just narrower."
              >
                Index rebuilding — results may be incomplete
              </span>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </ClientOnly>
</template>
