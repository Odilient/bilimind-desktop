<script setup lang="ts">
/** Where the key goes, said plainly: and if this computer has no keychain to seal it with, said before they add one. */
const storage = ref<{ encrypted: boolean; shared_file_has_key: boolean } | null>(null)

onMounted(async () => {
  try {
    storage.value = await useApi().get('/credentials/storage')
  } catch {
    storage.value = null
  }
})
</script>

<template>
  <div
    v-if="storage"
    class="mb-5 grid gap-2 text-[13.5px] leading-relaxed"
  >
    <p
      v-if="!storage.encrypted"
      role="status"
      class="rounded-[12px] border border-border-rule bg-surface-mute px-3.5 py-2.5 text-text-body"
    >
      This computer has no system keychain BiliMind can use, so your key is saved as plain text in a file only your
      user account can read. Installing a keyring (GNOME Keyring or KWallet on Linux) and restarting BiliMind seals it.
    </p>
    <p
      v-if="storage.shared_file_has_key"
      class="rounded-[12px] border border-border-rule bg-surface-mute px-3.5 py-2.5 text-text-body"
    >
      <code>~/.bilimind/config.json</code> also holds a key in plain text, for the command-line tool. BiliMind doesn't
      use that copy; delete it from the file if you don't use the tool.
    </p>
    <p class="text-text-muted">
      No key yet? Make one at
      <a
        class="underline"
        href="https://platform.deepseek.com/api_keys"
        target="_blank"
        rel="noopener"
      >DeepSeek</a>
      or
      <a
        class="underline"
        href="https://openrouter.ai/keys"
        target="_blank"
        rel="noopener"
      >OpenRouter</a>. You pay them directly for what you use.
    </p>
  </div>
</template>
