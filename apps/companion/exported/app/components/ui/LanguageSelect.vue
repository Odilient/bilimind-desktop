<script setup lang="ts">
/**
 * The language picker, names in their own language. With no `modelValue` it switches the
 * interface at once (useLocale: saved on the account when signed in, else the cookie). With one
 * it is a plain form field, for a setting that is saved with its page (an institution's language).
 */
const props = defineProps<{ modelValue?: Locale; label?: string }>()
const emit = defineEmits<{ 'update:modelValue': [Locale] }>()

const { t } = useI18n()
const { locale, setLocale, locales, names } = useLocale()
const toast = useToast()

const value = computed(() => props.modelValue ?? locale.value)

async function pick(event: Event): Promise<void> {
  const code = (event.target as HTMLSelectElement).value
  if (!isLocale(code)) return
  if (props.modelValue !== undefined) return emit('update:modelValue', code)
  try {
    await setLocale(code)
  } catch {
    toast.error(t('common.notSaved'))
  }
}
</script>

<template>
  <select
    :value="value"
    :aria-label="label ?? t('common.language')"
    class="h-9 cursor-pointer rounded-[9px] border border-border-field bg-transparent px-2.5 text-[14px] text-inherit focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
    @change="pick"
  >
    <option
      v-for="code in locales"
      :key="code"
      :value="code"
      :selected="code === value"
    >
      {{ names[code] }}
    </option>
  </select>
</template>
