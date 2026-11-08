<script setup lang="ts">
const { t } = useI18n()
/**
 * "Continue with Google" above the email form on the doors (sign in, sign up,
 * `/start`), with the quiet "or use email" rule under it. Google draws its own
 * button (`companion/google/signin.ts`, their branding rules); nothing at all
 * shows where it isn't available (no client id, the desktop or phone app).
 *
 * The session is already in place when `signed-in` fires; the page decides
 * where to go, exactly as after its own form.
 */
import type { AuthSession } from '~/composables/useAuth'
import { googleSignInAvailable, mountGoogleButton } from '~/companion/google/signin'

const props = defineProps<{ text?: 'continue_with' | 'signin_with' | 'signup_with' }>()
const emit = defineEmits<{ signedIn: [session: AuthSession, created: boolean]; error: [message: string] }>()

const el = ref<HTMLElement | null>(null)
const shown = ref(false)

onMounted(async () => {
  if (!googleSignInAvailable()) return
  // Shown first, so Google measures the real width of the slot it draws in.
  shown.value = true
  await nextTick()
  if (!el.value) return
  const ok = await mountGoogleButton(el.value, {
    text: props.text,
    onSignedIn: (session, created) => emit('signedIn', session, created),
    onError: (message) => emit('error', message),
  })
  if (!ok) shown.value = false
})
</script>

<template>
  <div
    v-show="shown"
    class="grid gap-4"
  >
    <div
      ref="el"
      class="flex min-h-[44px] justify-center"
    />
    <p
      class="flex items-center gap-3 text-[12.5px] font-medium text-text-faint"
      aria-hidden="true"
    >
      <span class="h-px flex-1 bg-border" />
      {{ t('shell.orEmail') }}
      <span class="h-px flex-1 bg-border" />
    </p>
  </div>
</template>
