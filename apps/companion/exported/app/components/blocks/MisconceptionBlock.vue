<script setup lang="ts">
import type { MisconceptionBlock } from '~/types/api'
import BlockShell from './BlockShell.vue'
import Markdown from './Markdown.vue'

/**
 * EXPAND — the wrong thing learners actually arrive believing, and the argument
 * against it.
 *
 * The order and the weight here are the entire content of this component, and
 * they are the opposite of the obvious layout. A refutation in which the
 * misconception is the loud half TEACHES the misconception: a skimmer reads the
 * bold quoted claim, retains it, and leaves more confident in the wrong thing
 * than they arrived. So the belief is set as reported speech — quiet, ruled off
 * to the side, clearly somebody else's voice — and the correction is the only
 * thing in the block with any weight at all.
 *
 * `why_it_seems_right` is required by the server for the same reason
 * `breaks_down_when` is required of an analogy: a refutation without the grain
 * of truth in it is a strawman, and nobody has ever changed their mind against
 * a strawman. It sits between the belief and the correction because that is the
 * order the argument has to be read in — first what you think, then why that was
 * reasonable, and only then what is actually the case.
 *
 * No outer box. `misconception` presents as an aside on a hairline, and a boxed
 * aside stops being a change of voice inside the lesson and becomes a separate
 * document sitting in the middle of it.
 */
defineProps<{ block: MisconceptionBlock }>()
</script>

<template>
  <BlockShell
    :type="block.type"
    :source-material-ids="block.source_material_ids"
  >
    <!-- Reported speech, and marked as such. The rule and the quotes are doing
         the work an "Incorrect:" label would otherwise do, without giving the
         wrong claim a heading of its own. -->
    <p
      v-if="block.payload?.belief"
      class="border-l-2 border-border-strong pl-4 text-[16px] leading-relaxed text-text-soft italic"
    >
      “{{ block.payload.belief }}”
    </p>

    <p
      v-if="block.payload?.why_it_seems_right"
      class="mt-3 text-[14.5px] leading-relaxed text-text-soft"
    >
      {{ block.payload.why_it_seems_right }}
    </p>

    <!-- The one loud thing in the block, at the lesson's own reading size. It is
         set larger than the belief on purpose: whichever of the two survives
         skimming is the one the learner keeps. -->
    <div
      v-if="block.payload?.what_is_true"
      class="mt-4 flex gap-3.5 rounded-[16px] bg-accent-soft px-4 py-4 shadow-[inset_0_0_0_1px_var(--accent-line)]"
    >
      <span class="grid size-8 shrink-0 place-items-center rounded-[10px] bg-accent text-on-accent">
        <UiIcon
          name="check"
          :size="15"
          :stroke="2.4"
        />
      </span>
      <div class="min-w-0">
        <p class="eyebrow-loud mb-2 text-accent-strong">What is actually true</p>
        <Markdown :source="block.payload.what_is_true" />
      </div>
    </div>

    <p
      v-if="block.payload?.tell"
      class="mt-3 text-[13px] leading-relaxed text-text-muted"
    >
      <span class="font-medium text-text-dim">How to catch yourself</span> —
      {{ block.payload.tell }}
    </p>
  </BlockShell>
</template>
