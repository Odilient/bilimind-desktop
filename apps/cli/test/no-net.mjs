// Preloaded with `node --import` by the contract test: no command may reach the network (no LLM spend, no TTS),
// so the test is free, fast and deterministic. fetch() and WebSocket reject; node:https/http requests error out.
import https from 'node:https';
import http from 'node:http';

const refuse = (what) => new Error(`network disabled in the contract test (${what})`);
globalThis.fetch = async (input) => { throw refuse(typeof input === 'string' ? input : String(input?.url ?? input)); };
globalThis.WebSocket = class { constructor(url) { throw refuse(String(url)); } };
for (const mod of [https, http]) {
  const block = (...args) => {
    const req = new http.ClientRequest('http://127.0.0.1:9/');   // discard port: fails fast, emits 'error'
    req.on('error', () => {});
    process.nextTick(() => req.destroy(refuse(String(args[0]?.href ?? args[0]?.host ?? args[0]))));
    return req;
  };
  mod.request = block;
  mod.get = block;
}
