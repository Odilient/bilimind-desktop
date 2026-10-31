<script setup lang="ts">
/**
 * The board's AI, as in the mockup's "Mapped Lectures 6–7" popover: one
 * thing it does now (map the course's topics onto the board, every node
 * naming its lecture or slide), and an Undo that takes the whole map back.
 * It says that one thing as its title ("Map the topics", the same name the
 * toolbar gives it) rather than promising a chat, then one sentence and the
 * buttons: lime for the map it will most likely want, the other secondary.
 *
 * In demo mode the map is built from the course's own rows (see board/ai.ts).
 * Against the API it asks `POST /items/{id}/map`, which isn't built yet; a
 * 404 shows "coming soon" rather than an error.
 */
import type { BoardController } from '~/companion/board/controller'
import type { BoardContext } from '~/companion/board/context'
import { planTopicMap, requestServerMap } from '~/companion/board/ai'
import type { MapPlan } from '~/companion/board/ops'
import { objectRect, union } from '~/companion/board/geometry'
import { subtreeIds } from '~/companion/board/mindmap'
import { mindNodes } from '~/companion/board/ops'
import { useQuietAi } from '~/companion/quiet-ai'

const props = defineProps<{
  ctl: BoardController
  itemId: string
  demo: boolean
  context: () => BoardContext
  phone: boolean
}>()
const emit = defineEmits<{ close: [] }>()

// Quiet AI: no AI on the board at all, even if something asked for the popover.
const { quiet } = useQuietAi()
watch(quiet, (on) => on && emit('close'), { immediate: true })

type State =
  | { k: 'menu' }
  | { k: 'working' }
  | { k: 'done'; plan: MapPlan; rootId: string; added: number }
  | { k: 'soon' }
  | { k: 'empty'; why: string }
  | { k: 'error'; message: string }

const state = ref<State>({ k: 'menu' })
const ctx = computed(() => props.context())

async function map(scope: 'course' | 'deadline') {
  state.value = { k: 'working' }
  let plan: MapPlan | null = null
  if (props.demo) {
    // A beat, so the map reads as made rather than pasted.
    await new Promise((r) => setTimeout(r, 450))
    plan = planTopicMap(ctx.value, scope)
    if (!plan) {
      state.value = { k: 'empty', why: 'No lectures have happened in this course yet, so there is nothing to map.' }
      return
    }
  } else {
    const res = await requestServerMap(props.itemId, scope)
    if (res.kind === 'soon') return void (state.value = { k: 'soon' })
    if (res.kind === 'error') return void (state.value = { k: 'error', message: res.message })
    plan = res.plan
  }
  const { rootId, added } = props.ctl.applyMapPlan(plan, null)
  state.value = { k: 'done', plan, rootId, added }
  show(rootId)
}

/** Frame the tree that was just mapped. */
function show(rootId: string) {
  requestAnimationFrame(() => {
    const ids = subtreeIds(mindNodes(props.ctl.parts), rootId)
    const r = union(ids.map((id) => props.ctl.get(id)).filter((o) => !!o).map((o) => objectRect(o!)))
    const root = props.ctl.get(rootId)
    if (!r || !root) return
    if (props.phone) props.ctl.showReadable(r, { x: root.x + root.w / 2, y: root.y + root.h / 2 }, 0.6, { top: 70, right: 16, bottom: 250, left: 16 }, true)
    else props.ctl.animateTo(props.ctl.fitRect(r, { top: 80, right: 60, bottom: 180, left: 90 }, 1.1), 480)
  })
}

function undo() {
  props.ctl.undo()
  state.value = { k: 'menu' }
}
</script>

<template>
  <div
    v-if="!quiet"
    class="aipop"
    :class="{ 'aipop--phone': phone }"
    role="dialog"
    aria-label="Map the topics"
    @pointerdown.stop
  >
    <div class="t">
      <BoardIcon
        name="spark"
        :size="16"
      />
      <template v-if="state.k === 'done'">
        {{ state.plan.title }}
      </template>
      <template v-else>
        Map the topics
      </template>
      <button
        type="button"
        class="x"
        aria-label="Close"
        @click="emit('close')"
      >
        <BoardIcon
          name="close"
          :size="16"
        />
      </button>
    </div>

    <template v-if="state.k === 'menu'">
      <p class="m">
        <template v-if="ctx.subject">
          Lays out what {{ ctx.subject.title }} has covered so far as a mind map on this board. Every idea
          names the lecture or slide it came from, and Undo takes it all back.
        </template>
        <template v-else>
          This board isn't in a course, so there are no lectures to map. A board made from a course can map
          its topics.
        </template>
      </p>
      <div
        v-if="ctx.subject"
        class="btns"
      >
        <UiBtn
          v-if="ctx.deadline"
          size="sm"
          variant="accent"
          data-act="map-deadline"
          @click="map('deadline')"
        >
          Map {{ ctx.deadline.title }}'s topics
        </UiBtn>
        <UiBtn
          size="sm"
          :variant="ctx.deadline ? 'secondary' : 'accent'"
          data-act="map-course"
          @click="map('course')"
        >
          Map this course's topics
        </UiBtn>
      </div>
    </template>

    <p
      v-else-if="state.k === 'working'"
      class="m"
    >
      Reading the lectures…
    </p>

    <template v-else-if="state.k === 'done'">
      <p class="m">
        {{ state.plan.summary }}
        <template v-if="state.added === 0">
          It was all on the board already.
        </template>
      </p>
      <div class="btns">
        <UiBtn
          size="sm"
          variant="primary"
          @click="show(state.rootId)"
        >
          Show the map
        </UiBtn>
        <UiBtn
          v-if="state.added"
          size="sm"
          data-act="undo-map"
          @click="undo"
        >
          Undo
        </UiBtn>
      </div>
    </template>

    <p
      v-else-if="state.k === 'soon'"
      class="m"
    >
      Mapping from your slides and recordings is coming soon. It will link every idea to its slide or the second it was said.
    </p>
    <p
      v-else-if="state.k === 'empty'"
      class="m"
    >
      {{ state.why }}
    </p>
    <p
      v-else
      class="m text-danger"
    >
      {{ state.message }}
    </p>
  </div>
</template>

<style scoped>
.aipop {
  position: absolute; left: 66px; bottom: 60px; z-index: 7; width: 380px;
  display: grid; gap: 10px; padding: 14px 14px 14px 16px;
  background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
  box-shadow: 0 18px 36px -16px rgb(13 22 96 / 0.45); font-size: 14px;
}
.aipop--phone { left: 10px; right: 10px; width: auto; bottom: calc(74px + env(safe-area-inset-bottom)); }
.t {
  display: flex; gap: 8px; align-items: center;
  font-family: var(--font-display); font-weight: 600; font-size: 17px; letter-spacing: -0.015em;
}
.t > svg { color: var(--cobalt); }
.x {
  margin: -6px -6px 0 auto; width: 36px; height: 36px; border-radius: 999px;
  display: grid; place-items: center; color: var(--text-faint);
}
.x:hover { background: var(--surface-mute); color: var(--text); }
.m { color: var(--text-soft); line-height: 1.5; margin: 0; }
.btns { display: flex; flex-wrap: wrap; gap: 8px; }
</style>
