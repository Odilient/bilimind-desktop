<script setup lang="ts">
// Settings slide-over: AI (BiliMind free or your own key), narration, output folder, about.
import { computed } from 'vue';
import Icon from './Icon.vue';
import KeyCard from './KeyCard.vue';
import { state } from '../store';

const s = computed(() => state.settings);
async function setNarrate(v: boolean) { state.settings = await window.bilimind.settings.save({ narrate: v }); }
async function pickOut() {
  const p = await window.bilimind.pickFolder();
  if (p) state.settings = await window.bilimind.settings.save({ outRoot: p });
}
const GH = 'https://github.com/Odilient/bilimind-desktop';
const openGh = () => window.bilimind.openExternal(GH);
const close = () => { state.settingsOpen = false; };
</script>

<template>
  <Transition name="scrim"><div v-if="state.settingsOpen" class="scrim" @click="close"></div></Transition>
  <Transition name="slide">
    <aside v-if="state.settingsOpen && s" class="panel" role="dialog" aria-label="Settings" @keydown.esc="close">
      <header>
        <h2 class="disp">Settings</h2>
        <button class="iconbtn" aria-label="Close settings" @click="close"><Icon name="i-x" /></button>
      </header>
      <div class="body">
        <KeyCard />

        <section class="row">
          <span class="ri"><Icon name="i-mic" /></span>
          <div class="tx"><b>Narration</b><span>A voice reads every lesson (free, needs internet while building).</span></div>
          <button class="sw" :class="{ on: s.narrate }" role="switch" :aria-checked="s.narrate" @click="setNarrate(!s.narrate)"><i></i></button>
        </section>

        <section class="row col">
          <div class="top"><span class="ri"><Icon name="i-folder" /></span>
            <div class="tx"><b>Where courses are saved</b><span class="path" :title="s.outRoot">{{ s.outRoot }}</span></div>
          </div>
          <button class="pill sm light" @click="pickOut">Change folder</button>
        </section>

        <section class="about slab cobalt">
          <svg class="mark" viewBox="0 0 40 40" aria-hidden="true"><use href="#mark" /></svg>
          <div>
            <b class="nm">BiliMind Desktop <span>v{{ s.version }}</span></b>
            <p>Open source under AGPL-3.0. No account. Your courses are folders on this computer. Free AI to start, or your own key.</p>
            <p class="team">Made by team Opus Magnum: Oybek Odilov, Abdugaffor Odilov, Ramil Khutlimuratov, Gameel Al-Bazeeli. Dormathon 2026.</p>
            <button class="pill sm lime" @click="openGh">Source on GitHub <Icon name="i-ext" /></button>
          </div>
        </section>
      </div>
    </aside>
  </Transition>
</template>

<style scoped>
.scrim { position: fixed; inset: var(--bar-h) 0 0 0; background: rgb(11 13 16 / 0.28); backdrop-filter: blur(2px); z-index: 40; }
.panel { position: fixed; top: calc(var(--bar-h) + 8px); right: 8px; bottom: 8px; width: 420px; z-index: 41; background: var(--page); border-radius: 28px; box-shadow: 0 30px 80px -20px rgb(11 13 16 / 0.45); display: flex; flex-direction: column; overflow: hidden; }
header { display: flex; align-items: center; justify-content: space-between; padding: 20px 18px 10px 22px; }
h2 { font-size: 34px; }
.body { flex: 1; overflow-y: auto; padding: 6px 14px 16px; display: grid; gap: 10px; align-content: start; }
.row { display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: #fff; border-radius: 22px; box-shadow: inset 0 0 0 1px var(--line); }
.row.col { flex-direction: column; align-items: stretch; }
.row.col .pill { align-self: flex-start; margin-left: 50px; }
.top { display: flex; gap: 12px; align-items: center; min-width: 0; }
.ri { width: 38px; height: 38px; border-radius: 50%; background: var(--cobalt-soft); color: var(--cobalt); display: grid; place-items: center; flex: none; }
.ri .ico { width: 17px; height: 17px; }
.tx { display: grid; gap: 2px; flex: 1; min-width: 0; }
.tx b { font-size: 14.5px; }
.tx span { font-size: 12.5px; color: var(--text-2); line-height: 1.4; }
.path { font-family: ui-monospace, Consolas, monospace; font-size: 12px !important; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sw { width: 46px; height: 28px; border-radius: 99px; background: var(--line-2); position: relative; flex: none; transition: background .2s; }
.sw i { position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgb(11 13 16 / 0.25); transition: transform .2s; }
.sw.on { background: var(--cobalt); }
.sw.on i { transform: translateX(18px); background: var(--lime); }
.about { display: flex; gap: 14px; padding: 18px; border-radius: 22px; }
.about .mark { width: 40px; height: 40px; flex: none; }
.nm { font: 700 16px/1.2 var(--display); letter-spacing: -0.02em; }
.nm span { font: 500 12px var(--body); color: rgb(255 255 255 / 0.6); margin-left: 4px; }
.about p { margin: 6px 0 0; font-size: 12.5px; line-height: 1.5; color: rgb(255 255 255 / 0.78); }
.about .team { color: rgb(255 255 255 / 0.6); }
.about .pill { margin-top: 12px; }
.slide-enter-active, .slide-leave-active { transition: transform .32s cubic-bezier(.2, .8, .2, 1), opacity .32s; }
.slide-enter-from, .slide-leave-to { transform: translateX(40px); opacity: 0; }
.scrim-enter-active, .scrim-leave-active { transition: opacity .25s; }
.scrim-enter-from, .scrim-leave-to { opacity: 0; }
</style>
