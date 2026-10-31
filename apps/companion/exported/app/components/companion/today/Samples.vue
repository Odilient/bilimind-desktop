<script setup lang="ts">
/**
 * "Look around": what every new account starts with (the starter kit, made
 * at sign-up), so there is something real to open before anything of the
 * learner's own exists: the sample course and the sample notes, each marked
 * Sample. One press, Remove samples, takes them all away whenever the
 * learner is ready (`removeSamples()`); nothing of their own is touched.
 *
 * Rows in the plan's white card: the course's cover or the note's kind, the
 * name, the Sample mark, and a chevron; the whole row opens it.
 */
import { useCompanion } from '~/companion/store'
import { isSample, removeSamples } from '~/companion/samples'
import { itemRoute } from '~/companion/ai/links'
import { noteIcon } from '~/companion/notes/tree'
import { itemHref } from '~/companion/today-layout'

const c = useCompanion()
const toast = useToast()

const rows = computed(() => [
  ...c.shelf.value
    .filter((s) => s.sample)
    .map((s) => ({ key: s.id, subject: s, icon: '', name: s.title, line: 'Course', to: `/app/courses/${s.id}` })),
  ...c.items.value
    .filter((i) => isSample(i) && !i.parent_id)
    .map((i) => ({
      key: i.id,
      subject: null,
      icon: noteIcon(i),
      name: i.title || 'Untitled',
      line: i.kind === 'board' ? 'Whiteboard' : 'Page',
      to: itemRoute(i) ?? itemHref(i),
    })),
])

const removing = ref(false)

async function remove(): Promise<void> {
  if (removing.value) return
  removing.value = true
  try {
    await removeSamples()
    toast.success({ title: 'Samples removed', body: 'Everything here is yours from now on.' })
  } catch {
    toast.error({ title: "The samples didn't go", body: 'Check the connection and try again.' })
  } finally {
    removing.value = false
  }
}
</script>

<template>
  <section
    v-if="rows.length"
    aria-labelledby="today-samples"
  >
    <div class="flex items-center justify-between gap-3 px-0.5">
      <div class="min-w-0">
        <h2
          id="today-samples"
          class="t-head text-[19px]"
        >
          Look around
        </h2>
        <p class="mt-0.5 text-[13px] text-text-faint">
          A sample course and notes, to try things on.
        </p>
      </div>
      <UiBtn
        variant="ghost"
        size="md"
        icon="trash"
        class="shrink-0 max-sm:h-11"
        :loading="removing"
        @click="remove"
      >
        Remove samples
      </UiBtn>
    </div>

    <ul class="mt-3 overflow-hidden rounded-[22px] bg-surface shadow-[inset_0_0_0_1px_var(--border),0_24px_48px_-36px_rgb(11_13_16/0.3)]">
      <li
        v-for="(r, index) in rows"
        :key="r.key"
        :class="index > 0 && 'border-t border-border-rule'"
      >
        <NuxtLink
          :to="r.to"
          class="group flex items-center gap-3 py-3 pr-3 pl-3.5 transition-colors hover:bg-surface-mute focus-visible:bg-surface-mute focus-visible:outline-none"
        >
          <CompanionCourseCover
            v-if="r.subject"
            :subject="r.subject"
            size="sm"
          />
          <span
            v-else
            class="grid size-10 shrink-0 place-items-center rounded-[12px] bg-surface-sunken text-text-soft"
            aria-hidden="true"
          >
            <CompanionIcon
              :name="r.icon"
              :size="17"
            />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-[14.5px] font-semibold text-text">{{ r.name }}</span>
            <span class="mt-0.5 block text-[12.5px] text-text-faint">{{ r.line }}</span>
          </span>
          <span class="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[12px] font-semibold text-accent-strong">
            <span class="size-1.5 rounded-full bg-lime-2" />
            Sample
          </span>
          <UiIcon
            name="chevron-right"
            :size="16"
            class="shrink-0 text-text-ghost transition-transform duration-150 group-hover:translate-x-0.5"
          />
        </NuxtLink>
      </li>
    </ul>
  </section>
</template>
