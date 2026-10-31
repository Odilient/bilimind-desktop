<script setup lang="ts">
/**
 * Choose a page to put on the board as a card. This course's pages first,
 * then the rest; a search box once there are enough to need one. Laid out as
 * the app lays out any list: a heading, one sentence on what happens, then
 * rows between hairlines, each the page's name over its first line.
 */
import type { Item } from '~/companion/types'

const props = defineProps<{ pages: Item[]; subjectTitle: string | null }>()
const emit = defineEmits<{ pick: [item: Item]; close: [] }>()

const q = ref('')
const list = computed(() => {
  const term = q.value.trim().toLowerCase()
  return props.pages.filter((p) => !term || p.title.toLowerCase().includes(term) || (p.preview ?? '').toLowerCase().includes(term))
})

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div
    class="pp-scrim"
    @pointerdown.self="emit('close')"
  >
    <div
      class="pp"
      role="dialog"
      aria-labelledby="pp-title"
    >
      <header class="flex items-start justify-between gap-3">
        <div class="grid gap-1">
          <h2
            id="pp-title"
            class="t-head text-[19px]"
          >
            Put a page on the board
          </h2>
          <p class="text-[14px] text-text-muted">
            It sits here as a card you can open.
          </p>
        </div>
        <button
          type="button"
          class="-mt-1 -mr-1 grid size-9 shrink-0 place-items-center rounded-full text-text-faint hover:bg-surface-mute hover:text-text"
          aria-label="Close"
          @click="emit('close')"
        >
          <BoardIcon
            name="close"
            :size="16"
          />
        </button>
      </header>
      <input
        v-if="pages.length > 6"
        v-model="q"
        class="pp-search"
        placeholder="Find a page"
        aria-label="Find a page"
        autofocus
      >
      <ul
        v-if="list.length"
        class="pp-list"
      >
        <li
          v-for="p in list"
          :key="p.id"
        >
          <button
            type="button"
            class="pp-item"
            @click="emit('pick', p)"
          >
            <BoardIcon
              name="doc"
              :size="18"
              class="mt-0.5 shrink-0 text-text-muted"
            />
            <span class="min-w-0 flex-1">
              <b>{{ p.title || 'Untitled page' }}</b>
              <small v-if="p.preview">{{ p.preview }}</small>
            </span>
          </button>
        </li>
      </ul>
      <p
        v-else
        class="text-[14px] text-text-muted"
      >
        {{ q ? 'No page matches.' : subjectTitle ? `No pages in ${subjectTitle} yet. Write one, and it can sit on this board.` : 'No pages yet. Write one, and it can sit on this board.' }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.pp-scrim { position: absolute; inset: 0; z-index: 20; display: grid; place-items: center; background: rgb(11 13 16 / 0.18); padding: 16px; }
.pp {
  width: min(480px, 100%); max-height: min(600px, 80dvh); display: grid; grid-template-rows: auto auto 1fr; gap: 14px;
  padding: 18px 18px 12px 20px; background: var(--surface); border-radius: 18px; box-shadow: var(--shadow-pop);
}
.pp-search { height: 44px; border: 1px solid var(--border-field); border-radius: 12px; padding: 0 12px; font-size: 15px; }
.pp-list {
  overflow: auto; margin: 0; padding: 0; list-style: none;
  border-top: 1px solid var(--border-rule); border-bottom: 1px solid var(--border-rule);
}
.pp-list > li + li { border-top: 1px solid var(--border-rule); }
.pp-item { width: 100%; min-height: 56px; display: flex; gap: 12px; align-items: flex-start; text-align: left; padding: 10px 8px; border-radius: 10px; }
.pp-item:hover { background: var(--surface-mute); }
.pp-item b { display: block; font-size: 15px; font-weight: 600; }
.pp-item small { display: block; font-size: 13.5px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
