<script setup lang="ts">
const { t } = useI18n()
const props = withDefaults(
  defineProps<{
    label?: string
    hint?: string
    error?: string | null
    placeholder?: string
    type?: string
    multiline?: boolean
    rows?: number
    disabled?: boolean
    required?: boolean
    autofocus?: boolean
    autocomplete?: string
    icon?: string
    id?: string
    /** Accessible name when the field is used without a visible label. */
    ariaLabel?: string
    /** Show a live counter against this ceiling. */
    maxlength?: number
    size?: 'sm' | 'md' | 'lg'
  }>(),
  { type: 'text', rows: 4, size: 'md' },
)

const reveal = ref(false)
const model = defineModel<string>({ default: '' })

const uid = useId()
const fieldId = computed(() => props.id ?? `field-${uid}`)
const describedBy = computed(() =>
  props.error ? `${fieldId.value}-error` : props.hint ? `${fieldId.value}-hint` : undefined,
)

const heights: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-[34px] text-[13px]',
  md: 'h-10 text-[14px]',
  lg: 'h-12 text-[15px]',
}

/** Within the last 15% of the allowance, or the last 120 characters. */
const nearLimit = computed(() => {
  if (!props.maxlength) return false
  const remaining = props.maxlength - (model.value?.length ?? 0)
  return remaining <= Math.min(120, props.maxlength * 0.15)
})

const control = useTemplateRef<HTMLInputElement | HTMLTextAreaElement>('control')

defineExpose({
  focus: () => control.value?.focus(),
})
</script>

<template>
  <div class="flex w-full flex-col gap-1.5">
    <div
      v-if="label || (nearLimit && multiline)"
      class="flex items-baseline justify-between gap-3"
    >
      <label
        v-if="label"
        :for="fieldId"
        class="text-[13px] font-semibold text-text-dim"
      >
        {{ label }}
        <span
          v-if="required"
          class="text-danger"
          aria-hidden="true"
          >*</span
        >
      </label>
      <!--
        Only once the limit is actually in sight. "0/2000" on an empty field
        tells nobody anything and makes a writing prompt look like a form.
      -->
      <span
        v-if="maxlength && nearLimit"
        class="num text-[11px] text-text-faint"
      >
        {{ maxlength - model.length }} left
      </span>
    </div>

    <div
      :class="[
        'relative flex w-full items-center rounded-[14px] border transition-[border-color,box-shadow] duration-150',
        // You write *into* white. A filled grey box is right for a search or a
        // setting, and reads as disabled when it is the thing you came here to
        // fill in — which is exactly what the course prompt is.
        multiline ? 'bg-surface' : 'bg-surface-mute focus-within:bg-surface',
        // Focus is the sky ink of links: a sky line and a soft sky ring, the
        // same signal the landing's field gives when you click into it.
        error
          ? 'border-danger/60 focus-within:border-danger focus-within:shadow-[0_0_0_4px_var(--danger-soft)]'
          : 'border-border-field focus-within:border-brand focus-within:shadow-[0_0_0_4px_var(--brand-line)]',
        disabled && 'pointer-events-none opacity-55',
      ]"
    >
      <UiIcon
        v-if="icon && !multiline"
        :name="icon"
        :size="15"
        class="pointer-events-none absolute left-3.5 text-text-faint"
      />

      <textarea
        v-if="multiline"
        :id="fieldId"
        ref="control"
        v-model="model"
        :rows="rows"
        :placeholder="placeholder"
        :disabled="disabled"
        :required="required"
        :autofocus="autofocus"
        :maxlength="maxlength"
        :aria-label="ariaLabel"
        :aria-invalid="error ? true : undefined"
        :aria-describedby="describedBy"
        class="w-full resize-y bg-transparent px-3.5 py-3 text-[14.5px] leading-relaxed outline-none placeholder:text-text-faint"
      />

      <input
        v-else
        :id="fieldId"
        ref="control"
        v-model="model"
        :type="type === 'password' && reveal ? 'text' : type"
        :placeholder="placeholder"
        :disabled="disabled"
        :required="required"
        :autofocus="autofocus"
        :autocomplete="autocomplete"
        :maxlength="maxlength"
        :aria-label="ariaLabel"
        :aria-invalid="error ? true : undefined"
        :aria-describedby="describedBy"
        :class="[
          'w-full bg-transparent outline-none placeholder:text-text-faint',
          heights[size],
          icon ? 'pr-3.5 pl-10' : 'px-3.5',
        ]"
      >

      <button
        v-if="type === 'password' && !multiline"
        type="button"
        class="mr-1.5 grid size-8 shrink-0 place-items-center rounded-lg text-text-faint hover:text-text-dim"
        :aria-label="reveal ? t('ui.hidePassword') : t('ui.showPassword')"
        :aria-pressed="reveal"
        @click="reveal = !reveal"
      >
        <UiIcon
          :name="reveal ? 'eye-off' : 'eye'"
          :size="16"
        />
      </button>

      <div
        v-if="$slots.suffix"
        class="pr-1.5 pl-1"
      >
        <slot name="suffix" />
      </div>
    </div>

    <p
      v-if="error"
      :id="`${fieldId}-error`"
      class="flex items-center gap-1.5 text-[12.5px] text-danger"
    >
      <UiIcon
        name="alert"
        :size="13"
      />
      {{ error }}
    </p>
    <p
      v-else-if="hint"
      :id="`${fieldId}-hint`"
      class="text-[12.5px] text-text-faint"
    >
      {{ hint }}
    </p>
  </div>
</template>
