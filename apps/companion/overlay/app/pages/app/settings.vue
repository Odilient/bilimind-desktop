<script setup lang="ts">
/** Settings on this computer: the AI key, and how the app behaves. No account, plan or team here. */
definePageMeta({ layout: 'companion' })
useSeoMeta({ title: 'Settings · BiliMind' })

const route = useRoute()
const router = useRouter()

const sections = [
  { id: 'keys', label: 'AI key' },
  { id: 'spending', label: 'Spending' },
  { id: 'preferences', label: 'Preferences' },
] as const

const active = computed(() => sections.find((s) => s.id === route.query.section)?.id ?? 'keys')

function open(id: string): void {
  void router.replace({ query: { ...route.query, section: id } })
}
</script>

<template>
  <div class="mx-auto w-full max-w-[720px] px-5 py-8 min-[900px]:py-10">
    <h1 class="t-head text-[28px] min-[900px]:text-[36px]">
      Settings
    </h1>

    <nav
      class="om-tabs -mx-1 mt-5 flex gap-1 overflow-x-auto border-b border-border-rule px-1"
      aria-label="Settings"
    >
      <button
        v-for="section in sections"
        :key="section.id"
        type="button"
        :aria-current="active === section.id ? 'page' : undefined"
        :class="[
          '-mb-px h-10 shrink-0 cursor-pointer border-b-2 px-3 text-[14px] font-medium transition-colors',
          active === section.id ? 'border-ink text-text' : 'border-transparent text-text-muted hover:text-text',
        ]"
        @click="open(section.id)"
      >
        {{ section.label }}
      </button>
    </nav>

    <div class="mt-6">
      <template v-if="active === 'keys'">
        <CompanionSettingsKeyStorage />
        <AccountApiKeys />
      </template>
      <CompanionSettingsSpending v-else-if="active === 'spending'" />
      <CompanionSettingsPreferences v-else />
    </div>
  </div>
</template>
