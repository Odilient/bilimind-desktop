# WP1 status: engine I/O (config, llm, ledger, cache, log, ingest, retrieve)

Owner files: `src/{config,llm,ledger,cache,log,retrieve}.ts`, `src/ingest/*`, tests `test/{llm,ledger-config,ingest}.test.ts`,
`test/wp1-helpers.ts`, `test/live/probe.ts` (live, not part of `vitest run`).

## Works

- **config.ts** `loadConfig`: key lookup `%USERPROFILE%\.bilimind\config.json` -> env vars -> `.env.local` (walks up from
  repoRoot, cwd and the module dir). Provider: `BILIMIND_PROVIDER` > config.json `provider` > deepseek when its key exists >
  openrouter. Presets: deepseek `https://api.deepseek.com` (`deepseek-flash` / `deepseek-v4-pro`, balance `/user/balance`),
  openrouter `https://openrouter.ai/api/v1` (`deepseek/deepseek-v4-flash`, balance `/credits`). `BILIMIND_MODEL_FAST/SMART`
  apply only when they fit the provider (the `.env.local` values are OpenRouter ids). Overrides: `BILIMIND_BASE_URL`,
  `BILIMIND_RUN_CAP_USD`, `BILIMIND_DAY_CAP_USD`, `BILIMIND_RESERVE_USD`, `BILIMIND_DEMO_DAY=1`, `BILIMIND_HOME` (tests).
