# Media stack verification (Dormathon / BiliMind for WorkBuddy)

Date: 2026-10-10. Machine: Windows 11, Node 24.19.0, pnpm 10.18.1, Python 3.11.9, ffmpeg 8.0.1.
Scratch folder: `hackathon/scratch/media` (all test scripts and generated files live there).

Status: DONE. Everything below was actually run on this PC on this network.

## TL;DR

| item | verdict | key number |
|---|---|---|
| Campus network | **npm registry blocked by Taylor's FortiGate**; use `--registry=https://registry.npmmirror.com` | other hosts fine |
| PC clock | **8 h slow**; breaks Edge TTS (403) until corrected; owner should turn on automatic time | skew 28,799 s |
| Edge TTS (msedge-tts 2.0.9) | works with clock-skew fix; EN + Malay; word timings for highlighting | ~6 KB per second of audio, 12 parallel lines in 11.8 s |
| Edge TTS limits | no `<break>`, no multi-voice SSML; escape `& < >`; long text streams at ~real time, so chunk + parallelize | |
| Two-host overview | pure byte concat of mp3s works (zero decode errors), timings computable from byte length | 33.86 s file, exact |
| OpenRouter v4-flash JSON schema | works, 614 ms, verbatim source quote validated | $0.0000329 per quiz item |
| Budget | **account balance $9.69** (key says $12.80 but account credits are the ceiling) | ~$0.08 per course text |
| Images | nano-banana-2-lite / 2.5-flash-image ~$0.02-0.04 each; cap and cache | |
| Music | Lyria 3 clip $0.04 / 30 s, pro $0.08 / song | |
| Pyodide 314.0.7 (Python 3.14.2) | works from **file://** only as a **module worker from a `data:` URL** | 6.3 MB download, 10.7 s cold, 1.7 s warm |
| JS sandbox | classic Blob worker (killable) + sandboxed iframe (DOM) both work on file:// | |
| Speech recognition | ms-MY only via cloud (needs internet) in Chrome and Edge; fallback record + self-rate | |
| Mermaid / KaTeX | pre-render at build time (SVG via puppeteer-core + installed Edge; KaTeX renderToString) | mermaid UMD would be 5.5 MB |
| MCP | `@modelcontextprotocol/sdk` 1.32.1 stdio server with zod tested end to end | 0.5 s spawn+calls |
| TypeScript | `latest` is 7.0.2 (native, no JS API) and breaks vue-tsc; pin 6.0.3 if vue-tsc is used | |

## 0. Two environment problems found first (read this before building)

1. **Taylor's network blocks the npm registry.** `registry.npmjs.org` returns a FortiGate "Application Control Violation" page (403, app "Npmjs", category "Update", re-signed with a Fortinet CA, so Node/curl fail with `UNABLE_TO_VERIFY_LEAF_SIGNATURE`). Every other host we need was clean: openrouter.ai, speech.platform.bing.com, cdn.jsdelivr.net, pypi.org, github.com, api.anthropic.com.
   - Workaround that works right now: `npm install --registry=https://registry.npmmirror.com <pkg>` (installed 58 packages in 11 s). For pnpm: `pnpm install --registry=https://registry.npmmirror.com`. Put `registry=https://registry.npmmirror.com` in the hackathon project's own `.npmrc` so WorkBuddy/codebuddy installs also work on campus Wi-Fi. A phone hotspot also bypasses it.
   - Do NOT plan any live `npx`/`npm install` step inside the demo. Pre-install everything; the WorkBuddy Skill/MCP server must run from an already-installed folder.
