<script setup lang="ts">
import type { MenuState } from '~/companion/doc/editor/menu'
import type { MentionItem } from '~/companion/doc/editor/mention'

/** The "@" list: this course's deadlines and topics, and the next few days. */
defineProps<{ state: MenuState<MentionItem> }>()

const ICONS: Record<MentionItem['kind'], string> = { deadline: 'flag', topic: 'book', date: 'calendar' }
</script>

<template>
  <PageFloating
    v-if="state.open"
    :rect="state.rect"
    label="Mention"
    @outside="state.close()"
  >
    <div class="pg-menu is-narrow">
      <template v-if="state.items.length">
        <button
          v-for="(item, index) in state.items"
          :key="`${item.kind}:${item.id}`"
          type="button"
          role="option"
          class="pg-menu-item"
          :class="{ 'is-active': index === state.index }"
          :aria-selected="index === state.index"
          @mouseenter="state.index = index"
          @click="state.choose(item)"
        >
          <i class="pg-menu-icon"><PageIcon
            :name="ICONS[item.kind]"
            :size="14"
          /></i>
          <span class="pg-menu-text">{{ item.label }}<small>{{ item.hint }}</small></span>
        </button>
      </template>
      <p
        v-else
        class="pg-menu-empty"
      >
        Nothing called “{{ state.query }}” in this course
      </p>
    </div>
  </PageFloating>
</template>
