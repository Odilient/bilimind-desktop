<script setup lang="ts">
/**
 * The model's reasoning as it happens, in a small box that rolls upward.
 *
 * Most of a generation is this: on a real lesson, 93 seconds of reasoning and
 * then 20 of writing. It is the true answer to "what is it doing?", so it is
 * shown rather than a spinner, muted and cut off at the top, because it is there
 * to be glanced at. The words are the model's working, not BiliMind speaking, so
 * screen readers get the status line beside it and not this.
 *
 * The server sends the tail of it and the total length; the length says how much
 * of the tail is new.
 */
const props = defineProps<{
  text: string
  length: number
}>()

const all = ref('')
let seen = 0

watch(
  () => props.length,
  (length) => {
    const fresh = length - seen
    if (fresh <= 0) return
    all.value += props.text.slice(-fresh)
    seen = length
  },
  { immediate: true },
)

const typed = useTypedText(() => all.value)
const tail = computed(() => typed.value.slice(-700))
</script>

<template>
  <div
    class="cp-thinking flex h-[108px] flex-col justify-end overflow-hidden text-[13px] leading-[1.55] whitespace-pre-wrap text-text-muted"
    aria-hidden="true"
  >
    {{ tail }}
  </div>
</template>

<style scoped>
.cp-thinking {
  mask-image: linear-gradient(to bottom, transparent, black 45%);
}
</style>
