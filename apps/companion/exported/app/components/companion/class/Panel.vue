<script setup lang="ts">
/**
 * A course's class (Daylight 2, landing 08 Together): who is in it, what they
 * added, and the one link to invite more. For a course of one's own it is a
 * single line and the Invite button, never an empty panel.
 *
 *   friends (up to 8)   each person's progress beside their name
 *   a class, as owner   the teacher's numbers: ready / getting there / not
 *                       started for the next assessment, and the topics
 *                       fewest have passed, counts only, from five people
 *   always              the feed: "Aziz added Seminar 5 reading.pdf", newest first
 *
 * Data from `companion/shares.ts` (the server copies what anyone adds into
 * everyone's course; this only reads the class). The host places it (the
 * course's home), and may restyle it; it reads tokens only.
 */
import type { Subject } from '~/companion/types'
import { membersLine, shareCourse, shareView, type CourseShareView, type ShareFace } from '~/companion/shares'
import { untilLabel } from '~/companion/time'

const props = defineProps<{ subject: Subject }>()

const { t } = useI18n()
const toast = useToast()
const view = ref<CourseShareView | null>(null)
const busy = ref(false)

const HUES = ['leaf', 'sky', 'apricot', 'lilac', 'rose', 'butter']
const faceStyle = (f: ShareFace) => ({
  background: `var(--${HUES[f.hue % 6]}-soft)`,
  color: `var(--${HUES[f.hue % 6]}-ink)`,
})

async function load(): Promise<void> {
  if (!props.subject.share_id) {
    view.value = null
    return
  }
  try {
    view.value = await shareView(props.subject.share_id)
  } catch {
    view.value = null
  }
}

watch(() => [props.subject.id, props.subject.share_id], () => void load(), { immediate: true })

