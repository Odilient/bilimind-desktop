<script setup lang="ts">
/**
 * One card of the Tasks board on its own page, laid out like an issue page
 * in a tracker (adgen-new's to-do): the title (renamed in place), its note
 * (edited in place), its steps, and when it was made, started and done.
 * Its properties sit in a column on the right, each one a picker; on a
 * phone they fold into a row of pills under the title.
 *
 * A deadline opens here too, so every card on the board opens the same
 * way. Its title, course and date are the school's: they are read here and
 * changed on the deadline's own page (`/app/d/{id}`), where its sources and
 * history are. Its column, priority, note and steps are the learner's.
 */
import type { PlanTask } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { clock, dayKey, dayLabel } from '~/companion/time'
import { columnOf, editTask, findEntry, notesOf, updateEntry } from '~/companion/tasks'
import type { MenuAction } from '~/components/ui/Menu.vue'

definePageMeta({ layout: 'companion' })

const c = useCompanion()
const { t } = useI18n()
const route = useRoute()
const actions = useTaskActions()

const id = computed(() => String(route.params.id ?? ''))
const card = computed(() => findEntry(c.planTasks.value, c.deadlines.value, id.value))
const entry = computed(() => card.value?.entry ?? null)
const task = computed<PlanTask | null>(() => (entry.value?.kind === 'task' ? entry.value.task : null))
const column = computed(() => (entry.value ? columnOf(entry.value) : 'todo'))
const title = computed(() => (entry.value ? (entry.value.kind === 'task' ? entry.value.task.title : entry.value.deadline.title) : ''))

useSeoMeta({ title: () => `${title.value || t('tasks.field.task')} · BiliMind`, robots: 'noindex' })

/* -- The title, renamed in place (an own task's; a deadline's is the school's) -- */

const titling = ref(false)
const titleDraft = ref('')
const titleInput = ref<HTMLInputElement | null>(null)

function editTitle(): void {
  if (!task.value) return
  titleDraft.value = task.value.title
  titling.value = true
  void nextTick(() => titleInput.value?.select())
}

function saveTitle(): void {
  if (!titling.value) return
  titling.value = false
  const next = titleDraft.value.trim().slice(0, 300)
  if (task.value && next && next !== task.value.title) void editTask(c, task.value, { title: next }).catch(() => undefined)
}

/* -- The note, edited in place -------------------------------------------------- */

const noting = ref(false)
const noteDraft = ref('')
const noteArea = ref<HTMLTextAreaElement | null>(null)

function editNote(): void {
  if (!entry.value) return
  noteDraft.value = notesOf(entry.value)
  noting.value = true
  void nextTick(() => noteArea.value?.focus())
}

function saveNote(): void {
  noting.value = false
  if (!entry.value) return
  const next = noteDraft.value.trim()
  if (next !== notesOf(entry.value).trim()) void updateEntry(c, entry.value, { notes: next || null }).catch(() => undefined)
}

function onNoteKey(event: KeyboardEvent): void {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault()
    saveNote()
  }
  if (event.key === 'Escape') {
    event.stopPropagation()
    noting.value = false
  }
}

/* -- When it was made, started and done ---------------------------------------- */

function stamp(iso: string | null | undefined): string {
  return iso ? `${dayLabel(dayKey(iso))}, ${clock(iso)}` : ''
}

const history = computed(() => {
  const e = entry.value
  if (!e) return []
  const row = e.kind === 'task' ? e.task : e.deadline
  const doneAt = e.kind === 'task' ? e.task.done_at : column.value === 'done' ? e.deadline.updated_at : null
  return [
    { label: e.kind === 'task' ? t('tasks.page.added') : t('tasks.page.arrived'), at: stamp(row.created_at) },
    { label: t('tasks.page.started'), at: stamp(row.started_at) },
    { label: e.kind === 'deadline' && e.deadline.status === 'submitted' ? t('tasks.page.handedIn') : t('tasks.card.done'), at: stamp(doneAt) },
  ].filter((h) => h.at)
})

/* -- The head's buttons -------------------------------------------------------- */

