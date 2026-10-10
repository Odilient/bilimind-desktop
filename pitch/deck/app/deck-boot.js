// Deck-only driver for this copy of the BiliMind Desktop renderer (mock mode, real showcase data).
// ?deck=home | filled | building | finished  puts the live app into that state by clicking it like a user would,
// then tells the deck (parent window) it is ready. Nothing here exists in apps/desktop/src.
(function () {
  'use strict';
  var q = new URLSearchParams(location.search);
  var mode = q.get('deck') || 'home';
  var hold = Number(q.get('hold') || 1900);
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  function waitFor(sel, ms) {
    return new Promise(function (resolve, reject) {
      var t0 = Date.now();
      (function poll() {
        var el = document.querySelector(sel);
        if (el) return resolve(el);
        if (Date.now() - t0 > (ms || 60000)) return reject(new Error('timeout ' + sel));
        setTimeout(poll, 60);
      })();
    });
  }
  function clickText(sel, text) {
    var el = Array.prototype.find.call(document.querySelectorAll(sel), function (e) { return e.textContent.indexOf(text) >= 0; });
    if (el) el.click();
    return el;
  }
  function ready() {
    document.documentElement.setAttribute('data-deck-ready', '1');
    try { parent.postMessage({ bmDeck: 'ready', mode: mode }, '*'); } catch (e) { /* standalone */ }
  }
  async function fill() {
    await waitFor('.exchip');
    await sleep(250);
    clickText('.exchip', 'Data Structures');
    await sleep(200);
    document.querySelector('.drop').click();
    await waitFor('.go .pill.lime:not([disabled])', 8000).catch(function () {});
    await sleep(450);
  }
  async function run() {
    await (document.fonts ? document.fonts.ready : Promise.resolve());
    if (mode === 'home') { await waitFor('.exchip'); await sleep(900); return ready(); }
    await fill();
    if (mode === 'filled') { await sleep(300); return ready(); }
    document.querySelector('.go .pill.lime').click();
    if (mode === 'building') {
      // Freeze the replay right after the Checker rejects a wrong answer key and rewrites it from the slides.
      await waitFor('.moment', 120000);
      await sleep(hold);
      window.bilimind.run.cancel();
      // Stop the clock too, so the Checker's moment card (shown for 5.2 s of app time) stays on screen.
      var frozen = Date.now();
      Date.now = function () { return frozen; };
      await sleep(400);
      return ready();
    }
    if (mode === 'finished') { await waitFor('.fin', 60000); await sleep(1300); return ready(); }
    ready();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();
