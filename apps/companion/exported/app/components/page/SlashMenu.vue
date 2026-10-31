<script setup lang="ts">
import type { MenuState } from '~/companion/doc/editor/menu'
import { SLASH_GROUPS, type SlashGroup, type SlashItem } from '~/companion/doc/editor/slash'

/**
 * The "/" menu, drawn two ways from one state: a floating list beside the
 * caret on desktop, and on the phone an "Insert" sheet resting on the
 * toolbar, with the learning blocks first because that's what a phone in a
 * lecture is for.
 */
const props = defineProps<{ state: MenuState<SlashItem>; phone: boolean; bottom?: number }>()

const PHONE_ORDER: SlashGroup[] = ['Learning', 'Basic', 'Media', 'Embeds']

/** Items grouped, each keeping its index in the flat list the keys move through. */
const groups = computed(() => {
  const order = props.phone && !props.state.query ? PHONE_ORDER : SLASH_GROUPS
  const indexed = props.state.items.map((item, index) => ({ item, index }))
  // While searching, best match first matters more than grouping.
  if (props.state.query) return [{ name: '', rows: indexed }]
  return order
    .map((name) => ({ name, rows: indexed.filter((row) => row.item.group === name) }))
    .filter((group) => group.rows.length)
})

const list = ref<HTMLElement | null>(null)

watch(
  () => props.state.index,
  () =>
    nextTick(() => {
      list.value?.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' })
    }),
)
</script>

<template>
  <template v-if="state.open">
    <PageFloating
      v-if="!phone"
      :rect="state.rect"
      label="Insert a block"
      @outside="state.close()"
    >
      <div
        ref="list"
        class="pg-menu"
      >
        <template v-if="state.items.length">
          <div
            v-for="group in groups"
            :key="group.name"
            class="pg-menu-group"
          >
            <span
              v-if="group.name"
              class="pg-menu-label"
            >{{ group.name }}</span>
            <button
              v-for="row in group.rows"
              :key="row.item.id"
              type="button"
              role="option"
              class="pg-menu-item"
              :class="{ 'is-active': row.index === state.index }"
              :aria-selected="row.index === state.index"
              @mouseenter="state.index = row.index"
              @click="state.choose(row.item)"
            >
              <i class="pg-menu-icon"><PageIcon
                :name="row.item.icon"
                :size="15"
              /></i>
              <span class="pg-menu-text">{{ row.item.label }}<small>{{ row.item.hint }}</small></span>
            </button>
          </div>
        </template>
        <p
          v-else
          class="pg-menu-empty"
        >
          No block called “{{ state.query }}”
        </p>
      </div>
    </PageFloating>

    <div
      v-else
      class="pg-slashsheet"
      :style="{ bottom: `${bottom ?? 0}px` }"
      role="listbox"
      aria-label="Insert a block"
      @mousedown.prevent
    >
      <div class="pg-slashsheet-head">
        <span class="pg-menu-label">Insert</span>
        <button
          type="button"
          class="pg-icon-btn"
          aria-label="Close"
          @click="state.close()"
        >
          <UiIcon
            name="x"
            :size="14"
          />
        </button>
      </div>
      <div
        ref="list"
        class="pg-slashsheet-list"
      >
        <template v-if="state.items.length">
          <div
            v-for="group in groups"
            :key="group.name"
            class="pg-menu-group"
          >
            <span
              v-if="group.name && group.name !== 'Learning'"
              class="pg-menu-label"
            >{{ group.name }}</span>
            <button
              v-for="row in group.rows"
              :key="row.item.id"
              type="button"
              role="option"
              class="pg-si"
              :class="{ 'is-active': row.index === state.index }"
              :aria-selected="row.index === state.index"
              @click="state.choose(row.item)"
            >
              <i><PageIcon
                :name="row.item.icon"
                :size="14"
              /></i>
              <span>{{ row.item.label }}<small>{{ row.item.hint }}</small></span>
            </button>
          </div>
        </template>
        <p
          v-else
          class="pg-menu-empty"
        >
          No block called “{{ state.query }}”
        </p>
      </div>
    </div>
  </template>
</template>
