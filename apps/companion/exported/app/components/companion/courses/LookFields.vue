<script setup lang="ts">
import type { Subject } from '~/companion/types'
import { courseColor } from '~/companion/colors'
import { COURSE_ICONS, coverPicture, firstEmoji } from '~/companion/course-icons'

/**
 * A course's look: its colour and the picture on its cover, a glyph from the
 * pack or an emoji. Both are `v-model`s, so the same fields edit a course in
 * place (`CompanionCoursesLookDialog`) and a course not made yet ("Start from
 * scratch"). `icon` null is "from the name": the glyph the title calls for,
 * or its initials.
 *
 * A picture of one's own is uploaded to a course that exists (`subjectId`),
 * because the server names it after the upload; a course not made yet gets
 * one from its card afterwards.
 */
const props = defineProps<{
  /** The course's name, for the preview and the automatic picture. */
  title: string
  /** A narrow column (beside "Start from scratch"'s fields): a smaller preview and grid. */
  compact?: boolean
  /** The course, when it exists: offers "Upload an image". */
  subjectId?: string
}>()

const icon = defineModel<string | null>('icon', { default: null })
const color = defineModel<string>('color', { required: true })

/** What the swatches and the preview read: the course as it would be. */
const look = computed(() => ({ id: '', title: props.title || 'New course', color: color.value, icon: icon.value }))
const auto = computed(() => coverPicture({ title: props.title }))
const picked = computed(() => coverPicture({ title: props.title, icon: icon.value }))

const emoji = ref(picked.value.kind === 'emoji' ? picked.value.text : '')
watch(icon, () => {
  if (picked.value.kind !== 'emoji') emoji.value = ''
})

function typed(): void {
  const one = firstEmoji(emoji.value)
  emoji.value = one ?? ''
  icon.value = one
}

/* -- A picture of one's own ----------------------------------------------- */

const api = useApi()
const toast = useToast()
const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)

/** What the server stores and serves: SVG is left out, it can carry script. */
const IMAGE_TYPES = 'image/png,image/jpeg,image/webp'
const MAX_MB = 2

async function upload(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !props.subjectId) return
  if (!IMAGE_TYPES.split(',').includes(file.type)) {
    toast.error('Pick a PNG, JPEG or WebP picture.')
    return
  }
  if (file.size > MAX_MB * 1024 * 1024) {
    toast.error(`That picture is over ${MAX_MB} MB. Pick a smaller one.`)
    return
  }
  uploading.value = true
  try {
    const form = new FormData()
    form.append('file', file)
    const saved = await api.post<Subject>(`/companion/subjects/${props.subjectId}/logo`, form)
    // Through the model, so the course everywhere (and its synced row) shows it.
    icon.value = saved.icon ?? null
  } catch (error) {
    toast.error(error instanceof Error && error.message ? error.message : 'The picture could not be uploaded.')
  } finally {
    uploading.value = false
  }
}

const wash = computed(() => `color-mix(in srgb, ${courseColor(color.value)} 18%, var(--surface))`)
const ink = computed(() => `color-mix(in srgb, ${courseColor(color.value)} 72%, var(--text))`)
</script>

<template>
  <div :class="['grid', compact ? 'content-start gap-4' : 'gap-5']">
    <div class="flex items-center gap-3.5">
      <CompanionCourseCover
        :subject="look as Subject"
        size="sm"
        :px="compact ? 44 : 56"
      />
      <div class="grid min-w-0 gap-0.5">
        <p class="truncate text-[16px] font-semibold text-text">
          {{ title || 'New course' }}
        </p>
        <p class="text-[13px] text-text-muted">
          {{ icon ? 'Your pick' : auto.kind === 'glyph' ? 'Picked from the name' : 'The initials, until you pick' }}
        </p>
      </div>
    </div>

    <div class="grid gap-2">
      <p class="text-[13.5px] font-semibold text-text-soft">
        Colour
      </p>
      <CompanionCoursesSwatches
        :subject="look"
        :compact="compact"
        @pick="color = $event"
      />
    </div>

    <div class="grid gap-2">
      <div class="flex items-center justify-between gap-3">
        <p class="text-[13.5px] font-semibold text-text-soft">
          Picture
        </p>
        <button
          v-if="icon"
          type="button"
          class="cursor-pointer rounded-[6px] text-[13px] font-medium text-text-muted underline-offset-4 hover:text-text hover:underline focus-visible:outline-2 focus-visible:outline-brand"
          @click="icon = null"
        >
          {{ picked.kind === 'image' ? 'Remove the picture' : 'From the name' }}
        </button>
      </div>
      <div
        :class="['grid grid-cols-8', compact ? 'gap-0.5' : 'gap-1']"
        role="radiogroup"
        aria-label="Picture"
      >
        <button
          v-for="choice in COURSE_ICONS"
          :key="choice.key"
          type="button"
          role="radio"
          :aria-checked="picked.kind === 'glyph' && picked.key === choice.key"
          :aria-label="choice.label"
          :title="choice.label"
          :class="[
            'grid aspect-square cursor-pointer place-items-center rounded-[10px] transition-[background-color,color,box-shadow] duration-150 focus-visible:outline-2 focus-visible:outline-brand',
            picked.kind === 'glyph' && picked.key === choice.key
              ? 'shadow-[inset_0_0_0_1.5px_currentColor]'
              : 'text-text-soft hover:bg-surface-sunken hover:text-text',
          ]"
          :style="picked.kind === 'glyph' && picked.key === choice.key ? { background: wash, color: ink } : undefined"
          @click="icon = choice.key"
        >
          <CompanionIcon
            :name="choice.key"
            :size="compact ? 17 : 19"
            :stroke="1.8"
          />
        </button>
      </div>
      <label class="mt-1 flex items-center gap-3 text-[13.5px] text-text-muted">
        Or an emoji
        <input
          v-model="emoji"
          type="text"
          inputmode="text"
          maxlength="16"
          placeholder="🐝"
          aria-label="An emoji for the cover"
          class="h-10 w-16 rounded-[10px] bg-surface-sunken text-center text-[20px] text-text outline-none placeholder:opacity-40 focus:shadow-[inset_0_0_0_2px_var(--brand)]"
          @input="typed"
        >
      </label>
      <div
        v-if="subjectId"
        class="flex flex-wrap items-center gap-3 text-[13.5px] text-text-muted"
      >
        Or a picture
        <UiBtn
          variant="secondary"
          size="sm"
          icon="upload"
          :loading="uploading"
          @click="fileInput?.click()"
        >
          {{ picked.kind === 'image' ? 'Upload another' : 'Upload an image' }}
        </UiBtn>
        <span class="text-[12.5px] text-text-faint">PNG, JPEG or WebP, up to {{ MAX_MB }} MB</span>
        <input
          ref="fileInput"
          type="file"
          :accept="IMAGE_TYPES"
          class="hidden"
          @change="upload"
        >
      </div>
    </div>
  </div>
</template>
