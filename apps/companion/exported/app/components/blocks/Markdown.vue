<script setup lang="ts">
import type { MdToken } from '~/composables/useMarkdown'

/**
 * Renders the token stream produced by `useMarkdown`. Every `v-html` here is
 * output the composable escaped and built itself — the source string never
 * reaches the DOM as markup.
 */
const props = withDefaults(
  defineProps<{
    source?: string | null
    /** Pre-parsed tokens (used when this component recurses into a blockquote). */
    tokens?: MdToken[]
    size?: 'sm' | 'md'
  }>(),
  { size: 'md' },
)

// Named explicitly so the blockquote branch can recurse into this component.
defineOptions({ name: 'BlocksMarkdown' })

const { parse } = useMarkdown()

const items = computed<MdToken[]>(() => props.tokens ?? parse(props.source ?? ''))

const headingClass: Record<number, string> = {
  1: 'mt-7 font-display text-[21px] font-semibold tracking-[-0.025em]',
  2: 'mt-6 font-display text-[18px] font-semibold tracking-[-0.02em]',
  3: 'mt-5 font-display text-[15.5px] font-semibold tracking-[-0.015em]',
  4: 'mt-5 text-[13.5px] font-semibold',
  5: 'mt-4 text-[13px] font-semibold text-text-muted',
  6: 'mt-4 text-[12.5px] font-semibold text-text-muted',
}

const alignClass = { left: 'text-left', center: 'text-center', right: 'text-right' } as const
</script>

<template>
  <!--
    15.5px at 1.72 is the reading size for generated prose. It is larger than a
    typical app body size on purpose: this is the one place in the product
    someone reads for forty-five minutes at a stretch.
  -->
  <div
    :class="[
      'md flex flex-col',
      size === 'sm' ? 'gap-2.5 text-[13px]' : 'gap-3.5 text-[15.5px]',
    ]"
  >
    <template
      v-for="(token, index) in items"
      :key="index"
    >
      <component
        :is="`h${token.level}`"
        v-if="token.kind === 'heading'"
        :class="[headingClass[token.level], index === 0 && 'mt-0']"
        v-html="token.html"
      />

      <p
        v-else-if="token.kind === 'paragraph'"
        class="leading-[1.72] text-text-body"
        v-html="token.html"
      />

      <component
        :is="token.ordered ? 'ol' : 'ul'"
        v-else-if="token.kind === 'list'"
        :start="token.ordered ? token.start : undefined"
        class="flex flex-col gap-1.5"
      >
        <li
          v-for="(item, i) in token.items"
          :key="i"
          class="relative pl-5 leading-[1.7] text-text-body"
          :style="{ marginLeft: `${item.depth * 1.1}rem` }"
        >
          <span
            v-if="token.ordered"
            class="num absolute left-0 text-[12px] text-text-faint"
            >{{ token.start + i }}.</span
          >
          <span
            v-else
            class="absolute left-1 top-[0.62em] size-1.5 rounded-full bg-lime-2"
          />
          <span v-html="item.html" />
        </li>
      </component>

      <BlocksCodeSnippet
        v-else-if="token.kind === 'code'"
        :code="token.code"
        :language="token.language"
      />

      <blockquote
        v-else-if="token.kind === 'quote'"
        class="border-l-2 border-brand-line pl-4 text-text-soft italic"
      >
        <BlocksMarkdown
          :tokens="token.tokens"
          :size="size"
        />
      </blockquote>

      <hr
        v-else-if="token.kind === 'rule'"
        class="border-t border-border"
      >

      <!--
        Header cells wrap. They used to be `whitespace-nowrap`, which on a phone
        guarantees a sideways scroll for any three-column generated table — and
        a wrapped header is the cheaper of the two costs.
      -->
      <div
        v-else-if="token.kind === 'table'"
        class="overflow-x-auto rounded-[14px] border border-border"
      >
        <table class="w-full border-collapse text-[13px]">
          <thead>
            <tr class="bg-surface-mute">
              <th
                v-for="(cell, i) in token.head"
                :key="i"
                :class="[
                  'border-b border-border px-3 py-2.5 text-[11px] font-semibold tracking-[0.06em] text-text-faint uppercase',
                  alignClass[token.align[i] ?? 'left'],
                ]"
                v-html="cell"
              />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, r) in token.rows"
              :key="r"
              class="border-t border-border first:border-t-0"
            >
              <td
                v-for="(cell, c) in row"
                :key="c"
                :class="['px-3 py-2.5 align-top text-text-body', alignClass[token.align[c] ?? 'left']]"
                v-html="cell"
              />
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* Links are cobalt: lime is a fill, and lime type on white is a decoration. */
.md :deep(a) {
  color: var(--brand);
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 3px;
  text-decoration-color: var(--brand-line);
}

.md :deep(a:hover) {
  text-decoration-color: var(--brand);
}

/* No border: an outlined chip every few words turns a paragraph into a fence. */
.md :deep(code) {
  font-family: var(--font-mono);
  font-size: 0.87em;
  padding: 1px 6px;
  border-radius: var(--radius-xs);
  background: var(--surface-sunken);
  color: var(--text);
  word-break: break-word;
}

.md :deep(strong) {
  color: var(--text);
  font-weight: 600;
}

.md :deep(em) {
  font-style: italic;
}

.md :deep(del) {
  text-decoration: line-through;
  color: var(--text-faint);
}
</style>
