<script setup lang="ts">
/**
 * Tasks: what do I have to do, and where am I with it? A tracker after
 * adgen-new's to-do (8 Nov 2026): the same cards as a board of three
 * columns, To do, Doing and Done, or as a list grouped the same way
 * (`?view=list`). A course filter and a search sit beside the switch, held
 * in the address too (`?course=`, `?q=`), so a link opens the same board.
 *
 * The cards are the learner's own tasks and their courses' deadlines
 * (`companion/tasks.ts` says which and why); To do and Doing keep the date
 * order (overdue first, no date last), the most pressing first on one day;
 * Done is newest first, six in sight. A card opens its own page
 * (`/app/tasks/{id}`); a column's "+", the New task button or `c` opens New
 * task in that column.
 *
 * A card is dragged to another column (mouse, or a long press on touch), or
 * moved from its "⋯" without a pointer. Doing is `started_at`; Done is the
 * tick, so a deadline in Done is handed in (or sat). The tick, the move and
 * the delete answer with a toast and an Undo (`useTaskActions`).
 *
 * Generated plan tasks (reviews, reading, checks) aren't here: they are the
 * day's plan, on Today and the Calendar.
 */
import type { PlanTask, Uuid } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { useNow } from '~/companion/today-layout'
import { dayKey } from '~/companion/time'
import {
  COLUMN_LABELS,
  columnOf,
  courseOptions,
  entryMatches,
  moveTask,
  taskColumns,
  taskGroups,
  type BoardCard,
  type TaskColumn,
} from '~/companion/tasks'
import { useExport } from '~/companion/export/use-export'

definePageMeta({ layout: 'companion' })

const c = useCompanion()
const toast = useToast()
const { t } = useI18n()
// After `t`: the title is read at once, and a `t` not yet declared throws, sending the page to the error screen.
useSeoMeta({ title: () => `${t('tasks.title')} · BiliMind`, robots: 'noindex' })
const exp = useExport()
const now = useNow()
const route = useRoute()
const router = useRouter()
const actions = useTaskActions()

/* -- What the address holds: the view, the course, the search ------------------- */

const view = computed(() => (route.query.view === 'list' ? 'list' : 'board'))
const courseId = computed<Uuid | null>(() => {
  const id = typeof route.query.course === 'string' ? route.query.course : ''
  return id && c.get('subjects', id) ? id : null
})
const course = computed(() => (courseId.value ? c.get('subjects', courseId.value) : null))
const query = ref(typeof route.query.q === 'string' ? route.query.q : '')

/** Each pick replaces the query; the default value leaves its key out. */
function setQuery(key: 'view' | 'course' | 'q', value: string): void {
  const next = { ...route.query }
  if (!value || (key === 'view' && value === 'board')) delete next[key]
  else next[key] = value
  void router.replace({ query: next })
}

let typingTimer: ReturnType<typeof setTimeout> | undefined
watch(query, (q) => {
  clearTimeout(typingTimer)
  typingTimer = setTimeout(() => setQuery('q', q.trim()), 250)
})

const views = computed(() => [
  { value: 'board', label: t('tasks.board.board'), icon: 'grid' },
  { value: 'list', label: t('tasks.board.list'), icon: 'list' },
])
const viewModel = computed({ get: () => view.value, set: (v: string) => setQuery('view', v) })

/* -- The cards ------------------------------------------------------------------- */

const groups = computed(() => taskGroups(c.planTasks.value, c.deadlines.value, now.value))
const filtered = computed(() =>
  groups.value
    .map((g) => ({ ...g, entries: g.entries.filter((e) => entryMatches(e, courseId.value, query.value)) }))
    .filter((g) => g.entries.length),
)
const columns = computed(() => taskColumns(filtered.value))
const COLUMNS: TaskColumn[] = ['todo', 'doing', 'done']
const narrowed = computed(() => Boolean(courseId.value || query.value.trim()))

