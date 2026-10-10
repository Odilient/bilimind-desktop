# BiliMind Desktop — Open-source rivals, adjacent tools and commercial study apps

> Research date: 2026-10-10. Status: IN PROGRESS (sections are filled as they are finished).
> Purpose: decide what BiliMind Desktop (Node/Electron, BYOK, local markdown vault, single user) must ship to be the best NotebookLM-class study tool on the market, and steal the install/UX patterns that make the best desktop AI apps painless.

## 0. TL;DR

_pending_

## 1. Method and caveats

_pending_

## 2. Product-by-product notes — open source NotebookLM-class

Stars / licence / last release were pulled live from the GitHub API on 2026-10-10. "Install" is judged from the point of view of a student, not a developer.

### Snapshot table

| Project | Stars | Licence | Stack | Latest release | Ships a real desktop installer? | Status |
|---|---|---|---|---|---|---|
| **HKUDS/DeepTutor** | 41.1k | Apache-2.0 | Python 3.11+ / FastAPI + Next.js 16 | v1.6.5 (2026-09-06), pushes daily | No — Docker, `pip install deeptutor` (needs Python **and** Node 20 on PATH), or source | Very active, the fastest-moving rival; closest to "AI course + tutor" |
| **lfnovo/open-notebook** | 40.0k | MIT | Python / FastAPI + Next.js + SurrealDB + LangChain (Esperanto lib for providers) | v1.15.0 (2026-10-04) | No — Docker Compose only (2 services), port 8502 | Active; the default "open NotebookLM" in every 2026 listicle |
| **MODSetter/SurfSense** | 16.3k | Apache-2.0 (README); repo licence field "NOASSERTION", older lists mention a BSL path | Python + Electron desktop | v2.2.0 (2026-10-09) | **Yes** — `.exe`, arm64 `.dmg`, AppImage, `.deb`; no account | Pivoted in 2026 from hosted SaaS to an air-gapped desktop app; hosted web app sunsets **18 Oct 2026** |
| **Cinnamon/kotaemon** | 25.8k | Apache-2.0 | Python / Gradio | v0.12.0 (2026-05-31) | Partial — a `.zip` with run scripts; Docker recommended | Slowing (no push since July 2026) |
| **khoj-ai/khoj** | 37.6k | AGPL-3.0 | Python / Django + Next.js | 2.0.0-beta.28 (2026-03-26) | Desktop client existed; self-host is pip/Docker | Slowing; the team's attention moved to **Pipali** (an "AI coworker on your computer") |
| **onyx-dot-app/onyx** (ex-Danswer) | 32.4k | MIT core + EE dirs | Python / Next.js / Vespa | v4.9.0 (2026-10-07) | `curl install_onyx.sh \| bash` (Docker); has a desktop client to a server | Active, but team/enterprise search, not study |
| **run-llama/notebookllama** | 2.0k | MIT | Python / Streamlit, LlamaCloud | v0.4.0 (2025-07-17) | No — `uv sync`, needs OpenAI + ElevenLabs + LlamaCloud keys | Demo-grade, cloud-dependent |
| **Meta NotebookLlama** (in `meta-llama/llama-cookbook`) | 18.6k (cookbook) | MIT | Jupyter notebooks | n/a | No | A 4-notebook recipe (PDF→clean text→transcript→re-write→TTS), not an app |
| **souzatharsis/podcastfy** | 6.6k | Apache-2.0 | Python lib + CLI | v0.4.0 (2024-11-16) | No | Library powering Open Notebook / SurfSense podcasts; dormant since May 2026 |
| **gabrielchua/open-notebooklm** | 2.6k | Apache-2.0 | Python / Gradio (HF Space) | none | No | Abandoned (last push Dec 2024) |
| **zijinz456/OpenTutor** | 138 | MIT | Python / FastAPI + Next.js 16 | none | No — Docker Compose or `scripts/quickstart.sh` | Tiny but feature-dense; useful as a design reference |
| **infiniflow/ragflow** | 91.9k | Apache-2.0 | Go/Python | active | No (Docker) | RAG engine, not a study app; best-in-class deep document parsing |
| **HKUDS/LightRAG** | 40.0k | MIT | Python | active | n/a | Graph-RAG library (DeepTutor ships it) |
| **stanford-oval/storm** | 31.6k | MIT | Python | last push 2025-09 | n/a | "Research a topic → Wikipedia-style cited report" — the pattern for our "course from a topic with no sources" |

### 2.1 DeepTutor (HKUDS) — the most dangerous rival

What it is: an "agent-native learning workspace" from HKU's Data Intelligence Lab (arXiv 2604.26962). v1.0 rewrite April 2026; ~40 releases since. Single agent loop ("ChatOrchestrator") behind every mode.

Modes / surfaces (exact names from the README):
- **Chat** (default) — one thread can call tools, ground on selected knowledge bases, read attachments, generate images/video, consult sub-agents, write notebook records. Context has two kinds: **sticky session context** (capability, workspace/course, tools, KBs, persona, model, Reading/Mastery state) and **one-time references** from a `+` menu (files, chat history, books, reading sections, notebooks, question-bank entries, imported agents) for a single turn.
- User-toggleable tools: `brainstorm`, `web_search`, `paper_search`, `zotero_search`, `reason`, `geogebra_analysis`, `imagegen`, `videogen`. Contextual tools mount automatically: `rag`, `kb_files`, `knowledge_frontier` (find work beyond the KB), `read_source`, `read_memory`, `write_memory`, `read_skill`, `exec`, `web_fetch`, `ask_user`, `list_notebook`, `write_note`, `question_bank`, `github`, `consult_subagent`, `workspace_*`.
- Capabilities runnable from CLI: `chat`, `ask_questions`, `deep_solve`, `deep_question`, `deep_research`, `visualize`, `math_animator` (Manim), `mastery_path`, `immersive_reading`, `course_study`, `audio_overview`.
- **Book — "living books from your materials"**: starts from KBs, notebooks, question banks or chat history; **proposes a chapter outline ("spine") first, with a cost estimate, before generating**; each chapter compiles into **typed blocks** — text, callouts, quizzes, flash cards, timelines, code, figures, interactive HTML, animations, concept graphs, deep dives, user notes — each with **Page Chat**. Blocks can be inserted, moved, regenerated, rewritten, or switched to another type. Selected passages go into a "learning-capture inbox". Progress, bookmarks, quiz attempts are private per reader even on shared books. Books stream while they compile, long compiles pause/resume, export to Markdown, and `book health` / `refresh-fingerprints` flag **source drift** (source changed after the book was built).
- **Mastery Path** — a gated path whose modes restrict the tools available; graded answers flow into the **Question Bank**; turns read the path's status before the first model call.
- **Practice** — from a question-bank selection: review sessions, mistake tracking, scheduled repetition.
- **Immersive Reading** — document (PDF/EPUB faithful rendering + annotations), YouTube/Bilibili video (native playback, transcript search, timestamp-grounded tutoring, resumable progress) or audio beside the thread; cited page by page; actions: read-aloud, study guidance, vocabulary, quiz, translation, notebook capture.
- **Co-Writer** — split-view Markdown editor with live preview (KaTeX, diagram fences), selection-aware AI edits, `.docx` import/export.
- **Visualize** — plugin catalogue (Chart.js, SVG, Mermaid, merged with Math Animator).
- **Memory** — file-backed three layers: L1 append-only event trace (`trace/<surface>/<date>.jsonl`), L2 per-surface curated facts (`L2/<surface>.md`), L3 cross-surface synthesis (`L3/*.md`), shown as a **Memory Graph** with evidence edges. Explicitly "not a hidden vector store" — this is the inspectable-memory idea we should copy into vault files.
- **Knowledge Center** — choice of retrieval engines per KB: LlamaIndex (hybrid vector+BM25, optional cross-encoder rerank, FAISS), PageIndex (page-level citations), GraphRAG, LightRAG, remote LightRAG, WeKnora, Tencent IMA, MarginNote 4, Kiwix ZIM, **linked Obsidian vault**. Has `deeptutor kb eval` reporting Recall@k / Precision@k / nDCG@k / MRR / MAP / Hit@k against a JSONL gold set.
- **Skills** in the open Agent-Skills `SKILL.md` format, with its own registry **EduHub** (Socratic tutors, flashcard builders, essay feedback, exam blueprints) plus ClawHub; import gate strips `always:` frontmatter and checks archives for traversal/zip-bombs.
- **Partners** — persistent companions with a `SOUL.md`, own memory, on 15 IM channels (Feishu, WeCom, WeChat via QR, Matrix, Zulip...).
- **Task Board** (To do / In progress / Done), **learner/guardian accounts** (guardian approves materials, sees reports), multi-user with grants.
- Operable by other agents: `deeptutor run <capability> --format json` streams NDJSON events (`content`, `tool_call`, `tool_result`, `done`).

