# Google NotebookLM — competitive research (as of October 2026)

> Research file for BiliMind Desktop. Status: IN PROGRESS (skeleton written first; sections filled as research completes).
> Researched 2026-10-10. Sources listed at the end of each section and in "Sources".

## 0. TL;DR
_pending_

## 1. Product overview and timeline

**Naming (important for anyone searching):** Google renamed NotebookLM to **Gemini Notebook** on **16 July 2026** (blog post by Josh Woodward, VP Google Labs). It is "the same standalone product with deeper Google integration and a secure cloud computer". `notebooklm.google.com` now redirects to `notebook.google.com`; help center moved to `support.google.com/gemininotebook`. Google cites **30M+ users and 600k+ organizations** (July 2026). In this document "NotebookLM" and "Gemini Notebook" mean the same product.

**What it is (Google's own definition):** "an AI-powered research assistant designed to help you refine and organize your ideas" — you upload *sources*, chat with them (answers grounded + inline citations), save *notes*, and generate *Studio* artifacts (Audio/Video Overviews, Mind Maps, Reports, Flashcards, Quizzes, Infographics, Slide Decks, Data Tables, and since June 2026 code-generated files).

The product's mental model is a **three-pane workspace**: **Sources** (left) - **Chat** (center) - **Studio** (right). A notebook = a bag of sources + chat history + notes + generated artifacts. There is no course/curriculum structure; the unit is the notebook.

### Timeline (dated; most relevant first-party dates)

| Date | Change |
|---|---|
| May 2023 (I/O) | Launched as **Project Tailwind** (Google Labs experiment). |
| Dec 2023 | Opened in US as NotebookLM on Gemini Pro; later Gemini 1.5 Pro (long-context). |
| Sep 2024 | **Audio Overviews** (two-host podcast "Deep Dive"). The viral moment. YouTube + audio-file sources added. |
| Oct 17 2024 | "Experimental" label removed; Audio Overview customization prompt ("focus on X", "explain to beginners"). |
| Dec 2024 | **Interactive Audio Overviews** ("Join" — talk to hosts); redesigned 3-panel UI (Sources / Chat / Studio); **NotebookLM Plus** for Workspace/Cloud/Gemini Advanced. |
| Feb 10 2025 | Plus included in Google One AI Premium for individuals. |
| Mar 2025 | **Mind Maps** (interactive, clickable nodes); **Discover sources** (web search for sources); Gemini 2.0 Flash Thinking for chat. |
| Apr 2025 | Audio Overviews in **50+ (then 80+) languages**; Gemini 2.5 Flash. |
| May 2025 | **Android and iOS apps** (May 19-20); audio length selector (Shorter/Default/Longer). |
| Jun-Jul 2025 | **Public sharing** of notebooks (link, view-only); **Featured notebooks** (The Economist, The Atlantic, authors, Shakespeare, Yellowstone, etc.); **Video Overviews** (narrated slide-style videos, Jul 29 2025). Studio redesigned to allow **multiple outputs of the same type** per notebook. |
| Sep 2 2025 | Audio Overview **formats: Deep Dive (default), Brief, Critique, Debate**. |
| Sep 2025 | **Flashcards and Quizzes** (web), **Learning Guide** chat persona (Socratic tutor), report "suggested formats" (dynamic report types based on content e.g. blog post, glossary). |
| Oct 13 2025 | Video Overviews: **6 visual styles (Nano Banana)** + **Brief** video format. |
| Oct 29 2025 | **1M-token chat context** on all plans, 6x longer conversation memory, **saved chat history**, **custom goals / roles / voice for chat** ("Configure chat"). |
| Nov 6 2025 | Flashcards + quizzes in mobile apps; temporary source selection. |
| Nov 13 2025 | **Deep Research** (agentic multi-page report + recommended sources); new source types: **Sheets, images, Word (.docx), Drive URLs as links**. |
| Nov 2025 | **Infographics** and **Slide Decks** (Nano Banana Pro); Studio "custom report" prompt. |
| Dec 18 2025 | **Data Tables** (export to Google Sheets); chat moved to **Gemini 3**. |
| Jan 2026 | Notebooks usable as **sources inside the Gemini app** (consumer, then Workspace Jan 20/27). |
| Feb 5 2026 | Workspace **"AI Expanded Access"** add-on with higher NotebookLM limits. |
| Mar 4 2026 | **Cinematic Video Overviews** (Gemini 3 + Nano Banana Pro + Veo 3); English, AI Ultra 18+. |
| Mar 20 2026 | **Slide revisions** (per-slide feedback & regenerate), **EPUB** sources, **PPTX export**, more infographic styles (10 presets), improved study tools, **saved private chat history**, **create artifacts directly from chat**. |
| Apr 8 2026 | **Notebooks in the Gemini app** (synced with NotebookLM). |
| Apr 2026 | Higher limits for Education Plus / Teaching & Learning; **Personal class notebooks in Classroom** (18+ higher-ed). |
| May 12 2026 | "Ask NotebookLM" step in **Workspace Studio** automations. |
| May 26 2026 | **Automatic Drive syncing** (Docs/Sheets/Slides refresh when originals change); **Schoology** course import via Gemini LTI. |
| Jun 8 2026 | **Rebuilt on Gemini 3.5 (Flash) + Antigravity**: per-notebook **secure cloud computer** that writes/runs code, **100+ curated software skills**, **agentic source discovery from chat**, new export formats (PNG/SVG charts; PDF/DOCX/MD/TXT; PNG/JPG/GIF; CSV/JSON; XLSX; PPTX). Ultra + Workspace AI Expanded Access first. |
| Jun 25 2026 | **Study Notebooks in the Gemini app** — diagnostic quiz, personalised lessons, progress tracking; sources sync with NotebookLM. |
| Jul 2026 | **Short Video Overviews** (~60 s vertical, 80+ languages, educational animations). |
| Jul 16 2026 | **Renamed Gemini Notebook**; code execution rolling to Pro. |
| Aug 4 2026 | Gemini Notebook in **Google Classroom** (teacher materials sync into student notebooks). |
| Aug 7 2026 | Workspace Studio **automatic recurring source additions**. |
| Aug 17 2026 | **Copy an entire notebook** (sources + Studio artifacts; not chat history or notes; copy not synced). |
| Aug 19 2026 | **Notebooks in AI Mode in Google Search** (180+ countries, English, not EEA). |
| Aug 27 2026 | **Expert Intelligence**: add purchased **Google Play Books** ebooks (100k+ titles: Penguin Random House, Macmillan, O'Reilly) as sources; author-made Featured Notebooks (Steven Pinker, Michael Pollan). |
| Sep 2 2026 | **Compute-based usage limits** (5-hour refresh + weekly cap) replace fixed daily counts; "Generate later" queue for heavy outputs. |
| Sep 15 2026 | **Real-time voice conversations** with notebooks on mobile (~100 languages, Ultra first); **mobile lecture audio recorder** (recordings become notes); **Interactive learning overviews** (under Reports; summary + embedded infographic/quiz/flashcards); new quiz types (**short answer, multiple select, fill-in-the-blank**); ask chat about quiz performance; add/edit quiz & flashcard questions; "fresh new look". Student offers (1 yr free AI Pro US / AI Plus 140+ markets, claim by Dec 31 2026). |
| Oct 2026 | Android app 1.60.x / iOS 1.60.x current. |

**Trajectory read:** NotebookLM started as "chat with your PDFs + podcast" and is turning into (a) an agentic research workstation with a code sandbox and (b) a study product (study notebooks, learning overviews, Classroom, quizzes, flashcards, tutor voice). Both directions overlap BiliMind. It is converging *into* Gemini (Gemini app notebooks, AI Mode notebooks) — i.e. less a standalone tool, more a Google-account-bound context store.

Sources: blog.google rename post (2026-07-16); blog.google "better research" (2026-06-08); notebooklm-guide.com changelog; Wikipedia "NotebookLM"; blog.google study tools (2026-09-15); blog.google Expert Intelligence (2026-08-27); TechCrunch 2026-06-08 and 2026-07-16.

## 2. Sources: types, limits, ingestion

### 2.1 Supported source types (official list, Gemini Notebook Help 16215270, Oct 2026)
- **Uploaded files:** PDF, Word (.docx), plain text (.txt), Markdown (.md), CSV, PowerPoint (.pptx), **EPUB** (since Mar 2026), **images** (PNG, JPEG, WebP, HEIC, "many common formats"; "certain types of images may not work as well"), **audio** (MP3, WAV, AAC, M4A, OGG, "many audio formats").
- **Google Drive:** Google Docs, Google Slides (**max 100 slides**), Google Sheets (**max 100k tokens**; larger silently truncated per third-party tests). Drive files **auto-sync every few minutes** (since May 2026) and can be manually synced; footnotes and comments are not imported; multi-tab Docs/Sheets are merged into one source; deleted/revoked files become inaccessible but **still count toward the limit**. The app never edits Drive originals.
- **Web URLs:** only visible HTML text; images, embedded video and nested pages skipped; paywalled pages unsupported; JS-heavy apps fail; PDF links are ingested as PDFs; multiple URLs separated by space/newline in one paste.
- **YouTube URLs:** public videos with captions only (uploaded or auto); **transcript only** (no visual frames); videos < 72 h old often fail; no-speech videos unsupported; source removed within 30 days if the video goes private/deleted.
- **Copied/pasted text** (user can title it at creation).
- **Notes** (a note can be converted to a source).
- **Gemini Chats** (import a Gemini app conversation as a source).
- **Google Play Books** purchased ebooks (text only, eligible titles only; download of derived audio may be blocked by publisher).
- **Other notebooks** can be sources in the Gemini app / AI Mode (not inside Notebook itself).

**Not supported (as of Oct 2026):** video files as video (no frame understanding — only YouTube transcripts / audio track); arbitrary code repos; ZIP; LaTeX; Excel .xlsx upload (Sheets and CSV only; third parties report .xlsx not accepted directly); websites crawled beyond one page; paywalled/login pages; Notion/Obsidian native import; EPUB images.

### 2.2 Ingestion behaviour
- **Audio** is transcribed server-side at import; the transcript text becomes the source. "Dozens of languages" for transcription.
- **Images** are understood multimodally (diagrams, handwriting, charts) via Gemini.
- **PDFs:** text + (since 2025) images/charts in PDFs are read multimodally; password/copy-protected PDFs fail. No published page limit.
- **Source guide:** clicking a source opens a **source guide** — auto summary + key topics (clickable topic chips that seed chat questions) — and the full extracted text with the cited passages highlighted.
- **Auto-labels:** with **5+ sources** the app can auto-label/categorize sources into groups; user can add/rename/delete labels and move sources between them (2026).
- **Per-source checkboxes:** user selects which sources chat and Studio use ("Select all sources" toggle). Temporary selection on mobile.
- **Failure modes:** "potentially unsafe" content flagged and blocked; source triggers safety flag => chat may refuse.

### 2.3 Limits (do not reset; identical across plans)
| Limit | Value |
|---|---|
| Words per source | **500,000** |
| Upload size per file | **200 MB** |
| Google Slides | 100 slides/source |
| Google Sheets | 100k tokens/source |
| PDF page limit | none published |
| Notebooks per user | 100 (Standard) / 200 (Plus) / 500 (Pro, Ultra) |
| Sources per notebook | **50** (Standard) / **100** (Plus) / **300** (Pro) / **500** (Ultra 20 TB, $100) / **600** (Ultra 30 TB, $200) |

The **50-source cap on free** is consistently cited as NotebookLM's #1 practical complaint (XDA: "NotebookLM's source limit is its biggest problem"). Sharing does not raise the cap for collaborators.

### 2.4 Source discovery
- **Fast Research** (formerly "Discover sources", Mar 2025): query box in Sources panel -> choose **Web** or **Drive** -> result list with title, relevance description, link -> tick and import.
- **Deep Research** (Nov 2025): toggle Web + Deep Research -> research question -> runs several minutes (can be minimized) -> produces a **report** plus **cited and uncited sources**; user picks which to import; report can be added as a source. 18+ only; imports can be partial if usage limits hit. Free = ~10/month; Plus 3/day; Pro 20/day; Ultra 75-200/day (pre-Sept-2026 table).
- **Agentic sourcing from chat** (Jun 2026, Gemini 3.5): start with a loose question in chat, the agent proposes web sources via Google Search; user approves; sources stay attributed. Example tasks: "find primary sources in other languages", "find related works by this author".
- **Workspace Studio** automation can append sources on a schedule (text, Drive links, YouTube, URLs) — Workspace only.

Sources: support.google.com/gemininotebook/answer/16215270; support.google.com/notebooklm/answer/16213268 (plans); fast.io limits guide (2026-09-22); XDA; blog.google Deep Research post (2025-11-13).

## 3. Source-grounded chat and inline citations

### 3.1 Behaviour
- **Grounding:** answers are restricted to the *selected* sources (per-source checkboxes). Off-source creative asks get "Gemini Notebook can't answer this question." Since Jun 2026 chat can also work **without sources** (web search, code, file creation) — i.e. it is drifting toward a general agent.
- **Inline citations:** each claim carries numbered **citation chips** `[1] [2]`. **Hover** = popover with the full quoted passage (text *or image* region from the source). **Click** = opens the source viewer scrolled to the passage, highlighted. Citations survive into saved notes ("tables and clickable inline citations are preserved").
- **Auto summary on open:** the chat panel opens with an auto-generated summary of all sources + **suggested questions** chips. Source guide (per source) has key-topic chips that inject a question into chat.
- **Context:** **1M-token context window** on all plans since Oct 29 2025 (Gemini 2.5/3), "6x longer conversation memory"; Google does not publish a per-message token limit. Retrieval is long-context + RAG hybrid (not documented).
- **Model visibility:** since Gemini 3.5 (Jun 2026) users can **expand "thinking steps"** to see what the model is doing (tool calls, code runs).
- **Stop / Keep generating:** a Stop button mid-generation; then revise the prompt or "Keep generating" the original.
- **Feedback:** thumbs up/down per answer (thumbs = consent for human review on consumer accounts).
- **Copy** answer; **Save to note**; **"Add a note"** from chat.
- **Chat history:** saved automatically and **private per user** even in shared notebooks (Mar 2026); "Delete Chat History" in the three-dot menu. Gemini-app chats inside a synced notebook are read-only in Notebook.
- **Artifacts from chat** (Mar 2026): ask in chat "make an audio overview about X" / "turn this into a report" and it produces Studio artifacts without leaving chat.
- **File outputs from chat** (Jun 2026, Ultra/Pro): code sandbox writes **charts (PNG/SVG), documents (PDF/DOCX/MD/TXT), images (PNG/JPG/GIF via Nano Banana), CSV/JSON, XLSX, PPTX**; artifacts can be edited "as new versions"; "experimental, supervise and double-check".
- **Research from chat:** run a research task in chat, then import the report and its sources.
- **Live Voice Chat** (mobile, 18+, Sep 2026): Audio button in chat box -> real-time voice conversation grounded in sources; mute/unmute, interrupt, change topic; transcript appears in chat; ~100 languages.
- **Cross-notebook:** impossible — "Each notebook is independent. Gemini Notebook can't access information across multiple notebooks at once." (The Gemini app can use several notebooks as sources; Notebook itself cannot.) This is a top complaint.

### 3.2 "Configure chat" (per notebook)
| Setting | Options |
|---|---|
| Conversational goal / style / role | **Default** (general research & brainstorming) - **Learning Guide** (Socratic tutor for learning concepts) - **Custom** (free text persona/role/instructions, **up to 10,000 chars**, raised from 500 in late 2025) |
| Response length | **Default - Longer - Shorter** |

Learning Guide behaviour: asks probing, open-ended questions instead of giving the answer, breaks problems into steps, chunks concepts and walks through them one at a time, adapts to the learner. (Launched Sep 2025; Workspace for Education Sep 23 2025.)

### 3.3 What chat does NOT do (gaps)
- No cross-notebook search / global "ask my whole library".
- No per-answer model choice (only Google's Gemini; plan decides "higher/highest model access").
- No export of the full chat transcript as a file (copy per message; notes export to Docs only).
- No branching/forking of conversations; one linear history per user per notebook.
- Citations point into Google's extracted text copy, not your original file/page number (PDF page numbers are not shown reliably — a recurring complaint for academic citation).
- No offline use.

Sources: support.google.com/gemininotebook/answer/16179559 (Use chat); XDA customization article; 9to5Google 2025-09-08; workspaceupdates 2026-03-20; blog.google 2025-10-29 (1M context).

## 4. Notes

- **Where:** originally a "noteboard" in the Studio panel; in 2026 **notes became first-class sources in the Sources panel** ("Created notes automatically appear in the Sources panel alongside your uploaded sources"). Old Studio notes can be **Convert**ed one by one or "Convert all notes to source"; converted notes show a note icon.
- **Create:** Sources panel -> **Create note** -> write/paste text. "Copied text" source also saved as a note.
- **Save to note** from a chat answer: keeps formatting, tables and clickable citations; "Saved response notes are editable once citations are removed" (i.e. editing kills citations — a recurring complaint).
- **Notes as sources:** chat answers cite into notes with chips; checked notes feed Studio artifacts; unchecked notes are excluded from Q&A and generation.
- **Export:** per note **Export to Docs** (one-way; edits don't sync back; sharing permissions don't carry over). No Markdown export of notes natively (third-party Chrome extensions fill this).
- **Editor:** basic rich text (bold/italic/headings/lists); no backlinks, no tags, no folders, no wiki-links, no LaTeX rendering in the editor (LaTeX renders in chat answers since 2025), no images in notes.
- **Mobile:** notes can be viewed/selected/used for chat on mobile, but **not edited**. The **mobile audio recorder** (Sep 2026) captures lectures/thoughts and stores the recording as a note (transcribed, citable, editable on web).
- **Copy notebook** does not copy notes or chat history.
- Mind Maps were historically saved as a special note type.

Sources: support.google.com/gemininotebook/answer/16262519; workspaceupdates 2026-09-18.

## 5. Studio panel UX (the output surface)

**Layout:** right-hand column; a grid of **tiles** (one per output type) on top, generated **artifacts list** below (newest first, each with title, type icon, source count, age, three-dot menu). Each tile has a **pencil icon** = "Customize" dialog; clicking the tile body = generate with defaults. Since mid-2025 you can create **multiple artifacts of the same type** per notebook (e.g. several audio overviews in different languages/foci).

**Tiles (Oct 2026):** Audio Overview - Video Overview - Mind Map - Reports - Flashcards - Quiz - Infographic - Slide Deck - Data Table (+ Notes moved to Sources). Learning overviews live under Reports.

**Common customize-dialog fields:** format radio cards, length (where applicable), **language** dropdown (80+), difficulty / count (study tools), visual style (video/infographic), orientation & detail (infographic), and a free-text **"What should the AI focus on?"** steering prompt with suggested topic chips.

**Artifact three-dot menu:** Rename, Download (format by type), Share (public link, consumer only), Export to Docs/Sheets (reports, tables), **View custom prompt** / **Show prompt** (prompt provenance), Delete, thumbs feedback.

**Background generation:** all artifacts generate in the background; you can queue several; generation can take from seconds (flashcards) to **30+ minutes (video)**. Completion = desktop web notification + **animated tab title** + **blue dot** on the artifact until opened (Settings > Notifications > Web notifications). Since Sep 2026, out-of-quota heavy outputs can be **"Generate later"** (deferred queue, notification when done) and the app **suggests cheaper alternative outputs**.

**Auto-generated starter artifacts:** when you first add sources, some artifacts (report, flashcards, infographic, slide deck, audio, or video) may be created automatically and don't count against limits.

**Prompt provenance:** every artifact remembers its custom prompt ("View custom prompt").

**Versioning:** slide revisions create a new deck version; code-generated files "modify as new versions"; otherwise no version history/undo.

**Embedding (testing, TestingCatalog Sep 2026):** *Interactive Reports* — a long report with placeholders for mind maps, slide decks, quizzes, flashcards; reader clicks **Add** to generate an embedded artifact in place, which is then saved to the notebook. This is NotebookLM inventing "the lesson page".

Sources: support.google.com/notebooklm/answer/16206563; XDA; testingcatalog.com.

## 6. Audio Overviews

**What:** AI-generated spoken discussion of the selected sources. The feature that made NotebookLM famous (Sep 2024). Built with "creative agents" (script writer -> TTS with natural disfluencies, interruptions, "mm-hmm" backchannels).

### 6.1 Formats (official, since Sep 2 2025)
| Format | Hosts | Description (Google) | Typical length |
|---|---|---|---|
| **Deep Dive** (default) | 2 | "Two hosts unpack and connect topics from your sources in a lively conversation." | ~6-20 min (Default), Longer can reach 30-60+ min |
| **The Brief** | 1 | "A single speaker delivers the key takeaways ... in under two minutes." | 1-2 min |
| **The Critique** | 2 | "Constructive evaluation of material like an essay or design doc." Expert-review tone, feedback on your draft. | ~5-15 min |
| **The Debate** | 2 | "A formal, back-and-forth debate" — hosts take opposing positions. | ~5-15 min |

A **Lecture** (single-host, ~30 min) format was reported in testing (PhoneArena) but is not in the official help page as of Oct 2026.

### 6.2 Options
- **Length:** Shorter / Default / Longer — **English only** (other languages get Default per format). A preference, not a guaranteed runtime.
- **Language:** 80+ output languages (default = Google Account preferred language; per-artifact override in the dialog). Expanded from English-only to 50+ (Apr 2025) then 80+.
- **Customization prompt:** free text — focus topics, expertise level ("explain to a 10-year-old", "assume PhD audience"), angle, what to skip. "View custom prompt" shows it later. No published char limit.
- **Voices:** **cannot choose voices**; fixed male + female host pair (lawsuit by ex-NPR host David Greene, Feb 2026, alleging his voice was imitated; Google denies). No custom host names/personas besides prompt-steering.

### 6.3 Interactive mode ("Join")
- Choose **Interactive mode** -> **Join** while listening -> hosts acknowledge you ("Oh, looks like someone wants to chime in"), you ask a question by voice, they answer grounded in sources, then resume the script.
- **English only**, only for newly generated overviews, voice not stored, shared links can't interact; glitches (speaker switches, a third voice).

### 6.4 Player / output
- Player: play/pause, scrub, **playback speed**, background playback (keeps playing while you browse sources), download (audio file — users report **.m4a/.wav**; no transcript export, no chapters, no RSS/podcast feed), share link (requires notebook shared/public; consumer accounts only), thumbs feedback.
- **Generation time:** "a couple of minutes" (longer for Longer), background.
- **No transcript** is shown or exportable (top complaint; users run audio through Whisper). No chapter markers, no "jump to citation" from audio.
- Requires edit access to generate/delete.

### 6.5 Quality reputation
- Pros: astonishingly natural; great for commuting/accessibility.
- Cons (from users and a 2026 *Media, Culture & Society* study): formulaic "wow, that's fascinating" banter, flattening every topic into the same upbeat American-podcast frame, padding, occasional factual drift, hosts sometimes "speak about" the sources as "this document", repetitive intros, mispronunciations in non-English, cannot correct a single error without regenerating everything.

Sources: support.google.com/notebooklm/answer/16212820; @NotebookLM on X (2025-09-02); 9to5Google 2025-09-02; notebooklm-guide audio guide; Wikipedia (lawsuit, study).

## 7. Video Overviews

**What:** narrated videos built from sources: AI-written script + AI voice narrator + generated visuals (slides/illustrations, and in Cinematic mode, Veo-animated footage). Launched Jul 29 2025 (slide-style), visual styles Oct 2025, Cinematic Mar 2026, Short Jul 2026.

### 7.1 Formats (official help 16454555, Oct 2026)
| Format | Description | Notes |
|---|---|---|
| **Explainer** | "A structured, comprehensive overview that connects the dots within your sources." | ~5-10 min narrated slides/illustrations; many languages |
| **Brief** | bite-sized core-ideas video (Oct 2025 blog) | appears in some UIs/guides; help page now lists Short instead |
| **Cinematic** | "A rich, immersive experience that can unpack the complex ideas of your sources through engaging visuals and storytelling." Gemini 3 + Nano Banana Pro + **Veo 3**; "hundreds of structural and stylistic decisions" | **English only, 18+**, Pro/Ultra (+ Business/Enterprise Standard/Plus); quota: Pro 2/day, Ultra 10-20/day (legacy table) |
| **Short** | "Quickly grasp key concepts ... in ~60 second videos" — vertical, mixes narration with **educational animations for formulas, diagrams, scientific concepts** | 80+ languages; shareable |

### 7.2 Options
- **Visual style** (Explainer only, 18+): auto-select, **Classic, Whiteboard, Watercolor, Retro Print, Heritage, Paper-craft, Kawaii, Anime**, or **Custom** (free-text style description). Styles generated by Nano Banana.
- **Language** (long list; Explainer and Short lists differ slightly).
- **Steering prompt** (suggested topics or own text): audience, focus, what to include.
- **Generation time:** "sometimes, more than 30 minutes"; background.
- **Player:** speed, slider, rewind/skip, fullscreen, "good video/bad video" feedback; Download (MP4); share link (consumer accounts); watermark on free/Plus and always in IN/KR/VN.

### 7.3 Weaknesses
- Cannot edit a single scene, the script, or the narration; regenerate whole video.
- No access to script/transcript or slide assets; no chapters.
- Visual accuracy issues (garbled text in images, wrong diagrams) — inherent to image generation.
- Long waits and failures on large notebooks.

Sources: support.google.com/gemininotebook/answer/16454555; blog.google Video Overviews + Nano Banana (2025-10-13); workspaceupdates 2026-03-20, 2026-09-18.

## 8. Mind Maps

- **Generation:** click the **Mind Map** chip/tile; output saved as an artifact in Studio. Regenerate = delete and recreate (no editing). Launched Mar 2025.
- **Structure:** a single-root, left-to-right **tree** (root = notebook topic; 2-4 levels; branches = main themes -> subtopics -> details). It is a hierarchy, not a graph (no cross-links).
- **Interaction:** zoom, pan/scroll, **expand/collapse** branches (nodes show a ">" count), toolbar top-right: expand all / collapse all, download, exit. **Clicking a node sends a chat question** about that topic ("Discuss what these sources say about X") — the map is a navigation UI into chat.
- **Export:** **Download** as an image (PNG). No OPML/Markdown/JSON export (third-party tools like Xmind's "NotebookLM mind map extractor" exist precisely because of this).
- **Sharing:** via notebook share or downloaded file. Downloads may be blocked when Play Books sources are used.
- **Mobile:** **not supported** on the mobile app.
- **Limits:** legacy 10/day free ... 1,000/day Ultra.
- **Gaps:** not editable, no manual nodes, no notes on nodes, no linking nodes to flashcards/progress, no cross-notebook map, image-only export.

Sources: support.google.com/notebooklm/answer/16212283; xmind.com extractor; learnprompting.org.

## 9. Reports (study guide, briefing doc, FAQ, timeline, blog post, custom)

**History:** originally (2024) four fixed "Notebook guide" buttons: **FAQ, Study Guide, Table of Contents, Timeline, Briefing Doc**. Redesigned Sep 8 2025 into a **Reports** tile.

**Current options (help page):** "Create your own, or choose from **FAQ, study guide, briefing document**, or an **AI-suggested report type**". Plus **Blog Post** preset (Sep 2025) and **Interactive learning overview** (Sep 2026). Timeline/ToC survive as suggestions or custom prompts.

| Preset | Content |
|---|---|
| **Briefing Doc** | executive summary of key themes, important ideas/facts, quotes with citations |
| **Study Guide** | short-answer quiz (~10 questions) + answer key, essay-format questions, **glossary of key terms** |
| **FAQ** | common questions + sourced answers |
| **Timeline** | chronological list of events + **cast of characters** (bios) |
| **Blog Post** | readable article of key takeaways |
| **Create Your Own** | free prompt (**up to ~1,000 words**) controlling structure, tone, style, format |
| **AI-suggested types** | dynamic, 3-4 suggestions inferred from source genre/topic: e.g. *white paper* (research), *explainer* (news), *glossary* / *magazine-style explainer* (economics paper), *character analysis* / *plot critique* (short story), concept explainer, strategy memo, etc. |
| **Interactive learning overview** | summary + embedded study tools (quizzes, flashcards, mind maps / infographics) in one hub (Sep 2026) |

- **Language:** picker with 80+ languages.
- **Data tables inside reports** export to Sheets (one tab per table).
- **Export:** "Export to Docs" (one-way), copy, PDF download via code-exec path (Jun 2026: PDF/DOCX/MD/TXT files), print.
- **Rendering:** Markdown-ish rich text with citation chips, headings, tables, LaTeX.
- **Gaps:** not editable in place (except via export); no regeneration of one section; no versioning; reports cannot be scheduled or chained into a sequence (no curriculum).

### 9.1 Data Tables (Dec 2025)
- Synthesizes facts across sources into a **structured table**; pencil = choose language or describe **rows and columns** in a prompt ("compare each study's sample size, method, finding").
- **Export to Sheets**: table on tab 1, **citations on tab 2**. Pro/Ultra first, later all.

Sources: support.google.com/notebooklm/answer/16206563; the-decoder (2025-09-08); 9to5Google (2025-09-08); freeacademy.ai lesson; workspaceupdates 2026-09-18.

## 10. Flashcards and quizzes

**Launched** Sep 8 2025 (web), Nov 6 2025 (mobile); big upgrade Mar 20 2026 and Sep 2026.

### 10.1 Flashcards
- **Customize (pencil):** number of cards (**Fewer / Standard / More**), difficulty (**Easy / Medium (default) / Hard**), **language**, topic prompt ("focus on chapter 3 terms").
- **Card UI:** front (term/question) -> click/space to **flip** -> back (answer); arrows to navigate; **"Explain"** button generates a detailed explanation of the card with **citations** to sources (opens in chat).
- **Progress (Mar 2026):** mark **"Got it" / "Missed it"**; **shuffle**; results screen -> **rerun missed cards**; progress **persists across sessions**; delete individual cards.
- **Sep 2026:** add or edit cards; ask chat about performance ("which concepts did I miss?").
- **Not present:** spaced repetition scheduling (no SM-2/FSRS, no due dates, no daily review queue), no Anki export (third-party extensions do CSV/Anki export), no cloze cards, no image occlusion, no cross-notebook deck.

### 10.2 Quizzes
- **Customize:** number of questions (Fewer/Standard/More), difficulty (Easy/Medium/Hard), language, topic prompt.
- **Types:** originally **multiple choice only (4 options)**; Sep 2026 adds **short answer, multiple select, fill-in-the-blank**.
- **UI:** one question per screen; select answer -> immediate correct/incorrect feedback with **hint** option; **"Explain"** why your answer was wrong with source citations; final **score** screen; **review** / retake; progress persists; delete questions; (Sep 2026) add/edit questions; ask chat about performance to find weak areas.
- **Not present:** no adaptive difficulty across sessions, no mastery tracking per concept, no question bank across notebooks, no timed exam mode, no export to QTI/Moodle/Kahoot (third parties fill), no item analysis for teachers (beyond basic analytics).

### 10.3 Adjacent: Study Notebooks in the Gemini app (Jun 25 2026)
Separate product surface (Gemini app, synced sources): **diagnostic quiz -> personalised study plan/lessons -> progress dashboard (weak areas, exam readiness)**. Free, global, 18+ personal accounts first. This is Google's closest thing to a "course" and it lives outside Notebook.

Sources: 9to5Google 2025-09-08 & 2025-11-06; workspaceupdates 2026-03-20 & 2026-09-18; blog.google 2026-09-15; androidauthority study notebooks.

## 11. Infographics and slide decks

Both launched Nov 2025, powered by **Nano Banana Pro** (Gemini 3 Pro Image) + NotebookLM "creative agents". 18+ only.

### 11.1 Infographics
- **Customize:** **Orientation** Landscape / Portrait / Square; **Detail level** Concise / Standard / Detailed; **Language**; **Style** (Mar 2026): auto-select (default) or one of 10 presets — **Sketch Note, Kawaii, Professional, Scientific, Anime, Clay, Editorial, Instructional, Bento Grid, Bricks**; free-text prompt.
- **Output:** a single raster image (PNG) with text baked in; download; share link. Watermark on Free/Plus (always in IN/KR/VN).
- **Weaknesses:** text rendered inside the image can be misspelled/garbled, especially non-Latin scripts; not editable; facts can't be clicked back to citations; inaccessible to screen readers (no alt text/structured data).

### 11.2 Slide Decks
- **Formats:** **Detailed Deck** (text-dense, reads standalone) vs **Presenter Slides** (sparse visuals for a live talk, with speaker notes).
- **Length:** Short / Default (Ultra gets longer decks + 2x limits).
- **Language**, free-text prompt (audience, slide count, style, brand: "use the brandbook source for colors").
- **Rendering:** each slide is generated as an **image** by Nano Banana Pro (illustrations, charts, typography all in one bitmap).
- **Revisions (Mar 2026):** pencil on a slide -> stylistic or factual feedback per slide -> queue several -> **"Generate revised deck"** -> new version appears in Studio (unchanged slides preserved). Cannot add/remove slides directly.
- **Export:** **PDF** and (Mar 2026) **PPTX**. Third-party testers conflict on PPTX editability — originally one full-bleed image per slide (not editable text); by mid-2026 some report editable text boxes. Google Slides native export "coming soon". Jun 2026 code-exec path can also produce real PPTX files via python-pptx-style code (editable).
- **Weaknesses:** non-editable images, typos in rendered text, long generation, quota-heavy, watermark on lower tiers.

Sources: workspaceupdates 2025-11-20 (Nano Banana Pro) & 2026-03-20; blog.google "8 ways ... Slide Decks" (2025-12-16); XDA customization article; exploreaitogether.com; notebooklm-guide slide decks.

## 12. Deep Research / Discover sources

Three generations of "find me sources":
1. **Discover sources** (Apr 2025): describe a topic in ~a sentence -> Gemini searches the web -> returns ~10 sources with a one-line rationale each -> tick to import. "I'm feeling curious" random-topic button.
2. **Fast Research vs Deep Research** (Nov 13 2025, Sources panel):
   - Select **Web** (or **Drive**) as the search scope.
   - **Fast Research** = quick scan; result list (title, relevance description, link), import immediately.
   - **Deep Research** = "turns your question into a research plan, browses **hundreds of websites**, refines its searches as it goes"; you can point it at specific sites; runs **in the background** (minutes) while you keep working; output = an **organized source-grounded report** + **recommended articles/papers/sites** split into **cited** and **uncited** sources -> choose which to import; the report itself can be added as a source -> then generate Audio/Video Overviews etc. on it. 18+. Partial imports when out of quota.
3. **Agentic research in chat** (Jun 8 2026, Gemini 3.5 + Antigravity): start from "loose ideas and questions"; the agent builds the source repository conversationally using Google Search, proposes sources, user approves ("keeping you in control"); supports tasks like "find primary sources in other languages", "find related works by this author". Web Research & Source Discovery win rate **78.2%** vs previous system (Google internal side-by-side). Ultra + Workspace AI Expanded Access first; Pro rolling out Jul-Aug 2026.

**Limits (legacy):** Deep Research Free 10/month, Plus 3/day, Pro 20/day, Ultra 75-200/day.

**Gaps:** web-only (no academic databases like Semantic Scholar/arXiv/PubMed as first-class scopes; Google Scholar not exposed), no citation-manager integration (Zotero/BibTeX), cannot crawl a whole site, no paywalled sources, research plan is not editable before running (unlike Gemini Deep Research app which shows the plan), report can't be re-run/updated incrementally.

Sources: blog.google Deep Research + file types (2025-11-13); support.google.com/gemininotebook/answer/16215270; blog.google better research (2026-06-08).

## 13. Learning Guide / tutor mode / education features

- **Learning Guide** chat style (Sep 2025): Socratic tutor — asks probing open-ended questions, breaks problems into steps, chunks concepts one at a time, adapts explanations; selected via Configure chat. Grounded in sources. Similar to Gemini "Guided Learning" and ChatGPT "Study mode".
- **Study tools in Studio:** flashcards (with progress), quizzes (4 types by Sep 2026, explain-why-wrong, performance chat), study guide report, interactive learning overviews.
- **Interactive learning overviews** (Sep 2026, under Reports): one hub combining a summary + quizzes, flashcards, mind maps/infographics "to stay focused during study sessions".
- **Ask chat about your performance** on the most recent quiz/flashcard set to find weak areas (no persistent mastery model though).
- **Real-time voice tutor** on mobile (Sep 2026): talk through material step by step, interrupt anytime.
- **Lecture recorder** on mobile (Sep 2026): record class -> transcribed note source.
- **Short Video Overviews** with educational animations for formulas/diagrams/science (Jul-Sep 2026).
- **OpenStax featured notebooks** (Sep 2025): Biology, AP Biology, Intro to Business, Chemistry, Psychology, Principles of Management.
- **Classroom integration** (Aug 2026): teachers' Classroom materials sync into students' notebooks; personal class notebooks for 18+ higher-ed (Apr 2026); **Schoology** import via Gemini LTI (May 2026). Workspace for Education admins control on/off by OU; under-18 allowed on Edu accounts with stricter content policy.
- **Study Notebooks in the Gemini app** (Jun 25 2026): diagnostic quiz -> personalised lessons -> **progress dashboard** (weak areas, exam readiness); sources sync with Notebook; free, global, 18+ personal first. Google splits "study plan" (Gemini app) from "research notebook" (Gemini Notebook).
- **Student offers:** 1 year free AI Pro (US college, 4x limits) / AI Plus (140+ markets, 2x) until Dec 31 2026.

**What is still missing for real learning (BiliMind's opening):** no structured multi-lesson course/curriculum with prerequisites and ordering inside Notebook; no spaced-repetition scheduler (no due dates, no FSRS/SM-2, no daily review across notebooks); no mastery/knowledge-state per concept persisted across sessions (beyond "last quiz" chat); no learning objectives or Bloom-level targeting; no exercises with code execution for learners (code sandbox is for the model's analysis, not student practice); no progress across notebooks; no certificates; no exam simulation/timed mode; no teacher-side item analytics beyond "users/queries per day".

Sources: workspaceupdates 2025-09-23, 2026-09-18; 9to5Google 2025-09-08; blog.google study tools 2026-09-15; notebooklm-guide changelog.

## 14. Featured / public notebooks and sharing

### 14.1 Private sharing
- **Share** dialog: add emails as **Viewer** (read-only: chat with sources, view artifacts) or **Editor** (add/remove sources and notes, generate artifacts, reshare). Consumer Gmail: up to **50 users**, no Google Groups. Workspace: per admin policy.
- **Copy link** or **Copy link to chat view** ("Chat-only" view hides sources & Studio but viewers may still reach them).
- **Allow copies** checkbox (Aug 2026) controls whether recipients can duplicate the notebook (copy = sources + Studio artifacts, not notes/chat; not synced).
- Chat history is private per user even in shared notebooks.
- **Analytics** (owner): 7-day "Users per day" and "Queries per day"; requires sharing with 4+ users and recent chat activity; updates every ~24 h.

### 14.2 Public sharing (Jun 2025)
- "Anyone with a link" -> **view-only** notebook; recipients need a Google account to open a public notebook; **individual artifacts** (audio, video, infographic, slides...) can be shared by link and viewed **without signing in**.
- **Consumer accounts only** — disabled for Workspace Enterprise/Education.
- Notebooks using Play Books sources cannot be public.
- 140k+ public notebooks within the first month.
- No custom domain, no SEO-indexable page, no embed widget, no theming, no analytics beyond the above.

### 14.3 Featured notebooks (Jul 14 2025 ->)
- Curated public notebooks on the home screen: The Economist (*The World Ahead 2025*), The Atlantic (Arthur C. Brooks *How to Build a Life*), Eric Topol (longevity), Jacqueline Nesi (parenting), Shakespeare complete works, Yellowstone guide, Our World in Data, Q1 earnings of top-50 companies; later OpenStax textbooks, The Economist archive 1945, author notebooks (Steven Pinker, Michael Pollan via Expert Intelligence 2026), Jane Austen.
- Each = sources + pre-generated audio overview + mind map + suggested questions; users can chat but not edit.

### 14.4 Advanced sharing
"Advanced sharing" is listed as a **paid** feature (Plus+): includes chat-only links and usage analytics.

Sources: support.google.com/notebooklm/answer/16206563; blog.google featured notebooks (2025-07-14); 9to5Google; Press Gazette.

## 15. Mobile apps

- **Launched** May 19-20 2025 (Android 10+, iOS/iPadOS 17+). Rebranded "Gemini Notebook" Jul 2026; Android 1.60.8 / iOS 1.60.7 in early Oct 2026.
- **Features:** notebook list with filters (Recent, Shared, Title, **Downloaded**); add sources (PDF, web, YouTube, copied text, Drive, images, EPUB) including from the **system share sheet** ("Share to NotebookLM" from any app); chat with citations; Audio Overviews with **offline download** and **background playback**, Interactive "Join"; Video Overviews; flashcards and quizzes (Nov 2025); reports (Jun 2026); infographics and slide decks (Dec 2025); slide revisions; **push notifications** when an artifact finishes; **LaTeX rendering**; light/dark theme; **Live Voice Chat** with notebooks (Sep 2026, 18+, ~100 languages); **audio recorder** for lectures (Sep 2026).
- **Missing on mobile (per help pages, Oct 2026):** **Mind Maps not supported**; **notes cannot be edited** (view/select only); some source discovery and customization options limited ("The mobile app may have limitations to this feature" appears on most help pages).
- **Historical complaints:** at launch no notes, no Discover, no source deselection, no audio customization, slower generation, audio routed to earpiece bug; WAV downloads huge; large downloads failing in mobile browsers.
- **Notebooks inside the Gemini mobile app** (Apr 30 2026): attach a Notebook notebook to a Gemini chat via "+" -> "Add notebook".

Sources: blog.google NotebookLM app (2025-05-19); Android Authority; JustUseApp; support.google.com/gemininotebook (mind maps, notes); App Store changelog; workspaceupdates 2026-09-18.

## 16. Languages

- **Output language:** Settings -> **Output Language** (defaults to Google Account language) — applies to chat answers and Studio outputs; each Studio customize dialog also has its own language dropdown (per artifact). Google lists **80+ supported output languages** (English, Spanish, French, German, Japanese, Hindi, Arabic, Swahili, Chinese, Russian, Ukrainian, Uzbek is in Gemini's list, etc.). Sources in any language; cross-lingual Q&A works (ask in English about Japanese sources).
- **Per-feature language support differs:**
  - Chat, reports, flashcards, quizzes, mind maps, data tables, infographics, slides: 80+.
  - **Audio Overviews: 80+**, but **Shorter/Longer length = English only**, **Interactive mode = English only**.
  - **Video Explainer & Short:** long lists (Afrikaans -> Vietnamese; differ slightly; Short got 70+ more languages in 2026); **Cinematic = English only**.
  - **Live Voice Chat:** nearly 100 languages.
  - **Audio-file transcription:** "dozens" of languages.
  - **Notes on mobile/under-18:** some features English-only.
  - **AI Mode notebooks:** English only (180+ countries, not EEA).
- **Interface (UI) language:** follows Google Account language (~similar set); separate from output language.
- **Quality caveat:** non-English audio is reported as less natural (mispronunciations, anglicized prosody, "American content" injected — 2026 *Media, Culture & Society* study critique).

Sources: support.google.com/notebooklm/answer/16212820; support.google.com/gemininotebook/answer/16454555; scalevise output-language article; nlmtools language guide.

## 17. Models used

| Period | Chat / reasoning model | Media models |
|---|---|---|
| 2023 (Tailwind/launch) | PaLM 2 | — |
| Dec 2023 | Gemini Pro (1.0) | — |
| 2024 | **Gemini 1.5 Pro** (long context; enabled multimodal sources) | Audio Overviews: Gemini + Google's SoundStorm-lineage dialog TTS |
| Early 2025 | Gemini 2.0 Flash / Flash Thinking | — |
| May 2025 | **Gemini 2.5 Flash** | — |
| Oct 2025 | Gemini 2.5 with **1M-token context** on all plans | **Nano Banana** (Gemini 2.5 Flash Image) for video visual styles |
| Nov-Dec 2025 | **Gemini 3** (Pro/Flash) | **Nano Banana Pro** (Gemini 3 Pro Image) for Infographics, Slide Decks |
| Mar 2026 | Gemini 3 | **Veo 3** + Nano Banana Pro for Cinematic Video |
| **Jun 8 2026 ->** | **Gemini 3.5 (Flash; API id `gemini-3.5-flash`, GA Jun 4 2026)** running inside **Antigravity** agent harness with a per-notebook **secure cloud computer** and **100+ curated software skills** | Nano Banana (images in code outputs) |

- Plan tiers get "Access / Higher access / Highest access" to Gemini models (Pro+ may route harder prompts to stronger models; not documented).
- Users cannot pick a model, cannot bring their own key, cannot run locally.
- HN users (Jul 2026) report **more hallucinations after the backend change**; r/notebooklm has many "hallucination" threads after the 3.5 move (unverified volume).

Sources: blog.google better research (2026-06-08); the-decoder; Wikipedia; alternativeto (2.5 Flash, 1M context); workspaceupdates (Nano Banana Pro 2025-11-20; Cinematic 2026-03-04).

## 18. Pricing tiers and limits

### 18.1 Plans (official table "Learn about Gemini Notebook's plans", Oct 2026)
| Plan | How you get it | Notebooks | Sources/notebook | Model access | Early access | Watermark removal |
|---|---|---|---|---|---|---|
| **Standard** | free with a Google account | 100 | 50 | Access | Standard | No |
| **Plus** | Google AI Plus | 200 | 100 | Access | Early | No |
| **Pro** | Google AI Pro | 500 | 300 | Higher | Priority | Yes* |
| **Ultra (20 TB)** | Google AI Ultra $100/mo (new at I/O May 2026) | 500 | 500 | Highest | Priority | Yes* |
| **Ultra (30 TB)** | Google AI Ultra $200/mo (cut from $250 at I/O 2026) | 500 | 600 | Highest | Priority | Yes* |

\* Visible watermark on generated media (infographics/slides/video) is removed on Pro+ — **except** in India, South Korea, Vietnam where it is always applied. Free/Plus outputs carry a watermark.

**US list prices** (third-party, verified Sept 2026; Google's own Sep 2026 student post values AI Pro at **$19.99/mo** and AI Plus at **$4.99/mo** in markets outside the US, so prices vary by region): Plus ~$7.99-9.99, Pro $19.99-24.99, Ultra $99.99 / $199.99. All bundle Gemini app, storage (Plus 200 GB, Pro 2 TB, Ultra 20-30 TB), Gemini in Gmail/Docs etc. **NotebookLM cannot be bought on its own** — it is a bundle perk.

Other paths: **Workspace** (Business/Enterprise/Education editions include it; "AI Expanded Access" and "AI Ultra Access" add-ons raise limits), **Gemini Notebook for Enterprise** on Google Cloud (5x+ artifacts, VPC-SC, IAM, data residency), **Education** (Education Plus / Teaching & Learning add-on get higher limits at no cost; under-18 allowed on Workspace for Education).

### 18.2 Usage model since 2 Sep 2026 — compute-based
- Old model (until Sept 1 2026): fixed daily counts per feature (below).
- New model: "flexible, compute-specific" limits. Usage counts **prompt complexity, chat length, number of sources, model and features used**. Quota **refreshes every 5 hours until a weekly limit**. Multipliers: Free = standard (1x), **Plus 2x, Pro 4x, Ultra 5x or 20x Pro** ($100 vs $200).
- **No absolute numbers published** ("there is no reliable answer like 'you get exactly 100 prompts every five hours'"). Settings -> Usage shows remaining balance and reset time.
- When the next output would exceed the limit, the app **suggests a cheaper alternative output** (e.g. infographic instead of video).
- **"Generate later"** queue: Video Overviews and Slide Decks can be deferred and generated automatically later (can take "a couple of hours"), with an optional notification.
- Some one-time automatic starter artifacts don't count.
- Users widely report this as more confusing than the old table (Journal du Geek: "it's complicated").

### 18.3 Legacy daily-count table (until Sept 2026, still quoted widely)
| Feature | Standard | Plus | Pro | Ultra 20TB | Ultra 30TB |
|---|---|---|---|---|---|
| Chats/day | 50 | 200 | 500 | 2,500 | 5,000 |
| Audio Overviews/day | 3 | 6 | 20 | 100 | 200 |
| Video Overviews/day | 3 | 6 | 20 (+2 cinematic) | 100 (+10 cinematic) | 200 (+20 cinematic) |
| Reports/day | 10 | 20 | 100 | 500 | 1,000 |
| Flashcards/day | 10 | 20 | 100 | 500 | 1,000 |
| Quizzes/day | 10 | 20 | 100 | 500 | 1,000 |
| Mind Maps/day | 10 | 20 | 100 | 500 | 1,000 |
| Deep Research | 10/month | 3/day | 20/day | 75/day | 200/day |
| Data Tables / Infographics / Slide decks | Limited | More | High | Higher | Highest |

### 18.4 Data-use terms (relevant to our privacy pitch)
- Personal accounts: "Your data is protected, and is **not used to train** Gemini Notebook **unless you provide feedback**." If you click thumbs up/down, Google **may review the full context** (queries, uploads, responses) by humans.
- Workspace/Education: not human-reviewed, not used for training, even with feedback.
- Data processed for abuse prevention. Everything lives on Google servers; no offline mode, no local export of the whole notebook.

Sources: support.google.com/notebooklm/answer/16213268; blog.google flexible limits (2026-08-28); 9to5Google 2026-08-28; Yahoo Tech; notebooklm-guide.com limits page (verified 2026-09-02); Engadget / blog.google I/O 2026 subscriptions; blog.google study tools (2026-09-15).

## 19. Integrations (Gemini app, Drive, Workspace, API, enterprise)

- **Google Drive:** pick Docs/Slides/Sheets/PDFs/DOCX from Drive; paste Drive URLs; **auto-sync** every few minutes (May 2026).
- **Export:** Docs (notes, reports), Sheets (data tables, report tables + citations tab), PDF/PPTX (slides), downloads for media; code-generated files (PNG/SVG/PDF/DOCX/MD/TXT/JPG/GIF/CSV/JSON/XLSX/PPTX).
- **Gemini app:** notebooks as sources in Gemini chats (Jan 2026); full **Notebooks in Gemini** workspace with chats + files + **custom instructions** synced both ways (Apr 2026, mobile Apr 30); Gemini chats importable as sources.
- **Google Search AI Mode:** notebooks inside AI Mode (Aug 19 2026; English; not EEA).
- **Google Play Books:** purchased ebooks as sources (Expert Intelligence, Aug 2026).
- **Google Classroom / Schoology (LTI):** class materials -> notebooks.
- **Workspace Studio (automation):** "Ask NotebookLM" step (May 2026), "add sources automatically" recurring step (Aug 2026).
- **Enterprise API (Google Cloud, alpha, Sep 2025):** `discoveryengine.googleapis.com/v1alpha/projects/{n}/locations/{us|eu|global}/notebooks` — create notebooks, add sources, **notebooks.audioOverview** (one per notebook), and a standalone **Podcast API** (generate podcasts without a notebook; role "Podcast API User"). No public consumer API; chat/video/reports have no documented REST endpoints. Community MCP servers/CLIs scrape the consumer app (e.g. `notebooklm-mcp-cli`, `nblm`), revealing internal parameters like `goal: default|learning_guide|custom`, `response_length: default|longer|shorter`.
- **Not integrated:** Obsidian, Notion, Zotero, Anki, Readwise, Slack, email (users export Gmail via gyb/mhonarc to load emails), local folders, Git repos, calendars, LMS beyond Classroom/Schoology.

Sources: docs.cloud.google.com NotebookLM Enterprise API (audio overview); blog.google (Gemini app notebooks); workspaceupdates (Workspace Studio, Classroom); HN rename thread.

## 20. User complaints (Reddit, HN, reviews)

Reddit itself was not directly fetchable (blocked); Reddit sentiment below comes from aggregators that quote r/notebooklm, r/college, r/privacy, r/degoogle, r/lawyers, plus first-hand **Hacker News** threads (fetched via the HN API: "NotebookLM is now Gemini Notebook" 371 pts/185 comments 2026-07-16; "Designing NotebookLM" 295/84 2025-09-20; "NotebookLM's automatically generated podcasts..." 907/490 2024-09-30; "Radio host David Greene says Google's NotebookLM tool stole his voice" 175/94 2026-02-15; "Lawyer says Google shut down his Gmail, Voice and Photos after NotebookLM upload" 2026-02-22), app-store aggregators, and reviews (XDA, Android Authority, Atlas, Sourclip, Journal du Geek).

Ranked by how often they recur:

1. **Source caps** — 50/notebook on free is "the most upvoted complaint" (researchers, lawyers, journalists); workarounds (merging PDFs, splitting notebooks) degrade retrieval. XDA: "its accuracy drops as you approach the source limit ... too much hay to search through"; some 3-source notebooks still answer wrongly.
2. **Notebooks are silos** — no cross-notebook question, no account-wide search, duplicated sources across notebooks go stale; "treating a notebook as a permanent research library is a common pitfall".
3. **Lock-in / no full export** — no one-click notebook export; flashcards/quizzes/study guides/chat have no structured export ("I can't export the quizzes that it makes, nor is there an easy way to export the flashcards" — teacher); notes -> Docs only; mind maps -> PNG only; audio was WAV for a long time; a whole cottage industry of Chrome extensions (Sourclip etc.) exists to get Markdown/CSV/Anki out.
4. **Audio Overview fatigue** — "great for the first week. Then you realize it is always the same two people"; can't choose voices; "hyper positive US corporate accents get pretty annoying"; "the two-person podcast format is kind of annoying and it can't pronounce math"; formulaic banter; hosts add content not in sources (esp. history); "generated audio is often about an altogether different topic than the one I requested"; "third voice" glitch; no transcript, no chapters, no RSS feed, can't fix one error without regenerating all.
5. **Hallucinations & citation trust** — grounding reduces but doesn't remove errors; omissions ("cites the right document yet misses a qualifying sentence"); citations sometimes point to unexpected passages; HN (Jul 2026): "The backend has changed people experience more hallucinations. You can see their subs."; "I can't trust NotebookLM with serious work and have stopped using it."
6. **PDF fidelity** — the original PDF is not shown; citations jump into extracted text, not the page ("I want to see the source of the generated summary 90% of the time and that's not happening with PDFs"); no page numbers -> useless for academic citation; scanned PDFs and tables extract poorly; Sheets with multiple tabs confuse retrieval; no bibliography/APA output (need Zotero).
7. **Privacy & account risk** — r/privacy and r/degoogle distrust uploading to Google; thumbs feedback = human review of full context; **a law professor's whole Google account (Gmail, Photos, Voice, backups) was disabled seconds after uploading text-only case reports to NotebookLM** (Feb 2026) — an automated CSAM classifier misfire on legal text; enterprises: "I really wish NotebookLM would hurry up and open a payment tier where they don't harvest your data... control of sensitive information is a requirement."
8. **Google product risk** — rename to "Gemini Notebook" triggered "killedbygoogle.com", "one step closer to the abattoir", "It ALWAYS starts with a name change, then more useless features, more enshittification, then users flee, then the product is killed"; fear of Gemini being "shoved in your face" and ads ("monetize every pixel").
9. **Opaque, shrinking usage limits** — Sep 2026 compute quota is "more flexible but less legible than the good old counter" (Journal du Geek); no absolute numbers; "You're almost at your AI usage limit" banners; heavy outputs deferred hours; Plus buyers disappointed answer quality is identical to free.
10. **UX confusion** — "I have never understood the distinction between 'Chat' and 'Studio'"; "low info density, way too many cards/buttons"; Studio tile block was 328 px tall after flashcards/quiz were added (small screens in India); panels not resizable; "Why notes? Is there a difference between my notes and AI notes?"; "Why isn't there a dedicated markdown notes section with folder and files?"; editing text is poor; saved notes lose citations when edited; chat history was not saved until late 2025.
11. **Mobile parity** — no Mind Maps, no note editing, historically no Discover/source deselection/audio customization; slow; earpiece audio bug; app-store sentiment ~56% positive / 44% negative (JustUseApp).
12. **Missing source types** — code repos ("not possible for big repos"), email (users script gyb + mhonarc to get Gmail in), video frames, websites beyond one page, paywalled/logged-in pages, .xlsx, Notion/Obsidian vaults.
13. **No general knowledge** — refuses to go beyond sources ("refuses to write things... I can't make it write an essay based on the information I fed"); users pair it with Claude/ChatGPT for writing ("NotebookLM for reading, Claude for writing"). (Partially changed by Jun 2026 sourceless chat.)
14. **Generated media quality** — garbled text in infographics/slides, especially non-Latin scripts; slides are images (not editable); watermark on free/Plus (permanently in IN/KR/VN); videos take 30+ min and can fail.
15. **Age and region gates** — Deep Research, slides, infographics, cinematic video, voice chat, styles are 18+; AI Mode notebooks exclude EEA; Cinematic/Interactive audio English-only.
16. **Cultural flattening** — 2026 *Media, Culture & Society* study: Audio Overviews flatten content into a standard US-podcast format and add American content irrelevant to the material's cultural context. Voice lawsuit (David Greene, ex-NPR) adds reputational noise.

**What users praise (keep these bars):** grounded answers with clickable citations ("It does not pretend to know things outside your sources"); generous free tier ("Free covers 95% of use cases"); audio overviews for commuting; Debate format as devil's advocate; long-context synthesis across dozens of PDFs; YouTube-lectures-to-study-guide in minutes; zero setup.

Sources: HN Algolia API items 48936451, 45315312, 47109174, 47025864, 41693087; aitooldiscovery.com Reddit review; XDA source-limit article; atlasworkspace.ai limitations; sourclip.com export guide; monsha.ai teachers blog; discrepancyreport.com (lawyer account ban, 2026-02-18); Journal du Geek 2026-09-05; JustUseApp; Android Authority; Wikipedia (study, lawsuit).

## 21. Open-source alternatives (brief)

(Full analysis lives in `res-oss-rivals.md`; this is the NotebookLM-relative snapshot, GitHub stats fetched 2026-10-10.)

| Project | Stars | License | Shape | vs NotebookLM |
|---|---|---|---|---|
| **AnythingLLM** (Mintplex-Labs) | 66.9k | MIT | desktop + Docker, local-first agents/RAG | no Studio outputs (no podcast, notes, flashcards) |
| **Open Notebook** (lfnovo) | 40.0k | MIT | Docker (FastAPI + Next.js + SurrealDB + LangChain), 20+ providers via Esperanto, 1-4 speaker podcasts with episode profiles, "transformations", full-text + vector search, REST API, 13 UI languages | closest feature clone; no desktop app, Docker friction, slow with local models, no study tools |
| **Khoj** | 37.6k | AGPL-3.0 | self-host "AI second brain", Obsidian/Emacs plugins, web + docs, automations | not notebook/Studio-shaped |
| **Kotaemon** (Cinnamon) | 25.8k | Apache-2.0 | RAG chat with docs, citations with PDF viewer highlights | chat only |
| **SurfSense** | 16.3k | Apache-2.0 (+mixed) | **pivoted to a desktop app** (Win/macOS-ARM/Linux AppImage/.deb); hosted web app sunset 18 Oct 2026; research with citations over local files, creates DOCX/PPTX/XLSX, mind maps, flashcards, quizzes, local-voiced audio with transcript, BYO OpenAI-compatible or local model | **the most direct desktop rival to BiliMind Desktop** — but document-tool-shaped, not course-shaped |
| **Podcastfy** | 6.6k | Apache-2.0 | Python lib: multimodal content -> multi-speaker podcast | audio only |
| **Morphik** | 3.7k | mixed | multimodal retrieval engine (+ Show HN NotebookLM clone) | infra |
| **open-notebooklm** (gabrielchua) | 2.6k | Apache-2.0 | PDF -> podcast demo | stale (2024) |
| **NotebookLlama** (Meta cookbook) | — | MIT | PDF -> podcast recipe | recipe |
| **InsightsLM** | 0.7k | MIT | self-hosted n8n/Supabase clone | small |
| Others seen | — | — | KnowNote (Docker-free desktop), Gloss (Rust desktop), Notebooker.ai (on open-notebook, plugin "creators"), Nouswise (commercial) | — |

**Common gaps across all of them (and NotebookLM):** none produce a **structured, ordered course** with lessons, prerequisites, archetype-chosen formats, exercises, grading and spaced review; none write to a **plain Markdown vault** the user owns (they keep data in SurrealDB/SQLite/Postgres/vector stores); most require Docker; podcast quality is far below NotebookLM's dialog TTS.

Sources: GitHub API; github.com/lfnovo/open-notebook; github.com/MODSetter/SurfSense; openalternative.co; HN Show HN threads.

## 22. Where a local, BYOK, file-based desktop course generator can beat NotebookLM
_pending_

## 23. Feature-parity checklist for BiliMind Desktop
_pending_

## Sources
_pending_