- **llm.ts** `callJson` (port of LlmClient::json): schema rendered into the system prompt (`describeSchema` = SchemaValidator::describe,
  verbatim error strings), `response_format json_object`, JSON repair (fence, braces, trailing commas), ONE corrective turn for
  schema/`validate` errors, one restart with the budget override on a truncated reply, transport/429/5xx back off and retry
  (3 HTTP attempts), any other 4xx stops at once (401/402 get specific messages, keys redacted). Reasoning only when
  `req.reasoning`: DeepSeek `thinking {type: enabled|disabled}` (temperature only when disabled, `BILIMIND_REASONING_EFFORT`
  optional); OpenRouter `reasoning {enabled}`, `usage.include`, `provider {require_parameters, max_price {0.2, 0.4}, allow_fallbacks}`
  for deepseek/* models. Safety net: a 400 naming `response_format`/`thinking`/`reasoning_effort` drops that one parameter
  once and retries. `deepseek-v4-pro` is refused unless `BILIMIND_ALLOW_EXPENSIVE=1`. Cache by sha256(provider:model:mode +
  messages) in `crew/cache/` unless `--no-cache`; a hit costs $0 (ledger line with `cached: true`). Default timeout 240 s
  (`BILIMIND_LLM_TIMEOUT_MS`).
- **DeepSeek cost**: price table from https://api-docs.deepseek.com/quick_start/pricing (read 2026-10-10), USD/1M peak:
  flash hit 0.006 / miss 0.30 / out 1.20; v4-pro 0.044 / 1.32 / 3.96. Off-peak (everything outside Mon-Fri 01-04 and
  06-10 UTC, so the whole weekend) is half. Peak/off-peak is decided from the API's own `Date` header (this PC's clock is off).
- **ledger.ts**: `%USERPROFILE%\.bilimind\ledger.jsonl`; refuses when `--max-usd`, the per-course cap ($0.25 =
  one course folder), the day cap ($2.00, UTC day) or the live balance minus the provider reserve would be crossed;
  `BILIMIND_DEMO_DAY=1` lifts the reserve. Reserves follow PLAN 6.2: **DeepSeek $3.00, OpenRouter $4.00**
  (the WP1 acceptance line says $4; set `BILIMIND_RESERVE_USD=4` to use $4 for both). Balance read once a minute per
  process; spend since then is subtracted. Unreachable balance = continue on caps only (progress line).
- **cache.ts / log.ts**: as contracted. `appendLog` redacts keys; `readLog` skips torn lines; `note` validates the text
  (the CLI's runCommand writes the log line with `result = text`).
- **ingest/**: pdf (unpdf, `verbosity: 0` so pdf.js never writes to stdout; one section per page; `Slide N` when >= 60% of
  pages are landscape, else `Page N`; pages with < 3 visible chars -> `scanned_pages`; running headers/footers on >= 60%
  of pages stripped), pptx (fflate; presentation.xml order; `<a:t>` + speaker notes through the slide rels; picture-only
  slides -> `scanned_pages`), docx (mammoth with Title/Heading 1-3 style map, split on h1/h2, tables as `a | b` rows,
  dc:title), md/txt/html. SaaS chunker (1200/150, paragraph then word boundaries, never across sections). Digest <= 6000
  chars, equal share per non-past-paper file, slides picked evenly first-to-last, back matter (references/licence) skipped.
  Roles: scored heuristics + file name (past_paper / syllabus / sop / lecture). Titles: PDF/docx metadata when meaningful
  (`Lecture 2 · Hash Tables`), else from the file name. `LICENSE*.md`, `STATUS.md`, `NOTICE`, dotfiles and `~$` files are skipped.
- **retrieve.ts**: minisearch (content + locator + title), SaaS term recipe (stopwords, >= 3 chars, <= 24 terms, prefix on
  >= 4), substring fallback, `retrieveForLesson` fills up to `minimum` from substring then 5-letter stems (never zero-overlap chunks).
- **Real files**: ds-final ingests in ~0.7 s: 4 decks `Slide N` (16/16/15/14), `past-paper.pdf` = `past_paper`, 65 chunks,
  digest 5948 chars, LICENSE.md skipped. boba-day-one: SOP docx = `sop`, 20 heading sections, menu table intact.
  bm-survival: 2 md files. dormathon-briefing: 41 slides, scanned pages 6, 9-14 reported. Also verified under
  WorkBuddy's bundled Node 22.22.2 (runs the .ts directly).
- **Live** (2 calls, $0.000043 total, 2026-10-10): DeepSeek direct `deepseek-flash` 140/12 tok, $0.000028, 1.0 s;
  OpenRouter pinned `deepseek/deepseek-v4-flash` 140/13 tok, $0.000015, 1.9 s. Both returned valid schema JSON on attempt 1.
- **Tests**: `pnpm -F @bilimind/engine exec vitest run test/llm.test.ts test/ledger-config.test.ts test/ingest.test.ts`
  -> 51 passed (mocked fetch; hand-written PDF and hand-built PPTX fixtures; ds-final/boba checks skip when the folder is absent).

## Extra exports (beyond the contract, all optional to use)

- llm.ts: `setEngineConfig(cfg|null)` (harness/test override), `activeConfig()`, `describeSchema`, `validateSchema`,
  `decodeJsonObject`, `outputContract`, `corrective`, `budgetOverride`, `FAILURE`, `costOf`, `estimateCost`, `isDeepseekPeak`,
  `DEEPSEEK_PRICES`, `OPENROUTER_PRICES`.
- ingest: `ingestFolder(dir, {roles, progress})`, `sourceText(ingest, materialId, {markers})` (a file's text without the chunk
  overlaps), `isIgnoredSource(name)` (init can use it when copying sources), `kindOf`, `titleFromName`, `titleFromMeta`,
  `chunkText`, `formatNoun`, `spread`, `roleScores`, `htmlToSections`, `markdownSections`, `extractPptxBuffer`.
- retrieve.ts: `lectureChunks(ingest)` (excludes past papers), `renderChunks(chunks, maxChars)` (`[material_id=<chunk id> · title · locator]`).
- config.ts: `PRESETS`, `redact`, `providerLabel`, `keyHint`, `parseDotenv`. ledger.ts: `readLedger`, `parseBalance`, `resetBalanceCache`.

## Stubbed / not done

- DeepSeek thinking mode (`reasoning: true`) together with `json_object` was not live-tested (the lane allowed 2 calls);
  the 400 safety net covers a refusal. WP2's first live outline call will show it.
- No OCR for scanned pages (reported only). pptx tables/charts text is not extracted (only `<a:t>` text).
- Chinese public holidays are treated as peak (can only over-count cost).

## Next

- Record the first real outline/draft costs per call from the ledger into PLAN 6.1 (DeepSeek direct output is ~6x the
  OpenRouter pinned price per token: $1.20/M peak, $0.60/M off-peak vs $0.17-0.19/M).
