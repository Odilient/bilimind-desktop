<script setup lang="ts">
import { useCompanion } from '~/companion/store'
import { EMPTY_CONTEXT, loadContext, type PageContext } from '~/companion/doc/context'
import { makePage } from '~/companion/notes/make'
import { TEMPLATES, isTemplateKey, templateTitle, type TemplateInfo, type TemplateKey } from '~/companion/doc/templates'
import { courseColor } from '~/companion/colors'
import '~/components/page/page.css'

/**
 * A new page. `?subject_id=&session_id=&topic_id=&parent_id=` say where it
 * lives, because the link that came here named it (a class's "Take notes");
 * left out, it goes to My notes, with the class on now kept only as its
 * "Add to …?" suggestion. `?template=` is what shape it starts in. With
 * a template, the page is made at once (`makePage`: an id made here, so it
 * works offline) and the route is replaced by the page itself in Notes
 * (`/app/notes/<id>`), so Back doesn't make another.
 *
 * Without one, this is a short screen in the page's own language: the way
 * back to the course on top, a heading that says where the page will go, one
 * sentence, and the starting shapes as a list of rows. Each row says what
 * the page starts with, and the name it will get when that name comes from
 * this class (the lab that's due, the lecture it's for).
 */
definePageMeta({ layout: 'companion' })

const route = useRoute()
const router = useRouter()
const store = useCompanion()
const toast = useToast()

const ctx = ref<PageContext>(EMPTY_CONTEXT)
const ready = ref(false)
const making = ref(false)

function q(name: string): string | null {
  const value = route.query[name]
  const one = Array.isArray(value) ? value[0] : value
  return typeof one === 'string' && one ? one : null
}

/** Said in the address; else My notes. */
const said = computed(() => Boolean(q('subject_id') || q('session_id') || q('parent_id')))

async function make(template: TemplateKey): Promise<void> {
  if (making.value) return
  making.value = true
  try {
    const id = await makePage({
      subjectId: said.value ? (ctx.value.subject?.id ?? q('subject_id')) : null,
      sessionId: said.value ? (ctx.value.session?.id ?? null) : null,
      topicId: said.value ? (ctx.value.topic?.id ?? null) : null,
      parentId: q('parent_id'),
      template,
    })
    await router.replace(`/app/notes/${id}`)
  } catch {
    making.value = false
    toast.error({ title: "Couldn't make the page", body: 'Check the connection and try again.' })
  }
}

onMounted(async () => {
  await store.load()
  ctx.value = await loadContext({
    subject_id: q('subject_id'),
    session_id: q('session_id'),
    topic_id: q('topic_id'),
  }).catch(() => EMPTY_CONTEXT)
  ready.value = true
  const template = q('template')
  if (isTemplateKey(template)) await make(template)
})

const where = computed(() => {
  const parts = [ctx.value.subject?.title ?? 'My notes']
  if (ctx.value.session) parts.push(ctx.value.session.title)
  if (ctx.value.topic) parts.push(ctx.value.topic.title)
  return parts.join(' · ')
})

const back = computed(() =>
  ctx.value.subject
    ? { to: `/app/courses/${ctx.value.subject.id}`, label: ctx.value.subject.title }
    : { to: '/app/notes', label: 'Notes' },
)

/** The name a template's page gets, when it says more than the template's own name. */
function named(t: TemplateInfo): string | null {
  const title = templateTitle(t.key, ctx.value)
  return title && !t.label.startsWith(title) ? title : null
}

useHead({ title: 'New page · BiliMind' })
</script>

<template>
  <div class="pg-route">
    <ClientOnly>
      <div
        v-if="!ready || making || isTemplateKey(q('template'))"
        class="pg-route-skeleton"
        aria-busy="true"
        aria-label="Making the page"
      >
        <span class="pg-skel is-crumbs" />
        <span class="pg-skel is-title" />
        <span class="pg-skel is-props" />
      </div>
      <section
        v-else
        class="pg-new"
        aria-labelledby="pg-new-title"
      >
        <NuxtLink
          :to="back.to"
          class="pg-back"
          :aria-label="`Back to ${back.label}`"
        >
          <UiIcon
            name="chevron-left"
            :size="18"
          />
          <i
            v-if="ctx.subject"
            class="pg-dot"
            :style="{ background: courseColor(ctx.subject.color) }"
          />
          <span class="pg-back-label">{{ back.label }}</span>
        </NuxtLink>
        <h1
          id="pg-new-title"
          class="t-head"
        >
          New page
        </h1>
        <p class="pg-new-lead">
          It goes in {{ where }}. Pick how it starts; you can change anything in it after.
        </p>
        <ul class="pg-new-list">
          <li
            v-for="t in TEMPLATES"
            :key="t.key"
          >
            <button
              type="button"
              class="pg-new-row"
              @click="make(t.key)"
            >
              <PageIcon
                :name="t.icon"
                :size="20"
              />
              <span class="pg-new-text">
                <span class="pg-new-label">{{ t.label }}</span>
                <span class="pg-new-hint">{{ t.hint }}<template v-if="named(t)"> · named “{{ named(t) }}”</template></span>
              </span>
              <UiIcon
                name="chevron-right"
                :size="18"
                class="pg-new-go"
              />
            </button>
          </li>
        </ul>
      </section>
    </ClientOnly>
  </div>
</template>