/** Done keeps the last six in sight; the rest of the two weeks are a click away. */
const DONE_SHOWN = 6
const showAllDone = ref(false)
function shown(col: TaskColumn): BoardCard[] {
  const cards = columns.value[col]
  return col === 'done' && !showAllDone.value ? cards.slice(0, DONE_SHOWN) : cards
}

/** On a phone one column at a time, picked here. */
const phoneCol = ref<TaskColumn>('todo')
const phoneOptions = computed(() =>
  COLUMNS.map((col) => ({ value: col, label: COLUMN_LABELS[col], count: columns.value[col].length })),
)

const todayCount = computed(() => groups.value.find((g) => g.key === 'today')?.entries.length ?? 0)
const eyebrow = computed(() =>
  todayCount.value ? t('tasks.board.eyebrow', todayCount.value) : t('tasks.board.eyebrowNone'),
)

/** The learner's own tasks left from earlier days: these can move; a deadline's date can't. */
const lateOwn = computed(() =>
  (filtered.value.find((g) => g.key === 'overdue')?.entries ?? []).flatMap((e) =>
    e.kind === 'task' && columnOf(e) === 'todo' ? [e.task] : [],
  ),
)

function move(task: PlanTask, date: string | null): void {
  void moveTask(c, task, date).catch(() => undefined)
}

const moving = ref(false)
async function catchUp(): Promise<void> {
  if (moving.value) return
  moving.value = true
  const late = [...lateOwn.value]
  const today = dayKey(now.value)
  try {
    for (const t of late) await moveTask(c, t, today)
    toast.success({ title: t('tasks.board.movedToday', late.length) })
  } catch {
    // The store has said which one it couldn't move.
  } finally {
    moving.value = false
  }
}

/* -- New task -------------------------------------------------------------------- */

const adding = ref<{ column: TaskColumn; text?: string; subjectId?: Uuid | null } | null>(null)

function add(column: TaskColumn = 'todo', text = ''): void {
  adding.value = { column, text, subjectId: courseId.value }
}

/** `c` opens New task, as in a tracker; not while typing, and not as the second key of "g c" (Courses). */
let lastG = 0
function onKey(event: KeyboardEvent): void {
  if (event.isComposing || event.metaKey || event.ctrlKey || event.altKey || adding.value) return
  const el = event.target as HTMLElement | null
  if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return
  const key = event.key.toLowerCase()
  if (key === 'g') lastG = Date.now()
  else if (key === 'c' && Date.now() - lastG > 1200) {
    event.preventDefault()
    add()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

/* -- Dragging ------------------------------------------------------------------- */

/*
 * Pointer events rather than HTML drag and drop, which touch screens don't
 * fire. A mouse drags after 6px; a finger after a 350ms press, so a swipe
 * still scrolls the column. The card stays put, faded, and a copy follows
 * the pointer; the column under it lights up, and letting go there moves it.
 */
interface Press {
  card: BoardCard
  id: number
  x: number
  y: number
  el: HTMLElement
  armed: boolean
  timer?: ReturnType<typeof setTimeout>
}
let press: Press | null = null
const drag = ref<{ card: BoardCard; x: number; y: number; dx: number; dy: number; w: number; over: TaskColumn | null } | null>(null)

function columnAt(x: number, y: number): TaskColumn | null {
  return (document.elementFromPoint(x, y)?.closest('[data-col]')?.getAttribute('data-col') as TaskColumn | null) ?? null
}

function grab(card: BoardCard, event: PointerEvent): void {
  const el = (event.target as HTMLElement).closest('li')
  if (!el) return
  press = { card, id: event.pointerId, x: event.clientX, y: event.clientY, el, armed: event.pointerType !== 'touch' }
  if (!press.armed) {
    press.timer = setTimeout(() => {
      if (!press) return
      press.armed = true
      lift(press.x, press.y)
    }, 350)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', release)
  window.addEventListener('touchmove', holdScroll, { passive: false })
  window.addEventListener('contextmenu', holdMenu)
}

function lift(x: number, y: number): void {
  if (!press) return
  const r = press.el.getBoundingClientRect()
  drag.value = { card: press.card, x, y, dx: press.x - r.left, dy: press.y - r.top, w: r.width, over: columnAt(x, y) }
}

function onMove(event: PointerEvent): void {
  if (!press || event.pointerId !== press.id) return
  if (!drag.value) {
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) < 6) return
    // A finger that moves before the press is long enough is scrolling.
    if (!press.armed) return release()
    lift(event.clientX, event.clientY)
  }
  Object.assign(drag.value!, { x: event.clientX, y: event.clientY, over: columnAt(event.clientX, event.clientY) })
}

/** Once a card is lifted, a finger moves the card, not the page. */
function holdScroll(event: TouchEvent): void {
  if (drag.value) event.preventDefault()
}
function holdMenu(event: Event): void {
  if (press && !press.armed) event.preventDefault()
}

function onUp(event: PointerEvent): void {
  if (!press || event.pointerId !== press.id) return
  const lifted = drag.value
  release()
  if (!lifted) return
  // The click that ends a drag isn't a click on the card.
  const swallow = (e: Event): void => {
    e.stopPropagation()
    e.preventDefault()
  }
  window.addEventListener('click', swallow, { capture: true, once: true })
  setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0)
  if (lifted.over) void actions.toColumn(lifted.card.entry, lifted.over)
}