const more = computed<MenuAction[]>(() => {
  const e = entry.value
  if (!e) return []
  if (e.kind === 'deadline') return [{ label: t('tasks.page.openDeadline'), icon: 'arrow-right', run: () => void navigateTo(`/app/d/${e.id}`) }]
  return [
    { label: t('tasks.page.rename'), icon: 'pencil', run: editTitle },
    { label: t('common.delete'), icon: 'trash', destructive: true, run: () => remove(e.task) },
  ]
})

function remove(t: PlanTask): void {
  actions.remove(t)
  void navigateTo('/app/tasks')
}
</script>

<template>
  <div class="pb-16">
    <ShellPageHead
      :title="t('tasks.field.task')"
      back="/app/tasks"
      bar-only
    />

    <div class="mx-auto w-full max-w-[1120px] px-4 pt-3 sm:px-6 lg:px-8 lg:pt-6">
      <div
        v-if="!c.status.ready"
        class="cp-skel h-[320px] rounded-[20px]"
        aria-busy="true"
      />

      <div
        v-else-if="!entry"
        class="mx-auto grid max-w-[420px] justify-items-center gap-3 py-20 text-center"
      >
        <p class="text-[17px] font-semibold text-text">
          {{ t('tasks.page.missingTitle') }}
        </p>
        <p class="text-[14.5px] text-text-muted">
          {{ t('tasks.page.missingBody') }}
        </p>
        <UiBtn
          to="/app/tasks"
          variant="secondary"
        >
          {{ t('tasks.page.back') }}
        </UiBtn>
      </div>

      <template v-else>
        <!-- Where this is, and the one thing to do about it. -->
        <div class="flex min-h-10 items-center gap-2">
          <nav
            :aria-label="t('tasks.page.breadcrumb')"
            class="hidden min-w-0 items-center gap-1.5 text-[13.5px] text-text-muted lg:flex"
          >
            <NuxtLink
              to="/app/tasks"
              class="inline-flex h-8 items-center gap-1.5 rounded-[8px] px-2 font-medium text-text-soft hover:bg-[rgb(var(--wash-rgb)/0.05)] hover:text-text"
            >
              <UiIcon
                name="check-circle"
                :size="15"
              />{{ t('tasks.title') }}
            </NuxtLink>
            <UiIcon
              name="chevron-right"
              :size="13"
              class="text-text-faint"
            />
            <span class="truncate">{{ title }}</span>
          </nav>
          <span class="flex-1" />
          <UiBtn
            v-if="entry.kind === 'deadline'"
            :to="`/app/d/${entry.id}`"
            variant="ghost"
            size="sm"
            class="hidden sm:inline-flex"
          >
            {{ t('tasks.page.sources') }}
          </UiBtn>
          <UiBtn
            :variant="column === 'done' ? 'secondary' : 'primary'"
            size="sm"
            :icon="column === 'done' ? undefined : 'check'"
            @click="actions.toggle(entry)"
          >
            {{ column === 'done' ? t('tasks.card.notDone') : entry.kind === 'deadline' ? t('tasks.card.markHandedIn') : t('tasks.card.markDone') }}
          </UiBtn>
          <UiMenu
            :actions="more"
            :title="title"
            :label="t('common.more')"
          />
        </div>

        <div class="mt-4 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_288px]">
          <article class="grid min-w-0 gap-6">
            <div class="grid gap-3">
              <input
                v-if="titling"
                ref="titleInput"
                v-model="titleDraft"
                type="text"
                maxlength="300"
                :aria-label="t('tasks.field.task')"
                class="t-head w-full rounded-[10px] bg-surface-sunken px-2 py-1 text-[26px] leading-tight text-text outline-none sm:text-[30px]"
                @keydown.enter.prevent="saveTitle"
                @keydown.esc.stop="titling = false"
                @blur="saveTitle"
              >
              <h1
                v-else
                :class="[
                  't-head group -mx-2 rounded-[10px] px-2 py-1 text-[26px] leading-tight [overflow-wrap:anywhere] text-text sm:text-[30px]',
                  task && 'cursor-text hover:bg-[rgb(var(--wash-rgb)/0.04)]',
                  column === 'done' && 'text-text-muted',
                ]"
                :role="task ? 'button' : undefined"
                :tabindex="task ? 0 : undefined"
                :title="task ? t('tasks.page.rename') : undefined"
                @click="editTitle"
                @keydown.enter="editTitle"
              >
                {{ title }}
              </h1>

              <!-- A phone has no column beside the page: the properties are a row of pills here. -->
              <CompanionTasksProps
                class="lg:hidden"
                :entry="entry"
                chips
                @column="actions.toColumn(entry, $event)"
              />
            </div>

            <section
              aria-labelledby="task-note"
              class="rounded-[16px] bg-surface p-4 shadow-[0_0_0_1px_var(--border),var(--shadow-card)]"
            >
              <header class="flex h-7 items-center gap-2 text-[13.5px] font-semibold text-text-soft">
                <UiIcon
                  name="file"
                  :size="15"
                />
                <h2 id="task-note">
                  {{ t('tasks.field.note') }}
                </h2>
                <span class="flex-1" />
                <UiBtn
                  v-if="!noting && notesOf(entry)"
                  variant="ghost"
                  size="sm"
                  icon="pencil"
                  @click="editNote"
                >
                  {{ t('common.edit') }}
                </UiBtn>
              </header>
              <div
                v-if="noting"
                class="mt-2"
              >
                <textarea
                  ref="noteArea"
                  v-model="noteDraft"
                  maxlength="5000"
                  :aria-label="t('tasks.field.note')"
                  :placeholder="t('tasks.page.notePlaceholder')"
                  class="min-h-[120px] w-full resize-none rounded-[10px] bg-surface-sunken px-3 py-2.5 text-[15px] leading-relaxed text-text outline-none [field-sizing:content] placeholder:text-text-faint focus:shadow-[inset_0_0_0_2px_var(--brand)]"
                  @keydown="onNoteKey"
                />
                <div class="mt-2 flex items-center gap-2">
                  <span class="mr-auto hidden text-[12.5px] text-text-faint sm:inline">{{ t('tasks.page.ctrlSaves') }}</span>
                  <UiBtn
                    variant="ghost"
                    size="sm"
                    @click="noting = false"
                  >
                    {{ t('common.cancel') }}
                  </UiBtn>
                  <UiBtn
                    variant="primary"
                    size="sm"
                    @click="saveNote"
                  >
                    {{ t('common.save') }}
                  </UiBtn>
                </div>
              </div>
              <button
                v-else
                type="button"
                class="mt-1 block w-full cursor-text rounded-[10px] px-0 py-1 text-left text-[15px] leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]"
                :class="notesOf(entry) ? 'text-text-body' : 'text-text-faint'"
                @click="editNote"
              >
                {{ notesOf(entry) || t('tasks.page.noteEmpty') }}
              </button>
              <p
                v-if="entry.kind === 'deadline' && entry.deadline.scope_note"
                class="mt-3 border-t border-border-rule pt-3 text-[14px] leading-relaxed text-text-muted"
              >
                <span class="font-semibold text-text-soft">{{ t('tasks.page.covers') }}</span>
                {{ entry.deadline.scope_note }}
              </p>
            </section>

            <CompanionTasksChecklist :entry="entry" />
          </article>

          <aside
            class="sticky top-4 hidden rounded-[16px] bg-surface p-2.5 shadow-[0_0_0_1px_var(--border),var(--shadow-card)] lg:block"
            :aria-label="t('tasks.field.properties')"
          >
            <CompanionTasksProps
              :entry="entry"
              @column="actions.toColumn(entry, $event)"
            />
            <dl
              v-if="history.length"
              class="mt-2.5 grid gap-1.5 border-t border-border-rule pt-3 pb-1 text-[13px]"
            >
              <div
                v-for="h in history"
                :key="h.label"
                class="grid grid-cols-[84px_minmax(0,1fr)]"
              >
                <dt class="text-text-muted">
                  {{ h.label }}
                </dt>
                <dd class="num px-2 text-text-soft">
                  {{ h.at }}
                </dd>
              </div>
            </dl>
          </aside>

          <!-- On a phone the history closes the page instead. -->
          <dl
            v-if="history.length"
            class="grid gap-1 text-[13px] lg:hidden"
          >
            <div
              v-for="h in history"
              :key="h.label"
              class="flex gap-2"
            >
              <dt class="text-text-muted">
                {{ h.label }}
              </dt>
              <dd class="num text-text-soft">
                {{ h.at }}
              </dd>
            </div>
          </dl>
        </div>
      </template>
    </div>
  </div>
</template>