Weaknesses we can exploit:
1. **Install** — Python 3.11–3.14 + Node 20 + optional ffmpeg/LaTeX for Manim; or Docker. The README's first suggestion is literally "paste this prompt into Claude Code/Codex to install it for you". No signed `.dmg`/`.exe`.
2. **Surface sprawl** — ~10 capabilities, Partners, Task Board, IM channels, multi-user grants. The README itself needs a "tour". A student who wants "teach me this" has to pick a mode.
3. **Data lives in its own tree** (`data/user/...`, `.deeptutor/data/`) not in a human-readable vault; Book exports to Markdown but is not *authored* as Markdown.
4. Chinese-ecosystem-first integrations (Feishu, WeCom, Bilibili, DashScope, Doubao) — fine, but a signal of audience.

### 2.2 Open Notebook (lfnovo) — the reference "open NotebookLM"

Model: **Notebook → Sources + Notes + Chat sessions**, plus **Podcasts**, **Transformations**, **Search**.
- **Sources**: PDFs, video, audio, web pages, Office docs, YouTube; a 3-step **Add Source wizard** (add → configure → **Process**, where you tick transformations to run on ingest; batch upload applies the selection to all items).
- **Insights / Transformations**: a transformation is a saved prompt run on one source; output saved as an **insight** (Markdown) on that source. Fields: `name` (unique id, e.g. `key_topics`), `title`, `description`, `system_prompt` (source full text appended after it), `model` (or System Default), `suggest by default on new sources`. Six built-ins: **Paper Analysis, Key Insights, Dense Summary (pre-selected), Reflection Questions, Table of Contents, Simple Summary**. Has a **Playground** tab to test a prompt on pasted text without saving. Sources > ~105k tokens auto-route to a **Large Context Model**.
- **Per-item context levels** (the single best UX idea in the category): click a context icon on each source/note card to cycle **Not included → Insights only → Full content**; header menus "Include all (insights only) / Include all (full content) / Exclude all". A panel above the chat box shows **how many sources/notes are in context and an estimated token count**. (Weakness: choices are not persisted across reloads.)
- **Chat**: sessions (named, switchable), per-session model override, `Ctrl/⌘+Enter` to send, **Save to note** on any answer (creates an "AI Generated" note, no dialog), numbered references — but **references point to whole items, not passages/pages**. Separate **Source Chat** (source on left, chat on right; truncated at ~50k tokens).
- **Podcasts**: **Speaker profile** (voice model + 1–4 speakers each with name, Voice ID, backstory, personality; per-speaker TTS override) and **Episode profile** (speaker profile, outline model, transcript model, **segments 3–20**, default briefing, language locale e.g. `pt-BR`, max output tokens default 8192). Pipeline: OUTLINE (N segments) → TRANSCRIPT (segment by segment) → AUDIO (line-by-line TTS, concatenated). Ships `tech_discussion`, `solo_expert`, `business_analysis` episode profiles. Failed episodes land in **Failed Episodes** with a **Retry** button and an explanatory NOTE per error class (e.g. "Invalid speaker name — retrying usually works"). Documents a "Privacy: what each model sees" table per step — copy this.
- **Search**: full-text + vector across everything. **REST API** (FastAPI, `/docs`), **MCP integration**, optional password. 14 UI languages. 20+ providers via the Esperanto library with a published provider × {LLM, embedding, STT, TTS} matrix; one-click **Test** connection and **Auto-assign Defaults** for model roles (chat, transformation, large-context, embedding, TTS, STT).

Weaknesses: Docker-only; no flashcards/quiz/spaced repetition/study plan; no course structure; passage-level citation missing; no mind map/infographic/slides/video; context selection not saved.

### 2.3 SurfSense — the only OSS rival with a real desktop installer

v2.x is "a free, open-source desktop app for documents you can't upload": index on disk, no account, any OpenAI-compatible or local model. Format matrix (from README): PDF (cited answers incl. OCR of scanned pages; create; fill/flatten forms, watermark, page numbers; merge/split/rotate), DOCX (edit as **tracked changes and comments**, create from a template), XLSX (reads formulas; creates native charts; pandas analysis), PPTX (create from template, replace text), CSV, images (OCR Latin/CJK), Markdown, HTML, **podcast** (voiced locally by default, with transcript), **mind maps, flashcards, quizzes** in-app. Edits always produce a new file — "your original is never changed". LibreOffice optional for conversions (never in the installer).

Takeaways: SurfSense proves the market is moving to **desktop + local index + no account** — exactly our shape — but its centre is document *agent work* (edit/convert files), not learning. Its "never mutate the original; write a copy" rule is one to copy.

### 2.4 Kotaemon

Gradio RAG UI. Best idea: **citations with an in-browser PDF viewer that highlights the cited span and shows a relevance score**, plus a **warning when retrieval returned low-relevance passages**. Hybrid full-text + vector retrieval with re-ranking; question decomposition for multi-hop; ReAct/ReWOO agents; GraphRAG/LightRAG indexing options; figures-and-tables multimodal parsing; settings UI exposes retrieval and prompts.

### 2.5 Khoj

Personal AI "second brain": chat with local or online LLMs over your docs (PDF, Markdown, org-mode, Word, Notion, images) and the web; custom agents (persona + knowledge + model + tools); **scheduled automations** that email you research newsletters; clients for browser, Obsidian, Emacs, desktop, phone, WhatsApp. AGPL. Momentum has shifted to Pipali. Useful pattern: **scheduled, proactive research digests** ("every Monday, summarize new papers on X").

### 2.6 Onyx (ex-Danswer)

Team knowledge layer: 50+ connectors with permission sync, agentic RAG on a hybrid index, Deep Research, custom agents, sandbox code execution, artifacts, voice mode, MCP server, Chrome extension, Slack/Discord bots. Not a study tool; relevant only for "connectors" and "deep research" patterns.

### 2.7 NotebookLlama (LlamaIndex) and Meta's NotebookLlama recipe

LlamaIndex's version: Streamlit app; LlamaCloud parses + indexes, OpenAI writes, ElevenLabs voices; produces summary, bullet points, FAQ, a mind map and a podcast. Meta's recipe: 4 notebooks — (1) Llama-3.2-1B cleans PDF text, (2) Llama-70B writes a transcript as a "world-class podcast writer", (3) Llama-8B **rewrites it for TTS** (adds "umm", interruptions, disfluencies; outputs a list of `(speaker, text)` tuples), (4) Parler-TTS / Bark voices speakers 1 and 2. The **separate "rewrite for speech" pass** is the trick worth stealing.

### 2.8 Podcastfy (and the open-notebooklm family)