2. **The PC clock is 8 hours slow.** Windows shows 08:06 (+08:00) while servers say 08:06 GMT (16:06 MYT); measured skew = 28,799,260 ms. Effect: Edge TTS answers 403 (its `Sec-MS-GEC` token is time-based). The same skew can break anything with signed or time-limited requests (OAuth/JWT expiry, and possibly WorkBuddy's own sign-in or Tencent Cloud request signatures, which usually allow only a few minutes of drift; not tested here). **Fix (owner must do it, it is a system setting): Settings > Time & language > Date & time > "Set time automatically" ON, then "Sync now".** Our TTS code also self-corrects (below), so narration works even on a wrong clock.

## 1. Edge TTS from Node: WORKS (with a clock-skew fix)

Packages checked (via npmmirror, `npm view`):

| package | version | last publish | license | verdict |
|---|---|---|---|---|
| **msedge-tts** | **2.0.9** | 2026-10-02 | MIT | **use this**: maintained, MIT, word + sentence boundaries, stream or file output, Node + browser |
| node-edge-tts | 1.2.10 | 2026-02-05 | MIT | backup; simpler CLI-ish API |
| @andresaya/edge-tts | 1.8.1 | 2026-09-19 | GPL-3.0 | avoid (GPL) |
| edge-tts-universal | 1.4.0 | 2026-02-25 | AGPL-3.0 | avoid (AGPL) |

Note: msedge-tts has `preinstall: npx only-allow pnpm`; npm 11 skips it (allow-scripts) and it installs fine; with pnpm it is a non-issue.

Real test (`scratch/media/tts-test.mjs`, outputs in `scratch/media/out/`), format `audio-24khz-48kbitrate-mono-mp3`:

| voice | text | file | duration | wall time | boundaries |
|---|---|---|---|---|---|
| en-US-AvaMultilingualNeural | EN sentence (88 chars) | 37,296 B | 6.22 s | 4.4 s | 17 WordBoundary events |
| en-US-AvaMultilingualNeural | same, sentence mode | 36,288 B | 6.05 s | 3.2 s | 1 SentenceBoundary |
| en-US-AndrewMultilingualNeural | EN | 38,304 B | 6.38 s | 6.2 s | 17 words |
| en-GB-SoniaNeural | EN | 35,424 B | 5.90 s | 5.5 s | 17 words |
| ms-MY-YasminNeural | Malay sentence | 42,768 B | 7.13 s | 3.1 s | 13 words (all Malay words correct) |
| ms-MY-OsmanNeural | Malay sentence | 39,456 B | 6.58 s | ~4 s | 13 words |

- Size rule of thumb: **6 KB per second of speech** (48 kbps). 1 min = ~360 KB, a 5-min lesson = ~1.8 MB (2.4 MB if base64-embedded). Use the 48 kbps format, not 96.
- Wall time 3-6 s per sentence includes a fresh WebSocket each time. Do NOT send a whole lesson as one request (long text streams at about real time, see limits below); send one request per paragraph and run ~8 in parallel.
- Boundary data: each metadata chunk is JSON `{"Metadata":[{"Type":"WordBoundary","Data":{"Offset":875000,"Duration":375000,"text":{"Text":"A",...}}}]}`. Offset/Duration are in 100-ns ticks: **ms = ticks / 10,000**. Example: "hash" at 137.5 ms for 412.5 ms. This is exactly what karaoke-style text highlighting needs. Word and sentence boundaries are separate flags in `setMetadata(voice, format, { wordBoundaryEnabled: true })`; store word events and derive sentence spans ourselves.
- Python `edge-tts` fallback not needed (Node works).

**The clock-skew fix (must be in our TTS module):**
```js
// before creating MsEdgeTTS: correct Date.now() using the server's Date header
const r = await fetch("https://speech.platform.bing.com/", { method: "HEAD" });
const skew = new Date(r.headers.get("date")).getTime() - Date.now();
if (Math.abs(skew) > 60_000) { const now = Date.now.bind(Date); Date.now = () => now() + skew; }
```
Without it every request returned `Unexpected server response: 403` on this PC. (A cleaner option: our own 100-line Edge TTS client that takes the time as a parameter; the monkey-patch is fine for a hackathon.)

### Edge TTS limits we hit (design around them)

- **No custom SSML.** A `<break time="350ms"/>` inside the text, a raw SSML document with `<break>`, and a two-`<voice>` SSML document all failed with "Stream closed before the synthesis completed (no turn.end received)". The free Read Aloud endpoint only accepts one voice + `<prosody>` (rate/pitch/volume, which msedge-tts exposes as `toStream(text, { rate: "+10%" })`). So: one request per speaker line, pauses made from silent frames (section 2).
- **Escape the text.** msedge-tts pastes input straight into its SSML template; `&`, `<`, `>` in lesson text (code!) will break the request. Always `text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")`. For code blocks, do not narrate the code literally; narrate a spoken explanation.
- **Long text streams at about real time.** 4 parallel passages of ~1,080 chars each (~78 s of audio each) took 64.8 s wall. 12 parallel short lines (one sentence each) took 11.8 s total, all 12 OK, no 429/403. **Chunk narration per paragraph (150-400 chars) and run ~8 requests in parallel**; never send a whole lesson as one request.
- Measured throughput: 12 lines in 11.8 s; 6 dialogue lines in 6.7 s. A 10-lesson course with ~3 min narration each (~120 chunks) is roughly 2-3 minutes of TTS with concurrency 8.

## 2. Two-host audio overview: pure byte concat WORKS (no ffmpeg needed)

Test: `scratch/media/dialogue-test.mjs`. Six lines alternating Ava (host A) and Andrew (host B) about hash tables, all six synthesized in parallel (6.7 s wall), then `Buffer.concat([line0, silence, line1, silence, ...])` written to `out/overview-concat.mp3`.

Why it works: Edge TTS output is raw MPEG-2 Layer III frames, header `FF F3 64 C4` (24 kHz, mono, 48 kbps CBR), **no ID3 tag, no Xing/VBR header**, every frame exactly 144 bytes = 24 ms (every file size was a multiple of 144). Same-format frames can be appended byte-for-byte.

Verification:
- `ffprobe` duration 33.864 s, bit_rate 48000.
- Full decode `ffmpeg -v error -i overview-concat.mp3 -f null -` printed **zero errors**, decoded time 33.86 s.
- The byte-based estimate `durationMs = bytes / 6000 * 1000` gave exactly 33,864 ms, so **timestamps can be computed from byte lengths alone** (CBR). Each host turn's start time = sum of previous byte lengths / 6. Word boundary offsets are relative to each line, so global word time = line start + word offset. This gives a synced, highlightable transcript for the overview player with zero audio tooling.
- Pause between turns: a 384 ms silent chunk (16 frames, 2,304 bytes) with the identical `FF F3 64 C4` header, made once with
  `ffmpeg -f lavfi -i anullsrc=r=24000:cl=mono -t 0.336 -c:a libmp3lame -b:a 48k -write_xing 0 -id3v2_version 0 silence-350.mp3`
  Commit that 2.3 KB file (or its base64) into the Skill; no ffmpeg at runtime.
- ffmpeg fallback also works: `ffmpeg -f concat -safe 0 -i list.txt -c copy out.mp3` in 0.1 s (it adds a 236-byte Xing header). Not needed.

Output files to listen to: `scratch/media/out/overview-concat.mp3`, `out/overview-transcript.json` (per-turn startMs/durMs).

## 3. OpenRouter: models, prices, one real structured-output call

Source: `GET https://openrouter.ai/api/v1/models` (no key; 458 models, saved as `scratch/media/models.json`) and `GET /api/v1/models/{id}/endpoints` (per-provider prices). Prices below are USD per 1M tokens.

### Budget reality (read from `/api/v1/key` and `/api/v1/credits`, free calls)
- Key limit $15 with **$12.80 remaining** on the key (weekly usage so far $2.20).
- **Account balance is lower: total credits $75, total usage $65.31 = $9.69 left.** The account balance is the real ceiling. Plan the build + demo on **$9.69**, not $12.
- This test spent $0.0000329.

### DeepSeek V4 (our main text model)

| model | in | out | context | max out | structured outputs |
|---|---|---|---|---|---|
| deepseek/deepseek-v4-flash | 0.013* | 1.28* | 1,048,576 | 943,718 | yes (`response_format` + `structured_outputs`) |
| deepseek/deepseek-v4-pro | 0.948* | 1.897* | 1,048,576 | 384,000 | yes |
| deepseek/deepseek-v4.1-flash (newer, text+image in) | 0.30 | 1.20 | 1,048,576 | 943,718 | yes |
| deepseek/deepseek-v4.1-flash:batch | 0.112 | 0.336 | 1,048,576 | 131,072 | yes (async batch, not for live demo) |

\* The model-level price is misleading: it shows the cheapest **input** provider (Relace, fp4), whose **output** is expensive ($1.28) and which does NOT support structured outputs. Per-provider prices for **v4-flash**:

| provider | in | out | structured outputs |
|---|---|---|---|
| Wafer | 0.065 | 0.170 | yes |
| StreamLake (fp8) | 0.083 | 0.165 | yes |
| DeepInfra (fp8) | 0.090 | 0.180 | yes |
| Venice | 0.097 | 0.193 | yes (served our test) |
| DigitalOcean | 0.098 | 0.196 | yes |
| Baidu / AtlasCloud / Parasail | 0.14 | 0.28 | yes |
| Relace (fp4) | 0.013 | 1.280 | **no** |
| OpenInference (fp4) | 0.014 | 1.152 | yes |
| Azure | 0.21 | 0.56 | no |

v4-pro cheapest structured-output providers: Parasail $0.45/$3.48 (89% uptime), StreamLake $0.948/$1.897, Cloudflare $1.15/$2.55.

**Always send this `provider` block** so routing never lands on an expensive-output or non-JSON provider:
```json
"provider": { "require_parameters": true, "max_price": { "prompt": 0.2, "completion": 0.4 } }
```
and `"reasoning": { "enabled": false }` for generation calls (the test used 0 reasoning tokens). Turn reasoning on only for the planner/validator step if quality needs it.

### The real call (`scratch/media/or-test.mjs`)
- Model `deepseek/deepseek-v4-flash`, `response_format: { type: "json_schema", json_schema: { strict: true, ... } }` for a quiz item `{question, options[4], answer_index, explanation, source_quote}` grounded in a 3-sentence "lecture slide".
- Result: HTTP 200, **614 ms end-to-end**, provider **Venice**, 93 prompt + 124 completion tokens, `usage.cost` = **$0.0000329**, `finish_reason: stop`, 0 reasoning tokens.
- JSON parsed cleanly, exactly 4 options, correct answer (`O(1 + alpha)`), and `source_quote` was a **verbatim** sentence from the source (checked with `SOURCE.includes(quote)`). That verbatim-quote check is a free, deterministic validator we can show in the demo ("every quiz answer is proven by a quote from your slides").
- `usage: { include: true }` returns `usage.cost` and `cost_details` directly in the response: no need to call `/generation` (which returned empty 2.5 s later anyway).

**Cost estimate per course** with v4-flash at ~$0.09 in / $0.18 out: 10 lessons x (6k in + 3k out) + outline + quizzes + validation, about 150k in + 60k out = ~$0.025. Even at 3x overhead (retries, validation passes) that is **~$0.08 per course, so $9.69 is 100+ courses**. Text cost is not the risk; image generation is.

### Other cheap text models with structured outputs (for comparison/fallback)
| model | in | out | ctx |
|---|---|---|---|
| openai/gpt-oss-120b | 0.037 | 0.17 | 131k |
| xiaomi/mimo-v2.6-flash | 0.14 | 0.28 | 1.05M |
| qwen/qwen3.5-flash-02-23 | 0.065 | 0.26 | 1M |
| google/gemini-2.5-flash-lite | 0.10 | 0.40 | 1M |
| qwen/qwen3.8-flash | 0.15 | 0.47 | 1M |
| anthropic/claude-haiku-5.5 | 0.10 | 0.50 | 1M |
| openai/gpt-6-luna | 0.10 | 0.50 | 1.05M |
Free with structured outputs exist (e.g. `thinkingmachines/inkling:free`, `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`) but free tiers rate-limit; do not rely on them in a live demo.

### Image-output models (output_modalities includes image)
| model | in | out (text) | image output | approx per image |
|---|---|---|---|---|
| google/gemini-3.1-flash-lite-image ("Nano Banana 2 Lite") | 0.25 | 1.50 | $30/M image tokens | ~$0.02-0.04 |
| google/gemini-2.5-flash-image ("Nano Banana") | 0.30 | 2.50 | $30/M | ~$0.039 (1,290 tokens per 1024px image) |
| google/gemini-nano-banana-2.1 | 1.50 | 7.50 | $30/M | ~$0.04+ |
| google/gemini-3.1-flash-image(-preview) | 0.50 | 3.00 | $60/M | ~$0.08 |
| google/gemini-3-pro-image(-preview) | 2.00 | 12.00 | $120/M | ~$0.15 |
| openai/gpt-5-image-mini | 2.50 | 2.00 | $8/M | cheap per token but high input price |
| openai/gpt-5-image | 10.00 | 10.00 | $40/M | expensive |
| openai/gpt-5.4-image-2 | 8.00 | 15.00 | $30/M | expensive |
Image rule: **cap images at ~1 hero image per lesson (or per course) with nano-banana-2-lite, cache them, and pre-generate the demo course.** 20 images = ~$0.80. Reuse the existing cobalt 3D objects (`img/11/obj-*.webp`) for UI decoration at zero cost. Product rule stands: generated images never contain text.

### Audio / TTS / music on OpenRouter
| model | what | price |
|---|---|---|
| google/lyria-3-clip-preview | music, 30 s clip, 48 kHz | **$0.04 per clip** (pricing fields read 0; price is per request, from the model description) |
| google/lyria-3-pro-preview | full-length song | **$0.08 per song** |
| openai/gpt-audio-mini | speech in/out (chat model) | text $0.60/$2.40; audio in $0.60/M, audio out $2.40/M tokens |
| openai/gpt-audio | speech in/out | text $2.50/$10; audio out $64/M tokens |
No dedicated cheap TTS model on OpenRouter; **Edge TTS (free) stays our narrator.** Lyria is a fun extra: one $0.04 intro jingle / focus-music loop per course is affordable (cache it, generate once for the demo).
Audio-input (speech understanding) models exist if we ever grade spoken answers server-side: `google/gemini-2.5-flash-lite` (audio in $0.30/M tokens, ~32 tokens/s, so ~$0.0006 per minute), `mistralai/voxtral-small-24b-2507`, `qwen/qwen3.8-omni-flash`, `xiaomi/mimo-v2.6-flash`. Not needed for the offline player.

## 4. Pyodide and the code sandbox: WORKS from file://, but only with a specific worker trick

**Latest Pyodide: 314.0.7** (new versioning; Python **3.14.2**). jsDelivr tags: latest 314.0.7, next 315.0.0-alpha.2, stable-0.29 = 0.29.5, stable-0.27 = 0.27.8. CDN base: `https://cdn.jsdelivr.net/pyodide/v314.0.7/full/` (also served at `cdn.jsdelivr.net/npm/pyodide@314.0.7/`). jsDelivr sends `Access-Control-Allow-Origin: *` and `cache-control: public, max-age=31536000`.

Core download (what `loadPyodide()` fetches before any package):

| file | raw | over the wire (br) |
|---|---|---|
| pyodide.mjs | 18 KB | 7 KB |
| pyodide.asm.mjs (was pyodide.asm.js in 0.2x; that name is now 404) | 1.25 MB | 262 KB |
| pyodide.asm.wasm | 9.60 MB | 3.44 MB |
| python_stdlib.zip | 2.55 MB | 2.51 MB |
| pyodide-lock.json | 119 KB | 25 KB |
| **total** | **~13.5 MB** | **~6.3 MB** |
numpy adds a few MB more on first `import numpy`.

Real browser test (`scratch/media/player-probe.html` opened as **file://** in Chrome 155 and Edge 154 via puppeteer-core, `probe-run.mjs`; results in `probe-chrome.json`, `probe-edge.json`):

| what | Chrome 155 | Edge 154 |
|---|---|---|
| `new Worker("py-worker.js")` from file:// | **fails**: "cannot be accessed from origin 'null'" | same |
| classic Blob worker + `importScripts(pyodide.js)` (v314) | **fails** (network error); fetch+eval gives "Classic web workers are not supported" (v314 dropped classic workers) | same |
| module worker from a **Blob** URL | **fails** even for a one-line worker on file:// | same |
| **module worker from a `data:` URL + `await import(".../pyodide.mjs")`** | **WORKS** | **WORKS** |
| cold load (fresh profile, ~6.3 MB download) | 10.8 s | 10.6 s |
| run `print(sys.version)` + expression | "3.14.2", value 285 | same |
| Python exception | clean `ZeroDivisionError: division by zero` | same |
| `while True: pass` with 2.5 s timeout | killed by `worker.terminate()` | same |
| restart worker after kill (HTTP cache warm) | **1.7 s** | 1.7 s |
| `import numpy` via `py.loadPackagesFromImports(code)` | works (~4 s first time) | works |

Recommended Python runner for the offline player (exactly what passed):
```js
const PYO = "https://cdn.jsdelivr.net/pyodide/v314.0.7/full/";
const src = `
  const { loadPyodide } = await import("${PYO}pyodide.mjs");
  const ready = loadPyodide({ indexURL: "${PYO}" });
  onmessage = async (e) => {
    const py = await ready; const { id, code } = e.data; let out = "";
    py.setStdout({ batched: s => out += s + "\n" }); py.setStderr({ batched: s => out += s + "\n" });
    try { await py.loadPackagesFromImports(code); const v = await py.runPythonAsync(code); postMessage({ id, out, value: String(v) }); }
    catch (err) { postMessage({ id, out, error: String(err).split("\n").slice(-2).join(" ") }); }
  };`;
const makePy = () => new Worker("data:text/javascript;charset=utf-8," + encodeURIComponent(src), { type: "module" });
// run with a timeout: setTimeout(() => { worker.terminate(); worker = makePy(); }, 5000)
```
- Start the worker lazily on the first code lesson (or on idle after page load) so the 10 s cold start is hidden; show "warming up Python" in the UI. In the demo, pre-warm by opening a code lesson before going on stage (then it is 1.7 s).
- **Truly offline Python is not possible from file://**: Chrome blocks `fetch()` of file:// URLs, so bundling the 13.5 MB Pyodide next to index.html does not help. Python needs the network once, then the browser HTTP cache (1-year max-age) serves it. Fallback when offline: the agent already runs every exercise during validation, so store `expected_output` in the course JSON and show it ("offline: here is what this prints") with the Run button disabled. If we ever need fully offline Python, ship a 20-line local static server (`npx serve` or a Node script) and open http://localhost.
- SQL exercises: same pattern with sql.js (`sql-wasm.wasm` ~0.6-1 MB) from CDN in a data: worker; or run SQL inside Pyodide's `sqlite3` module (already in the stdlib zip, zero extra download). **Recommendation: use Python's built-in `sqlite3` for SQL lessons** so there is one runtime.

**JavaScript runner** (both passed on file:// in Chrome and Edge):
- Sandboxed iframe `sandbox="allow-scripts"` + `srcdoc`, results via `postMessage`: ran code, captured console.log, and `parent.document` was blocked (opaque origin). Good for HTML/CSS/DOM exercises (render the user's HTML live inside it). Weakness: an infinite loop in a same-process iframe can freeze the page.
- **Classic Blob worker** (classic Blob workers DO work on file://; only module Blob workers fail) with `(0, eval)(code)` and `worker.terminate()` after 1.5 s: `while(true){}` was killed cleanly. **Use the Blob worker for plain JS logic exercises, the sandboxed iframe for HTML/DOM exercises.**

## 5. Speech recognition for speaking drills

Measured on file:// (headless Chrome 155 / Edge 154; file:// counts as a secure context, `isSecureContext: true`):

| check | Chrome 155 | Edge 154 |
|---|---|---|
| `SpeechRecognition` and `webkitSpeechRecognition` exist | yes / yes | yes / yes |
| on-device API `SpeechRecognition.available()` exists | yes | yes |
| `available({langs:["en-US"], processLocally:true})` | "downloadable" | "unavailable" |
| `available({langs:["ms-MY"], processLocally:true})` | **"unavailable"** | **"unavailable"** |
| `available({langs:["en-US"], processLocally:false})` (cloud) | "available" | "available" |
| `available({langs:["ms-MY"], processLocally:false})` (cloud) | **"available"** | **"available"** |
| `MediaRecorder` audio/webm;codecs=opus, audio/mp4 | yes, yes | yes, yes |
| `getUserMedia` | yes | yes |
| speechSynthesis voices (headless) | 5 local SAPI voices, no ms-MY | same |

What this means:
- **Malay speech recognition works only through the cloud service** (Google's for Chrome, Microsoft's for Edge): needs internet. English can run on-device in Chrome after a model download. Set `rec.lang = "ms-MY"`, `rec.interimResults = true`, `rec.maxAlternatives = 3` and compare the transcript to the target phrase with a normalized word-overlap score (lowercase, strip punctuation; for Malay also accept common spelling variants).
- Not verified here (needs a mic and a human): the actual transcription quality for Malay. Test it once by hand in Edge before the demo; Edge's online recognizer is generally good for ms-MY.
- **Fallback (always available, offline):** record with `MediaRecorder` (webm/opus), play back the learner's take next to the Edge-TTS reference audio, and let the learner self-rate (Again / Good / Easy feeds SM-2/FSRS). Feature-detect: `if (!SR || (await SR.available?.({langs:[lang], processLocally:false})) === "unavailable" || !navigator.onLine) useRecordAndCompare()`.
- Do not use `speechSynthesis` for narration: in headless it showed only local SAPI voices and no Malay; Edge-TTS mp3 files baked into the course are consistent everywhere and work offline.

## 6. Mermaid + KaTeX for a single-file offline player

Versions: **mermaid 12.1.0**, **katex 0.19.0** (npm latest). Both loaded fine from jsDelivr on a file:// page in Chrome and Edge (KaTeX via `<script>`, Mermaid via `await import(".../mermaid.esm.min.mjs")`; flowchart rendered in 1.6-2.4 s cold).

| asset | raw | brotli |
|---|---|---|
| mermaid.min.js (UMD, everything in one file) | **5.49 MB** | 1.49 MB |
| mermaid.esm.min.mjs entry (+104 lazy chunks, 5.36 MB total on CDN) | 31 KB | 12 KB |
| Mermaid ESM actually pulled to render flowchart + sequence + mindmap | ~2.6 MB decoded, 33 requests | |
| katex.min.js | 273 KB | 76 KB |
| katex.min.css | 25 KB | 3.5 KB |
| KaTeX fonts (20 woff2) | 260 KB | (already compressed) |

Recommendation: **render both at build time, ship zero runtime JS for them.**
- **KaTeX:** the agent calls `katex.renderToString(tex, { throwOnError: false })` in Node while assembling the course. The player only needs `katex.min.css` + the woff2 fonts (inline as base64 `@font-face`: ~350 KB, or subset to the 6-8 fonts actually used: ~120 KB). No katex.js in the player.
- **Mermaid:** pre-render to SVG with puppeteer-core driving the already-installed Edge/Chrome (no Chromium download). Tested in `scratch/media/mermaid-prerender.mjs`: flowchart 17 KB SVG in 1.5 s (first, includes loading), sequence 26 KB in 0.12 s, mindmap 32 KB in 0.48 s, themed with cobalt `#2340E6` / ink `#0B0D10` via `theme: "base"` + `themeVariables`. Outputs: `scratch/media/out/mermaid-*.svg`. Inline the SVGs in the course HTML.
- If build-time rendering is too much plumbing for the hackathon, fallback: lazy `import()` of mermaid ESM from jsDelivr only when a diagram is on screen (online only), with the diagram source shown as a code block when offline. Never inline the 5.5 MB UMD build.

## 7. MCP SDK: two maintained lines, both tested working over stdio

`npm view` (2026-10-10):
- **`@modelcontextprotocol/sdk` 1.32.1** (v1 line, published 2026-10-05; deps include express/hono/ajv; peer `zod ^3.25 || ^4.0`). The one every tutorial and most hosts use.
- **`@modelcontextprotocol/server` 2.3.1** + `@modelcontextprotocol/client` 2.3.1 + `@modelcontextprotocol/core` 2.3.1 (v2 split packages, 2026-10-05; server depends only on `zod ^4.2` + core). v2 `serveStdio()` serves both the 2025-era `initialize` handshake and the newer protocol revision.

Test (`scratch/media/mcp/`): both servers below were spawned over stdio by the v1 `Client` + `StdioClientTransport` (i.e. a 2025-era client, like WorkBuddy/CodeBuddy are likely to be). Results: tool listed with JSON Schema `required: ["goal","sourceDir"]` (zod `.default()` makes `days` optional), `outputSchema` advertised, valid call returned `structuredContent`, invalid call returned `isError: true` with a readable zod message ("Too small: expected string to have >=3 characters at goal"). Spawn + list + 2 calls: **~0.5-0.6 s** via `tsx`.

**Recommendation: use v1 `@modelcontextprotocol/sdk@1.32.1` for the hackathon** (maximum host compatibility, most examples). v2 also passed; switch only if a host requires the new protocol.

Minimal server (v1, tested as `server-v1.ts`):
```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "bilimind", version: "0.1.0" });

server.registerTool(
  "plan_course",
  {
    title: "Plan a course",
    description: "Turn a learning goal and source files into a roadmap of lessons with an archetype per topic.",
    inputSchema: {                       // v1: a raw zod shape (v2: wrap in z.object)
      goal: z.string().min(3).describe("One sentence goal, e.g. 'Data Structures final on Friday'"),
      sourceDir: z.string().describe("Absolute path to the folder with lecture files"),
      days: z.number().int().min(1).max(60).default(5),
    },
    outputSchema: { lessons: z.array(z.object({ title: z.string(), archetype: z.string() })) },
  },
  async ({ goal, sourceDir, days }) => {
    console.error(`[bilimind] plan_course ${goal}`);   // stdout is the protocol: log to stderr only
    const out = { lessons: [{ title: "Hash functions", archetype: "concept" }] };
    return { content: [{ type: "text", text: JSON.stringify(out) }], structuredContent: out };
  },
);

await server.connect(new StdioServerTransport());
```
v2 equivalent (tested as `server-v2.ts`): `import { McpServer } from "@modelcontextprotocol/server"; import { serveStdio } from "@modelcontextprotocol/server/stdio";` then `serveStdio(() => { const s = new McpServer({name, version}, { capabilities: { tools: {} } }); s.registerTool(name, { inputSchema: z.object({...}), outputSchema: z.object({...}) }, handler); return s; });`

Host config (WorkBuddy/CodeBuddy `mcpServers` JSON, same shape as Claude/Cursor): `{"mcpServers":{"bilimind":{"command":"node","args":["C:/path/bilimind-mcp/dist/server.js"],"env":{"OPENROUTER_API_KEY":"..."}}}}`. Ship compiled JS (or `node --import tsx`), never `npx` (npm is blocked on campus Wi-Fi, see section 0). Long tools (course generation takes minutes): return quickly per step (plan, write_lesson, narrate, validate, build_player) so the agent shows progress and can run steps in parallel, instead of one 5-minute tool call that may hit the host's tool timeout.

Edge TTS voice catalogue (live `getVoices()`): **322 voices, 142 locales.** Malay: `ms-MY-YasminNeural` (F), `ms-MY-OsmanNeural` (M). Malaysia's other languages are covered too: Tamil `ta-MY-KaniNeural`, `ta-MY-SuryaNeural`; Mandarin: 6 `zh-CN` voices. Multilingual voices (read mixed-language text naturally): en-US Ava, Andrew, Brian, Emma; en-AU William; fr-FR Vivienne, Remy; de-DE Seraphina, Florian; it-IT Giuseppe; ko-KR Hyunsu; pt-BR Thalita. Pitch line: "narrated in English, Bahasa Melayu, Mandarin or Tamil, for free."

## 8. Recommended versions (all checked with `npm view` on 2026-10-10 via npmmirror)

| package | version | notes |
|---|---|---|
| vite | **8.3.4** | node ^20.19 or >=22.12 (we have 24.19) |
| vue | **3.5.43** | |
| @vitejs/plugin-vue | **6.0.10** | peer vite ^5-^8 |
| vite-plugin-singlefile | **2.3.3** | peer vite ^5.4-^8, rollup ^4.59 |
| typescript | **6.0.3** (not 7.0.2) | **TS 7.0.2 is `latest` but is the native Go compiler with no classic JS API** (`require("typescript").createProgram` is undefined). Tested: `vue-tsc 3.3.12` crashes on TS 7 with `ERR_PACKAGE_PATH_NOT_EXPORTED './lib/tsc'`. TS 7's own `tsc --noEmit` works and is fast (0.23 s on the MCP server). Pin `typescript@~6.0.3` if we use vue-tsc; or skip vue-tsc (Vite does not typecheck) and use TS 7 only for the Node packages. |
| vue-tsc | 3.3.12 | only with typescript 6.x; optional for a hackathon |
| tsx | **4.23.15** | runs the MCP server/TS scripts without a build step |
| zod | **4.6.5** | works with MCP SDK v1 (peer ^3.25 or ^4) and v2 (^4.2) |
| @modelcontextprotocol/sdk | **1.32.1** | see section 7 (v2 alt: @modelcontextprotocol/server 2.3.1) |
| unpdf | **1.8.1** | PDF text extraction; node >=22; optional peer @napi-rs/canvas only for rendering pages to images (skip) |
| mammoth | **1.13.0** | .docx to HTML/text |
| @mozilla/readability | **0.6.0** | last publish 2025-03-03 (stable, not abandoned); pair with linkedom |
| linkedom | **0.18.13** | DOM for Readability in Node |
| ts-fsrs | **5.4.2** | FSRS scheduler (node >=20); use it to compute the review dates that go into the .ics and the Anki due dates |
| ics | **3.12.1** | study plan .ics |
| sql.js | **1.14.2** | build Anki `collection.anki2` (SQLite) for .apkg in Node |
| fflate | **0.8.3** | zip the .apkg (and course export); prefer over jszip (smaller, faster, sync API) |
| jszip | 3.10.2 | only if a dependency needs it |
| commander | **15.0.0** | node >=22.12 OK |
| msedge-tts | **2.0.9** | narration (section 1) |
| puppeteer-core | **25.13.0** | drives installed Edge/Chrome for Mermaid pre-render and player smoke tests; no Chromium download |
| katex | **0.19.0** | build-time `renderToString` |
| mermaid | **12.1.0** | build-time SVG via puppeteer-core |
| marked | 18.1.0 | Markdown lessons to HTML if needed |
| shiki | 4.5.0 | build-time code highlighting (zero runtime JS) |

Install line for the hackathon package (works on campus Wi-Fi):
```
pnpm add --registry=https://registry.npmmirror.com @modelcontextprotocol/sdk@1.32.1 zod@4.6.5 msedge-tts@2.0.9 unpdf@1.8.1 mammoth@1.13.0 @mozilla/readability@0.6.0 linkedom@0.18.13 ts-fsrs@5.4.2 ics@3.12.1 sql.js@1.14.2 fflate@0.8.3 commander@15.0.0 katex@0.19.0 puppeteer-core@25.13.0
pnpm add -D --registry=https://registry.npmmirror.com vite@8.3.4 vue@3.5.43 @vitejs/plugin-vue@6.0.10 vite-plugin-singlefile@2.3.3 typescript@6.0.3 tsx@4.23.15
```

## Files produced (all in `hackathon/scratch/media/`)
- `tts-test.mjs`, `dialogue-test.mjs`, `burst.mjs`, `control.mjs`, `one.mjs`, `raw.mjs`, `voices.mjs`: Edge TTS tests.
- `out/*.mp3` (5 voices, EN + Malay), `out/*.json` (word/sentence boundaries), `out/overview-concat.mp3` (two-host overview, byte-concatenated), `out/overview-transcript.json`, `out/silence-350.mp3` (reusable 2.3 KB pause).
- `or-test.mjs` (the one OpenRouter call), `models.json` (full model list snapshot).
- `player-probe.html` + `probe-run.mjs` (file:// browser probe), `probe-chrome.json`, `probe-edge.json`, `worker-diag*.html`.
- `mermaid-prerender.mjs`, `out/mermaid-{flow,seq,mind}.svg`.
- `mcp/server-v1.ts`, `mcp/server-v2.ts`, `mcp/client-test.mjs`.