async function invite(): Promise<void> {
  if (busy.value) return
  busy.value = true
  try {
    view.value = await shareCourse(props.subject.id)
    await navigator.clipboard?.writeText(view.value.url).catch(() => undefined)
    toast.success({
      title: t('shell.linkCopied', { url: view.value.url.replace(/^https?:\/\//, '') }),
      body: t('shell.linkCopiedBody'),
    })
  } catch {
    toast.error({ title: t('shell.linkFailed'), body: t('shell.checkConnection') })
  } finally {
    busy.value = false
  }
}

/**
 * Integrations: the link, straight into the class group chat. Telegram's and
 * WhatsApp's own share addresses open the app with the message ready to send.
 */
const sendTo = computed(() => {
  const url = view.value?.url
  if (!url) return []
  const text = t('shell.shareText', { title: props.subject.title })
  return [
    { name: 'Telegram', logo: 'telegram', href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}` },
    { name: 'WhatsApp', logo: 'whatsapp', href: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}` },
  ]
})

/** A centre's class this course belongs to (the share view says so since the institution edition). */
const klass = computed(() => (view.value as { group?: { id: string; name: string } | null } | null)?.group ?? null)
/** A student in a centre's class gets no link (the centre enrols people): no Invite then. */
const canInvite = computed(() => !klass.value || Boolean(view.value?.code))
const faces = computed(() => view.value?.members.slice(0, 5) ?? [])
const more = computed(() => Math.max(0, (view.value?.members_count ?? 0) - faces.value.length))
const tally = computed(() => {
  const k = view.value?.class
  if (!k?.deadline) return null
  const total = Math.max(1, k.ready + k.getting_there + k.not_started)
  return {
    line: t('shell.tally', { ready: k.ready, of: k.of, title: k.deadline.title }),
    parts: [
      { label: t('shell.ready'), n: k.ready, cls: 'bg-success' },
      { label: t('shell.gettingThere'), n: k.getting_there, cls: 'bg-warn' },
      { label: t('shell.notStarted'), n: k.not_started, cls: 'bg-surface-track' },
    ].map((p) => ({ ...p, width: `${(p.n / total) * 100}%` })),
  }
})
</script>

<template>
  <section class="rounded-[18px] bg-surface p-5 shadow-card ring-1 ring-border">
    <div class="flex items-center gap-3">
      <div class="min-w-0 flex-1">
        <h2 class="text-[15px] font-semibold text-text">
          {{ view ? membersLine(view) : t('shell.classStudy') }}
        </h2>
        <p
          v-if="!view"
          class="mt-0.5 text-[13.5px] text-text-soft"
        >
          {{ t('shell.classHint') }}
        </p>
      </div>
      <div
        v-if="faces.length > 1"
        class="flex -space-x-1.5"
        aria-hidden="true"
      >
        <span
          v-for="f in faces"
          :key="f.initials + f.name"
          class="grid size-7 place-items-center rounded-full text-[11px] font-semibold ring-2 ring-surface"
          :style="faceStyle(f)"
        >{{ f.initials }}</span>
        <span
          v-if="more"
          class="grid h-7 place-items-center rounded-full bg-surface-sunken px-2 text-[11px] font-semibold text-text-soft ring-2 ring-surface"
        >+{{ more }}</span>
      </div>
      <UiBtn
        v-if="canInvite"
        variant="primary"
        size="sm"
        icon="users"
        class="shrink-0"
        :loading="busy"
        @click="invite"
      >
        {{ t('shell.invite') }}
      </UiBtn>
    </div>

    <p
      v-if="sendTo.length"
      class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13.5px] text-text-muted"
    >
      {{ t('shell.sendGroup') }}
      <a
        v-for="app in sendTo"
        :key="app.name"
        :href="app.href"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1.5 font-semibold text-text-soft hover:text-text hover:underline"
      >
        <LandingD2Logo
          :n="app.logo"
          :s="14"
        />
        {{ app.name }}
      </a>
    </p>

    <NuxtLink
      v-if="klass"
      :to="`/app/class/${klass.id}`"
      class="mt-3 inline-flex items-center gap-1 text-[14px] font-semibold text-brand hover:underline hover:underline-offset-4"
    >
      {{ t('shell.openClass', { name: klass.name }) }}
      <UiIcon
        name="chevron-right"
        :size="15"
      />
    </NuxtLink>

    <!-- The owner's numbers, from five people up. -->
    <div
      v-if="tally && view?.class"
      class="mt-4 border-t border-border pt-4"
    >
      <p class="text-[14px] text-text">
        {{ tally.line }}
      </p>
      <div
        class="mt-2 flex h-2 overflow-hidden rounded-full bg-surface-sunken"
        role="img"
        :aria-label="tally.parts.map((p) => `${p.n} ${p.label.toLowerCase()}`).join(', ')"
      >
        <span
          v-for="p in tally.parts"
          :key="p.label"
          :class="p.cls"
          :style="{ width: p.width }"
        />
      </div>
      <ul class="mt-3 grid gap-1.5">
        <li
          v-for="topic in view.class.topics"
          :key="topic.topic_id"
          class="flex items-baseline justify-between gap-3 text-[13.5px]"
        >
          <span class="truncate text-text-body">{{ topic.title }}</span>
          <span class="shrink-0 text-text-soft">{{ t('shell.passedCheck', { n: topic.passed, of: view.class.of }) }}</span>
        </li>
      </ul>
      <p class="mt-2 text-[12.5px] text-text-faint">
        {{ t('shell.numbersOnly') }}
      </p>
    </div>

    <!-- Friends: each one's progress. -->
    <ul
      v-else-if="view?.friends && view.members.some((m) => m.progress !== null)"
      class="mt-4 grid gap-2 border-t border-border pt-4"
    >
      <li
        v-for="m in view.members"
        :key="m.initials + m.name"
        class="flex items-center gap-3 text-[13.5px]"
      >
        <span
          class="grid size-6 place-items-center rounded-full text-[10.5px] font-semibold"
          :style="faceStyle(m)"
        >{{ m.initials }}</span>
        <span class="w-16 truncate text-text-body">{{ m.you ? t('shell.you') : m.name }}</span>
        <span class="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken">
          <span
            class="block h-full rounded-full bg-brand"
            :style="{ width: `${m.progress ?? 0}%` }"
          />
        </span>
        <span class="w-10 text-right text-text-soft tabular-nums">{{ m.progress ?? '–' }}{{ m.progress !== null ? '%' : '' }}</span>
      </li>
    </ul>

    <ol
      v-if="view?.feed.length"
      class="mt-4 grid gap-3 border-t border-border pt-4"
    >
      <li
        v-for="e in view.feed.slice(0, 6)"
        :key="e.id"
        class="flex items-start gap-3"
      >
        <span
          class="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold"
          :style="faceStyle(e.who)"
          aria-hidden="true"
        >{{ e.who.initials }}</span>
        <div class="min-w-0">
          <p class="text-[14px] leading-snug text-text">
            {{ e.title }}
          </p>
          <p class="mt-0.5 text-[12.5px] text-text-soft">
            {{ [e.detail, untilLabel(e.at)].filter(Boolean).join(' · ') }}
          </p>
        </div>
      </li>
    </ol>
  </section>
</template>
