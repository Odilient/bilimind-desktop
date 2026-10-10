# BiliMind data model inventory (DAT-)

> Slice: every migration in `backend/database/migrations` (57 files + `RESERVED-SLOTS.md`) and every model in
> `backend/app/Models` (32 models), with the enums in `backend/app/Enums` (26) that type their columns.
> Source of truth for implementers porting to BiliMind Desktop (Node.js, local markdown vault, BYOK).
> Status: IN PROGRESS — sections are filled in order; anything still marked `_pending_` was not reached yet.

## 0. Feature checklist (DAT-xx)

Every user-visible behaviour the data model carries. Detailed spec per ID in §4; the desktop representation in §5.

| ID | Feature / behaviour (one line) |
|---|---|
| DAT-01 | Course identity minted by the client before the course exists (`uuid`), addressable by id or uuid |
| DAT-02 | Human URL `/{username}/{slug}`; slug follows the title until the course is public, then freezes |
| DAT-03 | Course lifecycle status (clarifying → outlining → outlined → expanding → ready / failed) with failure reason |
| DAT-04 | Clarifying questions (id, question, why, one-tap suggestions) and the learner's answers stored on the course |
| DAT-05 | Course inputs: topic, goal, level, language, minutes/week, source type (topic / materials / mixed) |
| DAT-06 | Course settings (preferred formats, depth overview/standard/deep, include code) merged key-by-key on edit |
| DAT-07 | `allows_code` gate: code blocks, code assessments and sandbox only on genuinely code subjects |
| DAT-08 | Durable create flow: `/create/{uuid}` draft (step, raw form, clarify answers in progress), Drafts strip, 30-day prune, empty drafts hidden |
| DAT-09 | Live generation progress report (outline phase + streamed step titles + attempt; parts batches) with server-side stopwatch |
| DAT-10 | Archive a course (off the shelf: out of library, today's plan, review queue; links unchanged) |
| DAT-11 | Trash with 30-day restore countdown, then purge; uploaded files survive until the real delete |
| DAT-12 | Share link (`share_token`) + public flag; public catalogue; private marks never leak into shared views |
| DAT-13 | Roadmap path grammar: core topics on the spine (`layer`), subtopics hanging off (`branch_of`, max one extra level), ordered by `position` |
| DAT-14 | Roadmap annotations: badges (recommended / alternative / anytime with colours), groups (headed boxes), notes (advice paragraphs), sections (chapters) |
| DAT-15 | "Where to go next" pointers (`further`) that create a new course, optionally anchored beside a topic |
| DAT-16 | Archetype per lesson → deterministic mandatory formats (`planned_block_types`), assessment-kind bias, image-fallback substitution |
| DAT-17 | Lazy lesson generation: stub → queued → generating → ready / failed, writing stopwatch, charge/refund bookkeeping |
| DAT-18 | Prerequisite / optional / related edges (legacy DAG) used for topological ordering of the schedule |
| DAT-19 | Polymorphic lesson blocks (27 types) with strictly normalised payloads per type |
| DAT-20 | Grounding provenance: which materials each block was built from (`source_material_ids`) |
| DAT-21 | Assessments: 9 kinds, hidden answer keys, rubrics, max score, ordering; retired (not deleted) on regenerate so attempts survive |
| DAT-22 | Attempts: full history per assessment with per-kind response, score, passed, feedback, criterion scores, grader meta, async states |
| DAT-23 | Per-lesson progress: available / in progress / completed / skipped, time spent, last seen; auto-complete when every live item is passed |
| DAT-24 | Spaced-repetition review queue (SM-2), seeded the day after a lesson is completed, recall graded 0–5 |
| DAT-25 | Study schedule: start date, minutes/week, study weekdays, items pending/done/skipped/moved, re-flow, overdue kept as visible debt |
| DAT-26 | Notifications: daily digest (one per local day, rewritten in place), course ready / failed; read state |
| DAT-27 | Hand-editing a lesson with optimistic locking (stale base revision → conflict), `edited_at` warning before regenerate |
| DAT-28 | Revision history: whole-lesson snapshots, cause, one-line summary, no-op autosaves collapsed, block diff + word diff, restore, retention |
| DAT-29 | Per-block AI rewrite in place (rest of lesson readable), with rewrite error shown on the block |
| DAT-30 | Attachments pinned beside a lesson: caption, order, sniffed type, inline vs download, allowed formats, size caps |
| DAT-31 | Private annotations: highlight, note, ink over picture/part, text label, whiteboard; client-minted ids; batch autosave; caps |
| DAT-32 | Materials library: file / url / pasted text / image / video; course-scoped or library-wide; ingest status incl. "needs you" + supplied text keeping the original |
| DAT-33 | Material chunks with human locators ("Slide 14", "Ch. 3", "12:40") printed into prompts for citations |
| DAT-34 | Verified external resources (canonical URL dedupe, verified-only, ranked per lesson with a "why", embeddable videos, licence) |
| DAT-35 | Generated illustrations: content-addressed cache, intent + subject, overlay labels, cost, per-course ceiling and weekly budget |
| DAT-36 | Narration audio cache keyed by text + voice |
| DAT-37 | Full-text search across courses / lessons / block prose (diacritic-insensitive, title-weighted) and materials; spoiler fields excluded |
| DAT-38 | Assistant: conversations (optionally course-scoped), messages with lesson/block context, artifacts (html / markdown / pdf) |
| DAT-39 | Generation telemetry: every LLM call's stage, model, tokens, cost, duration, attempts, error |
| DAT-40 | Usage allowance: monthly meters, top-ups, rollover, refunds of failed lessons (→ desktop: BYOK cost meter + budgets) |
| DAT-41 | BYOK credentials: encrypted secret, last four, label, active flag, last used |
| DAT-42 | Reading preferences (scale, font, theme) following the person across devices |
| DAT-43 | Profile: name, username (auto-suggested, deduped), locale, timezone, avatar |
| DAT-44 | Organizations / memberships / subscriptions (server-only tenancy; dropped on desktop) |
| DAT-45 | Self-healing data migrations (subtopic promotion, track → badge, backfills) → desktop vault schema versioning |

---

## 1. Full schema (server, as built — Postgres)

Conventions on every table unless noted: `id bigserial PK`, `created_at`/`updated_at timestamp NULL` (Laravel
`timestamps()`). `FK→x cascade` = `ON DELETE CASCADE`; `FK→x null` = `ON DELETE SET NULL`. "json" is Postgres `json`
except `courses.pipeline` which is `jsonb`. Enum columns are plain `varchar` in the DB; the PHP enum is the vocabulary.

### 1.1 Infrastructure tables (framework; NOT ported)

| Table | Columns | Notes |
|---|---|---|
| `sessions` | `id string PK`, `user_id FK? idx`, `ip_address(45)?`, `user_agent text?`, `payload longText`, `last_activity int idx` | web sessions |
| `cache`, `cache_locks` | `key PK`, `value mediumText` / `owner`, `expiration bigint idx` | Laravel cache; also used for claim-on-request locks |
| `jobs`, `job_batches`, `failed_jobs` | standard Laravel queue tables | queue = generation pipeline transport |
| `personal_access_tokens` | `tokenable morphs`, `name text`, `token(64) uniq`, `abilities text?`, `last_used_at?`, `expires_at? idx` | Sanctum bearer tokens |
| *(DDL)* `bilimind_search` text-search config | `COPY = simple` + `unaccent` mapping for all word token types | diacritic-folding FTS ("cafe" finds "café"); migration `2026_01_01_000000` must run before any generated tsvector |

### 1.2 Identity / tenancy / billing (server-only concepts)

**`users`** (model `User`, `Authenticatable`, Sanctum `HasApiTokens`)
| Column | Type | Notes |
|---|---|---|
| `id` | bigserial | single-user MVP historically resolved user #1 via `CurrentUser::get()` |
| `current_organization_id` | FK→organizations null, nullable | "current" org carries subscription + meters |
| `name` | string | |
| `username` | string unique nullable | auto-filled on `creating` by `Username::suggestFor()` (dedupe `you`, `you-2`, `you-3`); used in course URL `/{username}/{slug}` |
| `email` | string unique nullable | |
| `email_verified_at` | timestamp? | |
| `password` | string? | |
| `remember_token` | string(100)? | |
| `telegram_id` | string unique? | Telegram login / TMA |
| `telegram_username` | string? | |
| `locale` | string default `'en'` | UI + default course language |
| `timezone` | string default `'UTC'` | schedule/digest local day |
| `avatar_url` | string? | |
| `preferences` | json? | reading prefs `{reading:{scale,font,theme}}` (see §3) — cast `array` |

**`organizations`** (`Organization`) — "an individual is an organization of one"
`name string`, `slug string unique`, `type string default 'individual'` (enum `OrganizationType`: `individual|learning_center|bootcamp`), `owner_user_id FK→users cascade idx`, `settings json?`.

**`memberships`** (`Membership`): `organization_id FK cascade`, `user_id FK cascade idx`, `role string default 'owner'` (enum `MembershipRole`: `owner|admin|instructor|learner`; `canManage()` = owner|admin). Unique `(organization_id,user_id)`.

**`subscriptions`** (`Subscription`, one per org, unique `organization_id`): `plan string default 'free'` (`PlanTier`: `free|pro`), `interval string?` (`BillingInterval`: `month|year`), `billing_provider?` (stripe/paddle), `provider_subscription_id? idx`, `provider_customer_id? idx`, `status string default 'active'` (`SubscriptionStatus`: `active|trialing|past_due|canceled|incomplete|unpaid`; `grantsAccess()` = active|trialing), `is_active bool default true`, `period_start?`, `period_end?`, `trial_ends_at?`, `ends_at?` (grace after cancel).
Logic: `active()` = is_active && (!cancelled || ends_at future); `effectivePlan()` = active ? plan : free; `expansionCap()` = `config("plans.tiers.{plan}.limits.node_expansions_per_month")` (no tier unlimited).

**`usage_meters`** (`UsageMeter`): `organization_id FK cascade`, `meter string` (`node_expansion` | `illustration`), `period string(7)` `YYYY-MM`, `count int default 0`. Unique `(organization_id, meter, period)`.

**`usage_topups`** (`UsageTopup`): `organization_id FK cascade`, `meter string`, `source string default 'purchase'` (`purchase|rollover`), `quantity int`, `remaining int`, `amount_cents int?`, `currency(3)?`, `provider?`, `provider_reference? UNIQUE` (checkout session id → webhook idempotency), `expires_at?` (null = never). Index `(organization_id, meter, expires_at)`. Spend order: `expires_at ASC NULLS LAST, id`; spendable = `remaining>0 AND (expires_at IS NULL OR > now())`; consumed only after the month's plan allowance is gone.

**`api_credentials`** (`ApiCredential`, BYOK): `user_id FK cascade`, `provider string default 'deepseek'` (`PROVIDERS = ['deepseek','openrouter']`), `secret text` (cast `encrypted` = Laravel Crypt; `$hidden`), `last_four string(4)?`, `label?`, `is_active bool default true`, `last_used_at?`. Index `(user_id, provider)`. `setKey(plain)` trims, stores, records last 4. A stored key lifts the expansion cap (OwnKey) and the weekly imagery budget.

### 1.3 Course graph (the core — PORTED)

**`courses`** (`Course`, `SoftDeletes`)
| Column | Type / default | Notes |
|---|---|---|
| `id` | bigserial | route-resolves by id **or** uuid (`resolveRouteBinding`: digits → id, uuid → uuid, else null) |
| `uuid` | uuid unique (nullable at column level only) | **client-minted** in `/create/{uuid}` before the row exists; `booted()` fills if missing |
| `user_id` | FK→users cascade | owner |
| `organization_id` | FK→organizations null, idx | billing context |
| `title` | string | born = raw topic; renamed by outline stage |
| `slug` | string? ; unique `(user_id, slug)` | `CourseSlug::for($course)`; `syncSlug()` follows title UNTIL `is_public` (then frozen — someone's bookmark) |
| `topic` | text | raw prompt |
| `language` | string default `'en'` | content language |
| `level` | string? | `beginner|intermediate|advanced` (consts `LEVEL_*`) |
| `allows_code` | bool default false | set by outline model; gates `code` blocks, `code` assessments and sandbox |
| `further` | json? | "where to go next": `list<{title, topic, after_key}>` |
| `goal` | text? | |
| `minutes_per_week` | int? | study budget, feeds schedule |
| `source_type` | string default `'topic'` | `topic|materials|mixed` |
| `status` | string default `'clarifying'` | enum `CourseStatus` (§2) |
| `clarifying_questions` | json? | `[{id, question, why, suggestions:[]}]` |
| `clarifying_answers` | json? | `[{id, answer}]` |
| `settings` | json? | `{formats_preferred:[], depth, include_code, ...}` (see §3) |
| `share_token` | string? unique | share link capability |
| `is_public` | bool default false | public catalogue + `/{username}/{slug}` readable by anyone |
| `archived_at` | timestamp? | "off the shelf": out of library, today's plan, review queue; URL/share unchanged |
| `failure_reason` | text? | |
| `pipeline` | **jsonb**? | live progress report of the stage in flight (`App\Support\Pipeline`, §3) — cosmetic, never read back as input |
| `deleted_at` | timestamp? idx | trash; purge after `TRASH_RETENTION_DAYS = 30` (`purgesAt()`); attachment files deleted only on **force** delete |
Indexes: `(user_id,status)`, `created_at`, `(user_id, archived_at)`, `deleted_at`, `organization_id`.
Scopes: `onShelf` (archived_at null; soft-delete scope excludes trashed), `archived`, `shared` (is_public && share_token not null), `forUser`, `withStatus`.
Access: `isViewableBy(user)` = owner OR is_public; `canBeAnnotatedBy` = signed-in && viewable.
`canonicalPath()` = `/{username}/{slug}`; `canonicalUrl()` = `config('app.frontend_url') + path`.
Relations: `user`, `organization`, `draft` (hasOne CourseDraft), `nodes`, `edges`, `materials`, `generationRuns`, `schedules`, `blocks` (through nodes), `assessments` (through nodes).

**`nodes`** (`Node`) — one lesson on (or beside) the main line
| Column | Type / default | Notes |
|---|---|---|
| `course_id` | FK cascade | |
| `key` | string; unique `(course_id,key)` | stable slug; promoted subtopics use `{parentKey≤40}__{leafSlug≤40}[_n]` |
| `title` | string | |
| `summary` | text? | |
| `note` | text? | roadmap "note" paragraph beside a topic (advice, not a lesson) |
| `section` | string(80)? | set only on the lesson that OPENS a chapter |
| `group` | string(80)? | headed box gathering sibling subtopics (siblings sharing the string draw in one box) |
| `concept_key` | string? | language-agnostic canonical concept id |
| `archetype` | string? idx `(course_id, archetype)` | enum `ConceptArchetype` (11 values) — drives mandatory formats |
| `track` | string default `'core'` idx `(course_id,track)` | `LessonTrack`: `core|subtopic` (legacy `recommended`/`optional` migrated) |
| `mark` | string(20)? | `LessonMark`: `recommended|alternative|anytime` (badge on a subtopic) |
| `branch_of_node_id` | FK→nodes null | parent topic (or parent subtopic, max one level deeper) |
| `layer` | int default 0 | step index along the spine |
| `position` | int default 0 | 0 = topic on the line, 1..n = subtopics at that step in reading order |
| `estimated_minutes` | int default 15 | subtopic promotion uses 12 |
| `status` | string default `'stub'` | `NodeStatus`: `stub|queued|generating|ready|failed` |
| `planned_block_types` | json? | `list<BlockType value>` = `archetype->plannedBlockTypes()` (derived, never model-supplied) |
| `failure_reason` | text? | |
| `writing_started_at` | timestamp? | stopwatch survives reload (`writingFor()` seconds while generating) |
| `current_revision_id` | unsigned bigint? (NOT an FK on purpose) | optimistic-lock token for edits |
| `edited_at` | timestamp? | hand-edited marker; Regenerate warns before replacing human work |
| `charged_organization_id` | FK→organizations null | who paid for an in-flight write → refund target on failure; cleared when written or refunded |
Indexes: `(course_id,status)`, `(course_id,layer,position)`.
Scopes: `stubs`, `ready`, `inFlight` (queued|generating), `ordered` (layer, position, id), `core`, `forCourse`.
Relations: `course`, `branchOf`, `branches` (ordered position,id), `blocks` (ordered position), `assessments` (ordered position), `attachments` (position,id), `progress`, `scheduleItems`, `revisions` (desc id), `currentRevision`, `generationRuns`, `resources` (belongsToMany via `node_resource`, pivot `rank, relevance_score, why`, **only verified**, ordered by rank), `outgoingEdges`, `incomingEdges`, `prerequisites`, `dependents`.
`mandatoryFormats()`: archetype formats, with `annotated_media` → `walkthrough` substituted when the node has no `image` resource.

**`node_edges`** (`NodeEdge`): `course_id FK cascade`, `from_node_id FK→nodes cascade`, `to_node_id FK→nodes cascade idx`, `type string default 'prerequisite'` (`EdgeType`: `prerequisite|optional|related`; only prerequisite constrains order). Unique `(from_node_id,to_node_id)`, index `(course_id,type)`. (Legacy DAG; current product draws a path — see memory "a course is a path" — but edges still exist.)

**`blocks`** (`Block`) — polymorphic lesson part
`node_id FK cascade`, `position int default 0`, `type string idx` (`BlockType`, 27 values, §2), `payload json` (shape per type, §3), `source_material_ids json?` (`list<int>` grounding provenance), `rewriting_since timestamp?` (AI rewrite of this one part in flight), `rewrite_error text?`. Index `(node_id, position)`.
`carriesAssessments()` = quiz|exam|project|code → payload carries `assessment_ids`.

**`assessments`** (`Assessment`)
`node_id FK cascade`, `block_id FK→blocks cascade? idx`, `kind string` (`AssessmentKind`: `mcq|multi_select|short_answer|cloze|essay|project|code|ordering|numeric`), `prompt text`, `options json?` (`[{id,text}]`), `answer_key json?` (**`$hidden`**, never serialised to client), `rubric json?` (`[{criterion, weight, excellent, acceptable, poor}]`), `grader string default 'deterministic'` (`GraderKind`: `deterministic|llm_rubric|self`), `max_score int default 100`, `position int default 0`. Index `(node_id,position)`.
**Retired assessments**: regeneration cannot delete an answered assessment (attempts cascade), so it parks it at `position >= RETIRED_POSITION (1000)`; scopes `live()` (<1000) / `retired()` (>=1000). Only `live` counts for player, share view, completion.

**`attempts`** (`Attempt`): `assessment_id FK cascade`, `user_id FK cascade`, `response json`, `score int?`, `passed bool?`, `feedback text?`, `criterion_scores json?`, `grader_meta json?`. Indexes `(assessment_id,user_id)`, `(user_id,created_at)`. Async (llm_rubric) attempts are created with null score and filled by the grade job.

**`progress`** (`Progress`, table `progress`): `user_id FK cascade`, `node_id FK cascade idx`, `state string default 'available'` (`ProgressState`: `available|in_progress|completed|skipped`), `time_spent_seconds int default 0`, `completed_at?`, `last_seen_at?`. Unique `(user_id,node_id)`, index `(user_id,state)`. `isSettled()` = completed|skipped.

**`node_revisions`** (`NodeRevision`, no `updated_at` — immutable)
`node_id FK cascade`, `course_id FK cascade` (denormalised), `user_id FK null` (null = generator), `cause string` (`RevisionCause`: `generated|edited|rewritten|regenerated|restored`; boundary = regenerated|restored, never thinned by retention), `summary string` ("Edited 2 parts", "Regenerated: simpler"), `hash string(64)` (sha256 of canonicalised snapshot → no-op autosaves skipped), `snapshot json` (whole node: title, summary, every block, live assessments **with answer keys**), `restored_from_revision_id bigint?`, `bytes uint`, `created_at timestamp`. Indexes `(node_id,created_at)`, `(course_id,created_at)`. `previous()` = prior id for same node (diff base).

**`attachments`** (`Attachment`) — files pinned beside a lesson (NOT grounding)
`uuid unique` (only id the client sees), `user_id FK cascade`, `organization_id FK null`, `course_id FK cascade`, `node_id FK cascade`, `name string` (sanitised original filename), `path string` (`attachments/{course_id}/{uuid}.{ext}` on private disk; never on the wire), `mime string` (**sniffed** with finfo), `bytes ubigint`, `sha256(64)`, `width?`, `height?` (images), `caption string(500)?`, `position uint`. Index `(node_id,position)`. `kind()` derived via `AttachmentKind::fromMime` (`image|pdf|audio|video|document|file`; inline = image|pdf|audio|video). URL = temporary signed route, TTL 6 h.

**`annotations`** (`Annotation`) — private reader marks
`uuid unique` (**client-minted**, idempotent PUT), `user_id FK cascade`, `course_id FK cascade`, `node_id FK cascade`, `block_id FK cascade?` (null only for `board`), `kind string` (`AnnotationKind`: `highlight|note|ink|board|label`), `anchor json` (where), `data json` (what). Index `(user_id,node_id)`. `MAX_PER_NODE = 200`. Route key = uuid.

**`course_drafts`** (`CourseDraft`) — durable `/create` session
`uuid PK` (client-minted, no int id), `user_id FK cascade`, `organization_id FK null`, `course_id FK cascade?` (set when POST /courses succeeds), `step string default 'compose'` (`compose|clarify|generating`), `topic text?` (denormalised for Drafts strip), `payload json?` (the form verbatim). Index `(user_id, updated_at)`. `STALE_AFTER_DAYS = 30` (prune command); `linkTo(uuid, course)` creates/links draft and sets step clarify|generating; `isSubstantive()` = course_id set OR topic non-blank (empty drafts hidden).

### 1.4 Grounding, research and media

**`materials`** (`Material`; `course_id` null = library-wide)
`user_id FK cascade`, `organization_id FK null idx`, `course_id FK null idx`, `kind string` (`MaterialKind`: `file|url|text|image|video`), `title string`, `path string?` (storage under `materials/`), `url text?`, `mime?`, `bytes ubigint?`, `source_meta json?`, `status string default 'pending'` (`MaterialStatus`: `pending|processing|ready|failed|needs_input`), `char_count int default 0`, `failure_reason text?`. Index `(user_id,status)`. `hasSuppliedText()` = `source_meta.supplied_text === true`. `scopeForCourse(course, includeLibrary)`. Format derived (`MaterialFormat::of`: `pdf|docx|slides|book|transcript|sheet|markup|note|web|image|video|unknown`, extension first, mime second, `source_meta.original_path` wins).

**`material_chunks`** (`MaterialChunk`): `material_id FK cascade`, `ordinal int`, `locator string(120)?` ("Slide 14", "Ch. 3 — Isolation levels", "12:40"; printed into prompts for citations, not indexed), `content text`, `char_count int default 0`, `search_vector tsvector GENERATED ALWAYS AS to_tsvector('bilimind_search', content) STORED` + GIN index. Index `(material_id, ordinal)`.

**`resources`** (`Resource`, course-independent, keyed by URL)
`url string(2048)`, `url_hash string(64) UNIQUE` (sha256 of `canonicalUrl`: lowercase scheme/host, strip `www.`, strip trailing `/`, drop `utm_*`,`fbclid`,`gclid`,`ref`,`ref_src`,`si`,`feature`, ksort query, drop fragment), `kind string` (`video|article|docs|book|tool|image`), `title`, `description text?`, `source_domain?`, `duration_s int?`, `language string(16)?`, `provider string` (`youtube|tavily|brave|exa|wikimedia...`), `provider_id?` (e.g. YouTube videoId for embed), `embeddable bool default false`, `license?`, `commercially_usable bool default false`, `verified_at?` (null ⇒ never shown), `http_status int?`, `meta json?`. Indexes `(kind,language)`, `provider`, `verified_at`. `durationLabel()` → `m:ss` / `h:mm:ss`.

**`node_resource`** pivot: `node_id FK cascade`, `resource_id FK cascade`, `rank int default 0` (0 = best), `relevance_score float default 0`, `why text?` (one line shown to learner). Unique `(node_id,resource_id)`, index `(node_id,rank)`.

**`illustrations`** (`Illustration`, content-addressed cache)
`user_id/organization_id/course_id/block_id FK null` (who caused the spend), `hash string unique` (sha256(model | intent | subject | prompt template version)), `model string`, `intent string` (`IllustrationIntent`: `depiction|contrast|scene|metaphor`), `subject string`, `prompt text` (full composed prompt), `status string` (`pending|ready|failed`), `path?` (public disk), `mime?` (sniffed), `bytes?`, `width?`, `height?`, `cost_usd decimal(10,6) default 0`, `error text?`, `generated_at?`. Indexes `(course_id,status)` (per-course ceiling), `(status,updated_at)` (stalled sweep). URL `route('media.illustration', hash)`. Failed is terminal for a cooldown window (never retried immediately).

**`audio_assets`** (`AudioAsset`, edge-tts cache): `user_id FK null`, `organization_id FK null`, `hash string unique` (sha256(text + voice)), `voice string`, `text_preview string?`, `path string` (`audio/<hash>.mp3` public disk), `bytes int?`, `seconds float?`.

### 1.5 Study plan, review, notifications

**`schedules`** (`Schedule`): `course_id FK cascade`, `user_id FK cascade`, `organization_id FK null`, `starts_on date`, `minutes_per_week int`, `days_of_week json` (`[1,3,5]` ISO-8601, 1 = Monday), `status string default 'active'` (`active|paused|completed`). Indexes `(user_id,status)`, `(course_id,status)`. `minutesPerSession()` = `max(1, floor(minutes_per_week / max(1,count(days))))`.

**`schedule_items`** (`ScheduleItem`): `schedule_id FK cascade`, `node_id FK cascade idx`, `scheduled_for date`, `estimated_minutes int default 15`, `state string default 'pending'` (`ScheduleItemState`: `pending|done|skipped|moved`; open = pending|moved → eligible for recompaction). Indexes `(scheduled_for,state)`, `(schedule_id,scheduled_for)`. Scopes `dueOn(date)`, `overdue(asOf)` (pending & date < asOf), `pending`, `upcoming(asOf)`.

**`review_items`** (`ReviewItem`, SM-2, one per user×node; never plan-gated): `user_id FK cascade`, `course_id FK cascade`, `node_id FK cascade`, `ease_factor float default 2.5`, `interval_days int default 0`, `repetitions int default 0`, `lapses int default 0`, `state string default 'new'` (`new|learning|review`), `due_on date?`, `last_reviewed_at?`. Unique `(user_id,node_id)`; indexes `due_on`, `(user_id,due_on)`. `scopeDue(on=today)` = due_on not null && ≤ on.

**`notifications`** (`Notification`, BiliMind's own): `user_id FK cascade`, `type string` (`daily_digest|course_ready|course_failed`), `title string`, `body text?`, `payload json?`, `read_at?`. Indexes `(user_id,read_at)`, `(user_id,created_at)`.

### 1.6 Assistant, search, telemetry

**`assistant_conversations`** (`AssistantConversation`): `user_id FK cascade`, `organization_id FK null`, `course_id FK null` (course-scoped chat), `title string`. Index `(user_id, updated_at)`.

**`assistant_messages`** (`AssistantMessage`): `conversation_id FK cascade`, `role enum('user','assistant')`, `content text`, `artifact_id bigint?` (no FK constraint), `meta json?`. Index `(conversation_id,id)`.

**`artifacts`** (`Artifact`, assistant-produced documents in right panel): `user_id FK cascade`, `organization_id FK null`, `conversation_id FK null`, `kind enum('html','pdf','markdown')`, `title string`, `content longText?`, `file_path string?` (pdf rendered from html), `meta json?`. Index `(user_id,created_at)`.

**`search_documents`** (`SearchDocument`): `kind string(16)` (`SearchDocumentKind`: `course|node|block` → result groups courses/lessons/content), `course_id FK cascade`, `node_id FK cascade?`, `block_id FK cascade?`, `block_type string(32)?` (only denormalised display field), `title text`, `body text` (DERIVED via `SearchTextExtractor` per-type allowlist — never answers), `search_vector tsvector GENERATED = setweight(title,'A') || setweight(body,'B')` + GIN. Partial unique indexes: one per course (`kind='course'`), per node, per block → idempotent `updateOrCreate`/reindex. Ranked with `ts_rank` weights `{0.1,0.2,0.125,1.0}` (A:B = 8:1, mirrors former FTS5 `bm25(8.0,1.0)`). Materials are NOT here (they use `material_chunks.search_vector`); assessments never indexed.

**`generation_runs`** (`GenerationRun`, written ONLY by `LlmClient` for every LLM call): `course_id FK null`, `node_id FK null idx`, `stage string` (`GenerationStage`: `clarify|outline|expand_node|regenerate|rewrite_block|grade|schedule|illustrate`; default tier `pro` for outline, `flash` otherwise), `model string`, `status string` (`success|failed`), `input_tokens int`, `output_tokens int`, `cost_usd decimal(10,6)` (cast `decimal:6` to avoid float drift), `duration_ms int`, `attempts int default 1`, `error text?`. Indexes `(course_id,stage)`, `(stage,status)`, `created_at`.

### 1.7 Migration history notes that change semantics

- `2026_08_29_000600/000700`: `nodes.subtopics` (json labels) was added then **promoted**: every label became a real `subtopic` node (inherits parent `archetype` and `layer`, position after existing detours, `estimated_minutes=12`, `status=stub`, `planned_block_types` from archetype, no summary). Column dropped. Lesson: *no decorative boxes — anything drawn is openable*.
- `2026_08_29_001000`: tracks `recommended`/`optional` → `subtopic` + `mark recommended`/`anytime`; added `nodes.mark`, `nodes.group`, `nodes.note`, `courses.further`.
- `2026_08_13_130000/130100`: backfilled `users.username` and `courses.slug`.
- `2026_08_29_000500`: backfilled `materials.organization_id` (storage metering).
- `2026_09_20`: archive + soft-delete trash on courses.
- `2026_10_08`: `courses.pipeline` (jsonb progress) + `nodes.writing_started_at` + `nodes.charged_organization_id` (refunds).

## 2. Enums (complete vocabularies)

All are PHP string-backed enums; every one has `values()` and `label()`. Lenient `parse()` exists on
`ConceptArchetype`, `CodeMode`, `LessonMark`, `LessonTrack` (model output tolerance) — port these parsers verbatim.

| Enum (column) | Values → label | Behaviour that matters |
|---|---|---|
| `CourseStatus` (`courses.status`) | `clarifying` Awaiting answers · `outlining` Building outline · `outlined` Outline ready · `expanding` Writing lessons · `ready` Ready · `failed` Failed | `isTerminal()` = ready/failed/outlined/clarifying; `isGenerating()` = outlining/expanding |
| `NodeStatus` (`nodes.status`) | `stub` Not generated · `queued` · `generating` · `ready` · `failed` | terminal = ready/failed/stub; `isExpanded()` = ready |
| `LessonTrack` (`nodes.track`) | `core` "On the path" · `subtopic` "Under this step" | parse: `recommended|optional|detour|branch` → subtopic; `rule()` (prompt text) + `blurb()` (legend) + `writingContext()` |
| `LessonMark` (`nodes.mark`) | `recommended` #874efe "Our pick — do this one." · `alternative` #4f7a28 "Pick this or the recommended one, not both." · `anytime` #929292 "Order not strict." | `isOptional()` = alternative/anytime; parse: contains `recommend`/`opinion` → recommended, starts `alt` → alternative, `optional`/`anytime`/`not strict` → anytime |
| `ConceptArchetype` (`nodes.archetype`) | `procedural` Procedure · `conceptual` Concept · `factual` Facts · `discriminative` Choosing between · `diagnostic` Diagnosis · `quantitative` Calculation · `spatial` Layout · `evolutionary` How it got here · `performance` Do it for real · `safety_critical` Safety · `communicative` Speaking | `formats()` mandatory block types (below), `optionalFormats()`, `assessmentKinds()`, `plannedBlockTypes()` (= formats + `quiz` unless a format already carries assessments), `test()` and `writingNote()` prompt strings; parse strips `_knowledge|_node|_type|_archetype` |
| `BlockType` (`blocks.type`) | `explainer`, `key_points`, `example`, `resource`, `video`, `quiz`, `exam`, `project`, `flashcards`, `code`, `reflection`, `walkthrough`, `checklist`, `diagram`, `comparison`, `scenario`, `reference_table`, `worked_example`, `playground`, `annotated_media`, `timeline`, `analogy`, `audio`, `speaking`, `dialogue`, `illustration`, `misconception` (27) | `carriesAssessments()` = quiz/exam/project/code; `isNarrative()` = explainer/key_points/example/analogy/misconception; `isInteractive()` = scenario/playground/flashcards/annotated_media/code/audio/speaking/dialogue; `carriesResources()` = resource/video/annotated_media |
| `CodeMode` (code payload `mode`) | `function` (python, javascript) · `script` (python, javascript) · `debug` (python, javascript) · `query` (sql) · `build` (html) | parse aliases: sql/select/database→query; html/css/markup/page/web→build; fix/bug/bugfix/repair/broken→debug; program/stdin/stdout/cli/io→script; fn/func/code/exercise→function; unknown → function |
| `AssessmentKind` (`assessments.kind`) | `mcq`, `multi_select`, `short_answer`, `cloze`, `essay`, `project`, `code`, `ordering`, `numeric` | `defaultGrader()`: deterministic for mcq/multi_select/cloze/code/ordering/numeric, llm_rubric for short_answer/essay/project; `hasOptions()` = mcq/multi_select/ordering; `needsRubric()` |
| `GraderKind` (`assessments.grader`) | `deterministic` Auto-graded · `llm_rubric` Rubric-graded · `self` Self-assessed | `isAsync()` = llm_rubric |
| `EdgeType` (`node_edges.type`) | `prerequisite`, `optional`, `related` | only prerequisite constrains order |
| `ProgressState` (`progress.state`) | `available` Not started · `in_progress` · `completed` · `skipped` | `isSettled()` = completed/skipped (skipped = roadmap.sh's 4th state, not counted against learner) |
| `ScheduleItemState` | `pending`, `done`, `skipped`, `moved` | open = pending/moved |
| `RevisionCause` | `generated`, `edited`, `rewritten` "Rewritten by AI", `regenerated`, `restored` | boundary (never pruned) = regenerated/restored |
| `AnnotationKind` | `highlight`, `note`, `ink`, `board` "Whiteboard", `label` "Text" | `anchorsText()` highlight/note; `carriesStrokes()` ink/board; `isNodeLevel()` board (block_id null) |
| `AttachmentKind` (derived from mime) | `image`, `pdf`, `audio`, `video`, `document` (docx/pptx/xlsx/txt/md/csv), `file` | `isInline()` image/pdf/audio/video |
| `MaterialKind` | `file`, `url` "Link", `text` "Pasted text", `image`, `video` | `needsSuppliedText()` image/video (no OCR/transcription — owner supplies text) |
| `MaterialStatus` | `pending` Queued · `processing` · `ready` · `failed` · `needs_input` "Needs you" | terminal = ready/failed/needs_input; usable = ready |
| `MaterialFormat` (derived) | `pdf`, `docx`, `slides`, `book`, `transcript`, `sheet`, `markup`, `note`, `web`, `image`, `video`, `unknown` | `promptNoun()` ("slide deck", "lecture transcript", "personal notes"...) printed into the outline prompt; extension map: pdf; docx/odt/rtf; pptx/odp; epub; srt/vtt; csv/tsv; htm/html/xhtml/xml; txt/text/md/markdown/mdown/log/rst/json; png/jpg/jpeg/webp/gif |
| `IllustrationIntent` | `depiction`, `contrast`, `scene`, `metaphor` | each contributes exactly one prompt clause; no flowchart intent (Mermaid does that) |
| `GenerationStage` | `clarify`, `outline` (tier pro), `expand_node`, `regenerate`, `rewrite_block`, `grade`, `schedule`, `illustrate` (all others tier flash) | |
| `SearchDocumentKind` | `course`→courses, `node`→lessons, `block`→content ("In lessons") | |
| `OrganizationType` / `MembershipRole` / `PlanTier` / `BillingInterval` / `SubscriptionStatus` | see §1.2 | server-only |

**Archetype → mandatory formats → assessment bias** (deterministic, NOT model-chosen; `NodeExpander` rejects a lesson missing one):

| Archetype | Mandatory `formats()` | `assessmentKinds()` bias | Optional extras beyond the common menu (`key_points, video, resource, audio, speaking, dialogue`) |
|---|---|---|---|
| procedural | walkthrough, checklist | ordering, short_answer, project | example, code, diagram |
| conceptual | explainer, diagram, analogy | short_answer, mcq, essay | example, reflection, scenario, illustration, misconception |
| factual | flashcards, reference_table | cloze, mcq, multi_select | explainer, example, timeline |
| discriminative | comparison, example | multi_select, short_answer, mcq | reference_table, scenario, explainer, illustration, misconception |
| diagnostic | scenario, diagram | short_answer, ordering, multi_select | checklist, example, reference_table, misconception |
| quantitative | worked_example, playground | numeric, code, short_answer | explainer, code, reference_table |
| spatial | diagram, annotated_media (→ walkthrough if no image resource) | mcq, short_answer, cloze | explainer, walkthrough, reference_table, illustration |
| evolutionary | timeline, explainer | ordering, short_answer, mcq | comparison, reflection, example |
| performance | project, checklist | project, essay | walkthrough, example, reflection |
| safety_critical | checklist, scenario | multi_select, short_answer, ordering | reference_table, walkthrough, annotated_media, illustration |
| communicative | speaking, dialogue | short_answer, cloze, mcq | flashcards, explainer, example |

(`code` blocks/assessments are stripped unless `courses.allows_code`.)

## 3. JSON column shapes

### 3.1 Course-level

```jsonc
// courses.clarifying_questions — ClarifyIntentPrompt schema (3–5 items)
[{ "id": "prior_experience",            // snake_case English slug, 2–40 chars
   "question": "…",                     // one sentence, course language, 10–200
   "why": "…",                          // what changes with the answer, 10–220
   "suggestions": ["…","…","…"] }]      // 3–5 one-tap answers in learner voice, 2–140 each

// courses.clarifying_answers — POST /courses/{c}/clarify {answers:[…]} (1–20)
[{ "id": "prior_experience", "answer": "…" }]  // answer ≤2000

// courses.settings — defaults from CourseFactory; PATCH merges (array_replace)
{ "formats_preferred": [],               // list<BlockType> ≤20
  "depth": "standard",                   // overview | standard | deep
  "include_code": true }

// courses.further — outline output, ≤ GraphBuilder::MAX_FURTHER
[{ "title": "…≤60 (button text)", "topic": "…≤200 (prompt to create that course)", "after_key": "node_key | null (null = end of course)" }]

// courses.pipeline (jsonb) — App\Support\Pipeline, ONE stage at a time, null when idle
{ "stage": "outline", "started_at": "ISO8601",
  "phase": "waiting|thinking|writing|checking",
  "items": [{ "title": "…", "side": true }],   // step titles as the outline streams in; side = subtopic
  "attempt": 1 }
{ "stage": "parts", "started_at": "ISO8601", "batches_done": 2, "batches_total": 5, "added": 14 }
// present() adds "elapsed" (server-computed seconds). report() merges only if same stage; end(stage) clears only that stage.
```

### 3.2 Outline model output (what creates nodes) — OutlinePrompt schema

```jsonc
{ "course_title": "4–120 chars, course language",
  "allows_code": false,
  "nodes": [ /* 12–40, topics in study order each immediately followed by its subtopics */
    { "key": "snake_case_en ≤64", "title": "3–90", "summary": "40–500 (capability, coverage, pitfall)",
      "concept_key": "en canonical id", "section": "≤60, first topic of a chapter only",
      "note": "topics only, mentor advice ≤ MAX_NOTE_LENGTH", "track": "core|subtopic",
      "branch_of": "parent key (required unless core)", "mark": "recommended|alternative|anytime",
      "group": "≤60, shared by ≥3 siblings", "archetype": "<ConceptArchetype>", "estimated_minutes": 10–90 } ],
  "further": [ { "title", "topic", "after_key" } ] }
```
GraphBuilder maps this onto `nodes` (layer = spine step index, position = 0 for the topic, 1..n for subtopics), repairs a missing `branch_of` by putting the lesson on the spine, and derives `planned_block_types` from the archetype.

### 3.3 `nodes.planned_block_types`
`list<BlockType value>` = `ConceptArchetype::plannedBlockTypes()`, e.g. procedural → `["walkthrough","checklist","quiz"]`; performance → `["project","checklist"]` (project already carries assessments).

### 3.4 `blocks.payload` — normalised shapes per type (BlockPayloadNormaliser output, what is stored)

Shapes are the *stored* ones (after normalisation; aliases accepted on input are noted). `assessment_ids` is filled after assessments are created (`list<int>`). A payload that fails its `require` returns null → block dropped.

| Type | Stored payload | Notes / limits |
|---|---|---|
| `explainer` | `{markdown}` | markdown incl. code fences + tables |
| `key_points` | `{points: string[]}` | ≤12 (prompt asks 4–7) |
| `example` | `{title (default "Worked example"), markdown}` | |
| `analogy` | `{markdown, breaks_down_when}` | `breaks_down_when` mandatory |
| `misconception` | `{belief, why_it_seems_right, what_is_true, tell?}` | aliases: misconception / grain_of_truth / correction_markdown / how_to_catch_it |
| `walkthrough` | `{intro?, steps:[{n, title (default "Step k"), detail_markdown, warning?, check?}]}` | 3–9 steps; `verify` alias for check |
| `checklist` | `{title (default "Before you move on"), items:[{text ≤300, why?}], note?}` | 4–10 items |
| `project` | `{title (default "Project"), brief_markdown, deliverables: string[] ≤8, assessment_ids}` | one `project` assessment with rubric |
| `code` | base `{mode, language, starter_code, instructions_markdown, tests, hints: string[≤3, ≤200 chars], assessment_ids}` + per mode: | solution NEVER in payload (lives in assessment `answer_key.reference_solution`) |
| ↳ `function` | `tests:[{name ≤190, call, expect}]` | 2–5 tests; `call` is one expression |
| ↳ `debug` | function tests + `symptom_markdown` (required, else downgraded to function) | |
| ↳ `script` | `tests:[{name, stdin|null, expect}]` | JS script → exactly one case, no stdin |
| ↳ `query` | `setup_sql` (CREATE+INSERT required, else block dropped), `tables` (derived from setup), `tests:[{name, expect_table:{columns|null, rows, ordered}}]` | SQLite |
| ↳ `build` | `requirements: string[≤6]`, `tests:[{name, selector (whitelisted chars ≤120), min_count, text_contains?, attribute?:{name, value?}}]` | structural only, never executed |
| `diagram` | `{format:"mermaid", source, caption?, alt_text}` | plausibility-checked Mermaid; alt_text falls back to caption |
| `illustration` | `{intent, subject ≤180, caption?, alt_text (required), points:[{x_pct, y_pct, label, detail?}] ≤6}` | file resolved at read time via `illustrations.hash`; subject sanitised (no backticks/braces/newlines) and rejected if it claims photo/screenshot/etc. |
| `annotated_media` | `{media: <ResourceShape>, alt_text, hotspots:[{x_pct 0–100, y_pct 0–100, label, detail?}] ≤10}` | only when an `image` resource exists |
| `timeline` | `{events:[{when ≤60, title, detail?}]}` | 4–8 events |
| `comparison` | `{intro?, axes: string[], items:[{name, values: string[len = axes], best_for?}]}` | 2–4 items, 3–5 axes |
| `reference_table` | `{title?, columns: string[], rows: string[][], note?}` | each row = column count |
| `flashcards` | `{cards:[{front, back}]}` | ≤20 (prompt 6–12) |
| `scenario` | `{setup_markdown, steps:[{id, prompt, options:[{id, text, outcome_markdown?, correct: bool, next_id?}]}], debrief_markdown?}` | 2–4 steps × 2–4 options; not graded |
| `worked_example` | `{problem_markdown, steps:[{expression, explanation}], answer?, common_mistakes: string[≤5]}` | |
| `playground` | `{inputs:[{key, label, min, max, step, default (clamped), unit?}], formula_js, output_label (default "Result"), output_unit?, guidance_markdown?}` | `formula_js` must be exactly `function compute(i){…}`; forbidden tokens: import, require(, fetch(, xmlhttprequest, while, eval(, function(, =>, settimeout, setinterval, document, window, globalthis, localstorage, postmessage, worker, math.random, new function, constructor |
| `video` | `{items: <ResourceShape + why>[] ≤3, start_seconds?}` | kind video only; start clamped ≤86400 |
| `resource` | `{items: <ResourceShape>[] ≤5, note?}` | dropped if nothing resolves |
| `audio` | `{script_markdown, voice_hint?, language?, duration_estimate_s = max(15, round(words/2.5))}` | single language; narration via TTS cache |
| `speaking` | `{intro_markdown?, items:[{text ≤240, translation?, phonetic?}], voice_hint?, language}` | 2–12 items in target language |
| `dialogue` | `{scenario_markdown, ai_role (default "your conversation partner"), learner_role (default "you"), goal, opening_line?, hints: string[≤6], language}` | |
| `quiz` | `{intro?, assessment_ids}` | |
| `exam` | `{intro?, time_limit_minutes? (1–240), assessment_ids}` | |
| `reflection` | `{prompt}` | ungraded |

`<ResourceShape>` (denormalised snapshot from `ResourceIndex::shape`, stored INSIDE the payload):
`{resource_id, title, url, kind, provider, provider_id, embeddable, domain, duration_s, duration_label, language, license, attribution, thumbnail, image, favicon, site_name, author, why}`.

### 3.5 Assessments

```jsonc
// assessments.options (mcq: exactly 4 ids a–d; multi_select 4–6 with 2–3 correct; ordering 4–6 scrambled)
[{ "id": "a", "text": "…≤600" }]

// assessments.answer_key — by kind (NEVER sent to the client; LeakGuard scrubs payloads too)
mcq / multi_select : { "correct_option_ids": ["b"] }
ordering           : { "correct_order": ["c","a","d","b"] }        // every id once
numeric            : { "value": 13.04, "tolerance": 0.05, "unit": "A" }
cloze              : { "accepted": ["…","…"] }                     // prompt has exactly one "____"; grading trims/casefolds/collapses ws
short_answer       : { "reference_answer": "…" }
code               : { "reference_solution": "…" }
essay / project    : none (rubric only)

// assessments.rubric — required for llm_rubric; 2–4 rows, weights sum to 1
[{ "criterion": "6–200 chars, specific", "weight": 0.4,
   "excellent": "10–400", "acceptable": "10–400", "poor": "10–400" }]
```
Model-side fields not persisted as columns: `bloom` (remember|understand|apply|analyze|evaluate|create) — validated at expansion (≥1 higher-order item, ≤50% remember, ≤40% mcq) then dropped. **Port improvement: persist `bloom` on the assessment** (it is needed for analytics and NotebookLM-beating "practice by level").

### 3.6 Attempts

```jsonc
// attempts.response — canonical per kind (SubmitAttemptRequest)
mcq          { "option_id": "b" }
multi_select { "option_ids": ["a","c"] }
cloze        { "blanks": ["…"] }  |  { "text": "…" }
short_answer { "text": "…≤5000" }
essay        { "text": "…≤40000" }
project      { "text"?, "deliverables"?: [], "links"?: ["https://…"], "notes"? }
ordering     { "order": ["c","a","d","b"] }          // distinct, all ids
numeric      { "value": "13,04 A" }                  // string; comma decimals + trailing unit parsed
code         { "code", "language"?, "tests": [{ "name", "passed", "error"?, "detail"?, "expected"?, "received"? }],
               "console"?: [], "timed_out"?: bool, "duration_ms"?: int }
self-graded  { "completed"?: bool, "note"?: "…", "code"?, "language"? }
// bare scalar/list is promoted to the canonical shape

// attempts.criterion_scores (llm_rubric)
[{ "criterion", "weight", "score_0_to_1", "points", "max_points", "comment" }]

// attempts.grader_meta
{ "status": "grading|queued|pending",            // while not graded
  "grader": "deterministic|llm_rubric|self", "assessment_kind": "…", "graded_at": "ISO",
  "configured_grader"?: "…", "grader_substituted"?: true,
  // llm_rubric extras:
  "source": "llm_rubric", "prompt_version", "tier": "flash", "llm_called": true,
  "scoring": "weighted_criterion_scores", "criteria_count", "rubric_source": "assessment|default",
  "unmatched_criteria": [], "model_reported_score", "model_reported_passed",
  "feedback_quality", "feedback_reasked",
  // failure:
  "reason": "grader_unavailable", "error": "…", "retry_queued": bool }
```
Pass rule (`GradingPolicy`): `passed = score >= ceil(max_score × 70%)`. Rubric score = Σ(weightShare × score_0_to_1) × max_score; missing criteria score 0.

### 3.7 Revisions

```jsonc
// node_revisions.snapshot (RevisionWriter::snapshot) — whole-node, answer keys INCLUDED
{ "title", "summary", "estimated_minutes",
  "blocks": [{ "id", "type", "payload", "source_material_ids" }],              // ordered position,id
  "assessments": [{ "id", "block_id", "kind", "prompt", "options", "answer_key", "rubric", "grader", "max_score", "position" }] } // live only
// hash = sha256(RevisionDiff::canonical(snapshot)); bytes = strlen(json)
```
`RevisionDiff::compare(before, after)` → `{title: bool, summary: bool, estimated_minutes: bool, blocks:[{id, type, label, change: added|changed|same, moved, fields[]}], removed:[{id, type, label, before_index}], counts:{added, removed, changed, moved}}` (blocks matched by id; moves via longest increasing subsequence). `words(before, after)` → `[{op: eq|del|ins, text}]` (line LCS, then word LCS per changed line; caps 400 lines / 400 words).

### 3.8 Annotations (client-owned shapes, stored verbatim; validated by UpsertAnnotationsRequest)

```jsonc
// highlight / note
anchor: { "block_id": 12, "field": "markdown|steps.2.detail_markdown|… ≤80", "start": 0, "end": 42,
          "quote": "the covered text ≤2000 (REQUIRED, used to re-find after edits)", "prefix"?: "≤64", "suffix"?: "≤64" }
data:   { "color": "≤24 chars", "text"?: "note body ≤4000 (note: key required, may be empty)" }
// ink (over a block's picture or the whole part)
anchor: { "block_id", "target": "media|block", "media_index"?: 0 }   // coordinates normalised 0..1 to the painted box
data:   { "strokes": [{ "tool": "pen|marker|arrow", "color", "size": 0.5–64, "points": [[x,y],[x,y,pressure]] }] }  // ≤500 strokes × ≤2000 pts
// label (Text tool)
anchor: { "block_id", "target": "media|block", "media_index"?: int≥0 (required for media), "x": 0..1, "y": 0..1 }
data:   { "text": "1–500", "color", "size": "sm|md|lg", "weight"?: "normal|bold", "background"?: bool }
// board (whiteboard beside the lesson; block_id = null)
anchor: { "logical_width": 100–8000, "logical_height": 100–8000 }
data:   { "strokes": [ …as ink… ] }
```
Batch PUT ≤50 marks, ≤256 KB per mark, ≤200 marks per user per node; uuid unique across all users; a uuid cannot move between lessons.

### 3.9 Drafts, users, materials, notifications, assistant

```jsonc
// course_drafts.payload — the /create form verbatim (SaveCourseDraftRequest minus step/course_id)
{ "topic", "goal", "language", "level": "any|beginner|intermediate|advanced", "minutes_per_week",
  "material_ids": [int], "skip_clarify": bool,
  "clarify": { "<questionId>": { "chips": ["…"], "text": "…" } } }   // answers-in-progress, ≤12 questions

// users.preferences (merged per key)
{ "reading": { "scale": 0.75–1.6, "font": "sans|serif", "theme": "paper|warm|dim" } }

// materials.source_meta (per format, merged on each ingest)
{ "provider": "youtube|vimeo", "video_id": "…" }           // LinkClassifier for video URLs
{ "sections": 14, "locator_kind": "slide|heading|chapter|timecode|page", "cues"?: 312 }  // extractors
{ "wants": "text|transcript" }                             // needs_input ask (removed once answered)
{ "supplied_text": true, "original_path": "materials/…" }  // owner typed the text; original upload kept

// resources.meta
{ "thumbnail", "image", "favicon", "site_name", "channel"|"author", "attribution", "preview_checked_at",
  /* plus provider data: view counts, published_at, extracted excerpt */ }

// notifications.payload (daily_digest; one per user per local date, rewritten in place)
{ "date": "YYYY-MM-DD", "due_count", "due_minutes", "overdue_count", "max_days_late",
  "course_ids": [], "schedule_item_ids": [],
  "items": [{ "schedule_item_id", "schedule_id", "node_id", "course_id", "course_title", "title",
              "estimated_minutes", "scheduled_for", "days_late" }] }

// assistant_messages.meta
user:      { "course_id"?, "node_id"?, "block_id"? }            // context the question was asked in
assistant: { "course_id"?, "node_id"?, "produced_artifact"?: "html|markdown|pdf" }
// artifacts: content = html/markdown body; kind flips to pdf with file_path "artifacts/{id}.pdf" when the
// message matched /\b(pdf|printable|print out|printout|print-ready)\b/i (html source kept in content)
```

### 3.10 Search text derivation
`search_documents.body` is produced by `SearchTextExtractor` through a per-block-type **allowlist** of prose fields (never answer keys, never assessment text). One doc per course (`title` = course title, `body` = topic + goal), per node (`title` = node title, `body` = summary + concept_key), per block (`title` = heading for the block, `body` = allowlisted prose with markdown flattened to text: fences keep contents, links keep text). Re-indexed on every write; `search:reindex [--fresh] [--verify]`.

**Block-field allowlist (indexed)** — and, by omission, the *spoiler/executable* fields that must never be indexed or shown before interaction:
- indexed: explainer.markdown; key_points.points; example.title/markdown; analogy.markdown/breaks_down_when; reflection.prompt; walkthrough.intro + steps.title/detail_markdown/warning/check; checklist.title/note/items.text/why; comparison.intro/axes/items.name/best_for/values; reference_table.title/note/columns/rows; worked_example.problem_markdown/answer/common_mistakes/steps.explanation; timeline.events.when/title/detail; scenario.setup_markdown/debrief_markdown/steps.prompt/options.text; diagram.caption/alt_text; illustration.caption/alt_text/points.label/detail; annotated_media.alt_text/hotspots.label/detail; playground.guidance_markdown/output_label/inputs.label; misconception.*; audio.script_markdown; speaking.intro_markdown/items.text/translation; dialogue.scenario_markdown/goal/ai_role/learner_role/opening_line/hints; resource+video.note/items.title/why; flashcards.front/back; quiz+exam.intro; project.title/brief_markdown/deliverables; code.instructions_markdown/symptom_markdown/requirements/tests.name.
- NEVER indexed: scenario `outcome_markdown`/`correct`, diagram `source`, illustration `subject`, playground `formula_js`, code `starter_code`/`tests.call|expect|stdin`/`setup_sql`/`hints`, all URLs, all assessments (prompt, options, answer_key, rubric).
- Materials are searched separately over `material_chunks.search_vector` (MaterialSearch); course search ranks with `ts_rank` A=1.0/B=0.125 weights.

## 4. Per-feature detailed spec

Columns and JSON shapes are in §1–§3; this section states the behaviour each feature depends on.

**DAT-01 Client-minted course identity.** The create page mints a v4 uuid, puts it in the URL `/create/{uuid}` before any request, and sends it with `POST /courses`. `CourseFactory::claimUuid`: a uuid already used by *this* user returns the existing course (idempotent create — a double submit or reload never makes a second course); one used by another user is not confirmed. `Course::booted()` mints a uuid for any other creation path. Every `{course}` route accepts digits (id) or a uuid; anything else → 404. `resolveSoftDeletableRouteBinding` lets restore find trashed courses by uuid.

**DAT-02 Canonical URL.** `users.username` auto-suggested on create (dedupe with `-2`, `-3`), `courses.slug = CourseSlug::for(course)` unique per user. `syncSlug()` re-derives on title change **unless** `slug !== null && is_public` (published slugs are someone's bookmark). Changing a username moves every course URL with no redirect (a freed handle may be claimed by someone else). Course is born titled after the raw topic (≤90 chars) and renamed by the outline.

**DAT-03 Lifecycle.** `clarifying` (questions waiting) → `outlining` → `outlined` (plan drawn, lessons are stubs) → `expanding` (writing lessons) → `ready`; any stage → `failed` with `failure_reason`. `skip_clarify` moves straight to `outlining` before the job is dispatched so an SSE client never sees a terminal status first. Terminal for the stream: ready/failed/outlined/clarifying.

**DAT-04 Clarify.** ClarifyIntentJob writes 3–5 questions; the learner answers (chips and/or free text; draft keeps `{qid:{chips[],text}}` in progress) and `POST /clarify {answers:[{id,answer}]}` stores them and starts the outline. Answers are printed into the outline prompt via PromptSupport.

**DAT-05 Inputs.** `topic` 3–2000, `goal` ≤2000, `level` beginner|intermediate|advanced (draft also allows `any`), `language` BCP-47-ish (`^[A-Za-z]{2,8}(-[A-Za-z0-9]{2,8})*$`, default user locale), `minutes_per_week` 10–10080, `material_ids` ≤50 (library materials moved onto the course; `source_type` = materials when topic empty, mixed otherwise).

**DAT-06 Settings.** Defaults `{formats_preferred: [], depth: "standard", include_code: true}`; PATCH merges with `array_replace` so one key never wipes the rest; printed into prompts ("Preferred formats", "Requested depth", "include code: yes/no").

**DAT-07 allows_code.** Boolean decided by the outline model; defaults false. When false the expander strips `code` from the optional menu and drops code blocks/assessments.

**DAT-08 Drafts.** One row per `/create/{uuid}` visit, PUT on every meaningful change, payload stored verbatim (§3.9). `CourseDraft::linkTo(uuid, course)` is called by the create endpoint (server side, so the link exists before the client hears about the course) and creates a draft if the client never saved one; step becomes `clarify` or `generating`. Listed only when `isSubstantive()` (course attached or non-blank topic) and `updated_at` within 30 days; deleted when the learner reaches the workspace; `bilimind:prune-course-drafts` removes untouched ones after 30 days.

**DAT-09 Pipeline progress.** `courses.pipeline` holds one stage report (§3.1). Written with raw query updates (no `updated_at` bump, no model events), merged only into the same running stage, cleared only by the stage that owns it. `elapsed` is computed server-side. Purely cosmetic — never an input. `nodes.writing_started_at` gives each lesson its own stopwatch (`writingFor()` while `generating`).

**DAT-10 Archive.** `archived_at` set/cleared; `scopeOnShelf` (archived null + not trashed) filters library, scheduling, digest and review queue. Review items and schedules are kept, so un-archiving resumes exactly where it was.

**DAT-11 Trash.** Soft delete (`deleted_at`). The card shows "deletes in N days" from `purgesAt() = deleted_at + 30d`. `bilimind:purge-trashed-courses` force-deletes after retention (`DELETE /courses/{c}/forever` purges immediately; `POST /courses/{c}/restore` brings it back); only a force delete removes the attachment directory `attachments/{course_id}` (soft delete must restore whole). Rationale: a generated course costs real money; a misclick must be reversible.

**DAT-12 Sharing.** `share_token` (unique) + `is_public`. `isViewableBy(user)`: owner or public. Public courses appear in the catalogue and at the canonical URL for signed-out readers. Annotations, attempts and progress are never joined into anything served to someone else; answer keys are `$hidden` and payloads pass through `LeakGuard::scrubArray`. Attachment file URLs in shared projections are 6-hour signed links.

**DAT-13 Path grammar.** `track=core` lessons are the spine; `layer` = step index (0-based; prompt says "step layer+1"); `position 0` = the topic itself, `1..n` = its subtopics in reading order. `branch_of_node_id` names the parent (a topic or, once, another subtopic — never deeper). Canonical reading order = `layer, position, id`. Every drawn box is a real, openable lesson (the 2026-08-29 promotion turned decorative `subtopics` labels into nodes with `estimated_minutes = 12`, inherited archetype/layer, `status = stub`).

**DAT-14 Roadmap annotations.** `mark` badge on subtopics (colours #874efe / #4f7a28 / #929292 and legend blurbs in §2; alternative/anytime are optional for completion); `group` string shared by siblings → drawn in one headed box (≥3 siblings per prompt); `note` = advice paragraph beside a topic (≤ `GraphBuilder::MAX_NOTE_LENGTH`); `section` (≤80; outline asks ≤60) only on the first topic of a chapter — following lessons belong to it.

**DAT-15 Further.** `courses.further = [{title ≤60, topic ≤200, after_key?}]` (≤ `GraphBuilder::MAX_FURTHER`); buttons at the end of the course (or beside the `after_key` topic) that open a new create flow pre-filled with `topic`.

**DAT-16 Archetype → formats.** Outline picks one of 11 archetypes per lesson; `planned_block_types` is derived (table in §2). `Node::mandatoryFormats()` substitutes `annotated_media → walkthrough` when no `image` resource was found for the node. NodeExpander rejects and retries a lesson missing a mandatory format.

**DAT-17 Lazy expansion.** Nodes are created as `stub`; expanding marks requested nodes `queued` → `generating` (sets `writing_started_at`) → `ready` or `failed` (`failure_reason`). `ExpandCourseRequest {node_ids?: int[] ≤200}` (null = all). Server billing: `charged_organization_id` set per lesson the charge covered, cleared on success (earned) or refund (failed) — read-and-clear in one statement so no double refund.

**DAT-18 Edges.** `node_edges` unique (from,to), type prerequisite|optional|related; only prerequisite constrains order. ScheduleBuilder orders nodes with Kahn's algorithm, ties broken by layer → position → id; cycles cannot hang it.

**DAT-19 Blocks.** 27 types (§2), payload shapes §3.4; every model-written payload passes `BlockPayloadNormaliser::normalise(type, payload, resources)` — aliases accepted, limits clamped, invalid → block dropped (never shipped half-formed). Lesson = 4–9 blocks (schema allows 3–12). Hand edits go through `BlockSynchroniser` (create/update/delete by id) and the same normaliser.

**DAT-20 Provenance.** `blocks.source_material_ids` (≤12 from the model, ≤50 on edit) records grounding; materials' chunk `locator`s let the lesson cite "your slide 14".

**DAT-21 Assessments.** 3–6 per lesson spread over quiz/exam/project/code blocks (≤8 per block); ≤40% mcq; ≥1 higher-order Bloom item; ≤50% remember; per-kind answer-key and rubric rules (§3.5). `answer_key` never leaves the server. Regeneration parks answered assessments at `position ≥ 1000` (retired) instead of deleting — attempts survive, `live()` excludes them from player, share view, completion.

**DAT-22 Attempts.** `POST /assessments/{id}/attempt {response, async?}`; response validated per kind (§3.6). Deterministic and self graders are synchronous; llm_rubric is queued when `async` (status `queued`) or inline, and on LLM failure the attempt is kept with `status: pending|queued, reason: grader_unavailable`. Pass = score ≥ 70% of max_score. Code attempts report `{name, passed}` per declared test name (names ≤190 chars so they always match). Every attempt is kept (history), `GET /assessments/{id}/attempts` lists them.

**DAT-23 Progress.** Row created on first touch (`available`). After every graded attempt: available → in_progress; completed when every **live** assessment has ≥1 passing attempt (never auto-un-completes). Explicit `POST /nodes/{id}/progress {state?, time_spent_seconds? ≤86400 per ping}` accumulates time; time alone moves available → in_progress; `completed_at` set on completion, cleared if state leaves completed. First completion seeds a review item.

**DAT-24 Review (SM-2).** One item per user × node. Seed: `new`, ease 2.5, due tomorrow (user's timezone). Review with quality q 0–5: q ≥ 3 → repetitions++, interval 1 → 6 → round(interval × ease), state `review`; q < 3 → repetitions 0, interval 1, lapses++, state `learning`. ease += 0.1 − (5−q)(0.08 + (5−q)·0.02), floor 1.3. `dueFor(user, date)` = due_on ≤ date, course on shelf, ordered due_on, id. API: `GET /reviews/today`, `GET /reviews/stats`, `POST /reviews {node_id, quality 0–5 | correct: bool}` (correct → q 5, incorrect → q 2). Never plan-gated.

**DAT-25 Schedule.** `StoreScheduleRequest {starts_on ≤ +5y, minutes_per_week 10–10080, days_of_week ISO 1–7 distinct}`. Session budget = floor(minutes_per_week / #days) (min 1). `build()` packs whole nodes in topological order onto allowed weekdays from `starts_on` (a node longer than a session gets a session alone; never split; never in the past; prerequisite never later); idempotent — keeps done/skipped/moved, replans pending. `recompact()` after done/skip/move re-packs pending items on/after today; overdue pending items stay where they are (debt shown on Today). Calendar walk bounded by 3650 days. Item updates: `state` and/or `scheduled_for` (move → `moved`, pinned).

**DAT-26 Notifications.** `daily_digest`: one per user per local date (found by `payload.date` within 3 days and rewritten in place), title/body summarise due lessons, minutes and overdue debt (top 5 lines `- {title} — {course} ({n} min)`); payload §3.9. `course_ready` / `course_failed` on pipeline end. `read_at` via `markRead()`.

**DAT-27 Editing + optimistic lock.** `PATCH /nodes/{id} {title?, summary?, estimated_minutes? 1–600, base_revision_id?, blocks?[≤60]: {id?, type, payload, source_material_ids?}}`. A `base_revision_id` that is not the node's `current_revision_id` → 409 (two tabs cannot clobber). Blocks round-trip ids (new blocks have none). Sets `edited_at`; Regenerate warns when `edited_at` is set.

**DAT-28 History.** `RevisionWriter::record()` after every content change; `ensureCurrent()` before anything replaces content (first touch of a pre-revision lesson writes a `generated` row; divergence writes an `edited` row). `edited` saves identical to current (same hash) are collapsed. Summary line computed at write time ("Edited the explainer", "Added a quiz, reordered", caller-supplied for rewrite/regenerate/restore, ≤250 chars). History panel: list newest first; preview = `RevisionDiff::compare(previous, this)`; word diff per field via `words()`. Restore (`RevisionRestorer`) rewrites blocks/assessments from the snapshot and records a `restored` revision with `restored_from_revision_id`. Retention (`bilimind:prune-revisions`): keep everything < 90 days; beyond, keep newest 20, all regenerated/restored boundaries, last revision of each calendar day, and the current one.

**DAT-29 Per-block rewrite.** `POST /nodes/{node}/blocks/{block}/rewrite {instruction? ≤500}`: sets `rewriting_since`, RewriteBlockJob (stage `rewrite_block`) replaces just that payload, records a `rewritten` revision; failure stores `rewrite_error` on the block (cleared by the next attempt). Whole-lesson regenerate `POST /nodes/{node}/regenerate {instruction? ≤500}` goes through queued/generating and records `regenerated`.

**DAT-30 Attachments.** Owner pins files beside a lesson (never grounding, never changes blocks). Allowed sniffed mimes: png, jpeg, gif, webp, pdf, mp3, m4a/mp4 audio, ogg, wav, mp4, webm, docx, pptx, xlsx, txt, md, csv, zip (extension ↔ sniffed-mime table enforced). Caption ≤500, position 0–10000 (reorder), name sanitised, sha256 + width/height for images. Inline render only for image/pdf/audio/video; everything else download. Upload size cap from plan config.

**DAT-31 Annotations.** Private per reader; kinds/anchors/data §3.8. `PUT /nodes/{id}/annotations {annotations:[≤50]}` upserts by client uuid (lower-cased); refuses a uuid owned by another user or used on another lesson; ≤200 per user per lesson; ≤256 KB per mark. A block deleted by an edit cascades its marks away; text marks carry `quote/prefix/suffix` to re-find the passage after edits. Board = node-level (block_id null).

**DAT-32 Materials.** Kinds and statuses §2. `course_id` null = library-wide (attachable to new courses). Ingest job extracts text (pdf, docx/odt/rtf, pptx/odp, epub, srt/vtt, csv/tsv, html, txt/md/json, URLs incl. YouTube/Vimeo classification), chunks it, sets `char_count`, `ready`. Images and captionless videos end in `needs_input` with `source_meta.wants = text|transcript`; the owner supplies text → stored as a new file, `supplied_text: true`, upload kept at `source_meta.original_path` (a second correction replaces the first correction, never the original). Quotas per plan: Free 100 MB / 200 materials / 20 MB per file; Pro 2 GB / 2000 / 50 MB.

**DAT-33 Chunks + locators.** Chunker: target 1200 chars, 150 overlap, paragraph-aware; each chunk carries a locator from the extractor's sections (`locator_kind` slide|heading|chapter|timecode). Retriever prints locators into prompts; FTS over `content`.

**DAT-34 Resources.** Research stage (YouTube, Wikipedia, Wikimedia Commons, xAI/Tavily/Brave/Exa web) proposes candidates; `UrlVerifier` must reach the URL (`verified_at`, `http_status`) before any learner sees it. Dedupe by `url_hash` of the canonical URL. Per-node pivot rank (0 best), relevance score, one-line `why`. Embeddable videos need `provider_id`. `LinkPreviewFetcher` enriches `meta` (thumbnail, favicon, site_name, author). Block payloads embed the resource shape snapshot (§3.4).

**DAT-35 Illustrations.** Block stores only intent + subject + words; the server composes the prompt (`IllustrationPrompt`, versioned) and caches by `hash`. Status pending → ready | failed (failed is not retried immediately). Ceilings: `imagery.max_per_course` (8), weekly platform budget `imagery.weekly_budget_usd` ($3.50; lifted with own OpenRouter key), plan `illustrations_per_month` (Free 10 / Pro 40). Labels never baked in — `points` overlay real text. `alt_text` is the block when no picture can be drawn.

**DAT-36 Audio cache.** `hash = sha256(text + voice)`; file `audio/<hash>.mp3`; shared across learners; regenerated if the file is missing.

**DAT-37 Search.** Three kinds of document + material chunks (§3.10). Diacritic-insensitive (`unaccent` + `simple`), title weight 8× body. Results grouped courses / lessons / content; live status read at hydration (index never shows a stale chip).

**DAT-38 Assistant.** Conversations per user, optionally scoped to a course; each user message records the course/node/block it was asked from; the reply may contain an artifact (html or markdown), persisted and opened in the right panel; "pdf/printable" requests render html → pdf (`artifacts/{id}.pdf`), keeping the html in `content`. Conversation `touch()`ed on each turn to sort first. LLM stage logged as `clarify` (tier flash).

**DAT-39 Telemetry.** `LlmClient` writes one `generation_runs` row per call (success or failure) with stage, model, tokens, `cost_usd` (decimal 6), duration, attempts, error. Measured costs (memory): outline call 80–200 s; expansion ≈ $0.002–0.04 per lesson; illustration ≈ $0.039 per picture.

**DAT-40 Allowance.** Server: monthly `usage_meters` per org (`node_expansion`, `illustration`), Free 12 lessons / Pro 150 per month, top-up packs (25 lessons $5, 100 lessons $15, 50 illustrations $9, expire after 365 days), capped rollover of unspent plan allowance, refund of failed lessons. Grants consumed only after the plan's month is spent, soonest-expiring first.

**DAT-41 BYOK.** `api_credentials` per user × provider (deepseek, openrouter), `secret` encrypted with the app key, only `last_four` ever shown; storing one lifts the expansion cap and the weekly imagery budget (OwnKey; queue workers must resolve the key from the course owner, never `CurrentUser`).

**DAT-42 Reading preferences.** `users.preferences.reading = {scale 0.75–1.6, font sans|serif, theme paper|warm|dim}`, merged per key so devices do not overwrite each other's settings.

**DAT-43 Profile.** name ≤120, username (rules in `Username`), email, password (min 8), timezone ≤64 (drives "today" for schedule, digest and review), locale ≤12 (default course language), avatar_url.

**DAT-44 Tenancy.** "An individual is an organization of one": org auto-provisioned per user; memberships with roles; one subscription per org; materials/courses/schedules carry `organization_id` for metering. Not user-visible on desktop.

**DAT-45 Data migrations.** The server reshapes old data in migrations (subtopic labels → nodes, retired tracks → badges, slug/username/org backfills) and treats every new nullable column as "ordinary when null" so old courses render. The desktop needs the same discipline for vault files (§5.10).

## 5. Porting to BiliMind Desktop (local vault)

_pending_
