<script setup lang="ts">
/** What the AI has cost on their key: the day, each course, each thing by name, and the limits they can change. */
interface Spending {
  today_usd: number
  caps: { run_usd: number; day_usd: number }
  day_resets: string
  building_from_folder: boolean
  courses: { id: number; title: string; spent_usd: number; lessons: { id: number; title: string; cost_usd: number }[] }[]
  recent: { at: string; what: string; course: string | null; model: string; cost_usd: number }[]
}

const api = useApi()
const toast = useToast()
const view = ref<Spending | null>(null)
const perCourse = ref('')
const perDay = ref('')
const saving = ref(false)

async function load(): Promise<void> {
  view.value = await api.get<Spending>('/companion/spending')
  perCourse.value = String(view.value.caps.run_usd)
  perDay.value = String(view.value.caps.day_usd)
}

onMounted(() => void load().catch(() => (view.value = null)))

async function save(): Promise<void> {
  saving.value = true
  try {
    await api.put('/companion/spending/caps', { run_usd: Number(perCourse.value), day_usd: Number(perDay.value) })
    await load()
    toast.success('Limits saved.')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Those limits could not be saved.')
  } finally {
    saving.value = false
  }
}

async function stop(): Promise<void> {
  await api.del('/companion/folders/build').catch(() => undefined)
  await load()
}

const money = (n: number) => (n < 0.01 && n > 0 ? '<$0.01' : `$${n.toFixed(2)}`)
const when = (at: string) => new Date(at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
</script>

<template>
  <div
    v-if="view"
    class="grid gap-7 text-[14px] text-text-body"
  >
    <section>
      <h2 class="font-display text-[16px] font-semibold text-text">Today</h2>
      <p class="mt-1">
        {{ money(view.today_usd) }} of your {{ money(view.caps.day_usd) }} daily limit, which starts over at {{ view.day_resets }}.
        You pay your AI provider directly; BiliMind takes nothing.
      </p>
      <div
        v-if="view.building_from_folder"
        class="mt-3 flex flex-wrap items-center gap-3 rounded-[12px] border border-border-rule bg-surface-mute px-3.5 py-2.5"
      >
        <span>A course is being built from a folder.</span>
        <UiBtn
          size="sm"
          variant="ghost"
          @click="stop"
        >
          Stop it
        </UiBtn>
      </div>
    </section>

    <section>
      <h2 class="font-display text-[16px] font-semibold text-text">Limits</h2>
      <p class="mt-1 text-text-muted">Nothing goes past these without you raising them. The command-line tool shares them.</p>
      <form
        class="mt-3 flex flex-wrap items-end gap-3"
        @submit.prevent="save"
      >
        <label class="grid gap-1 text-[13px]">
          For one course, in dollars
          <input
            v-model="perCourse"
            class="h-9 w-32 rounded-[10px] border border-border-rule bg-surface px-3 text-text"
            type="number"
            min="0.01"
            max="1000"
            step="0.01"
            required
          >
        </label>
        <label class="grid gap-1 text-[13px]">
          For one day, in dollars
          <input
            v-model="perDay"
            class="h-9 w-32 rounded-[10px] border border-border-rule bg-surface px-3 text-text"
            type="number"
            min="0.01"
            max="1000"
            step="0.01"
            required
          >
        </label>
        <UiBtn
          type="submit"
          size="sm"
          :disabled="saving"
        >
          Save limits
        </UiBtn>
      </form>
    </section>

    <section v-if="view.courses.length">
      <h2 class="font-display text-[16px] font-semibold text-text">By course</h2>
      <ul class="mt-2 grid gap-3">
        <li
          v-for="course in view.courses"
          :key="course.id"
        >
          <p class="flex justify-between gap-4 font-medium text-text">
            <span>{{ course.title }}</span>
            <span class="num">{{ money(course.spent_usd) }} of {{ money(view.caps.run_usd) }}</span>
          </p>
          <ul
            v-if="course.lessons.length"
            class="mt-1 grid gap-0.5 text-[13px] text-text-muted"
          >
            <li
              v-for="lesson in course.lessons"
              :key="lesson.id"
              class="flex justify-between gap-4"
            >
              <span>{{ lesson.title }}</span>
              <span class="num">{{ money(lesson.cost_usd) }}</span>
            </li>
          </ul>
        </li>
      </ul>
    </section>

    <section v-if="view.recent.length">
      <h2 class="font-display text-[16px] font-semibold text-text">Lately</h2>
      <ul class="mt-2 grid gap-1 text-[13px]">
        <li
          v-for="(row, i) in view.recent"
          :key="i"
          class="flex justify-between gap-4"
        >
          <span>{{ row.what }}<span
            v-if="row.course"
            class="text-text-muted"
          > · {{ row.course }}</span></span>
          <span class="num shrink-0 text-text-muted">{{ when(row.at) }} · {{ money(row.cost_usd) }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>