Python lib + CLI; inputs: URLs, PDFs, images, YouTube, raw text, or **a topic (grounded web search)**. Short (2–5 min) or **longform (30+ min)** via chunked rounds (`max_num_chunks: 8`, `min_chunk_size: 600` chars). `conversation_config.yaml` keys: `word_count`, `conversation_style` (e.g. engaging, fast-paced, enthusiastic), `roles_person1` ("main summarizer"), `roles_person2` ("questioner/clarifier"), `dialogue_structure` (Introduction / Main Content Summary / Conclusion), `podcast_name`, `podcast_tagline`, `output_language`, `engagement_techniques` (rhetorical questions, anecdotes, analogies, humor), `creativity` (0–1), `user_instructions`. TTS backends: OpenAI (`tts-1-hd`, echo/shimmer), ElevenLabs (`eleven_multilingual_v2`), **Microsoft Edge TTS (free, no key)**, Gemini, Gemini multi-speaker. `ending_message`. This config schema is a good starting point for our audio-lesson "episode profile".

### 2.9 OpenTutor (small, but a checklist of learning science)

Local single-user beta. "Upload → AI Teaches → You Practice → AI Remembers → AI Reminds → Repeat". 12 composable **blocks** (notes, quiz, flashcards, knowledge graph, study plan, analytics, …) where an AI "Layout agent" suggests workspace changes and progressively unlocks features. **7 question types**: MCQ, short answer, fill-in-blank, true/false, matching, ordering, coding. Wrong-answer tracking with diagnostic feedback, adaptive difficulty, **FSRS 4.5**, study plan + calendar with deadlines, **LOOM** concept-mastery knowledge graph (arXiv 2511.21037), **LECTOR** knowledge-graph-aware review ordering (arXiv 2508.03275: co-review related concepts, prerequisites before dependents), Socratic mode, fatigue/cognitive-load signals from message brevity and error patterns, Canvas LMS import.

### 2.10 Other OSS worth knowing

- **RAGFlow** (91.9k★): deep document understanding (layout, tables, templates per doc type) — the parsing quality bar.
- **Open WebUI** (154k★), **LobeHub** (83k★): general chat front-ends with knowledge bases; set user expectations for chat polish (artifacts, branching, model compare).
- **STORM** (Stanford): topic → perspective-guided question asking → outline → cited long report. Pattern for "course from a bare topic".
- **SiYuan / AFFiNE / AppFlowy / Logseq**: local-first PKM with AI add-ons; they set the bar for block editing and local storage.


## 3. Product-by-product notes — local-AI desktop shells (AnythingLLM, Jan, LM Studio, Msty, Cherry Studio)

These are not study tools, but they own the "install an AI app on my laptop" experience. Students will compare our first five minutes to theirs.

| Product | Stars | Licence | Shell | Latest | Price |
|---|---|---|---|---|---|
| **AnythingLLM Desktop** (Mintplex-Labs/anything-llm) | 66.9k | MIT | **Electron + Node/Express server + Node "collector"**, Vite/React UI | v1.17.0 (2026-10-01) | Free; hosted/cloud tier sold separately |
| **Jan** (janhq/jan) | 44.9k | Apache-2.0-style (repo field NOASSERTION) | **Tauri (Rust) + React**, bundled llama.cpp engine | v0.8.6 (2026-10-09) | Free |
| **LM Studio** | closed app; `lms` CLI 5.3k★ MIT | proprietary, free incl. for work | Electron, llama.cpp + Apple MLX runtimes, headless core `llmster` | 0.4.x (0.4.0 2026-01-28 … 0.4.14 2026-05-22) | Free |
| **Msty Studio** | closed | proprietary | Electron | 2.8.0 (2026-06-11) | Free Desktop; Aurum $149/yr or $349 lifetime; Teams $300/user/yr (min 5) |
| **Cherry Studio** (CherryHQ/cherry-studio) | 52.5k | AGPL-3.0 (+ commercial licence) | Electron + React | v2.1.4 (2026-09-30) | Free |

### 3.1 AnythingLLM Desktop — the closest architectural template (it is Node.js)

- "Single-player" desktop build of the same codebase as the Docker multi-user server. Desktop drops: multi-user, embeddable widget, white-label, password, browser-accessible UI. Keeps: agents, website scraping, text-splitter config, chat logs, full developer API, data connectors.
- **Everything embedded, no services to run**: SQLite (`anythingllm.db`), **LanceDB** embedded vector store (default, file-based), **Native Embedder** (in-process ONNX model via transformers.js — runs on CPU, no key), built-in Whisper transcription, browser-native TTS/STT by default with in-browser **Piper TTS** as a local upgrade, and a **built-in LLM provider** that downloads GGUF models from inside the app.
- Storage (documented): macOS `~/Library/Application Support/anythingllm-desktop/storage`, Linux `~/.config/anythingllm-desktop/storage/`, Windows `%APPDATA%\anythingllm-desktop\storage`. Subfolders: `lancedb/`, `documents/` (parsed JSON of each upload), `vector-cache/` (embeddings cached by content hash so re-embedding the same file is free), `models/`, `plugins/` (custom agent skills), `direct-uploads/`, `logs/`. An **"Open storage"** menu item opens this folder.
- Concepts: **Workspaces** (each with its own docs, LLM override, system prompt, chat mode **"chat" vs "query"** — query mode refuses to answer without retrieved context), **document pinning** (pin a doc to always inject it full-text instead of chunks), drag-and-drop into chat for full-text insertion ("direct uploads"), citations panel with the retrieved chunks, **agents** via `@agent` (web browse, scrape, save file, chart, SQL, summarize docs), **Agent Flows** (no-code builder), **MCP**, **Scheduled Tasks** (cron prompts with agent tools), **Memories** (automatic + user-managed), **Dynamic Model Routing** (rules choose provider/model per chat), **Intelligent Skill Selection** (claims up to 80% token cut when many tools are on), embedded chat widget, browser extension.
- Network: API bound to `127.0.0.1` by default; "Enable network discovery" rebinds to `0.0.0.0` after restart. Docs warn not to expose the desktop app publicly (no auth).
- System guidance: 16 GB RAM, 8-core CPU recommended for local models; cloud models need little.

Lesson for BiliMind: copy the "zero external services" architecture (SQLite + LanceDB + in-process embedder + content-hash embedding cache), the `Open storage` affordance, the "pin = full-text, unpinned = retrieval" rule, and "query mode" (answer only from sources) as the default for study.

### 3.2 Jan

- Tauri app: small download, native webview. Distributed as `.exe`, `.dmg`, `.deb`, AppImage, **Microsoft Store** and **Flathub**. llama.cpp engine now ships inside the app (v0.8.5) and a **guided first-run setup wizard** was added.
- v0.8.0 UX details worth copying: **hardware "fit" pills** on every model — *Fits / May be slow / Won't fit* — computed from your RAM/VRAM before download; quantizations grouped **Small / Balanced / Large** with a **Recommended** tag; **Delete All downloads** shows the disk space to be freed; **backend dependency checker** lists missing CUDA/Vulkan/cuDNN with links to installers; CUDA backend auto-skipped when VRAM is too low; **per-thread activity spinners** that keep running when you navigate away; **message queue** (type while streaming; queued messages are editable chips; two-stage Stop); background thread titling (cancelled if you rename); **Up-arrow recalls last message**; regenerate on failed responses; **inline MCP approval** inside the tool card showing arguments; RAG citations as numbered cards with superscripts only for matches with cosine ≥ 0.65; **Factory Reset with "Keep models and configs"**.
- Providers split into Local (llama.cpp, MLX) and Remote; OpenAI/Anthropic/Gemini model lists **populate from your API key** with capabilities inferred from model IDs; Anthropic-compatible endpoints (v0.8.1); OpenAI-compatible local server at `localhost:1337`.
- Projects (group chats + files) since v0.7.x; Assistants (custom instructions).

### 3.3 LM Studio

