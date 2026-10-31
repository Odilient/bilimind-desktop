<script setup lang="ts">
import type { Assessment, AttemptResponse } from '~/types/api'

/**
 * The project submission. Sends `{text, deliverables?, links?}` — exactly the
 * shape SubmitAttemptRequest accepts — and shows the deliverables from the
 * project block so the learner can tick them off as they write.
 */
const props = withDefaults(
  defineProps<{
    assessment: Assessment
    disabled?: boolean
    /** Deliverables declared by the parent `project` block. */
    deliverables?: string[]
  }>(),
  { deliverables: () => [] },
)

const model = defineModel<AttemptResponse | null>({ default: null })

const text = ref('')
const done = ref<string[]>([])
const links = ref<string[]>([''])

watch(
  model,
  (value) => {
    const restored = (value as { text?: unknown } | null)?.text
    if (typeof restored === 'string' && restored !== text.value) text.value = restored
  },
  { immediate: true },
)

const validLinks = computed(() =>
  links.value.map((link) => link.trim()).filter((link) => /^https?:\/\/\S+$/i.test(link)),
)

const brokenLinks = computed(() =>
  links.value.some((link) => link.trim() !== '' && !/^https?:\/\/\S+$/i.test(link.trim())),
)

watch(
  [text, done, validLinks],
  () => {
    const body = text.value.trim()

    if (body === '' && done.value.length === 0 && validLinks.value.length === 0) {
      model.value = null
      return
    }

    const response: Record<string, unknown> = {}
    if (body !== '') response.text = body
    if (done.value.length > 0) response.deliverables = [...done.value]
    if (validLinks.value.length > 0) response.links = [...validLinks.value]

    model.value = response as AttemptResponse
  },
  { deep: true },
)

function toggle(item: string): void {
  done.value = done.value.includes(item)
    ? done.value.filter((entry) => entry !== item)
    : [...done.value, item]
}

function addLink(): void {
  if (links.value.length < 20) links.value = [...links.value, '']
}

function removeLink(index: number): void {
  links.value = links.value.filter((_, i) => i !== index)
  if (links.value.length === 0) links.value = ['']
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div v-if="deliverables.length">
      <p class="eyebrow-loud mb-2.5 text-text-faint">What you're handing in</p>
      <ul class="flex flex-col gap-1">
        <li
          v-for="(item, index) in deliverables"
          :key="index"
        >
          <button
            type="button"
            :disabled="disabled"
            :aria-pressed="done.includes(item)"
            class="flex w-full items-start gap-3 rounded-[12px] px-2.5 py-2 text-left transition-colors hover:bg-surface-mute disabled:opacity-60"
            @click="toggle(item)"
          >
            <span
              aria-hidden="true"
              :class="[
                'mt-px grid size-5 shrink-0 place-items-center rounded-[6px]',
                done.includes(item)
                  ? 'bg-accent text-on-accent'
                  : 'text-transparent shadow-[inset_0_0_0_1.5px_rgb(var(--wash-rgb)/0.18)]',
              ]"
            >
              <UiIcon
                name="check"
                :size="11"
              />
            </span>
            <span
              :class="[
                'min-w-0 flex-1 text-[14px] leading-relaxed',
                done.includes(item) ? 'text-text-faint line-through' : 'text-text-body',
              ]"
              >{{ item }}</span
            >
          </button>
        </li>
      </ul>
    </div>

    <UiTextField
      v-model="text"
      label="What you built"
      multiline
      :rows="8"
      :maxlength="40000"
      :disabled="disabled"
      placeholder="Describe what you built, the decisions you made and where it falls short. The rubric grades what you actually say here."
    />

    <div>
      <p class="eyebrow-loud mb-2.5 text-text-faint">Links (optional)</p>
      <div class="flex flex-col gap-1.5">
        <div
          v-for="(_, index) in links"
          :key="index"
          class="flex items-center gap-1.5"
        >
          <UiTextField
            v-model="links[index]"
            size="sm"
            class="flex-1"
            icon="link"
            :disabled="disabled"
            placeholder="https://github.com/you/project"
            aria-label="Link to your work"
          />
          <UiBtn
            v-if="links.length > 1 || links[0] !== ''"
            variant="ghost"
            size="sm"
            square
            icon="x"
            label="Remove link"
            :disabled="disabled"
            @click="removeLink(index)"
          />
        </div>
      </div>
      <div class="mt-1.5 flex items-center justify-between gap-3">
        <UiBtn
          variant="ghost"
          size="xs"
          icon="plus"
          :disabled="disabled || links.length >= 20"
          @click="addLink"
        >
          Add another
        </UiBtn>
        <p
          v-if="brokenLinks"
          class="text-[11.5px] text-warn"
        >
          Links need the full https:// prefix to be sent.
        </p>
      </div>
    </div>
  </div>
</template>
