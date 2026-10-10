<script setup lang="ts">
// Provider + key entry. The key goes straight to main (settings.save) and never comes back: only last4.
import { ref, computed } from 'vue';
import Icon from './Icon.vue';
import type { ProviderId } from '../env';
import { state } from '../store';

const props = defineProps<{ inline?: boolean }>();
const emit = defineEmits<{ saved: [] }>();

const provider = ref<ProviderId>(state.settings?.provider ?? 'deepseek');
const value = ref('');
const busy = ref(false);
const msg = ref<{ ok: boolean; text: string } | null>(null);
const why = ref(false);
const saved = computed(() => state.settings?.keys[provider.value]);
const NAMES: Record<ProviderId, string> = { deepseek: 'DeepSeek', openrouter: 'OpenRouter' };
const LINKS: Record<ProviderId, string> = { deepseek: 'https://platform.deepseek.com/api_keys', openrouter: 'https://openrouter.ai/keys' };

function openLink(url: string) { window.bilimind.openExternal(url); }
async function pick(p: ProviderId) {
  provider.value = p; msg.value = null;
  if (saved.value?.set) state.settings = await window.bilimind.settings.save({ provider: p });
}
async function save() {
  if (!value.value.trim()) return;
  busy.value = true; msg.value = null;
  try {
    state.settings = await window.bilimind.settings.save({ provider: provider.value, key: { provider: provider.value, value: value.value.trim() } });
    value.value = '';
    await test(true);
  } catch (e) { msg.value = { ok: false, text: (e as Error).message }; }
  busy.value = false;
}
async function test(afterSave = false) {
  busy.value = true;
  const r = await window.bilimind.settings.testKey(provider.value).catch((e) => ({ ok: false, error: String(e), balance: undefined }));
  busy.value = false;
  msg.value = r.ok ? { ok: true, text: `Key works${r.balance ? `, balance ${r.balance}` : ''}` } : { ok: false, text: r.error || 'The key did not work' };
  if (r.ok && afterSave) emit('saved');
}
</script>

<template>
  <div class="kc" :class="{ inline: props.inline }">
    <div class="head">
      <span class="k"><Icon name="i-key" /></span>
      <div>
        <b>{{ props.inline ? 'Add your AI key to start' : 'AI key' }}</b>
        <p>Bring your own key. A whole course costs a few cents.</p>
      </div>
    </div>
    <div class="seg" role="tablist">
      <button v-for="p in (['deepseek', 'openrouter'] as ProviderId[])" :key="p" :class="{ on: provider === p }" role="tab" :aria-selected="provider === p" @click="pick(p)">{{ NAMES[p] }}</button>
    </div>
    <div v-if="saved?.set" class="have"><Icon name="i-lock" /> {{ NAMES[provider] }} key saved <code>••••{{ saved.last4 }}</code></div>
    <div class="row">
      <input v-model="value" class="field" type="password" autocomplete="off" spellcheck="false" :placeholder="saved?.set ? 'Paste a new key' : `Paste your ${NAMES[provider]} key`" @keydown.enter="save" />
      <button class="pill dark" :disabled="busy || !value.trim()" @click="save">Save</button>
      <button class="pill light" :disabled="busy || !saved?.set" @click="test()">Test</button>
    </div>
    <p v-if="msg" class="msg" :class="{ bad: !msg.ok }"><Icon :name="msg.ok ? 'i-check' : 'i-warning'" /> {{ msg.text }}</p>
    <p class="foot">
      <button class="link" @click="why = !why"><Icon name="i-lock" /> Your key stays on this computer</button>
      <button class="link dim" @click="openLink(LINKS[provider])">Get a {{ NAMES[provider] }} key <Icon name="i-ext" /></button>
    </p>
    <p v-if="why" class="why">It is saved in a file in your user folder (.bilimind\config.json) and only sent to {{ NAMES[provider] }} when a course is being written. BiliMind has no server and no account.</p>
  </div>
</template>

<style scoped>
.kc { display: grid; gap: 12px; padding: 18px; border-radius: 22px; background: var(--lime-soft); box-shadow: inset 0 0 0 1px rgb(78 106 8 / 0.14); }
.kc:not(.inline) { background: #fff; box-shadow: inset 0 0 0 1px var(--line); }
.head { display: flex; gap: 12px; align-items: center; }
.head b { font-weight: 700; font-size: 15px; display: block; }
.head p { margin: 0; font-size: 13px; color: var(--text-2); }
.k { width: 38px; height: 38px; border-radius: 50%; background: var(--ink); color: var(--lime); display: grid; place-items: center; flex: none; }
.k .ico { width: 18px; height: 18px; }
.kc.inline .seg { background: rgb(255 255 255 / 0.7); }
.row { display: flex; gap: 8px; }
.row .field { flex: 1; min-width: 0; }
.have { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-2); }
.have code { font: 600 12.5px/1 ui-monospace, Consolas, monospace; color: var(--ink); background: var(--page); padding: 4px 7px; border-radius: 6px; }
.msg { margin: 0; display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--green); }
.msg.bad { color: var(--coral); }
.foot { margin: 0; display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.link { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; color: var(--ink-3); text-decoration: underline; text-decoration-color: rgb(11 13 16 / 0.25); text-underline-offset: 3px; }
.link.dim { color: var(--text-2); }
.link .ico { width: 13px; height: 13px; }
.why { margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--text-2); }
</style>