- One signed installer per OS (Apple Silicon Macs, x64/ARM64 Windows, x64 Linux AppImage). Runtimes (llama.cpp variants, **MLX** on Apple Silicon) are **separate, independently updatable packs** managed in a Runtimes panel (`Ctrl/⌘+Shift+R`) — so the app picks the right CUDA/Vulkan/Metal build for your machine and updates engines without reinstalling.
- Model discovery = Hugging Face search inside the app with staff picks and memory-fit estimates; a first-run flow offers a recommended starter model sized to the machine.
- UI modes: **User / Power User / Developer** — progressive disclosure of sampling params, server, logs.
- **Chat with documents**: `.pdf`, `.docx`, `.txt`. Rule: *if the document fits in the model's context it is injected in full; otherwise RAG retrieves sections*. Documented tip: put the words you expect to appear in the source into your question.
- 0.4.0 (2026-01-28): `llmster` headless daemon, parallel requests to one model, stateful `/v1/chat` REST endpoint that can use local MCPs, permission keys for server clients; 0.4.1 Anthropic-compatible `/v1/messages`; 0.4.5 **LM Link** (use a remote LM Studio's models as if local); MCP "Add to LM Studio" deep-link button.

### 3.4 Msty Studio

- Closed, Electron. Free desktop tier includes **Knowledge Stacks** (semantic, auto-synced document collections over files, folders, Obsidian vaults, YouTube transcripts) with limits; Aurum unlocks the full feature set. 2.8.0 (2026-06-11) added a **Discover Hub** of ready-made Knowledge Stacks/building blocks, a unified model hub and native provider tools.
- Signature UX (known from prior versions): **split chats** (same prompt to several models side by side, synced input), **branching/forking** conversations, **"delve" mode** (click any phrase in an answer to spawn a sub-thread), **flowchat** visual tree of a conversation, prompt library, personas, **real-time cost/usage per message**, local models via bundled Ollama-compatible runtime with one-click "get started with local AI".
- Lesson: branching + "click a term to dig in" is a natural fit for learning ("explain this word" without losing the lesson).

### 3.5 Cherry Studio

- Electron, "Ready to Use — No Environment Setup Required", Windows/macOS/Linux. 300+ pre-configured assistants, **multi-model simultaneous conversations**, knowledge base over text/images/Office/PDF, **WebDAV backup**, Mermaid rendering, global search, topic management, AI translation, mini-programs, MCP servers, themes (Aero, PaperMaterial, …), transparent window. Roadmap: selection assistant (system-wide text selection → AI actions), Deep Research, notes and collections, canvas, OCR, TTS, plugin system, Android/iOS.
- Lesson: a **system-wide selection assistant** (highlight text in any app → "make flashcards / explain / add to course") is a strong daily-use hook for a study app.


## 4. Product-by-product notes — PKM + AI (Obsidian plugins, Logseq, Reor, KnowNote, RemNote, Anki, Saner, Hyperbook)

Our output is an Obsidian-compatible vault, so the Obsidian AI plugins are both rivals and **complements** — a student may open the BiliMind vault in Obsidian with Smart Connections installed. We should make sure our files *work well* with them (plain links, frontmatter, no proprietary blobs in `.md`).

| Product | Stars | Licence | Latest | Model |
|---|---|---|---|---|
| **Obsidian Copilot** (logancyang/obsidian-copilot) | 7.8k | AGPL-3.0 | 4.0.14 (2026-10-09) | Free OSS plugin + paid "Plus/Believer" hosted models |
| **Smart Connections** (brianpetro) | 5.5k | source-available core | 4.7.2 (2026-08-06) | Free core + Pro plugins |
| **Text Generator** (nhaouari) | 2.0k | MIT | 0.8.7 (2026-04-27) | Free |
| **Obsidian Spaced Repetition** (st3v3nmw) | 2.6k | MIT | active (2026-10-05) | Free |
| **Logseq** | 45.2k | AGPL-3.0 | 2.0.2 (2026-10-07) | Free; paid sync |
| **Reor** | 8.5k | AGPL-3.0 | v-0.2.32 (2025-04-05) | **Archived** |
| **KnowNote** (mrsibe/KnowNote) | 1.2k | GPL-3.0 | v1.5.3 (2026-10-02) | Free, Electron |
| **CaviraOSS/PageLM** | 2.0k | (unclear) | no releases; active | Free, Node/TS |
| **Anki** | 31.9k | AGPL-3.0 (+ others) | 26.09.3 (2026-09-23) | Free desktop; iOS paid |
| **AnkiAIUtils** | 0.9k | — | 2026-06 | Free scripts |
| **ts-fsrs** | 0.8k | MIT | active | Library we should use |
| **RemNote** | closed | — | — | Free; Pro ~$10/mo; Pro+AI ~$20/mo (sources disagree) |
| **Saner.AI** | closed | — | — | Free (100 notes, 30 AI msgs/mo); Starter $12/mo ($8 yearly); Standard $20/mo ($16 yearly); BYOK allowed |
| **openpatch/hyperbook** | 74 | MIT | active | Markdown → interactive workbook static site generator (education) |

### 4.1 Obsidian Copilot (v4)

Has become an **agent host inside Obsidian**: Agent mode runs **opencode** (downloaded and managed by the plugin), **Claude Code** (auto-detected install, uses its login) or **Codex** (via the `@agentclientprotocol/codex-acp` adapter) with permissions you control. **Projects** (instructions + reusable context + chat history per project), **Skills shared across agents** (ships skills for Obsidian Markdown, Bases, Canvas, Obsidian CLI), **Commands** (saved prompts via `/` and the command palette), **Quick Ask** (ask about a selection inline → continue / replace / insert / copy), multiple Agent tabs, `@`-mention several agents for one read-only review (paid), Quick Chat. BYOK keys stored in **the OS keychain via Obsidian Keychain, not in the vault's `data.json`** — copy this. Free opencode Zen models show a warning that the provider may train on prompts. Built-in **"Report an issue"** zips a screenshot + recent logs for the user to review before upload and opens a prefilled issue with a report ID.

### 4.2 Smart Connections (v4)

"Zero-setup": ships a **local embedding model that indexes the vault immediately** — no API key, no extra app, works on mobile. **Connections view**: notes semantically related to the one you are writing, ranked list + mini-graph, drag a result to insert a link. **Lookup view**: semantic search on demand. Pro: **inline connections** while typing, Bases integration. Lesson: a "related" side panel that needs zero configuration is the bar for our "related lessons / sources" feature; and our generated vault should be immediately useful to it.

### 4.3 Text Generator

Template engine for prompts with **frontmatter configuration** (a note's frontmatter can choose provider/model/params), "Considered Context" (which parts of the note/links go into the prompt), community template gallery. Lesson: **prompt templates as Markdown files in the vault** (`.bilimind/prompts/*.md`) are understandable and shareable.

### 4.4 Obsidian Spaced Repetition plugin

Flashcards written inline in notes (`question::answer`, `?` multi-line separators, `==cloze==`), review entire notes, deck = tag/folder; scheduling data stored as HTML comments in the note. Lesson: **our flashcard syntax should be readable by this plugin** (or at least exportable to it) so the vault works in Obsidian with zero BiliMind running.

### 4.5 Logseq 2.0

The DB version (public beta 2026-07-13; 2.0.2 on 2026-10-07) made **SQLite the canonical store**; the Markdown-file app is split off as **"Logseq OG"** with maintenance only. Two-way Markdown sync is still in development. No built-in AI; plugins provide it; the CLI can now query the graph for agents. Lesson: a large OSS PKM just *abandoned* plain files as the source of truth — "your notes stay plain Markdown files forever" is now a sharper differentiator for us.

### 4.6 Reor (archived) and KnowNote (its spiritual successor)

Reor (Electron, Ollama + transformers.js + LanceDB) auto-linked related notes and did RAG over one chosen directory; archived May 2025 — proof that "local AI notes" alone is not a product. **KnowNote** (Electron, GPL-3.0) is the most similar architecture to what BiliMind Desktop needs: three columns (**Knowledge Library · AI Q&A · Note Output**), parsing + splitting + **in-process embedding** + vector search inside the app ("no Docker, no server, no account"), **every answer keeps the passages it was built from and their character offsets**, notes + **mind maps**, BYOK (OpenAI/Anthropic/Google-compatible or Ollama), and a **read-only stdio MCP server** (`knownote --mcp`) exposing `list_notebooks`, `search_notebook` (returns doc id, page, char offsets), `get_source`, `read_document`, `search_notes` — no write tool, no tool that calls a model, no filesystem paths in results ("safe to grant to an agent reading untrusted documents"). Honest "What is not here yet" section in the README (quiz, slides, audio not shipped; unsigned builds; macOS arm64 only; no Linux).

### 4.7 PageLM (CaviraOSS)

Node.js/TypeScript + LangChain/LangGraph, Vite/React; JSON file storage by default. Features: contextual chat over PDF/DOCX/MD/TXT, **SmartNotes (Cornell-style)**, non-overlapping flashcards, quizzes with **hints, explanations, scoring**, AI podcast (Edge TTS, ElevenLabs, Google, OpenAI, Cartesia, Hume, MiniMax, VoxCPM…), voice transcription of lectures, **Homework Planner**, **ExamLab** (simulate an exam, get feedback), **Debate** practice, Study Companion. Needs Node 21+, ffmpeg; Docker. Lesson: confirms the student feature set; "ExamLab" and "Debate" are cheap, high-perceived-value modes.

### 4.8 Anki + AI

- Anki 26.09 ships FSRS natively (FSRS Helper add-on for optimisation/rescheduling), Image Occlusion built in. **AnkiConnect** is the de facto local API (port 8765) every external AI tool uses to push cards.
- Common 2026 pattern: keep Anki for review, generate cards elsewhere (LLM → `.apkg` or AnkiConnect).
- **AnkiAIUtils** (medical student): every card you **failed** gets new fields — explanation, mnemonic (reusing *your* mnemonic library, major system), AI illustration — selected via semantic similarity to your own examples; runnable on cron; logs for rollback. → Our "**leech rescue**": when a card lapses N times, generate a better explanation/mnemonic/diagram for it.
- Anki Brain: chat/summarise inside Anki.
- Lesson: ship **`.apkg` export and AnkiConnect push** day one; use **ts-fsrs** for our own scheduler so cards round-trip with Anki's FSRS semantics.

### 4.9 RemNote

PDF **Learn Mode**: annotate PDFs; **1-click flashcards** (click a sentence → card) or AI generation of flashcards + quizzes from a whole document; **AI tutor answering questions about the PDF with inline citations to the exact location**; chat with the tutor while practising; MCQ practice quizzes; **AI explanations when you get a question wrong**; progress by topic mastered; **AI grading with voice input**; image-to-text for lecture notes/diagrams. Notes and flashcards are the same object (bidirectional cards inline in notes). Pricing: Pro ~$10/mo, Pro with AI ~$20/mo.

### 4.10 Saner.AI

ADHD-oriented AI notes + tasks + email/Drive/Slack ingestion; OCR and PDF ingestion on every plan; BYOK supported with per-token cost on top. Lesson: low-friction capture and "the AI tells you what to do today" planning resonate with students who struggle with executive function.

### 4.11 Hyperbook (openpatch)

Not AI — a Markdown-based static-site generator for **interactive workbooks**, maintained by OpenPatch (an education/assessment org; CS-teacher community). `@hyperbook/markdown` has **30+ custom directives**: alert, collapsible, tabs, glossary, bookmarks, quiz, textinput, **learningmap**, slideshow, mermaid, plantuml, math, excalidraw, geogebra, jsxgraph, **h5p**, **pyide / sql-ide / webide / online-ide** (in-browser code), p5, scratchblock, typst, audio/video/youtube, download, protect, qr. CLI (`hyperbook`, `create-hyperbook`) + a VS Code extension with preview and validation. Lesson: an existing, open, Markdown-directive grammar for interactive lessons; our "publish course as static site" export can borrow its directive ideas or even target it.


## 5. Product-by-product notes — commercial AI study tools

Prices come from third-party trackers (the vendors' own pricing pages are often blocked or JS-only); treat them as ±30%. The point is the **pattern**: every one of these is a cloud subscription of roughly **$5–25/month**, mobile-first, with **usage caps on the free tier** and **no data ownership**. A BYOK desktop app where a typical course costs cents of API spend is a structural price advantage — if we show the student the meter.

| Product | What it is | Signature features | Price (third-party, 2026) | What to steal |
|---|---|---|---|---|
| **StudyFetch** (tutor "Sparky", formerly Spark.E) | Upload-everything study platform | **Study Plan** from materials + deadlines split into milestones, with a **cram mode** that highlights the most important concepts before an exam; **Live Lecture** (records class, real-time notes, tips, ask questions during the lecture); **Tutor Me**; Notes from PDF/PPT/video; **Arcade** (game-style recall, e.g. matching Spanish verb forms to meanings); flashcards; practice tests "simulating the real exam"; **audio recaps**; **explainer videos**; every generated tool **links back to source** | Free (10 chats, 1 set, 2 uploads); Base $7.99/mo; Premium $11.99/mo (unlimited, live lecture, handwriting upload, group study) | Deadline-driven plan + cram mode; matching game |
| **Mindgrasp** | Summaries/notes/quizzes from docs, video, audio, links | 90-min lecture → structured notes; flashcards; quizzes; AI math helper; Chrome extension for **Canvas, Blackboard, Panopto**; iOS | Basic $9.99, Scholar $12.99, Premium $14.99 /mo (image analysis, bulk upload). Trustpilot ~2.0 over billing | LMS-video capture; the cautionary tale (a 2025 study: students who relied fully on AI notes scored lower) → we must force **active recall**, not just summaries |
| **Quizlet** (Plus) | The incumbent flashcard network | **Learn** (adaptive rounds), **Test**, Match; **Magic Notes** (notes/PDF → flashcards, practice tests, outlines); **Q-Chat** (Socratic quiz-tutor on your set; reported paused/limited at times); AI card generation; offline | Plus ≈ $7.99/mo or $35.99–44.99/yr; free Learn rounds capped daily | Learn-mode round structure (mix of MCQ → written as mastery grows) |
| **Gizmo** | Gamified AI flashcards (web + iOS) | Magic Import (PDF, YouTube, PPT, notes, audio, record a lecture), spaced repetition, **lives** (free tier ~15/day), streaks, AI tutor with **"Explain like I'm 5"**, import from **Quizlet and Anki**, **Gizmo Live** (multiplayer); Series A $22M (Apr 2026) | Free with lives; "Unlimited" sold weekly/yearly (≈$155/yr, student ≈$77/yr) | ELI5 toggle; streaks; Quizlet/Anki import as an on-ramp |
| **Coursebox** | AI course **authoring** + LMS (for educators/businesses) | Designs a course structure from requirements, files, idea and learners → drafts lessons, videos, assessments, quizzes, interactive elements into a drag-and-drop editor; quiz + **rubric** generation; **AI grading** of open answers; chatbot tutor; **AI avatar videos**; white-label LMS; **SCORM** export; SSO/API on Enterprise | Free (3 courses); paid from ~$10/mo up to enterprise | Outline-first course design from a "learner profile"; rubric-graded open answers; SCORM/static export |
| **Coconote** | Lecture recorder → notes | Record lecture / upload PDF / paste text → organized notes, chat, flashcards, MCQ quizzes; video/audio/websites; iOS/Mac first; App Store 4.6 | ~$59/yr single tier (varies by source) | One-tap record → lesson |
| **Turbo AI** (ex-TurboLearn) | Lecture/PDF/YouTube → notes | Notes with **diagrams, equations, tables, emojis**; flashcards, quizzes, **podcasts** from notes; chat with notes; live lecture recording + transcription; spaced repetition; real-time collaboration; claims **5M+ users** | Free tier, unclear limits; paywalls "appear suddenly" | Rich notes (equations, tables, diagrams) by default; podcast from a note |
| **Knowt** | Free Quizlet alternative | **Free Learn mode**, one-click **Quizlet import**, AI generation from notes/PDFs/videos, matching, practice tests, **Knowt Play** games, **Kai** (voice AI tutor that quizzes conversationally and explains why you were wrong), AI lecture notetaker, **full-length mock exams for AP/SAT/ACT/IB/GCSE** | Free; Premium ~$5/mo ($35/yr); Ultra ~$12.49–24.99/mo | Voice quiz tutor; exam-board mock exams |
| **Revisely** | Flashcard/quiz generator | Flashcards, quizzes, summaries from text/docs/videos; editable output; **answer assessment** (grades typed answers); sharing; Anki integration | Free; paid from ~$9.99/mo | Typed-answer grading |
| **Wisdolia → Jungle AI** | Chrome extension: flashcards from any article/PDF/YouTube | Generate cards on any web page; save to Anki. Chrome Web Store listing for "Wisdolia" now shows **Removed**; brand continues as **Jungle** | Freemium | "Make cards from what I'm reading right now" capture |
| **RemNote** (see §4.9) | Notes + SRS + PDF learn mode | 1-click flashcards from a PDF sentence, AI tutor with exact-location citations, explanations on wrong answers, AI voice grading | ~$10/mo Pro; ~$20/mo Pro+AI | — |

Observations across the commercial set:
1. **Lecture capture is table stakes** (StudyFetch, Mindgrasp, Coconote, Turbo, Knowt all record/transcribe lectures). A desktop app can do this *better* (system audio + mic, local Whisper, no upload limit).
2. **Games and streaks** are how they retain teenagers (Arcade, Knowt Play, Gizmo lives/streaks). Adults/university students care more about **exam dates and mastery**.
3. **"Links back to the source"** is now a marketed feature (StudyFetch FAQ, RemNote exact-location citations). Our passage-level citations must be visibly better than NotebookLM's.
4. **Mock exams** (Knowt for AP/SAT/IB/GCSE; PageLM ExamLab; StudyFetch practice test) are a high-intent feature right before exams.
5. **Billing friction is the #1 complaint** (Mindgrasp 2.0 Trustpilot, Turbo's sudden paywalls). BYOK + a transparent cost meter is an answer students will notice.


## 6. Google NotebookLM baseline (what we must beat)

**Renamed "Gemini Notebook" on 2026-07-16** (URL now `notebook.google.com`; old links redirect). Google cites **30M+ users and 600k organisations**. Free tier remains; Plus / AI Pro / AI Ultra raise limits.

Feature timeline relevant to us (dates from Google posts / Wikipedia):
- **Sources**: PDFs, Google Docs/Slides/Sheets, web URLs, YouTube, audio, images, pasted text, Word; **EPUB** added (Mar 2026). Per-notebook source caps (historically 50 free / 300 paid) and per-source size caps (historically ~500k words / 200 MB). **Discover sources / Deep Research** finds web sources and writes a report.
- **Chat** with inline numbered citations that show the quoted passage on hover; custom chat goal/role and response length; **Learning Guide** (Socratic tutor mode, 2025). Since Mar 2026 chats **save automatically**, stay private even in shared notebooks, and any chat can be **turned into an Audio/Video Overview, report or other artifact** without leaving it.
- **Audio Overviews** (Sep 2024): two AI hosts; formats *Deep Dive, Brief, Critique, Debate*; length short/default/long; **Interactive mode** (Dec 2024: tap "Join" to ask the hosts a question mid-episode); 80+ languages.
- **Video Overviews** (2025): narrated slide-style videos with images/diagrams; visual styles; **Cinematic Video Overviews** (immersive animated deep-dives, English, paid); **Short Video Overviews** (Jul 2026: 60-second vertical videos).
- **Mind Map** (interactive, click a node to ask about it).
- **Reports**: Briefing doc, Study guide, Blog post, custom, plus suggested formats.
- **Flashcards and Quizzes** (2025): since Mar 2026 progress saves across sessions, cards marked **"Got it" / "Missed it"**, shuffle, a **results screen to rerun missed cards**, delete individual cards/questions — but **no real spaced-repetition scheduler**.
- **Infographics** and **Slide Decks** (Nov 2025, Nano Banana Pro image model); **10 infographic styles** (Sketch Note, Kawaii, Professional, Scientific, Anime, Clay, Editorial, Instructional, Bento Grid, Bricks; Mar 2026); **per-slide revision by prompt** (new deck version); **PPTX** export in addition to PDF.
- **Data Tables** (Dec 2025).
- **Secure cloud computer per notebook** (Jul 2026): writes and runs code for data analysis grounded in sources; interactive charts and spreadsheets (Ultra first, then Pro).
- Sync with the **Gemini app**; notebooks in **AI Mode in Search** (from 2026-08-19, English, outside the EEA).
- Sharing: share a notebook (view/chat), public links, featured notebooks. Mobile apps (Android 10+, iOS 17+), offline audio.
- Leaked/in-testing (unconfirmed): **Canvas** (turn a notebook into an interactive timeline, explainer web page, small learning game, or data visualiser), **Personal Preferences**, **Connectors**.

Where NotebookLM is weak (our openings):
1. **No ownership/portability** — outputs live in Google; no Markdown vault, no bulk export of notes/flashcards/audio scripts; `notebooklm-py` (unofficial API, **19.7k★**) and `notebooklm-mcp` (3.4k★) exist *because* people want programmatic and agent access.
2. **Gemini-only models**, no local/offline mode, privacy concerns for sensitive material; region/age gates (many features 18+, English-only, outside EEA).
3. **No course structure**: a notebook is a pile of sources + one-off artifacts. No ordered path, prerequisites, progress, or "what should I study next".
4. **No spaced repetition**, no mastery tracking, no exam date planning, no mistake notebook.
5. **No lecture recording**, no handwriting/whiteboard capture.
6. **Generated artifacts are not editable documents** (reports/flashcards can't be co-edited like notes; slides edit by prompt only).
7. **Caps** on sources/outputs per day on free tier.


## 7. Feature matrix

Legend: **Y** = yes, **P** = partial / limited / paid tier only, **N** = no, **?** = not verified. Judged from READMEs, official docs and changelogs fetched on 2026-10-10 (open source) and from vendor pages plus third-party reviews (commercial). "BiliMind web (today)" is the current Laravel/Nuxt product, included so the desktop port can see what it must keep.

### 7.1 Open-source, desktop and PKM tools

| Feature | BiliMind web (today) | NotebookLM / Gemini Notebook | DeepTutor | Open Notebook | SurfSense | AnythingLLM Desktop | KnowNote | Kotaemon | Khoj | OpenTutor | PageLM | Obsidian + Copilot/SC/SR | Jan / LM Studio | **BiliMind Desktop (target)** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Platform & ownership** | | | | | | | | | | | | | | |
| Native desktop installer (no Docker/Python) | N | N | N | N | Y | Y | P | P | P | N | N | Y | Y | Y |
| Works fully offline with local models | N | N | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| BYOK, many providers (cloud + local) | P | N | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | P | Y |
| Visible cost meter / estimate before spend | P | N | P | N | ? | N | N | N | N | N | N | N | P | Y |
| Output is plain files the user owns (Markdown) | N | N | P | N | P | N | N | N | N | N | P | Y | N | Y |
| No account needed | N | N | Y | Y | Y | Y | Y | P | P | Y | Y | Y | Y | Y |
| **Ingestion** | | | | | | | | | | | | | | |
| PDF / DOCX / PPTX | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | P | P | P | Y |
| Web URL | Y | Y | Y | Y | P | Y | Y | P | Y | ? | N | P | N | Y |
| YouTube / video transcript | Y | Y | Y | Y | ? | Y | N | N | N | N | N | P | N | Y |
| Record a lecture / transcribe audio | P | P | P | P | ? | P | N | N | N | N | Y | N | N | Y |
| Images / scanned pages (OCR) | Y | Y | Y | P | Y | P | ? | Y | Y | ? | N | N | N | Y |
| EPUB | Y | Y | Y | ? | ? | ? | ? | N | N | N | N | N | N | Y |
| Watch a folder / vault, auto-reindex | N | P | P | N | P | P | N | N | Y | N | N | Y | N | Y |
| Course/notebook from a bare topic (web research) | Y | Y | Y | N | P | P | N | N | Y | N | Y | N | N | Y |
| **Understanding** | | | | | | | | | | | | | | |
| Grounded chat over sources | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | P | Y |
| Passage-level citations (page/offset, highlight) | P | Y | Y | P | P | P | Y | Y | P | P | N | P | P | Y |
| Per-source context control in chat | N | Y | Y | Y | P | P | ? | Y | P | N | N | P | N | Y |
| Socratic / tutor mode | P | Y | Y | N | N | N | N | N | N | Y | P | N | N | Y |
| Deep research report with citations | P | Y | Y | N | P | P | N | P | Y | N | N | P | N | Y |
| Mind map / concept graph | Y | Y | Y | N | Y | N | Y | P | N | Y | N | P | N | Y |
| Proactive / scheduled digests | Y | N | N | N | N | Y | N | N | Y | P | N | N | N | Y |
| Persistent learner memory | N | N | Y | N | ? | Y | N | N | P | P | P | P | N | Y |
| **Course building** | | | | | | | | | | | | | | |
| Ordered course / path with progress | Y | N | Y | N | N | N | N | N | N | P | N | N | N | Y |
| Clarifying questions before generating | Y | N | P | N | N | N | N | N | N | N | N | N | N | Y |
| Outline review before full generation | Y | N | Y | N | N | N | N | N | N | N | N | N | N | Y |
| Rich typed lesson blocks (10+ kinds) | Y | N | Y | N | N | N | N | N | N | P | N | N | N | Y |
| Lesson editing + version history | Y | N | P | N | N | N | N | N | N | N | N | P | N | Y |
| Generated diagrams / illustrations | Y | Y | Y | N | P | N | N | N | Y | N | N | N | N | Y |
| Runnable code in lessons | Y | N | P | N | N | N | N | N | N | P | N | N | N | Y |
| **Practice & retention** | | | | | | | | | | | | | | |
| Flashcards | Y | Y | Y | N | Y | N | N | N | N | Y | Y | Y | N | Y |
| Spaced repetition scheduler (SM-2/FSRS) | P | N | P | N | ? | N | N | N | N | Y | N | Y | N | Y |
| Quiz with several question types | Y | P | Y | N | Y | N | N | N | N | Y | Y | N | N | Y |
| Open-answer grading against a rubric | Y | N | P | N | N | N | N | N | N | P | N | N | N | Y |
| Mock exam / exam simulation | Y | N | P | N | N | N | N | N | N | N | Y | N | N | Y |
| Mistake notebook / lapse handling | N | P | Y | N | N | N | N | N | N | Y | N | N | N | Y |
| Study plan / calendar with deadlines | Y | N | P | N | N | N | N | N | N | Y | Y | N | N | Y |
| Mastery tracking per concept | P | N | Y | N | N | N | N | N | N | Y | N | N | N | Y |
| Streaks / games | P | N | N | N | N | N | N | N | N | N | N | N | N | Y |
| **Media** | | | | | | | | | | | | | | |
| Audio overview / podcast | P | Y | Y | Y | Y | N | N | N | N | N | Y | N | N | Y |
| Interactive audio (interrupt to ask) | N | Y | N | N | N | N | N | N | N | N | N | N | N | Y |
| Video overview / animation | N | Y | P | N | N | N | N | N | N | N | N | N | N | P |
| Slides / infographic | N | Y | P | N | P | N | N | N | N | N | N | N | N | Y |
| Spoken dialogue / speaking practice | Y | P | N | N | N | P | N | N | P | N | P | N | N | Y |
| **Share & extend** | | | | | | | | | | | | | | |
| Share / publish (link or static site) | Y | Y | P | N | N | N | N | P | N | N | N | P | N | Y |
| Anki export / AnkiConnect | N | N | N | N | N | N | N | N | N | N | N | P | N | Y |
| Mobile app | P | Y | N | N | N | P | N | N | P | N | N | Y | N | P |
| API / CLI / MCP for agents | N | N | Y | Y | ? | Y | Y | N | Y | N | N | Y | Y | Y |
| Custom prompts / skills / plugins | N | P | Y | Y | ? | Y | N | P | Y | N | N | Y | P | Y |

Notes on the less obvious cells:

- BiliMind web: BYOK exists in the SaaS (`OwnKey`) but the server key is the default; generation telemetry (`generation_runs`) exists but is not shown to the learner as a meter; review uses **SM-2 per lesson**, not per card; audio is Edge TTS on `audio`/`dialogue` blocks, not a podcast; Whisper + `DialogueTutor` power speaking practice; 9 assessment kinds (mcq, multi_select, short_answer, cloze, essay, project, code, ordering, numeric) and 3 graders (deterministic, llm_rubric, self); 28 block types hung off 11 concept archetypes; `today`/`review` pages show streaks.
- NotebookLM flashcards have Got it / Missed it and a rerun-missed screen, but no scheduler (hence P for spaced repetition and mistake handling). Its "code" is a per-notebook cloud computer for data analysis, not runnable lesson code.
- DeepTutor: the Book's typed blocks, Mastery Path and Practice cover course building and retention; "scheduled repetition" is described without naming the algorithm (P). Cost estimate is shown before a Book spine is approved (P for the meter row). Outputs land in a content workspace folder and Books export to Markdown (P for files).
- Open Notebook: citations point to whole sources/notes/insights, not passages (P). Its strength is per-item context levels and podcasts.
- SurfSense: many cells are "?" because its README documents formats, not every feature; its desktop app and mind maps/flashcards/quizzes/podcast are confirmed.
- Jan / LM Studio: LM Studio is local-models only (no cloud providers), Jan supports both (P for BYOK). Both expose a local OpenAI-compatible server.
- Obsidian column = Obsidian + Copilot + Smart Connections + Spaced Repetition plugins together; file history needs Obsidian Sync or git (P).

### 7.2 Commercial AI study apps

| Feature | BiliMind web (today) | NotebookLM | RemNote | Anki + AI add-ons | Quizlet Plus | Knowt | Gizmo | StudyFetch | Turbo AI | Coconote | Mindgrasp | Coursebox |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Upload PDF/slides → study set | Y | Y | Y | P | Y | Y | Y | Y | Y | Y | Y | Y |
| Record lecture live → notes | N | N | N | N | N | Y | Y | Y | Y | Y | P | N |
| YouTube → study set | Y | Y | P | N | P | Y | Y | Y | Y | P | Y | Y |
| Structured multi-lesson course | Y | N | N | N | N | N | N | P | N | N | N | Y |
| Grounded tutor chat with citations | Y | Y | Y | N | P | P | P | Y | P | P | P | P |
| Flashcards | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | P |
| Real spaced repetition | P | N | Y | Y | P | P | Y | ? | P | ? | ? | N |
| Quizzes / practice tests | Y | Y | Y | N | Y | Y | Y | Y | Y | Y | Y | Y |
| Explanation when you answer wrong | P | P | Y | P | P | Y | Y | ? | ? | ? | ? | P |
| Typed / open answer AI grading | Y | N | Y | N | P | P | N | ? | N | N | N | Y |
| Mock exams (named exam boards) | P | N | N | N | N | Y | N | P | N | N | N | N |
| Study plan from deadlines (+ cram mode) | Y | N | N | N | N | N | N | Y | N | N | N | N |
| Games / streaks / lives | P | N | N | N | Y | Y | Y | Y | N | N | N | N |
| Audio recap / podcast | P | Y | N | N | N | N | N | Y | Y | N | N | N |
| Explainer video | N | Y | N | N | N | N | N | Y | N | N | N | Y |
| Voice tutor (talk to quiz) | Y | P | Y | N | N | Y | N | P | N | N | N | N |
| Import from Quizlet / Anki | N | N | Y | Y | N | Y | Y | ? | ? | ? | ? | N |
| Export to Anki / SCORM / files | N | N | P | Y | N | N | N | N | N | N | N | Y |
| Works offline / local data | N | N | P | Y | P | N | N | N | N | N | N | N |
| BYOK (no subscription required) | P | N | N | Y | N | N | N | N | N | N | N | N |
| Typical price (USD/mo, third-party) | free beta / Pro | free / AI Pro | ~10–20 | free | ~3–8 | free / ~5–25 | free (lives) / ~13 | free / 8–12 | free / ? | ~5 | 10–15 | free / ~10+ |


## 8. What makes AnythingLLM / Jan / LM Studio installs painless (and what to copy)

The contrast is stark: every open-source **study** tool (DeepTutor, Open Notebook, Kotaemon, OpenTutor, PageLM, NotebookLlama) asks for Docker, Python, Node, `uv`, or ffmpeg. DeepTutor's README opens by telling you to paste a prompt into Claude Code so *an agent* installs it. The three painless apps share eight traits:

| # | Trait | AnythingLLM | Jan | LM Studio | What BiliMind Desktop does |
|---|---|---|---|---|---|
| 1 | **One native installer per OS, nothing else to install** | `.dmg` (separate Apple Silicon / Intel), `.exe`, AppImage via `installer.sh` | `.exe`, `.dmg`, `.deb`, AppImage, **Microsoft Store**, **Flathub** | one installer per OS (Apple Silicon, x64/ARM64 Windows, x64 Linux) | Electron + electron-builder: signed+notarised universal `.dmg`, signed NSIS `.exe` (+ winget), AppImage + `.deb` + Flathub. **No Python, no Docker, no system ffmpeg** (bundle `ffmpeg-static`, ONNX runtime, pdf.js, Tesseract-wasm). |
| 2 | **All services embedded in-process** | SQLite + **LanceDB** (file-based vector DB) + in-process **native embedder** (ONNX via transformers.js) + built-in Whisper + browser TTS/Piper | llama.cpp engine ships inside the app (v0.8.5); single router process | llama.cpp / MLX runtimes as packs | SQLite (better-sqlite3) for index/state, LanceDB or sqlite-vec for vectors, transformers.js embedder (small multilingual model, ~25–120 MB, downloaded once with progress), whisper.cpp/transformers.js for transcription, Piper/Kokoro for local TTS. Nothing listens on a public port. |
| 3 | **Works before you configure anything** | Defaults pre-selected (built-in LLM provider, native embedder, LanceDB); onboarding is "accept defaults" | Guided first-run wizard (v0.8.5) | First run offers a **starter model** (e.g. a 6.3 GB Gemma on a 16 GB machine) with **Skip** | First run: (a) pick or create a vault folder (default `~/Documents/BiliMind`), (b) paste a key **or** "use a local model" **or** "skip — explore the sample course". A **pre-generated sample course ships in the installer** so the app is useful at minute one with zero keys. |
| 4 | **Hardware-aware recommendations** | Recommends based on RAM; docs give 16 GB / 8-core guidance | **Fit pills: Fits / May be slow / Won't fit** before download; quant groups Small/Balanced/Large with Recommended; **dependency checker** for CUDA/Vulkan/cuDNN with links | Memory-fit estimates in model search; runtime auto-selected for GPU | Detect RAM/VRAM/Apple Silicon at first run; if the student picks local, show only models that fit, tagged with expected speed ("~20 tokens/s — a lesson in ~2 min"). Detect an existing **Ollama / LM Studio / Jan** server on `11434` / `1234` / `1337` and offer it with one click instead of downloading anything. |
| 5 | **Keys are pasted in the UI and tested immediately** | Provider form + model list | Model lists **populate from your API key**, capabilities inferred from model ids | — | Paste key → instant **Test** (1-token call) → green check + model list fetched from the provider + **auto-assigned roles** (fast / smart / embedding / TTS / STT / image) like Open Notebook's "Auto-assign Defaults". Keys go to the **OS keychain** (`safeStorage`/keytar), never into the vault (Obsidian Copilot's rule). |
| 6 | **Your data is one folder you can open** | `storage/` with `documents/`, `lancedb/`, `vector-cache/`, `models/`, `logs/`; **"Open storage"** menu item | Data folder in Tauri app-data dir; **Factory Reset → "Keep models and configs"** | `~/.lmstudio/models`, configurable | Two places, both openable from the menu: the **vault** (student's Markdown, human-readable) and the **app cache** (`index.sqlite`, vectors, model weights, logs) which can be deleted and rebuilt from the vault at any time. "Rebuild index" and "Reset app (keep vault + keys)" buttons. |
| 7 | **Updates without reinstalling** | Re-run installer (Linux); in-app notice | In-app update; engine updates | **Runtimes update independently of the app** | `electron-updater` with differential updates from GitHub Releases; model/runtime packs (whisper, embedder, TTS voices) are downloaded and versioned separately so a 5 MB app update never re-downloads a 500 MB model. Release notes shown on first launch after update. |
| 8 | **Progressive disclosure** | Desktop hides multi-user/admin entirely | Settings split Local vs Remote | **User / Power User / Developer** UI modes | Default UI shows "Create course · Library · Review · Settings". Model roles, prompts, retrieval knobs, MCP server live under "Advanced". |

Extra details that remove friction:
- **Unsigned builds are the #1 install complaint** for small Electron apps (KnowNote documents its Gatekeeper/SmartScreen workaround; AnythingLLM tells users to click "Keep" in the browser). Budget for an Apple Developer ID and a Windows code-signing certificate (or Azure Trusted Signing) from day one.
- **Linux AppImage + AppArmor**: AnythingLLM's installer script asks to create an AppArmor rule because Ubuntu 24.04+ blocks unprivileged user namespaces for Electron's sandbox; ship a `.deb` that installs the profile, and a `--no-sandbox`-free path.
- **Don't bundle a chat model.** KnowNote ships no chat model at all and AnythingLLM makes its built-in model an optional in-app download; a 4–6 GB model in the installer makes the download hostile. Offer local models as an optional, hardware-checked download.
- **First generation must be cheap and fast**: default the "fast" role to a cheap model (e.g. a Gemini Flash / GPT mini / Haiku class model via the student's key) and show the estimated cost before the first course (e.g. "≈ $0.04 with your key").
- **Diagnostics bundle**: Obsidian Copilot's "Report an issue" (zip of screenshot + recent logs, reviewed by the user before upload, prefilled GitHub issue with a report id) is the model; strip keys and vault content by default.
- **Portable mode**: a `BiliMind-portable` zip (Windows) / AppImage with `--user-data-dir` next to the binary lets students run from a USB stick on lab computers.


## 9. Ranked must-have feature list for BiliMind Desktop (with delight details)

_pending_

## 10. Gaps nobody fills (our wedge)

_pending_

## 11. Sources

_pending_
