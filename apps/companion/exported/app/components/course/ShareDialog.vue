<script setup lang="ts">
import type { Course, CourseVisibility } from '~/types/api'
import type { Organization } from '~/composables/useAuth'
import { toApiError } from '~/composables/useApi'

/**
 * Who can open this course — the owner's one sharing control.
 *
 * "Share" used to mean exactly one thing: publish to the world and copy the
 * link. That is still here, as the last of three choices, because it is the
 * right answer for somebody showing a friend. But a teacher handing a course to
 * their class must not have to publish their centre's curriculum to do it, so
 * the middle choice — the organisation — is the one that reaches students and
 * nobody else: no catalogue, no search engines, no answer keys either way.
 *
 * A choice applies when it is pressed; the dialog then offers the link, which
 * is the course's own address in every case. What changes is who it opens for.
 */
const props = defineProps<{ course: Course }>()
const emit = defineEmits<{ changed: [] }>()

const open = defineModel<boolean>('open', { default: false })

const api = useApi()
const toast = useToast()
const origin = useSiteOrigin()

/** Organisations this account teaches in — the only ones it may share with. */
const teaching = ref<Organization[]>([])
const loadingOrgs = ref(false)

watch(open, async (isOpen) => {
  if (!isOpen || teaching.value.length > 0) return
  loadingOrgs.value = true
  try {
    const all = await api.get<Organization[]>('/organizations')
    teaching.value = all.filter(
      (org) => org.type !== 'individual' && ['owner', 'admin', 'instructor'].includes(String(org.role)),
    )
  } catch {
    teaching.value = []
  } finally {
    loadingOrgs.value = false
  }
})

const current = computed<CourseVisibility>(() => props.course.visibility ?? (props.course.is_public ? 'public' : 'private'))
const working = ref<string | null>(null)

interface Choice {
  key: string
  visibility: CourseVisibility
  organizationId?: number
  icon: string
  title: string
  body: string
}

const choices = computed<Choice[]>(() => [
  {
    key: 'private',
    visibility: 'private',
    icon: 'lock',
    title: 'Only you',
    body: 'Nobody else can open it.',
  },
  ...teaching.value.map((org) => ({
    key: `org-${org.id}`,
    visibility: 'organization' as const,
    organizationId: org.id,
    icon: 'users',
    title: org.name,
    body: `Everyone in ${org.name} can open it, work through it and take its quizzes. Their progress shows in your report. It is never published.`,
  })),
  {
    key: 'public',
    visibility: 'public',
    icon: 'globe',
    title: 'Anyone with the link',
    body: 'Published: readable without an account, and listed on Explore once a few lessons are written. Never the answer keys, progress or your uploaded files.',
  },
])

function isSelected(choice: Choice): boolean {
  if (choice.visibility !== current.value) return false
  if (choice.visibility !== 'organization') return true
  return choice.organizationId === props.course.organization?.id
}

async function choose(choice: Choice): Promise<void> {
  if (working.value || isSelected(choice)) return
  working.value = choice.key
  try {
    await api.put(`/courses/${props.course.id}/visibility`, {
      visibility: choice.visibility,
      ...(choice.organizationId ? { organization_id: choice.organizationId } : {}),
    })
    emit('changed')
    toast.success(
      choice.visibility === 'private'
        ? 'Only you can open it now.'
        : choice.visibility === 'organization'
          ? `Shared with ${choice.title}.`
          : 'Published. Anyone with the link can read it.',
    )
  } catch (raw) {
    toast.error(toApiError(raw).message || "That couldn't be changed.")
  } finally {
    working.value = null
  }
}

const link = computed(() => (props.course.path ? `${origin}${props.course.path}` : null))

async function copy(): Promise<void> {
  if (!link.value || !import.meta.client) return
  try {
    await navigator.clipboard.writeText(link.value)
    toast.success(
      current.value === 'organization'
        ? `Link copied. It opens for members of ${props.course.organization?.name ?? 'your organisation'}.`
        : 'Link copied.',
    )
  } catch {
    toast.error(`Couldn't copy. The link is ${link.value}`)
  }
}
</script>

<template>
  <UiModal
    v-model:open="open"
    title="Who can open this course"
    size="compact"
  >
    <div
      class="flex flex-col gap-2"
      role="radiogroup"
      aria-label="Who can open this course"
    >
      <button
        v-for="choice in choices"
        :key="choice.key"
        type="button"
        role="radio"
        :aria-checked="isSelected(choice)"
        :disabled="working !== null"
        :class="[
          'flex w-full cursor-pointer items-start gap-3 rounded-[16px] p-3.5 text-left transition-colors disabled:cursor-default',
          isSelected(choice)
            ? 'bg-accent-soft shadow-[inset_0_0_0_1.5px_var(--accent-line)]'
            : 'bg-surface shadow-[inset_0_0_0_1px_var(--border)] hover:bg-surface-mute',
        ]"
        @click="choose(choice)"
      >
        <span
          :class="[
            'grid size-8 shrink-0 place-items-center rounded-full',
            isSelected(choice) ? 'bg-surface text-accent-strong' : 'bg-surface-sunken text-text-soft',
          ]"
        >
          <UiIcon
            :name="working === choice.key ? 'loader' : choice.icon"
            :size="15"
            :class="working === choice.key && 'animate-spin-slow'"
          />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block text-[13.5px] font-semibold text-text">{{ choice.title }}</span>
          <span class="mt-0.5 block text-[12.5px] leading-relaxed text-text-muted">{{ choice.body }}</span>
        </span>
        <UiIcon
          v-if="isSelected(choice)"
          name="check"
          :size="16"
          class="mt-1.5 shrink-0 text-accent-strong"
        />
      </button>

      <NuxtLink
        v-if="course.can_report && current === 'organization'"
        :to="`/reports/${course.uuid}`"
        class="mt-1 flex items-center gap-2 rounded-[14px] bg-surface-mute px-3.5 py-3 text-[12.5px] font-medium text-text-soft shadow-[inset_0_0_0_1px_var(--border)] hover:text-text"
        @click="open = false"
      >
        <UiIcon
          name="users"
          :size="15"
          class="text-brand"
        />
        <span class="flex-1">See how {{ course.organization?.name ?? 'your class' }} is doing</span>
        <UiIcon
          name="chevron-right"
          :size="15"
          class="text-text-faint"
        />
      </NuxtLink>

      <p
        v-if="!loadingOrgs && teaching.length === 0"
        class="px-1 pt-1 text-[12px] leading-relaxed text-text-faint"
      >
        Teach at a learning centre? Once you're a teacher in its organisation on BiliMind, you
        can share a course with its students here without publishing it.
      </p>
    </div>

    <template #footer>
      <UiBtn
        variant="ghost"
        @click="open = false"
      >
        Done
      </UiBtn>
      <UiBtn
        variant="primary"
        icon="link"
        :disabled="current === 'private' || !link"
        @click="copy"
      >
        Copy link
      </UiBtn>
    </template>
  </UiModal>
</template>
