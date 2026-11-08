<script setup lang="ts">
/**
 * "Back up everything", under Account beside deleting it, where people look
 * for their data: every course and My notes in one zip
 * (`companion/export/bundle.ts`), and the spreadsheet on its own for anyone
 * who only wants the dates. Free on every plan; nothing here is AI.
 */
import { useExport } from '~/companion/export/use-export'

const exp = useExport()
const { t } = useI18n()
const busy = ref(false)

async function backup(): Promise<void> {
  if (busy.value) return
  busy.value = true
  try {
    await exp.backup()
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="mt-8 border-t border-border-rule pt-6">
    <h3 class="text-[15px] font-semibold text-text">
      {{ t('settings.backup.title') }}
    </h3>
    <p class="mt-1 text-[14px] leading-relaxed text-text-muted">
      {{ t('settings.backup.text') }}
    </p>
    <div class="mt-3 flex flex-wrap items-center gap-2">
      <UiBtn
        variant="secondary"
        icon="download"
        :loading="busy"
        @click="backup"
      >
        {{ t('settings.backup.all') }}
      </UiBtn>
      <UiBtn
        variant="ghost"
        @click="exp.spreadsheet()"
      >
        {{ t('settings.backup.sheet') }}
      </UiBtn>
    </div>
  </div>
</template>
