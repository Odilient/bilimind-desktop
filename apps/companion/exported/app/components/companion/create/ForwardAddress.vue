<script setup lang="ts">
/**
 * The learner's own forwarding address, and the one thing to do with it.
 * Emails sent to it are sorted into the right course; a changed date waits
 * in the Inbox for a yes. Lifted out of the old /app/start.
 */
import { useCompanion } from '~/companion/store'
import { FORWARD_DOMAIN } from '~/companion/demo-seed'

const c = useCompanion()
const toast = useToast()

const address = computed(() => {
  const alias = c.connections.value.find((x) => x.kind === 'email')?.meta.alias
  return typeof alias === 'string' && alias ? `${alias}@${FORWARD_DOMAIN}` : null
})

async function copy(): Promise<void> {
  if (!address.value) return
  try {
    await navigator.clipboard.writeText(address.value)
    toast.success('Address copied')
  } catch {
    toast.info({ title: address.value, body: 'Copy it from here.' })
  }
}
</script>

<template>
  <section class="grid gap-4">
    <template v-if="address">
      <div class="grid gap-2">
        <p class="text-[15px] font-semibold">
          Your BiliMind address
        </p>
        <!-- No contextual alternates: Inter turns "2x3" into "2×3", which is wrong in an address. -->
        <p class="flex h-12 items-center rounded-full bg-surface-track px-5 text-[16px] font-semibold [font-feature-settings:'calt'_0] select-all">
          <span class="truncate">{{ address }}</span>
        </p>
      </div>
      <div>
        <UiBtn
          variant="primary"
          size="lg"
          @click="copy"
        >
          <CompanionIcon
            name="copy"
            :size="16"
          />
          Copy address
        </UiBtn>
      </div>
      <p class="max-w-[62ch] text-[15px] leading-relaxed text-text-body">
        Then set a forwarding rule in your university email, once, and forget it. In Outlook on
        the web it is under Settings, Mail, Forwarding. Forwarding a single email by hand works too.
      </p>
    </template>
    <p
      v-else
      class="text-[15px] text-text-body"
    >
      Your own address appears here once your account is set up.
    </p>
  </section>
</template>