function release(): void {
  if (press?.timer) clearTimeout(press.timer)
  press = null
  drag.value = null
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
  window.removeEventListener('pointercancel', release)
  window.removeEventListener('touchmove', holdScroll)
  window.removeEventListener('contextmenu', holdMenu)
}
onBeforeUnmount(release)
</script>

<template>
  <div class="pb-16">
    <CompanionShellMasthead
      :title="t('tasks.title')"
      :eyebrow="c.status.ready ? eyebrow : undefined"
      :subtitle="t('tasks.board.subtitle')"
      width="max-w-[1280px]"
    >
      <template #actions>
        <UiBtn
          variant="primary"
          icon="plus"
          :title="t('tasks.board.newTaskKey')"
          @click="add()"
        >
          {{ t('tasks.board.newTask') }}
        </UiBtn>
      </template>
      <template #bar-actions>
        <UiBtn
          variant="ghost"
          size="sm"
          square
          icon="plus"
          :label="t('tasks.board.newTask')"
          @click="add()"
        />
      </template>
    </CompanionShellMasthead>

    <div class="@container mx-auto grid w-full max-w-[1280px] grid-cols-[minmax(0,1fr)] content-start gap-4 px-4 pt-5 sm:px-6 lg:px-8 lg:pt-6">
      <div
        v-if="!c.status.ready"
        class="cp-skel h-[300px] rounded-[20px]"
        aria-busy="true"
      />

      <template v-else>
        <!-- The view, the course and the search: all three live in the address. -->
        <div class="flex flex-wrap items-center gap-2">
          <UiSegmented
            v-model="viewModel"
            :options="views"
            :label="t('tasks.field.view')"
          />
          <CompanionTasksPropMenu
            :label="t('tasks.field.course')"
            kind="course"
            variant="chip"
            :search="true"
            :options="[{ key: '', label: t('tasks.course.all') }, ...courseOptions(c.shelf.value).slice(1)]"
            :value="courseId ?? ''"
            @pick="setQuery('course', $event)"
          >
            <CompanionCourseCover
              v-if="course"
              :subject="course"
              size="sm"
              :px="15"
            />
            <CompanionIcon
              v-else
              name="cap"
              :size="13"
              class="text-text-faint"
            />
            <span class="max-w-[180px] truncate">{{ course?.title ?? t('tasks.course.all') }}</span>
            <UiIcon
              name="chevron-down"
              :size="13"
              class="text-text-faint"
            />
          </CompanionTasksPropMenu>
          <label class="relative order-last flex h-8 w-full min-w-0 items-center sm:order-none sm:w-auto sm:max-w-[260px] sm:flex-1">
            <span class="sr-only">{{ t('tasks.board.find') }}</span>
            <UiIcon
              name="search"
              :size="14"
              class="pointer-events-none absolute left-2.5 text-text-faint"
            />
            <input
              v-model="query"
              type="search"
              :placeholder="t('tasks.board.find')"
              class="h-8 w-full min-w-0 rounded-[9px] bg-surface pr-2 pl-8 text-[16px] text-text shadow-[inset_0_0_0_1px_var(--border)] outline-none placeholder:text-text-faint focus:shadow-[inset_0_0_0_1.5px_var(--border-strong)] min-[700px]:text-[13.5px]"
            >
          </label>
        </div>

        <template v-if="view === 'board'">
          <!-- A phone has room for one column: this picks it, and the "⋯" moves cards. -->
          <UiSegmented
            v-model="phoneCol"
            :options="phoneOptions"
            :label="t('tasks.field.column')"
            block
            class="@min-[620px]:hidden"
          />

          <div class="grid gap-3 @min-[620px]:grid-cols-3">
            <section
              v-for="col in COLUMNS"
              :key="col"
              :data-col="col"
              :aria-labelledby="`tasks-${col}`"
              :class="[
                // On a desk each column is as tall as the window allows and scrolls on its own.
                'flex min-w-0 flex-col rounded-[18px] p-2 transition-[background-color,box-shadow] duration-150 @min-[620px]:max-h-[calc(100dvh-268px)] @min-[620px]:min-h-[320px]',
                drag?.over === col && columnOf(drag.card.entry) !== col
                  ? 'bg-accent-soft shadow-[inset_0_0_0_1.5px_var(--accent-line)]'
                  : 'bg-[rgb(var(--wash-rgb)/0.04)]',
                col !== phoneCol && '@max-[619px]:hidden',
              ]"
            >
              <header class="flex h-9 items-center gap-2 pr-0.5 pl-2">
                <CompanionTasksStatusIcon :s="col" />
                <h2
                  :id="`tasks-${col}`"
                  class="flex items-baseline gap-1.5 text-[14.5px] font-semibold whitespace-nowrap text-text"
                >
                  {{ COLUMN_LABELS[col] }}
                  <span class="num text-[13px] font-medium text-text-faint">{{ columns[col].length }}</span>
                </h2>
                <span class="flex-1" />
                <button
                  type="button"
                  :aria-label="t('tasks.list.newIn', { col: COLUMN_LABELS[col] })"
                  :title="t('tasks.list.newIn', { col: COLUMN_LABELS[col] })"
                  class="grid size-8 shrink-0 cursor-pointer place-items-center rounded-[9px] text-text-faint hover:bg-[rgb(var(--wash-rgb)/0.06)] hover:text-text"
                  @click="add(col)"
                >
                  <UiIcon
                    name="plus"
                    :size="16"
                  />
                </button>
              </header>

              <CompanionTasksAdd
                v-if="col === 'todo'"
                :subject-id="courseId"
                class="mx-0.5 mb-2"
                @more="add('todo', $event)"
              />
              <!-- Own tasks left from earlier days: one press brings them all to today. -->
              <p
                v-if="col === 'todo' && lateOwn.length"
                class="mx-1 mb-2 flex flex-wrap items-center gap-x-2 text-[13px] text-text-muted"
              >
                {{ t('tasks.board.fromEarlier', lateOwn.length) }}
                <button
                  type="button"
                  class="cursor-pointer font-semibold text-text-soft hover:text-text hover:underline disabled:opacity-50"
                  :disabled="moving"
                  @click="catchUp"
                >
                  {{ t('tasks.board.moveToday') }}
                </button>
              </p>

              <ul class="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] content-start gap-2 p-0.5 [scrollbar-width:thin] @min-[620px]:overflow-y-auto">
                <li
                  v-for="card in shown(col)"
                  :key="card.entry.id"
                >
                  <CompanionTasksCard
                    :entry="card.entry"
                    :group="card.group"
                    :dragging="drag?.card.entry.id === card.entry.id"
                    @grab="grab(card, $event)"
                    @toggle="actions.toggle"
                    @column="actions.toColumn"
                    @move="move"
                    @remove="actions.remove"
                  />
                </li>
                <li v-if="!columns[col].length">
                  <button
                    type="button"
                    class="group/empty grid w-full cursor-pointer justify-items-center gap-1.5 rounded-[12px] px-3 py-6 text-center text-[13.5px] leading-relaxed text-text-muted shadow-[inset_0_0_0_1.5px_var(--border-dashed)] transition-shadow hover:text-text-soft hover:shadow-[inset_0_0_0_1.5px_var(--border-strong)]"
                    @click="add(col)"
                  >
                    <span>
                      {{
                        narrowed
                          ? t('tasks.board.nothingFilter')
                          : col === 'todo'
                            ? t('tasks.list.emptyTodo')
                            : col === 'doing'
                              ? t('tasks.board.emptyDoing')
                              : t('tasks.board.emptyDone')
                      }}
                    </span>
                    <span class="inline-flex items-center gap-1 text-[12.5px] font-semibold opacity-60 group-hover/empty:opacity-100">
                      <UiIcon
                        name="plus"
                        :size="12"
                      />{{ t('tasks.add.action') }}
                    </span>
                  </button>
                </li>
              </ul>

              <button
                v-if="col === 'done' && columns.done.length > DONE_SHOWN"
                type="button"
                class="mx-2 mt-2 h-8 cursor-pointer self-start rounded-full px-2 text-[13px] font-semibold text-text-soft hover:text-text"
                @click="showAllDone = !showAllDone"
              >
                {{ showAllDone ? t('tasks.board.showFewer') : t('tasks.board.showAll', { n: columns.done.length }) }}
              </button>
            </section>
          </div>
        </template>

        <CompanionTasksListView
          v-else
          :columns="columns"
          @add="add"
          @toggle="actions.toggle"
        />

        <p class="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-2 text-[14px] text-text-muted">
          <!-- The school's deadlines arrive here by themselves once a source is connected. -->
          <NuxtLink
            to="/app/settings?section=integrations"
            class="inline-flex items-center gap-1.5 font-medium text-text-soft hover:text-text hover:underline"
          >
            <CompanionIcon
              name="cap"
              :size="14"
            />{{ t('tasks.board.bring') }}
          </NuxtLink>
          <!-- Exports: the spreadsheet's Tasks tab sits beside every deadline and grade. -->
          <template v-if="groups.length">
            <span
              class="text-text-ghost"
              aria-hidden="true"
            >·</span>
            {{ t('tasks.board.download') }}
            <button
              type="button"
              class="cursor-pointer font-medium text-text-soft hover:text-text hover:underline"
              @click="exp.spreadsheet()"
            >
              {{ t('tasks.board.spreadsheet') }}
            </button>
            <button
              type="button"
              class="cursor-pointer font-medium text-text-soft hover:text-text hover:underline"
              @click="exp.tasksCsv()"
            >
              CSV
            </button>
          </template>
        </p>
      </template>
    </div>

    <!-- The lifted card, following the pointer. -->
    <div
      v-if="drag"
      class="pointer-events-none fixed top-0 left-0 z-50 rounded-[12px] shadow-[var(--shadow-raised)]"
      :style="{ width: `${drag.w}px`, transform: `translate(${drag.x - drag.dx}px, ${drag.y - drag.dy}px) rotate(1.5deg)` }"
      aria-hidden="true"
    >
      <CompanionTasksCard
        :entry="drag.card.entry"
        :group="drag.card.group"
      />
    </div>

    <CompanionTasksNewTask
      :start="adding"
      @close="adding = null"
    />
  </div>
</template>
