<script setup lang="ts">
// Provider + key entry. BiliMind free (the default) needs no key: its key lives only on BiliMind's server.
// An own key goes straight to main (settings.save) and never comes back: only last4.
import { ref, computed } from 'vue';
import Icon from './Icon.vue';
import type { ProviderId } from '../env';
import { state } from '../store';

const props = defineProps<{ inline?: boolean }>();
const emit = defineEmits<{ saved: [] }>();

const ORDER: ProviderId[] = ['bilimind', 'deepseek', 'openrouter'];
const provider = ref<ProviderId>(state.settings?.provider ?? 'bilimind');
const free = computed(() => provider.value === 'bilimind');
const value = ref('');
const busy = ref(false);
const msg = ref<{ ok: boolean; text: string } | null>(null);
const why = ref(false);
const saved = computed(() => state.settings?.keys[provider.value]);
const NAMES: Record<ProviderId, string> = { bilimind: 'BiliMind free', deepseek: 'DeepSeek', openrouter: 'OpenRouter' };
const SUBS: Record<ProviderId, string> = { bilimind: 'no key needed', deepseek: 'your key', openrouter: 'your key' };
const LINKS: Record<ProviderId, string> = { bilimind: '', deepseek: 'https://platform.deepseek.com/api_keys', openrouter: 'https://openrouter.ai/keys' };

function openLink(url: string) { window.bilimind.openExternal(url); }
async function pick(p: ProviderId) {
  provider.value = p; msg.value = null; why.value = false;
  if (state.settings?.keys[p]?.set) state.settings = await window.bilimind.settings.save({ provider: p });
}
async function save() {
  if (free.value || !value.value.trim()) return;
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
  const r: { ok: boolean; balance?: string; note?: string; error?: string } = await window.bilimind.settings.testKey(provider.value)
    .catch((e) => ({ ok: false, error: String(e) }));
  busy.value = false;
  msg.value = r.ok ? { ok: true, text: r.note ?? `Key works${r.balance ? `, balance ${r.balance}` : ''}` }
    : { ok: false, text: r.error || (free.value ? 'The free service did not answer' : 'The key did not work') };
  if (r.ok && afterSave) emit('saved');
}
</script>

<template>
  <div class="kc" :class="{ inline: props.inline }">
    <div class="head">
      <span class="k"><Icon name="i-key" /></span>
      <div>
        <b>{{ props.inline ? 'Add your AI key, or use BiliMind free' : 'AI for your courses' }}</b>
        <p>{{ free ? 'Free to use. No key, no account.' : 'Bring your own key. A whole course costs a few cents.' }}</p>
      </div>
    </div>
    <div class="seg three" role="tablist" aria-label="Which AI writes your courses">
      <button v-for="p in ORDER" :key="p" :class="{ on: provider === p }" role="tab" :aria-selected="provider === p"
              :aria-label="p === 'bilimind' ? 'BiliMind free — no key needed' : `${NAMES[p]} (your key)`" @click="pick(p)">
        <b>{{ NAMES[p] }}</b><small>{{ SUBS[p] }}</small>
      </button>
    </div>
    <div v-if="free" class="row freerow">
      <div class="have"><Icon name="i-check" /> Ready. BiliMind pays for the AI.</div>
      <button class="pill sm light" :disabled="busy" @click="test()">Check</button>
    </div>
    <template v-else>
      <div v-if="saved?.set" class="have"><Icon name="i-lock" /> {{ NAMES[provider] }} key saved <code>••••{{ saved.last4 }}</code></div>
      <div class="row">
        <input v-model="value" class="field" type="password" autocomplete="off" spellcheck="false" :placeholder="saved?.set ? 'Paste a new key' : `Paste your ${NAMES[provider]} key`" @keydown.enter="save" />
        <button class="pill dark" :disabled="busy || !value.trim()" @click="save">Save</button>
        <button class="pill light" :disabled="busy || !saved?.set" @click="test()">Test</button>
      </div>
    </template>
    <p v-if="msg" class="msg" :class="{ bad: !msg.ok }"><Icon :name="msg.ok ? 'i-check' : 'i-warning'" /> {{ msg.text }}</p>
    <p class="foot">
      <button class="link" @click="why = !why"><Icon name="i-lock" /> {{ free ? 'No key on this computer' : 'Your key stays on this computer' }}</button>
      <button v-if="!free" class="link dim" @click="openLink(LINKS[provider])">Get a {{ NAMES[provider] }} key <Icon name="i-ext" /></button>
    </p>
    <p v-if="why && free" class="why">BiliMind free runs on BiliMind's own AI account. Its key lives only on BiliMind's server, never on this computer. While a course is being written, the text it needs goes through that service to the AI. For a direct line, use your own key.</p>
    <p v-else-if="why" class="why">It is saved in a file in your user folder (.bilimind\config.json) and only sent to {{ NAMES[provider] }} when a course is being written. It never goes through BiliMind.</p>
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
.seg.three { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-radius: 16px; }
.seg.three button { height: auto; padding: 7px 8px; border-radius: 12px; display: grid; gap: 1px; text-align: center; }
.seg.three b { font-weight: 700; font-size: 13px; white-space: nowrap; }
.seg.three small { font-size: 11px; font-weight: 500; color: var(--text-3); }
.freerow { align-items: center; justify-content: space-between; }
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
