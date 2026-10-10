# Inventory: PLATFORM features (BiliMind web -> BiliMind Desktop)

Status: IN PROGRESS (skeleton written first; sections fill in as they finish)

Source trees inspected:
- Backend: /home/iphone8/projects/odilient/bilimind/backend (Laravel 13)
- Frontend: /home/iphone8/projects/odilient/bilimind/frontend/app (Nuxt 4)

## 0. Checklist (PLT-xx)

Disposition legend for BiliMind Desktop: **KEEP** (port as is), **ADAPT** (same user value, different mechanics), **REPLACE** (SaaS plumbing swapped for a local equivalent that keeps the user value), **DROP** (no user value on a single-user desktop; may move to the project website). Details per ID in §1–§11; desktop design in §12.

| ID | Feature (one line) | Desktop |
|---|---|---|
| PLT-01 | Email/password registration that auto-provisions a personal org + Free plan | REPLACE → first-run onboarding (vault + profile + provider key) |
| PLT-02 | Sign in with email/password, `?next=` return | DROP |
| PLT-03 | Sign out (revoke token, clear caches) | DROP (optional app lock) |
| PLT-04 | Session hydration `/auth/me` (user, org, plan + allowance numbers) | ADAPT → `profile` + `budget` read from local config/ledger |
| PLT-05 | Profile edit (name, email, username, password, locale, timezone, avatar) | ADAPT → name, handle, default content language; timezone auto from OS |
| PLT-06 | Username handle with strict charset + reserved list (URL namespace) | ADAPT → publishing handle (keep rules, trim reserved list to site paths) |
| PLT-07 | Reading prefs: account default + session preview (scale/font/theme) | KEEP (vault default + window override) |
| PLT-08 | Global route guard + public allowlist + topic carry | DROP (everything is local); keep `?topic=` prefill via deep link |
| PLT-09 | CurrentUser acting identity with single-user fallback | KEEP (trivial singleton — desktop IS the single-user mode) |
| PLT-10 | Telegram Mini App silent sign-in (initData HMAC) | DROP |
| PLT-11 | Capacitor native mobile shell (token in Keychain, back button, deep links) | DROP (mobile = Obsidian reading the vault); keep deep-link idea as `bilimind://` |
| PLT-12 | Free/Pro plan catalogue + pricing table | DROP → replaced by BYOK + cost meter |
| PLT-13 | Monthly lesson cap with 402 refusal and tier-specific way out | REPLACE → user-set spend budget with the same refusal shape, in dollars |
| PLT-14 | Illustration ceilings (per-course 8, monthly plan, platform weekly $) | ADAPT → per-course cap (pedagogical) + budget; circuit breaker kept |
| PLT-15 | Material storage quota (count, bytes, per-file) | ADAPT → no quota; per-file ingestion size guard + vault size display |
| PLT-16 | Allowance read-out + "running low" at 80% | REPLACE → budget meter, warn at 80% |
| PLT-17 | Reserve → settle → keep/refund lesson charge lifecycle | ADAPT → estimate → actual; failed lessons shown with their real cost |
| PLT-18 | Top-up packs (25/100 lessons, 50 illustrations, 1-year expiry) | DROP |
| PLT-19 | Monthly rollover of unspent allowance (paid only) | DROP |
| PLT-20 | Upgrade checkout (Paddle/Stripe) + return acknowledgement | DROP |
| PLT-21 | Cancel at period end / resume, renewal line | DROP |
| PLT-22 | Provider webhooks (subscription sync, idempotent pack grant) | DROP |
| PLT-23 | BYOK credential management (add/activate/remove, last four only) | KEEP+EXPAND → multi-provider keys in OS keychain, test connection |
| PLT-24 | OwnKey: one resolver for whose key pays (course owner, Pro only) | ADAPT → one resolver for which provider+model+key runs each stage |
| PLT-25 | Generation-run ledger (stage, model, tokens, cost_usd, duration, attempts, error) | KEEP+SURFACE → append-only JSONL ledger + Usage screen |
| PLT-26 | Publish/share a course (public flag, token, copy link) | REPLACE → Export / Publish static site / share `.bilimind` package |
| PLT-27 | Unpublish (old links die) | ADAPT → Unpublish from target (delete deployed folder) |
| PLT-28 | Legacy `/shared/{token}` links redirecting to canonical | DROP |
| PLT-29 | Canonical course URL; owner vs stranger views; SEO + schema.org Course | ADAPT → static-site path `/{handle}/{slug}/` with JSON-LD |
| PLT-30 | Read-only public projection (no keys/progress/attempts/materials) | KEEP as the export filter |
| PLT-31 | Course slug rules (per-user unique, word-trim, freeze once public) | KEEP (+ filesystem-safe folder names) |
| PLT-32 | Public catalogue `/explore` with ≥4-written-lessons quality gate | ADAPT → static site index page per handle; gate kept for `noindex` |
| PLT-33 | Sitemaps, OG image, robots, llms.txt | ADAPT → generated into the published static site |
| PLT-34 | IndexNow push on publish | ADAPT (optional, user supplies key) |
| PLT-35 | Search-console verification meta | ADAPT (optional site setting) |
| PLT-36 | Organizations (individual, learning_center, bootcamp) | DROP → multiple vaults |
| PLT-37 | Switch current organization | REPLACE → vault switcher |
| PLT-38 | Members list / invite existing user / change role / remove | DROP (collaboration via shared folder/Git + course packages) |
| PLT-39 | Roles owner/admin/instructor/learner | DROP |
| PLT-40 | In-app notification inbox with unread badge and 45 s poll | ADAPT → local inbox + OS notifications (push from main process, no poll) |
| PLT-41 | 08:00 daily digest (today's plan, overdue, idempotent, silent on rest days) | KEEP+IMPROVE → local time, OS notification + optional daily note `.md` |
| PLT-42 | Learner-safe failure copy (no vendor/model/status) | ADAPT → actionable provider errors (the user owns the key) + friendly copy |
| PLT-43 | Toast stack (tones, durations, undo action) | KEEP |
| PLT-44 | Account language = default course language (no UI i18n exists) | KEEP + ADD real UI i18n |
| PLT-45 | Per-user timezone drives "today" | ADAPT → OS timezone automatically |
| PLT-46 | Settings hub with `?section=` (profile, plan, keys, team) | REPLACE → desktop Settings window (sections in §12) |
| PLT-47 | Dark/light theme toggle (localStorage, OS default) | KEEP (+ "system" option) |
| PLT-48 | Library with drafts strip, filter chips, archive + trash shelves, undo toasts | KEEP (backed by vault folders/frontmatter) |
| PLT-49 | Explore page | see PLT-32 |
| PLT-50 | 32 generated learning roadmaps with "Build this course" | ADAPT → bundled "Start from a roadmap" gallery (offline templates) |
| PLT-51 | Compare `/vs/*` pages (incl. NotebookLM) | DROP from app → project website/README |
| PLT-52 | Guides (spaced repetition, learning path, judging AI courses) | ADAPT → in-app Help |
| PLT-53 | SEO landing + legal pages | DROP from app → website; desktop ships LICENSE + privacy note |
| PLT-54 | `/start` door that keeps the typed prompt through sign-up | REPLACE → first-run onboarding keeps the typed prompt the same way |
| PLT-55 | Prune abandoned/finished create drafts (30 d / 1 d) | KEEP (runs on launch + daily timer) |
| PLT-56 | Thin revision history after 90 d (keep 20, boundaries, daily) | KEEP |
| PLT-57 | Trash with 30-day retention + purge | KEEP (vault `.trash/`, final delete to OS recycle bin) |
| PLT-58 | Search index observer + reindex command | ADAPT → file watcher + rebuildable SQLite FTS cache |
| PLT-59 | Operator CLIs: llm:ping, course:subtopics, resources:enrich | ADAPT → "Test connection", "Repair course", "Refresh link previews" actions + CLI |
| PLT-60 | Named rate limiters (api/auth/generation/speech/search) | REPLACE → client-side per-provider concurrency + 429/Retry-After handling |
| PLT-61 | DB queue with long retry_after (no double runs) | ADAPT → persistent local job queue that resumes after restart |
| PLT-62 | No admin panel; operator data in generation_runs | ADAPT → Diagnostics panel (logs, ledger, provider status) |
| PLT-63 | Legacy URL redirects (/courses/{id}, node URLs, share tokens) | DROP (map `bilimind://course/{uuid}` deep links instead) |
| PLT-64 | App shell navigation (rail, bottom bar, bell, account menu, palette) | ADAPT → desktop sidebar + menu bar + tray |
| PLT-65 | Standalone full-window code sandbox with postMessage protocol | KEEP (as a separate BrowserWindow, same message protocol) |

## 1. Auth & identity

Sources: `backend/routes/api/auth.php`, `app/Http/Controllers/Auth/AuthController.php`, `app/Http/Requests/Auth/*`, `app/Services/Auth/OrganizationProvisioner.php`, `app/Support/CurrentUser.php`, `app/Support/Username.php`, `app/Models/User.php`, `frontend/app/composables/useAuth.ts`, `frontend/app/middleware/auth.global.ts`, `frontend/app/composables/useReadingSettings.ts`, `frontend/app/pages/{login,register,start}.vue`, `frontend/app/plugins/20.capacitor.client.ts`.

### PLT-01 Email + password registration
- `POST /api/auth/register` (public, `throttle:auth` = 20/min per IP).
- Request: `{name (req, ≤120), email (req, email, ≤255, unique), password (req, min 8, confirmed → password_confirmation), username? (Username::rules), timezone? (≤64), locale? (≤12)}`. Email lowercased+trimmed; username lowercased; locale defaults `en`, timezone `UTC`.
- In ONE DB transaction: create user → `OrganizationProvisioner::personalOrganizationFor($user)` (creates an `individual` org named after the user, an `owner` membership, a `free` + `active` subscription, sets `users.current_organization_id`). Then mints a Sanctum token named `bilimind`.
- Response 201: `{token, token_type:'Bearer', user, organization, subscription}` (the "me payload", see PLT-04).
- Frontend `register.vue`: fields name/email/password/password_confirmation; copy "Map your first course in a couple of minutes — no card needed to plan." A pricing CTA may deep-link `/register?plan=pro&interval=year`; after registering the page immediately starts checkout for that plan (falls back silently to /today if that handoff fails). The UI does NOT send username/timezone (server derives username; timezone stays UTC unless changed elsewhere).

### PLT-02 Sign in
- `POST /api/auth/login {email, password}` (public, throttle:auth). Wrong credentials → 422 `{errors:{email:['These credentials do not match our records.']}}`. A user without `current_organization_id` is self-healed (personal org provisioned) before the token is issued. Token name `bilimind`.
- `login.vue`: on success navigates to `?next=` (set by the guard) else `/today`; 401 copy "That email and password do not match."; "register" link carries the whole query through (plan/interval/next).

### PLT-03 Sign out
- `POST /api/auth/logout` deletes only the current access token. Client clears token cookie (`bilimind_token`, 30-day cookie), user/org/subscription state, `clearNuxtData()`, resets the activity/notification state, navigates to `/login`. Sign-out button lives in the Settings hub (desktop: sidebar foot; phone: bottom of panel).

### PLT-04 Session hydration ("me payload")
- `GET /api/auth/me` → `{user, organization, subscription}`:
  - `user`: `{id, name, username, email, locale, timezone, avatar_url, preferences (object, {} when empty), current_organization_id}`.
  - `organization`: `{id, name, slug, type: individual|learning_center|bootcamp, is_owner}`.
  - `subscription`: `{plan: free|pro, status, is_active, has_unlimited_expansion, node_expansions_per_month, node_expansions_used, node_expansions_topup, illustrations_per_month, illustrations_used, illustrations_topup}` — all numbers come from `AllowanceService` and the EFFECTIVE plan (a lapsed Pro row reports Free numbers).
- Frontend: `useAuth()` keeps `token` (cookie), `user`, `organization`, `subscription`, `ready` in `useState`; `fetchMe()` runs once on first navigation when a token exists; a 401 clears the session. Derived: `isAuthenticated`, `orgRole`, `isOrgOwner`, `canGenerate` (subscription is_active / status active|trialing).

### PLT-05 Profile editing
- `PATCH /api/auth/profile` — every field optional, only sent fields change: `name`, `username` (Username rules, ignoring self; changing it MOVES every course URL, old URLs 404, deliberately no redirect), `email` (unique), `password` (+confirmation, min 8), `timezone`, `locale`, `avatar_url` (nullable, ≤2048), `preferences.reading.{scale 0.75–1.6, font sans|serif, theme paper|warm|dim}` (merged over stored prefs; scale rounded to 2dp). Returns the me payload.
- UI (`components/account/Profile.vue`, "How you show up, and which language the app speaks."): only Name, Email, Language (select of `en, uz, ru, es, fr, de, tr, ar, pt, it`, labelled via `languageName()`), "Save changes" enabled only when dirty; toast "Your details are saved."; validation errors shown per field. No UI exists for username, password change, timezone or avatar even though the API accepts them.

### PLT-06 Username handle (URL namespace)
- Every user always has a username (model `creating` hook calls `Username::suggestFor`: Telegram handle → display name → email local part → `learner`, made unique with `-2`, `-3` … suffix; stem trimmed to 25 chars so suffix fits).
- Rules: 3–30 chars, regex `^[a-z][a-z0-9]*(?:[_-][a-z0-9]+)*$` (starts with letter, separators `_`/`-` never doubled or at ends), not reserved, unique. `normalise()`: ASCII-transliterate, lowercase, non-`[a-z0-9_-]` → `-`, collapse runs, trim, cap 30, strip leading digits.
- RESERVED list (load-bearing — every top-level route + SEO pages): `about account courses create features for-institutions how-it-works library login materials pricing register review sandbox shared today ai-course-generator ai-quiz-generator exam-prep guides pdf-to-course study-plan-generator vs compare learn roadmap roadmaps tools _nuxt api assets favicon.ico public robots.txt sitemap.xml static well-known auth billing checkout invoices logout password plans signin signout signup stripe subscribe telegram verify webhooks admin app blog careers changelog community contact dashboard docs documentation download explore faq feed help home index investors jobs legal me new news notifications onboarding press privacy profile refund refunds search security settings status support tags teams terms trending u user users bilimind official root staff support-team system`. Validation message: "That username is reserved. Please pick another."

### PLT-07 Reading preferences (account default + session override)
- Two layers: account default in `users.preferences.reading` (`{scale, font, theme}`), plus a session-local working copy (`useState('reading:local')`). Controls change the local copy instantly (preview); "Set as default" is the only write (`PATCH /auth/profile {preferences:{reading}}`, toast "Saved as your default"); "reset" drops the local copy.
- Defaults `{scale:1, font:'sans', theme:'paper'}`; scale min 0.75, max 1.6, step 0.05 (clamped + rounded); fonts Sans/Serif; themes Paper `#ffffff/#18181b`, Warm `#f6efe2/#2b2418`, Dim `#1f2024/#e6e6ec`. Applied as classes `reading-surface reading-font-{font} reading-theme-{theme}` on the lesson column. Signed-out readers get the controls without persistence.

### PLT-08 Global route guard + public allowlist
- `middleware/auth.global.ts`: everything is protected unless public. Public = `PUBLIC_PAGES` from `shared/pages.ts` (also feeds sitemap + footer) + `/login`, `/register`, `/start`, `/sandbox`, `/checkout`; plus by-name route `user-course` (`/{user}/{course}`), prefixes `/shared/*`, `/learn/*`, `/vs/*`, and `/dev/*` in dev builds only.
- Signed-in user hitting `/login|/register|/start` → redirected to `?next=` or `/today` (HOME), carrying `?topic=` so the prompt the visitor typed survives the bounce.
- Signed-out user on a protected route → `/login?next=<fullPath>`.

### PLT-09 CurrentUser — the acting identity (single-user fallback)
- `CurrentUser::get()` prefers the Sanctum user; otherwise (CLI, queued jobs, unauthenticated) falls back to the lowest-id user, creating `{name:'You', locale:'en', timezone:'UTC'}` if the DB is empty. `currentOrganization()` = explicit `current_organization_id` else first owned org.
- This is literally the original "no auth MVP" single-user mode (model docblock: "exactly one row (id=1)"). Known trap (memory: queue-worker identity): inside a job CurrentUser is user #1 → BYOK leak; fixed by `OwnKey` resolving the key from the course owner, never from CurrentUser.

### PLT-11 Native mobile shell (Capacitor 8)
- Same Nuxt app built as static SPA (`MOBILE=1 nuxt generate`, `ssr:false`), `appId com.bilimind.app`, `webDir .output/public`, `androidScheme https`.
- Plugin `20.capacitor.client.ts` (native only): status bar light/no overlay, splash hidden on `app:mounted`, Android back button = router.back() or exit at root, `appUrlOpen` deep links → in-app route, auth token mirrored into `@capacitor/preferences` (Keychain/Keystore) and re-seeded into the cookie on cold start.

## 2. Billing, plans, usage meters, caps, BYOK

Sources: `config/plans.php`, `app/Enums/{PlanTier,SubscriptionStatus,BillingInterval}.php`, `app/Models/{Subscription,UsageMeter,UsageTopup,ApiCredential,GenerationRun}.php`, `app/Services/Billing/*` (`AllowanceService`, `Allowance`, `ExpansionCharge`, `LessonCharge`, `OwnKey`, `TopupPack`), `app/Http/Middleware/{EnforceGenerationCap,EnforceMaterialQuota}.php`, `app/Services/Materials/MaterialQuota.php`, `app/Services/Imagery/IllustrationBudget.php`, `config/imagery.php`, `config/llm.php`, `app/Http/Controllers/{BillingController,AllowanceController,CredentialController}.php`, `app/Services/Subscription/*`, `app/Console/Commands/RollAllowance.php`, `frontend/app/components/account/{Plan,ApiKeys}.vue`, `frontend/app/composables/{useAllowance,useBilling,useCredentials}.ts`, `frontend/app/pages/{checkout,pricing}.vue`, `frontend/app/lib/paddle.ts`.

Core doctrine (stated in code comments): "BiliMind charges for persistence, not generation." Clarify + outline + review + scheduling are never metered; only node EXPANSION (= writing a lesson) and generated ILLUSTRATIONS are counted, plus uploaded-material storage. Two meters, never merged into a credit balance ("lessons are lessons, illustrations are illustrations").

### PLT-12 Plan catalogue (Free / Pro)
| | Free | Pro |
|---|---|---|
| price | $0 | $15/mo (`1500` cents), $149/yr (`14900`) — tax-exclusive, USD |
| `node_expansions_per_month` | 12 | 150 |
| `illustrations_per_month` | 10 | 40 |
| `material_storage_bytes` | 100 MB | 2 GB |
| `material_count` | 200 | 2000 |
| `material_upload_bytes` (per file) | 20 MB | 50 MB |
| features | unlimited_clarify, unlimited_outline, capped_node_expansion, own_materials, unlimited_review, unlimited_schedule, unlimited_reminders | + high_node_expansion_cap, priority_generation, byok_lifts_expansion_cap, byok_lifts_illustration_cap |
- `GET /api/billing` (owner/admin only) → `SubscriptionResource` `{id, plan, plan_label, interval, status, status_label, is_paid, is_active, cancelled, on_grace_period, ends_at, period_start, period_end, trial_ends_at, plan_catalog{name, price{monthly,yearly}, currency, features, limits}}` + `plans[]` (`{plan, name, price, currency, features, limits, is_paid}`) + `topups[]`.
- Subscription states: `active|trialing|past_due|canceled|incomplete|unpaid`; only active/trialing grant access. `effectivePlan()` = plan if `active()` (is_active and not past `ends_at`) else Free — every limit reads the effective plan.
- Pricing UI (`Plan.vue`): Pro lines built from LIMITS, not feature keys ("150 lessons written for you each month", "40 illustrations each month", "Unused lessons carry over, up to half a month", "Your own model key takes lessons off the meter"); yearly saving DERIVED `round((1 - yearly/(monthly*12))*100)` → "Yearly · save 17%".

### PLT-13 Monthly lesson meter + hard cap (402)
- `usage_meters` row per `(organization_id, meter, period 'YYYY-MM')` with `count`. Meters: `node_expansion`, `illustration`.
- Middleware `generation.cap` (`EnforceGenerationCap`) on the expand route only. Requested quantity = `count(unique(node_ids))` if given, else number of `stub` nodes on the course (min 1).
- Allowed if: (a) `OwnKey::forText(course)` returns a key (see PLT-24) → unmetered; (b) plan cap null; (c) `planRemaining + topupRemaining >= requested`.
- Refusal: HTTP 402 `{message, error:'node_expansion_cap_reached', plan, limit, used, topup_remaining, remaining, requested, period, resets_at (ISO, 1st of next month)}`. Messages differ by tier — Free: "You have written your 12 free lessons this month. Upgrade to Pro for 150 a month, top up from Plan & billing, or wait for the 1st." Pro: "You have written 150 lessons this month, which is everything Pro includes. Top up from Plan & billing to keep going, add your own {OpenRouter} key — that uses your own credit and is never counted — or wait for the 1st." Free is never told about keys (they lift nothing on Free).
- Frontend: on 402 the course page reloads the allowance (`pages/[user]/[course].vue`), `ExpandDialog.vue` reads allowance before letting the learner pick lessons.

### PLT-14 Illustration budget (three ceilings)
- `IllustrationBudget::check(course, org)` → reason codes in order: `disabled` (imagery.enabled false) → `provider_halted` (cache flag after provider failure; failure cooldown 6h) → `course_cap` (`imagery.max_per_course` = 8 ready+pending per course) → `plan_cap` (illustration meter exhausted) → `weekly_budget` (platform-wide `imagery.weekly_budget_usd` = $3.50 over 7 days; skipped when the user's own OpenRouter key pays).
- Returns `{allowed, reason, courseUsed, courseLimit, monthUsed, monthLimit (plan+topups), weekSpendUsd, weekBudgetUsd, usingOwnKey}`. Meter is RESERVED at dispatch and refunded if the render fails. Cost per image constant `0.0387` USD (`google/gemini-2.5-flash-image`).
- Shared/public readers SEE existing illustrations but can never trigger a render (owner-only trigger).

### PLT-15 Material storage quota
- `EnforceMaterialQuota` on POST routes that add bytes only (never GET/DELETE — "a user at their ceiling must always be able to look at what they have and throw some of it away"). Storage is a STOCK (`SUM(materials.bytes)` now), not monthly.
- 402 shapes: `{error:'material_count_reached', message:'Your Free plan holds 200 materials and you have 200. Delete one you have finished with, or upgrade for room for more.', limit, used, requested:1}` or `{error:'material_storage_full', …}`. Lesson attachments add bytes but not count. URL materials cost 0 at request time. `GET /api/materials/quota` returns `{plan, byok, …}` for the meter UI.

### PLT-16 Allowance read-out + "running low" moment
- `GET /api/allowance` (ANY member; counts only, no money): `{data:{lessons: Allowance, illustrations: Allowance, packs: TopupPack[], resets_at}}`. `Allowance.toArray()` = `{meter, metered, plan_limit, plan_used, plan_remaining, topup_remaining, remaining (null when unmetered), percent_used (plan share only, 0–100), unmetered}`. BYOK is asked per meter (text key vs OpenRouter image key).
- `useAllowance()` (shared `useState('allowance')`): fails OPEN (an unreadable allowance never blocks); `low(meter)` = `percent_used >= 80`; packs are only offered beneath a meter that is low (`packsFor('node_expansion'|'illustration')`), never as a permanent shop.

### PLT-17 Charge lifecycle: reserve → settle → keep/refund
- Middleware consumes `requested` units BEFORE the controller (prevents two requests winning the last lesson) and stores an `ExpansionCharge{organization, quantity, settled}` in request attributes.
- Controller calls `LessonCharge::settle(charge, claimedNodeIds)`: first `min(quantity, claimed)` nodes get `nodes.charged_organization_id = org`; unclaimed remainder refunded immediately. If the request ends unsettled (422/404/exception) middleware refunds all.
- Lesson written → `keep(node)` clears `charged_organization_id`. Lesson failed → `refund(nodeIds)` uses a locking CTE `UPDATE … RETURNING old charged_organization_id` so a double failure refunds once. Failed-lesson card ends with the constant "It does not count against your lessons."
- Spend order (`AllowanceService::consume`): plan share first, then top-ups soonest-expiry first (`expires_at ASC NULLS LAST, id`), rows locked. Refund order mirrors it (top-ups first only if plan share is full; only into non-expired grants; plan meter floored at 0).

### PLT-18 Top-up packs
- `config('plans.topups.packs')`: `lessons_25` (25 lessons, $5), `lessons_100` (100, $15), `illustrations_50` (50 images, $9). Each `{meter, name, description, quantity, price, currency, stripe_price, paddle_price}`. Descriptions: "A few more lessons, whenever the month runs short." / "A full course and then some." / "Pictures for roughly six more courses."
- Expire after 365 days (`TOPUP_EXPIRES_AFTER_DAYS`). `TopupPack.toArray()` = `{id, meter, name, description, quantity, price, currency, purchasable, expires_after_days}`; `purchasable=false` when the provider price id is unset (checkout answers 503 → toast "Top-ups are not switched on yet. Nothing has been charged.").
- `usage_topups` rows: `{organization_id, meter, source: purchase|rollover, quantity, remaining, amount_cents, currency, provider, provider_reference (UNIQUE idempotency key), expires_at}`.

### PLT-19 Monthly rollover (paid only)
- `bilimind:roll-allowance` monthly on the 1st 00:20: for every Pro org (effective plan paid) and each meter, `carry = min(cap - usedLastMonth, floor(cap * 0.5))`; granted as `source=rollover`, `expires_at = end of this month`, reference `rollover:{org}:{meter}:{YYYY-MM}`. Free never rolls. Toggle `ALLOWANCE_ROLLOVER`.

### PLT-20 Upgrade checkout
- `POST /api/billing/checkout {interval: month|year}` (owner/admin; 422 if already paid and not in grace) → `{url}`; browser redirected. Provider = `plans.billing_provider` (Paddle as merchant of record since 2026-09-12; Stripe driver kept). Paddle flow opens on the app's own `/checkout?_ptxn=txn_…` page which loads Paddle.js and opens the overlay; states `opening|open|missing|unavailable`; both exits land on `/account?section=plan&status=success|cancelled`.
- Return acknowledgement in `Plan.vue`: success → toast "Payment received. Your plan updates in a few seconds." and re-fetch billing/allowance/me after 4 s; cancelled → "Checkout closed. Nothing was charged."; query param removed.
- `POST /api/billing/topup {pack}` → `{url}` same flow.

### PLT-21 Cancel / resume (grace period)
- `POST /api/billing/cancel` (422 on Free or already cancelled) → cancels at period end (`ends_at` set). `POST /api/billing/resume` (only within grace). UI: Cancel is hidden in an overflow menu with a confirm; status chip `Trial | Ending soon | Active | Free plan`; renewal line "Your trial ends on …" / "Your plan stays open until {ends_at}, then drops to Free." / "Renews on {period_end}."

### PLT-22 Provider webhooks
- `POST /api/billing/paddle/webhook` (Paddle-Signature, 5 s tolerance) and `/stripe/webhook` — public. Paddle events: `transaction.completed` (grants the top-up pack from `custom_data.topup_pack`, idempotent by transaction id), `subscription.{created,updated,activated,past_due,paused,resumed,trialing}` (sync plan/interval/status/period/ends_at), `subscription.canceled` (downgrade).

### PLT-23 BYOK credential management
- `GET /api/credentials` → `[{id, provider, label, last_four, is_active, last_used_at, created_at}]` (secret never serialised; encrypted at rest via Laravel `encrypted` cast).
- `POST /api/credentials {provider?: deepseek|openrouter (default = llm.credential_provider = openrouter), key (req, ≤250, regex ^sk-[A-Za-z0-9_\-]{16,}$), label? ≤120}` → deactivates other keys of that provider, stores new as active. Messages: "Paste your API key." / "That does not look like an API key. It should start with \"sk-\"."
- `POST /api/credentials/{id}/activate` (one active per provider); `DELETE /api/credentials/{id}` ("Key revoked."). Other users' keys → 404.
- UI (`ApiKeys.vue`): provider select OpenRouter (default, first) / DeepSeek, key + optional label, client check "That key looks too short." (<8), toasts "Key added. On Pro, new lessons use it." / "That key is now the one in use." / "Key removed."; explainer: "On Pro, lessons get written against your own model key instead of counting toward the month. On the free plan a key is kept but not used — it starts working the day you upgrade. We store only the last few characters…"

### PLT-24 OwnKey — whose key pays
- `OwnKey::forText(?course)` (provider = `llm.credential_provider`) and `OwnKey::forImages(?course)` (always OpenRouter). Holder = course OWNER when a course is known (works inside queue workers), else the really-authenticated user, else nobody. Honoured only if the effective plan's features contain `byok_lifts_expansion_cap` / `byok_lifts_illustration_cap` (Pro). Any exception → null (metered, platform key). Used identically by the cap middleware, `LlmClient`, the image client, `AllowanceController` and `MaterialQuota`.

### PLT-25 Generation-run ledger (the cost record)
- `generation_runs` row for EVERY LLM call (success or failure), written only by `LlmClient`: `{course_id, node_id, stage: clarify|outline|expand_node|regenerate|rewrite_block|grade|schedule|illustrate, model, status: success|failed, input_tokens, output_tokens, cost_usd (decimal 6), duration_ms, attempts, error}`.
- Cost: OpenRouter reports real cost (`reports_cost=true`); otherwise computed from `config('llm.pricing')[model] {input, output}` USD per 1M tokens (fallback 0.55/2.19). Measured: one expansion ≈ $0.00216 on `deepseek/deepseek-v4-flash` via OpenRouter (~10k in / ~6.4k out); image $0.0387 flat. Weekly imagery spend is summed from this table.
- Not surfaced to learners in the web app (operator-only data) — the desktop app should surface it (see §12).

## 3. Sharing, public courses, catalogue/explore, IndexNow

Sources: `routes/api/courses.php`, `app/Http/Controllers/{ShareController,PublicCatalogController,CourseController}.php` (`showByPath`, `update`), `app/Support/CourseSlug.php`, `app/Models/Course.php` (`syncSlug`, `canonicalPath`, `scopeShared`), `app/Services/Course/CoursePayload.php::forPublic`, `app/Http/Resources/CourseResource.php` (`asShared`, `shareUrl`), `app/Jobs/SubmitToIndexNowJob.php`, `frontend/app/pages/{[user]/[course].vue, shared/[token].vue, explore.vue}`, `frontend/app/components/course/PublicView.vue`, `frontend/server/routes/{sitemap.xml,sitemap-pages.xml,sitemap-learn.xml,sitemap-courses.xml,og.svg}.ts`, `frontend/server/middleware/indexnow-key.ts`, `frontend/app/plugins/verification.ts`, `frontend/shared/pages.ts`.

### PLT-26 Publish / share a course
- `POST /api/courses/{course}/share` (owner only, else 404 "Course not found.") — idempotent: mints a 32-char alphanumeric `share_token` only if none exists (collision-retried), sets `is_public=true`. Response `{share_token, share_url, is_public:true}`. `share_url` = the canonical `/{username}/{slug}` URL when available, else legacy `{frontend_url}/shared/{token}`.
- On the FIRST publish (was private): clears the catalogue cache (`PublicCatalogController::forget()`) and queues IndexNow for `[canonicalPath, '/explore']`.
- UI: a "Share" button in the course workspace header. If the course already has `share_url` it is copied straight to the clipboard, else POST then copy; toast title "Share link copied", body "Read-only: no answer keys, no progress, and none of your uploaded materials." The web UI has no unpublish button (API only).

### PLT-27 Unpublish
- `DELETE /api/courses/{course}/share` → `is_public=false`, `share_token=null` (every link already handed out dies; re-sharing mints a new token). Clears the catalogue cache if it was public. Response `{share_token:null, share_url:null, is_public:false}`.

### PLT-28 Legacy token links
- `GET /api/shared/{token}` (public, token `[A-Za-z0-9]{32}`) → read-only projection, 404 "This course is not shared." unless `is_public` and token match. The page `shared/[token].vue` 301-redirects to `course.path`; when dead it shows "This link is no longer live — The owner unshared this course, or the link was mistyped. Sharing again makes it readable at its own address." (noindex).

### PLT-29 Canonical course address `/{username}/{course-slug}`
- `GET /api/u/{username}/{slug}` (outside auth; username `[A-Za-z0-9_-]{3,30}`, slug `[A-Za-z0-9-]{1,60}`). Reads the bearer token itself: owner → full workspace payload; anyone else → read-only projection if public; else 404. Never uses CurrentUser (its user-#1 fallback would leak a library).
- The Nuxt route `[user]/[course].vue` is the SAME URL for owner (workspace) and stranger (`PublicView`); `readOnly = course.is_shared === true`. SEO: only the read-only view is indexable and only if ≥4 lessons are written (`INDEXABLE_MIN_LESSONS`, mirrors the API); description = topic + "N written lessons in an ordered path, with graded practice." (≤158 chars); emits schema.org `Course` with `hasCourseInstance` + free `Offer` + `syllabusSections` (one per lesson).

### PLT-30 Read-only public projection
- `CoursePayload::forPublic`: owner `{id, username, name, avatar_url}`, nodes ordered with blocks (by position), LIVE assessments only (retired ones hidden), attachments (signed expiring URLs), edges. NO answer keys, progress, attempts, schedule, annotations, materials. Existing illustrations hydrated; a reader can never trigger a new render.
- `PublicView.vue`: brand header + "Shared course" badge + theme toggle + "Make your own" (to `/start` for signed-out readers); hero = title, byline (owner name), goal/topic, badges (N lessons, total reading time "1h 20m", level, LANGUAGE code); every lesson as an `<article id="{node.key}">` with title, summary, "{min} min · N assessments", blocks rendered read-only via `BlockRenderer`; unwritten lessons say "This lesson is in the outline but hasn't been written yet."; empty course: "This course has no lessons yet — The owner shared it before the outline finished generating."; a contents list.

### PLT-31 Course slugs (and when they freeze)
- `CourseSlug::for(course, title?)`: `Str::slug`, ≤60 chars cut on WORD boundary, trailing connector words dropped (`a an and as at by for from in into of on or the to via with`), empty → `course`, all-digit or reserved (`courses edit followers following library new settings shared`) → `course-{slug}`; unique PER USER with `-2`, `-3` suffix.
- Renaming a PRIVATE course moves its slug; once `is_public` the slug is frozen ("at that point the slug is somebody else's bookmark"). Changing username moves every URL with no redirect.

### PLT-32 Public catalogue `/explore`
- `GET /api/public/courses?page=&language=` (anonymous) → `{data:[{path, title, topic, language, level, lessons, lessons_written, author{username,name}, updated_at}], meta{page, per_page:24, total, last_page}}`; newest first by `updated_at, id`; cached 30 min per page+language; cache swept for first 40 pages on publish/unpublish/purge.
- Quality gate `indexable()`: `is_public`, status `ready`, slug not null, owner has username, ≥4 nodes with status `ready`. Language facet accepts only `^[a-z]{2}(-[A-Za-z]{2,8})?$`.
- Page: landing layout, server-rendered page links (no infinite scroll), each `?page=N` canonicalises to itself, titles "Free AI-Generated Courses to Read Now | BiliMind" / "… — page N", JSON-LD `CollectionPage` + `ItemList` (only when non-empty).

### PLT-33 Sitemaps, OG image, robots, llms.txt
- `sitemap.xml` = index of `sitemap-pages.xml` (from `shared/pages.ts` PUBLIC_PAGES with priority/changefreq), `sitemap-learn.xml` (generated roadmaps), `sitemap-courses.xml` (from `GET /api/public/courses/sitemap` → `{data:[{path, lastmod (date)}]}`, max 50,000, cached 1 h; empty `<urlset>` on API failure; changefreq weekly, priority 0.6).
- `/og.svg` drawn by `server/utils/og-card.ts` (raster `public/og.png` used for `og:image`); static `robots.txt`, `llms.txt`, `site.webmanifest`, icons.

### PLT-34 IndexNow push
- `SubmitToIndexNowJob::submitPaths(paths)` no-ops unless `services.indexnow.key` + `app.frontend_url`; POSTs `{host, key, urlList}` to `https://api.indexnow.org/indexnow`, filters foreign hosts, 2 tries, 15 s timeout, 200/202 = ok, failures only logged. The Nuxt server middleware serves `/{key}.txt` → the key (text/plain).

### PLT-35 Search-console verification
- SSR-only plugin emits `google-site-verification`, `msvalidate.01`, `yandex-verification` meta tags from runtime config, skipping blank ones.

## 4. Organizations / teams / invites / roles

Sources: `routes/api/organizations.php`, `app/Http/Controllers/OrganizationController.php`, `app/Services/Auth/OrganizationProvisioner.php`, `app/Enums/{MembershipRole,OrganizationType}.php`, `app/Http/Requests/Organizations/*`, `app/Models/{Organization,Membership}.php`, `frontend/app/components/account/Organization.vue`, `frontend/app/pages/for-institutions.vue`.

Model: "an individual is an organization of one". Every user gets a personal `individual` org at registration. The ORGANIZATION (not the user) owns the subscription, `usage_meters` and `usage_topups`; a user acts within `users.current_organization_id`. IMPORTANT: courses are still scoped by `courses.user_id` — `GET /api/courses` filters `where user_id = me`. `courses.organization_id` is stamped but only used to pick which org's plan/meter pays. There is NO shared team library, no course assignment, no instructor view of learners' progress. "Team" today = pooled plan + member list.

### PLT-36 Organizations (personal + multi-seat types)
- Types: `individual`, `learning_center`, `bootcamp`. `POST /api/organizations {name ≤120, type?}` → `createOrganization` (owner membership + free subscription; does NOT switch current). Slug = `Str::slug(name)` unique with `-1`, `-2`… (`workspace` when empty).
- `GET /api/organizations` → `[{id, name, slug, type, is_owner, is_current, plan}]`; `GET /api/organizations/current` (404 "You have no organization yet.").
- No UI to create a non-personal org in the web app (API only); `/for-institutions` is a marketing page.

### PLT-37 Switch current organization
- `POST /api/organizations/{org}/switch` (must be a member, else 404) sets `current_organization_id`; billing, meters and BYOK plan checks then follow the new org. No switcher UI exists in the web app.

### PLT-38 Members: list, invite, change role, remove
- `GET /api/organizations/{org}/members` (any member) → `[{membership_id, user_id, name, email, role, can_manage}]`.
- `POST …/members {email, role?}` (owner/admin) — invitee must ALREADY have an account: else 422 "No user with that email exists yet. Ask them to sign up first."; duplicate → 422 "That user is already a member.". No email is sent, no pending-invite state.
- `PATCH …/members/{membership} {role}` (owner/admin; owner's role immutable: "The owner's role cannot be changed."); `DELETE …/members/{membership}` (owner cannot be removed).
- UI "Your team" (`Organization.vue`): everyone sees the list; manage controls only for owners ("the honest thing rather than a wall of disabled buttons"); invite form email + role select; toasts "Invited {email}.", "{name} is now {role}.", "Could not change that role.".
- Known drift (porting note, not to be copied): the UI role list is `member|admin|owner` while the API accepts `owner|admin|instructor|learner` (inviting as `member` fails validation); the UI reads `organization.role` which the me payload never sends (it sends `is_owner`), so `canManage` is always false; UI keys members by `id` while the API returns `membership_id`.

### PLT-39 Roles
- `owner`, `admin`, `instructor`, `learner`; `canManage()` = owner|admin → gates billing (`/api/billing*`) and member management. Instructor/learner have no distinct capabilities yet. `/api/allowance` deliberately open to any member (counts only).

## 5. Telegram

Sources: `routes/api/telegram.php`, `app/Http/Controllers/Auth/TelegramAuthController.php`, `app/Services/Telegram/TelegramService.php`, `config/telegram.php`, `frontend/app/lib/tma.ts`, `frontend/app/composables/{useTmaAuth,useTelegram}.ts`, `frontend/app/plugins/10.tma-redirect.client.ts`, `frontend/mobile.md`.

What exists is ONLY a Telegram Mini App (TMA) sign-in. There is no bot logic: no webhook, no commands, no outbound messages, no Telegram notifications/reminders, no deep-link `start_param` handling (parsed but unused), no sharing to Telegram. Config keys `bot_username` and `mini_app_url` are defined but unused by app code.

### PLT-10 Telegram Mini App silent sign-in
- `POST /api/auth/telegram {initData}` (public, throttle:auth). Validation (`TelegramService::validateInitData`): parse query string, remove `hash`, `ksort`, join `key=value` with `\n` → data-check-string; `secret = HMAC_SHA256(key="WebAppData", msg=bot_token)` (raw); compare `hex(HMAC_SHA256(secret, dcs))` to `hash` with `hash_equals`. Freshness: `time() - auth_date <= TELEGRAM_AUTH_MAX_AGE` (86400). `TELEGRAM_ALLOW_INSECURE=true` + no bot token = local bypass.
- `parseInitData` → `{telegram_id, first_name, last_name, username, language_code, photo_url, is_premium, auth_date, start_param}`; missing user → 422 "Invalid Telegram user data."; bad signature/expired → 401.
- Find-or-create by `users.telegram_id` (race-safe `createOrFirst`); new user name = "first last" or "@username" or "Telegram user", `locale = language_code ?? 'en'`, email null, personal org provisioned. Existing user: refresh `telegram_username`, self-heal org. Token named `tma`. Response mirrors login.
- Client: `lib/tma.ts` `isTmaContext()` = live signals (`#tgWebAppData` hash or `Telegram.WebApp.initData`) else a persisted flag (`bilimind_tma` in sessionStorage + 1-year cookie) because the hash is wiped on first client navigation; the Telegram SDK (`telegram-web-app.js`) is loaded lazily only after detection. Plugin `10.tma-redirect.client.ts` runs before the auth guard: authenticates via initData, and if the learner landed on `/`, `/login` or `/register` replaces to `/today` (deep links left alone). `useTelegram()` calls `WebApp.ready()` + `expand()` and exposes `user`, `themeParams`, `close`.

## 6. Notifications & email

Sources: `routes/api/schedule.php`, `app/Http/Controllers/NotificationController.php`, `app/Models/Notification.php`, `app/Jobs/DailyDigestJob.php`, `routes/console.php`, `app/Support/FailureNotice.php`, `frontend/app/components/shell/Activity.vue`, `frontend/app/composables/useToast.ts`.

No email is sent by the application at all (no `Mail::`, no Mailables, no `->notify()`; the controller docblock says "No mail is configured"). No push, no browser `Notification` API, no Telegram messages. The `oybek@bilimind.com` Brevo/Cloudflare mail setup is for humans, not the app. The only notification surface is an in-app inbox plus toasts.

### PLT-40 In-app notification inbox ("Activity")
- Table `notifications` (BiliMind's own, not Laravel's): `{id, user_id, type, title, body?, payload (json)?, read_at?, created_at}`. Types defined: `daily_digest`, `course_ready`, `course_failed` — but only `daily_digest` is ever written (course_ready/failed constants are unused).
- `GET /api/notifications?limit=(1–100, default 30)&unread_only=bool` → unread first, then newest: `{data:[{id, type, title, body, payload, is_read, read_at, created_at, created_at_human}], meta:{unread_count, total, limit}}`. `POST /api/notifications/{id}/read` → idempotent, returns the item + `unread_count`; other users' rows 404.
- UI `Activity.vue`: a bell (in the desktop rail, the phone top bar and the Today header); ONE shared list + ONE 45-second poll however many bells are mounted (ref-counted; first mount starts, last unmount stops). Unread dot on the bell. Modal "Activity — Daily plans and generation updates."; skeleton while loading; empty state "Nothing yet — Your daily plan lands here every morning once a course is scheduled."; each row = dot (accent if unread), title, relative time (`just now`, `5m ago`, `3h ago`, `yesterday`, `4d ago`), body; click = optimistic mark-read (rolled back on failure); "mark all read" (first 50).

### PLT-41 08:00 daily digest
- `Schedule::job(new DailyDigestJob)->dailyAt('08:00')` (server timezone, not per-user), `withoutOverlapping`, 3 tries, backoff 60/300/900 s. Per user (errors isolated per user):
  1. Load active schedules whose course is on the shelf (not archived/trashed). None → nothing.
  2. `ScheduleBuilder::recompact()` each schedule (reconcile with real progress).
  3. Collect open items (`pending|moved`, `scheduled_for <= today` in the USER's timezone). None → write NOTHING ("silent on a rest day").
  4. Split due-today vs overdue (`days_late`), sum due minutes.
  5. Title: "Today's plan: 3 lessons · 45 min (+2 overdue)" or "Catch up: 2 lessons waiting for you" (≤200 chars). Body lines `- {lesson} — {course} ({min} min)`; then "Still open: N lessons, up to D days late." + first 5 overdue lines.
  6. Payload `{date, due_count, due_minutes, overdue_count, max_days_late, course_ids, schedule_item_ids, items:[{schedule_item_id, schedule_id, node_id, course_id, course_title, title, estimated_minutes, scheduled_for, days_late}]}`.
  7. Idempotent per day: finds an existing `daily_digest` row from the last 3 days with `payload.date == today` and rewrites it (and resets read state) instead of inserting.

### PLT-42 Learner-safe failure copy
- `FailureNotice::because($e)` is the ONLY writer of the "why" clause in `courses.failure_reason` / `nodes.failure_reason`: never names vendor, model, HTTP status or stage. Three sentences: OURS "The service that writes lessons could not be reached — that is on our side, not on anything you typed. Try again in a few minutes; if it keeps happening, tell us." / SLOW "The model took too long to answer. Try again — it usually lands on the second attempt." (connection/transport errors) / SHAPE "The model answered in a shape BiliMind could not use. Trying again almost always fixes it." (schema/decode failures). Full error goes to `generation_runs.error` (operator surface).

### PLT-43 Toasts
- `useToast()` global stack (`useState('bilimind-toasts')`): `{id, tone: neutral|success|warn|danger, title, body?, duration, action?{label, handler}}`; default duration 4200 ms, danger 7000 ms; helpers `success/error/info/warn`; `dismiss(id)`.

## 7. i18n / languages

Sources: `frontend/app/components/account/Profile.vue`, `frontend/app/utils/words.ts` (`LANGUAGES`, `languageName`), `frontend/app/pages/create/[draft].vue` (`LANGUAGES`), `frontend/app/utils/landing.ts` (`LANGUAGES` marketing list), `frontend/nuxt.config.ts` (`htmlAttrs.lang='en'`), `backend/app/Services/Course/CourseFactory.php::normaliseLanguage`, `backend/app/Services/Schedule/ScheduleBuilder.php::todayFor`, `backend/config/app.php`.

There is NO UI internationalisation: no `@nuxtjs/i18n`, no `$t()`, no translation files; every UI string is hard-coded English, `<html lang="en">`, no RTL handling. Backend has no lang files in use; API messages are English. What exists is CONTENT language (the language lessons are written in) plus a per-user locale and timezone.

### PLT-44 Account language → default course language
- `users.locale` (≤12 chars; set at register, from Telegram `language_code`, or via Settings → Profile "Language" select: `en uz ru es fr de tr ar pt it`). It does not change the UI; it is the fallback course language: `CourseFactory::normaliseLanguage(requested, user)` = trimmed lowercase requested language, else `user.locale`, else `config('app.locale')` (`en`).
- Create flow language select ("Which language should the lessons be in?"): `en English, uz O'zbek, ru Русский, es Español, pt-BR Português (BR), fr Français, de Deutsch, it Italiano, tr Türkçe, ar العربية, hi हिन्दी, id Bahasa Indonesia, zh 中文, ja 日本語, ko 한국어` (default `en`). `languageName()` map (English names) covers `en uz ru es fr de tr ar pt it zh ja ko hi`, else upper-cased code. Course language is stored on `courses.language`, shown as a badge on public pages, and is a facet on the public catalogue. Marketing copy claims 20 languages (`utils/landing.ts`).
- Search is language-agnostic by design (Postgres `simple` + `unaccent`, no stemming, "because courses are written in the learner's own language").

### PLT-45 Per-user timezone ("today")
- `users.timezone` (default `UTC`; accepted by register/profile APIs but there is no UI to set it). `ScheduleBuilder::todayFor(user)` = start of day in the user's timezone; drives Today, overdue counts, review due dates and the digest's "due today". The digest job itself fires at 08:00 SERVER time for everyone.

## 8. Settings / account pages

Sources: `frontend/app/pages/account/index.vue`, `frontend/app/components/account/{Profile,Plan,ApiKeys,Organization}.vue`, `frontend/app/composables/useTheme.ts`, `frontend/app/components/ui/AllowanceMeter.vue`.

### PLT-46 Settings hub `/account`
- One page, `noindex`, title "Settings · BiliMind", subtitle "Your account, plan, keys and team." Left column (desktop ≥lg, 220 px): identity card (initials avatar from first 2 chars of name, name, email), vertical section nav, "Sign out" ghost button. On phone: horizontally scrolling tab strip and a "Sign out" button at the bottom.
- Sections via `?section=` (deep-linkable, `router.replace`, default `profile`): `profile` "Profile" (icon user) → PLT-05/PLT-44; `plan` "Plan & billing" (card) → PLT-12/16/18/20/21; `keys` "API keys" (key) → PLT-23; `team` "Your team" (users) → PLT-38.
- `Plan & billing` panel contents: current plan card (name, status chip, renewal line), month/year interval toggle + Upgrade (Free), allowance meters for lessons + illustrations (`AllowanceMeter`), packs offered only under a meter ≥80% used, overflow menu with "Cancel plan" (confirm dialog), Resume button when winding down.

### PLT-47 Theme (dark/light)
- `useTheme()`: `localStorage['bilimind-theme']` = `dark|light`, else OS `prefers-color-scheme`; toggles `html.light` + `color-scheme`, adds a transient `theme-switching` class to suppress transitions. Toggle exists in the public course view and app chrome. Separate from the lesson reading theme (PLT-07).

## 9. Library, explore, compare/vs, guides, SEO marketing pages

Sources: `frontend/app/pages/{library,explore}.vue`, `frontend/app/pages/learn/{index,[topic]}.vue`, `frontend/app/pages/vs/{chatgpt,coursera,[product]}.vue`, `frontend/app/pages/guides/*`, `frontend/app/content/{learn,compare}/*.json`, `frontend/shared/{pages,learn}.ts`, `frontend/app/components/learn/Cta.vue`, `frontend/app/composables/useStartCourse.ts`, `backend/app/Http/Controllers/CourseController.php::index`.

### PLT-48 Library `/library` (title "Courses · BiliMind")
- Data: `GET /api/courses?shelf=library|archived|trash` → `{data: CourseSummary[], meta:{shelf, counts:{library, archived, trash}, trash_retention_days:30}}`; plus `GET /api/course-drafts` for the "Pick up where you left off" `CourseDraftsStrip` at the top (courses represented by a draft are hidden from the library grid, never from archived/trash).
- One chip row = filter + shelf: `All`, `In progress` (0<percent<100), `Being built` (status in clarifying|outlining|outlined|expanding), `Finished` (percent ≥100) — chips with 0 hidden except All; `Archived` / `Trash` chips appear only when the server count >0 (or currently selected) and refetch with `?shelf=`.
- Filter box filters titles/topic/goal client-side ("filter", deliberately not "search"; real search is the command palette).
- Card: title, blurb (goal/topic if different from title), one progress sentence (`courseProgressLine`), one action button whose verb is the state (`failed` → "See what happened"; `clarifying` → "Answer a few questions", links to `/create/{uuid}`; else start/continue/review via `courseAction`), next scheduled date, writing count (queued+generating).
- Card menu: Archive / Back to library; Move to trash; in trash: Put it back, Delete forever (the ONLY confirm dialog). Archive/trash are undoable via toast action: "“X” archived — It keeps its link and everything in it. Find it under Archived." [Undo]; "“X” moved to the trash — Nothing is deleted yet — it stays for 30 days." [Undo]; trashed cards show time left ("today", "tomorrow", "29 days").
- API: `POST/DELETE /courses/{id}/archive`, `DELETE /courses/{id}` (trash), `POST /courses/{id}/restore`, `DELETE /courses/{id}/forever`. Archive = off the shelf (library, Today, review queue, digest) but URL/share/catalogue untouched; trash hides everywhere incl. public URL; expansion/regeneration jobs refuse archived/trashed courses.

### PLT-49 Explore `/explore` — see PLT-32.

### PLT-50 Learn roadmaps `/learn` + `/learn/{topic}` (generated SEO set)
- 32 static JSON roadmaps in `app/content/learn/*.json` generated by `marketing-ops/generator/gen-learn.mjs`; index `shared/learn.ts` (`LearnEntry {slug, subject, group: Software|Languages|Exams|Craft|Business, tier 1|2, h1, titleTag, description, hours, span, stages…}`). Page JSON shape: `{h1, titleTag, description, lead, hours, span, prerequisites, opening[], stages[{name, span, summary, topics[], proof}], paces[{hours, reality}], mistakes[{title, body}], checks[], faq[{q,a}], slug, subject, tier, updated}`. Subjects include accounting, aws-solutions-architect, ccna, copywriting, creative-writing, cybersecurity, docker, drawing, english-fluency, excel, … (32).
- CTA "Build this course" → `/start?topic=Learn {subject}` (signed-in users bounce to `/today` with the topic preserved). Related-roadmap links at the foot (`components/learn/Related.vue`). Own sitemap `sitemap-learn.xml`.

### PLT-51 Compare pages `/vs/*`
- Hand-written: `/vs/chatgpt` ("A conversation ends. A course does not."; "Ask for a syllabus and you get a plausible one"; "It cannot mark your work, and it will say you passed"), `/vs/coursera` ("A course about your subject, not a nearby one"; "Sized to your hours, not to a fixed 40"; "Practice that is marked, not a certificate").
- Generated `/vs/{product}` from `app/content/compare/*.json` (7: anki, coursebox, duolingo, khan-academy, notebooklm, quizlet, udemy). Shape `{h1, titleTag, description, lead, verdict, chooseThem[], chooseUs[], axes[{axis, them, us}], together, faq[{q,a}], slug, rival, updated}`. CTA → `/start`.
- The NotebookLM page's own positioning (relevant to the desktop goal): NotebookLM = answers + page-level citations over a corpus you query, no order, no marking, no schedule, no spaced review; BiliMind = ordered prerequisite path, lessons in the right format, "nine graded question types" with written feedback, code exercises against real tests, schedule from real weekly hours that re-flows, spaced review. Suggested combo: NotebookLM as the reading layer, BiliMind for retention/practice.

### PLT-52 Guides `/guides`
- Hub + 3 long-form articles: `/guides/spaced-repetition` ("Spaced repetition, actually applied" — explains ease factor etc.), `/guides/learning-path` ("How to turn a subject into a path"), `/guides/ai-generated-courses` ("Judging an AI course").

### PLT-53 SEO / marketing landing pages (list only)
- `/` (landing "stage": hero with the real prompt field, product-UI sections; signed-in home is `/today`), `/features`, `/how-it-works`, `/pricing`, `/about` ("Planning is free", "It says when it is unsure"), `/for-institutions` ("Seats, not licences", "Invite by email"), `/ai-course-generator`, `/ai-quiz-generator` (MCQ/multi-select, cloze/ordering/numeric, short answer/essay), `/pdf-to-course` (reads the file → splits into what it teaches → lessons grounded in your text), `/study-plan-generator` (hours not intentions; re-flows when a day is missed), `/exam-prep` (start from the actual syllabus; tested the way you will be tested).
- Legal: `/terms`, `/privacy`, `/refunds` (values in `app/utils/legal.ts`).
- All registered in `shared/pages.ts` with `{path, label, priority, changefreq, group: Product|Use it for|Compare|Learn|Company|Legal}` which drives the auth allowlist, footer and `sitemap-pages.xml`. Each uses `usePageSeo({title, description, path, heading, pageTypes?, pageProps?})` for canonical + JSON-LD.

### PLT-54 `/start` — the sign-up door that keeps the prompt
- Layout `start`, noindex. Left pane shows the sentence the visitor typed in the hero (pending prompt state, "ghost-flight" animation from the hero field), with what will happen next; right pane is the sign-up/in form. On success the field "flies" to the dashboard where it runs. `useStartCourse().startTo(topic, level)`: signed in → `/create?topic&level`; stranger → `/start?next=/create?…`.

## 10. Console commands, observers, scheduled tasks, rate limits, admin

Sources: `routes/console.php`, `app/Console/Commands/*`, `app/Observers/SearchIndexObserver.php`, `app/Providers/AppServiceProvider.php`, `bootstrap/app.php`, `config/queue.php`, `database/seeders/BackfillOrganizationsSeeder.php`, `backend/CLAUDE.md`.

### Scheduled tasks (`routes/console.php`, run by `php artisan schedule:work`)
| time | name | what |
|---|---|---|
| daily 08:00 | `bilimind:daily-digest` | `DailyDigestJob` — PLT-41 |
| daily 03:20 | `bilimind:prune-course-drafts` | PLT-55 |
| daily 03:40 | `bilimind:prune-revisions` | PLT-56 |
| daily 04:00 | `bilimind:purge-trashed-courses` | PLT-57 (last, the only destructive one) |
| monthly 1st 00:20 | `bilimind:roll-allowance` | PLT-19 |
All `withoutOverlapping()`.

### PLT-55 Course-draft pruning
- `bilimind:prune-course-drafts [--dry-run]`: deletes drafts untouched for `CourseDraft::STALE_AFTER_DAYS` = 30 (already hidden from the Drafts strip after 30 days) and "finished" drafts (course status `outlined|ready`, draft untouched >1 day — a day's grace for the reload during outline). Never touches the course.

### PLT-56 Revision history thinning
- `bilimind:prune-revisions [--dry-run] [--verify]`: for revisions older than `GRACE_DAYS` = 90, keep: the node's `current_revision_id`, the newest `KEEP_NEWEST` = 20 revisions, every boundary cause (`RevisionCause::isBoundary` — regenerate/restore), and the last revision of each calendar day; delete the rest in chunks of 500. `--verify` prints count, total bytes, nodes with history.

### PLT-57 Trash with 30-day retention
- `DELETE /courses/{id}` soft-deletes; `POST /restore`; `DELETE /forever` immediate. `bilimind:purge-trashed-courses [--days=] [--dry-run]` force-deletes courses trashed ≥30 days, one row at a time so the `deleting` hook removes the attachment directory; FK cascades remove nodes, blocks, assessments, attempts, progress, schedule items, revisions, annotations, search docs. One failure doesn't stop the run; clears catalogue cache if any purged course was public. Search documents are kept while in trash so a restore is searchable without reindex.

### PLT-58 Search index maintenance
- `SearchIndexObserver` on `Course` (title/topic/goal), `Node` (title/summary/concept_key), `Block` (type/payload): on `saved` when created or those attributes changed → `SearchIndexer::index*`. No `deleted` hook by design (deletes are mass deletes; DB FK cascade + AFTER DELETE triggers handle removal).
- `search:reindex [--course=] [--fresh] [--verify]` rebuilds the course/lesson/block index; `--verify` reports orphaned/missing docs and checks the index exists.

### PLT-59 Operator diagnostics and backfills (CLI only)
- `llm:ping [--tier=flash|pro]`: one structured call through `LlmClient` (schema `{ok:true, pong:'pong', sum:42}` from "19 + 23") and prints the parsed result + its `generation_runs` row — a provider/key health check.
- `course:subtopics [course ids…] [--force] [--dry-run]`: re-runs outline stage two (`StepParts`) to break steps into subtopic lessons for old/failed courses; idempotent.
- `resources:enrich [--all] [--limit=N] [--blocks-only]`: fetch link previews (banner, logo, site name) for verified resources and redraw the `resource`/`video` blocks citing them.
- `BackfillOrganizationsSeeder`: provisions personal orgs for pre-auth users.

### PLT-60 Rate limits (named limiters)
| limiter | limit | key | used by |
|---|---|---|---|
| `api` | 120/min | user id or IP | every protected route |
| `auth` | 20/min | IP | register, login, telegram auth |
| `generation` | 60/min | user/IP | clarify/expand/regenerate/stream (`routes/api/generation.php`) |
| `speech` | 30/min | user/IP | Whisper + dialogue tutor |
| `search` | 180/min | user/IP | command-palette search-as-you-type |
- `trustProxies('*')` (behind nginx/Cloudflare) so IP keys are real. Unauthenticated JSON → 401 `{"message":"Unauthenticated."}`; ModelNotFound → 404 `{"message":"Not found."}` (never leak class names). Error envelope `{message, errors?}`.

### PLT-61 Queue
- Database queue (`jobs` table), `retry_after` 3700 s (> worker `--timeout` 3600) — at 90 s a second worker re-ran outlines/lessons mid-flight (paid call twice). Jobs: ClarifyIntent, GenerateOutline, BreakStepsIntoParts, ExpandCourse, ExpandNode, RegenerateNode, RewriteBlock, ResearchNode, GenerateIllustration, GradeAttempt, IngestMaterial, BuildSchedule, DailyDigest, SubmitToIndexNow.

### PLT-62 Admin
- There is NO admin panel (no Filament/Nova/Horizon/Telescope in `composer.json`; no admin routes). `admin` exists only as an org role and a reserved username. Operator surfaces are: `generation_runs` (cost/errors), logs, the artisan commands above, `psql`. Pricing/limits are edited in `config/*.php` + env.

## 11. Every frontend page (frontend/app/pages)

43 page files. Layouts: `default` (app shell: 62 px desktop rail `Today / Courses / Materials / New course` + Activity bell + account menu → `/account`; phone bottom bar `Today / Courses / Files`), `workspace`, `landing` (marketing chrome, footer from `shared/pages.ts`), `auth` (sign-in card), `start`, or `false` (no chrome). "Auth" column: P = public, A = requires sign-in (global guard).

| Route | File | Layout | Auth | Purpose |
|---|---|---|---|---|
| `/` | `index.vue` | landing | P | Marketing landing "stage": hero with the real prompt field (pending-prompt hand-off to `/start` or `/create`), product-UI sections, FAQ. Signed-in TMA users are sent to `/today`. |
| `/today` | `today.vue` | default | A | Signed-in home: "what should I do right now" — one hero card + one button, today's plan as one ordered list, lateness as a quiet count with one bulk fix, prompt field to start a course (`?topic=` prefill). |
| `/library` | `library.vue` | default | A | Course library with drafts strip, filter chips, archive/trash shelves (PLT-48). |
| `/materials` | `materials.vue` | default | A | Learner's own materials: drop file / paste note / add link; queued ingestion with polled status; failures always with an action; storage quota meter. |
| `/review` | `review.vue` | default | A | Spaced-review loop: one lesson card at a time, four honest recall buttons, calm end with streak. |
| `/create` | `create/index.vue` | default | A | Doorway: mints a uuid and `replace`s to `/create/{uuid}` preserving query (topic, level). |
| `/create/{uuid}` | `create/[draft].vue` | default | A | Durable 3-step create flow: say what to learn (topic, level, language, minutes/week, materials) → answer generated one-tap clarify questions (skippable) → watch outline build. Autosaved draft keyed by uuid. |
| `/{user}/{course}` | `[user]/[course].vue` | none | P* | Canonical course URL: owner → full workspace (roadmap, lessons, assistant, artifacts, share button…); others → `PublicView` read-only if public else 404. SEO + schema.org Course (PLT-29/30). |
| `/courses/{id}` | `courses/[id]/index.vue` | none | A | Legacy id URL → redirect to canonical path. |
| `/courses/{id}/nodes/{nodeId}` | `courses/[id]/nodes/[nodeId].vue` | none | A | Legacy node URL → canonical path `?node={key}`. |
| `/shared/{token}` | `shared/[token].vue` | none | P | Legacy share link → 301 to canonical path; dead-link empty state (PLT-28). |
| `/account` | `account/index.vue` | default | A | Settings hub: Profile / Plan & billing / API keys / Your team (PLT-46). |
| `/login` | `login.vue` | auth | P | Email+password sign-in, `?next=` (PLT-02). |
| `/register` | `register.vue` | auth | P | Sign-up; `?plan=pro&interval=year` continues straight to checkout (PLT-01). |
| `/start` | `start.vue` | start | P | Sign-up door that keeps the typed prompt on screen (PLT-54). |
| `/checkout` | `checkout.vue` | auth | P | Paddle default payment link: opens overlay for `?_ptxn=` (PLT-20). |
| `/sandbox` | `sandbox.vue` | none | P | Full-window code sandbox (python/javascript/sql/html) runnable in-browser; payload via `postMessage SANDBOX_INIT` / sessionStorage `bilimind:sandbox-payload` / `?lang=`; posts `SANDBOX_RESULT` back to opener. |
| `/explore` | `explore.vue` | landing | P | Public catalogue (PLT-32). |
| `/learn` | `learn/index.vue` | landing | P | Roadmaps hub, grouped Software/Languages/Exams/Craft/Business. |
| `/learn/{topic}` | `learn/[topic].vue` | landing | P | Generated roadmap page + "Build this course" (PLT-50). |
| `/vs/chatgpt` | `vs/chatgpt.vue` | landing | P | Comparison vs ChatGPT. |
| `/vs/coursera` | `vs/coursera.vue` | landing | P | Comparison vs Coursera & Udemy. |
| `/vs/{product}` | `vs/[product].vue` | landing | P | Generated comparison (anki, coursebox, duolingo, khan-academy, notebooklm, quizlet, udemy). |
| `/guides` | `guides/index.vue` | landing | P | Guides hub. |
| `/guides/spaced-repetition` | `guides/spaced-repetition.vue` | landing | P | Article. |
| `/guides/learning-path` | `guides/learning-path.vue` | landing | P | Article. |
| `/guides/ai-generated-courses` | `guides/ai-generated-courses.vue` | landing | P | Article. |
| `/features` | `features.vue` | landing | P | Marketing. |
| `/how-it-works` | `how-it-works.vue` | landing | P | Marketing. |
| `/pricing` | `pricing.vue` | landing | P | Pricing table (Free/Pro, monthly/yearly, packs). |
| `/about` | `about.vue` | landing | P | Company/about. |
| `/for-institutions` | `for-institutions.vue` | landing | P | Teams & schools pitch (seats, invite by email). |
| `/ai-course-generator` | `ai-course-generator.vue` | landing | P | SEO landing. |
| `/ai-quiz-generator` | `ai-quiz-generator.vue` | landing | P | SEO landing. |
| `/pdf-to-course` | `pdf-to-course.vue` | landing | P | SEO landing. |
| `/study-plan-generator` | `study-plan-generator.vue` | landing | P | SEO landing. |
| `/exam-prep` | `exam-prep.vue` | landing | P | SEO landing. |
| `/terms` | `terms.vue` | landing | P | Legal. |
| `/privacy` | `privacy.vue` | landing | P | Legal. |
| `/refunds` | `refunds.vue` | landing | P | Legal. |
| `/dev/prompt` | `dev/prompt.vue` | none | dev only | Visual harness for the composer field (fixtures, no API). |
| `/dev/roadmap` | `dev/roadmap.vue` | none | dev only | Visual harness for the roadmap board (fixture course, in-memory marking); 404 in production. |

\* `/{user}/{course}` is let through the guard by route name; the API decides visibility.

### PLT-63 Legacy URL redirects
- `/courses/{id}` → canonical `/{username}/{slug}` (the id is the address that never goes stale while a private course's slug follows its title); `/courses/{id}/nodes/{nodeId}` → canonical path with `?node={node.key}`; `/shared/{token}` → canonical path (301). All live in notifications, shares and bookmarks made before the URL move.

### PLT-64 App shell navigation
- Desktop: 62 px rail `Today (home) / Courses (workspace) / Materials (file) / New course (plus)` + Activity bell in the rail footer + account menu (avatar → `/account`, sign out). Phone: bottom tab bar `Today / Courses / Files`, bell in the top bar. Course workspace uses its own `workspace` layout (full-bleed). Global command palette (`SearchPalette`, search-as-you-type, own 180/min limiter) — specified in the search slice.

### PLT-65 Standalone sandbox window `/sandbox`
- Public, no chrome, full viewport; languages `python | javascript | sql | html`; starter payload from `postMessage {type:'SANDBOX_INIT'}` (after it posts `SANDBOX_READY`), else sessionStorage `bilimind:sandbox-payload`, else `?lang=`; every run posts `SANDBOX_RESULT` to the opener so a lesson can capture pass/fail from the popped-out window. (Runtime details belong to the code-exercise slice.)

Server routes (Nitro, `frontend/server`): `/sitemap.xml`, `/sitemap-pages.xml`, `/sitemap-learn.xml`, `/sitemap-courses.xml`, `/og.svg`, middleware serving `/{indexNowKey}.txt`.

## 12. Porting to BiliMind Desktop

Target: Node.js desktop app (Electron or similar), single local user, BYOK (OpenRouter / OpenAI / Anthropic / Gemini / Ollama), everything written to a student-owned vault (Obsidian-compatible markdown + assets + JSON sidecars). Principle used below: **drop the SaaS plumbing, keep the user value, and where the web app hid something from the learner because it was the platform's money, show it — it is now the learner's money.**

### 12.1 Identity and profile (PLT-01…09, 54)
- No accounts, tokens, guard, Sanctum, or `/auth/*`. `CurrentUser` collapses to a `profile` singleton loaded at startup. Keep the session shape minus the auth fields so ported UI keeps working:
  - `profile` = `{name, handle, content_language, timezone (from Intl.DateTimeFormat().resolvedOptions().timeZone, never stored unless overridden), reading:{scale, font, theme}}`.
  - `budget` replaces `organization` + `subscription` (see 12.2).
- **First-run onboarding** (replaces register + `/start`): 1) choose/create a vault folder (detect an existing Obsidian vault by `.obsidian/` and offer a `BiliMind/` subfolder), 2) name + optional publishing handle (validated with the PLT-06 regex `^[a-z][a-z0-9]*(?:[_-][a-z0-9]+)*$`, 3–30 chars; `Username.normalise()` + `suggestFor()` ported to suggest from the OS username/name), 3) add at least one provider (or detect Ollama at `http://127.0.0.1:11434`), 4) default content language. If the user typed a topic before finishing (hero field / `bilimind://new?topic=`), keep it on screen through onboarding and run it at the end — the `/start` "keep the sentence" behaviour.
- **Reading preferences** keep the two-layer model: vault default in `.bilimind/config.json` (`reading`), per-window session override, "Set as default" writes the file. Same clamps (0.75–1.6, step 0.05; fonts sans|serif; themes paper|warm|dim with the same swatches).
- **Multiple vaults** replace multiple organizations and "switch org" (PLT-36/37): recent vaults list in app settings, File → Open/New vault, one window per vault.
- Optional **app lock** (OS-auth / passphrase) replaces sign-out for shared computers.

### 12.2 BYOK, model routing, cost meter, budgets (PLT-12…25)
Everything about plans, checkout, Paddle/Stripe, webhooks, top-ups, rollover, cancel/resume, grace periods, `usage_meters`, `usage_topups` and `organizations` is dropped. The user value they carried — "know how much is left before you hit a wall, and have a way out" — is kept as a dollar budget on the user's own keys.

**Providers + secrets (PLT-23 expanded)**
- Providers: `openrouter`, `openai`, `anthropic`, `gemini`, `ollama` (+ `openai-compatible` custom base URL, which also covers DeepSeek direct). Per provider: `{enabled, base_url, key_ref}`; the key itself lives in the OS keychain (Electron `safeStorage` / keytar; service `BiliMind`, account `provider:{id}`), NEVER in the vault (vaults get synced and shared). Linux without libsecret → encrypted file in `userData` with a visible warning. Env overrides (`OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`/`GOOGLE_API_KEY`, `OLLAMA_HOST`) for power users.
- Replace the `^sk-…{16,}$` regex (wrong for Anthropic `sk-ant-…`, Gemini `AIza…`, Ollama none) with a **Test connection** button (cheap list-models or 1-token call) that reports "OK · 214 models" or the provider's error. Keep the write-only UX: after save only `last_four`, `label`, `added_at`, `last_used_at` are shown. Keep "one active key per provider" but allow several saved (activate/remove as in PLT-23).
- `llm:ping` (PLT-59) becomes this button plus `bilimind ping --stage expand_node` in the CLI.

**Model routing (replaces OwnKey, PLT-24)**
- One resolver, same discipline as `OwnKey` ("decided here and nowhere else"): `route(stage) → {provider, model, key}`. Stages = the `GenerationStage` enum: `clarify, outline, expand_node, regenerate, rewrite_block, grade, schedule, illustrate` (+ assistant, speech, research as other slices define). Two presets mirror the web tiers: `flash` (default for everything) and `pro`; per-stage override in Settings. Default suggestion: OpenRouter `deepseek/deepseek-v4-flash` (measured ≈ $0.0022/lesson) and `google/gemini-2.5-flash-image` for illustrate ($0.0387/image).
- Capability matrix decides availability: illustrate requires an image-capable route (OpenRouter image models, OpenAI images, Gemini image); Anthropic/Ollama have none → the illustrate stage shows "Pictures need an image-capable provider" instead of failing jobs. Queued jobs carry their resolved route (like the course-owner rule) so a settings change mid-batch does not silently switch models.

**Ledger = the cost meter (PLT-25, surfaced)**
- Append-only JSONL per device and month: `<vault>/.bilimind/ledger/{deviceId}/{YYYY-MM}.jsonl` (per-device files avoid sync conflicts). One line per LLM/image call, success or failure:
  `{ts, run_id, course_uuid, node_key, stage, provider, model, status:'success'|'failed', input_tokens, output_tokens, reasoning_tokens?, cached_input_tokens?, images?, cost_usd, cost_source:'reported'|'estimated'|'free', duration_ms, attempts, error?}`.
- Cost: OpenRouter `usage.cost` (measured, as today); OpenAI/Anthropic/Gemini from token usage × a price table (bundled JSON, refreshable from OpenRouter's public models endpoint, user-editable per model, `pricing_fallback` 0.55/2.19 per 1M as now); Ollama = 0 with tokens and time still recorded. Retries are summed into the same line (as `LlmClient` does).
- A SQLite cache (rebuildable from the JSONL) powers: status-bar meter ("October $0.43 · this course $0.12"), a **Usage** screen (by month, course, stage, model; tokens and time; CSV export), and per-course totals mirrored into the course sidecar (`cost_usd_total`).

**Budgets (replace PLT-13/14/16/17)**
- Settings: `monthly_usd` (optional), `per_course_usd` (optional), `confirm_above_usd` (default e.g. $0.50 per action), `images.max_per_course` (default 8 — keep: "about how many pictures a lesson should have, not money").
- Pre-flight estimate before expand/regenerate: `requested lessons × median cost per lesson for this route from the ledger` (fallback: tokens heuristic 10k in / 6.4k out × price). Confirm dialog only above `confirm_above_usd`.
- Keep the **refusal shape** so ported UI code needs little change: `{error:'budget_reached', scope:'month'|'course', limit_usd, used_usd, remaining_usd, requested_estimate_usd, resets_at}` with copy that names the ways out (raise the budget, switch the stage to a cheaper model, use Ollama, or wait for the 1st). Keep `Allowance.toArray()`'s fields in dollar terms (`plan_limit`=budget, `plan_used`=spent, `remaining`, `percent_used`, `unmetered`=no budget set) and the **80 % "running low"** warning.
- Charge lifecycle becomes estimate → actual. Unlike the web (refund on failure), a provider still bills a failed call; show it honestly on the failed-lesson card ("This attempt cost $0.002") instead of "It does not count against your lessons". Never auto-retry a failed lesson more than `llm.max_attempts` (3) without the user.
- Material storage quota (PLT-15) dropped; keep a per-file ingestion guard (default 200 MB, configurable) and show vault size in Settings → Vault.
- Imagery circuit breaker (`provider_halted` + 6 h cooldown) kept per provider so one outage does not burn a batch.

### 12.3 Sharing → export / publish / packages (PLT-26…35, 63)
- **Share a course with another BiliMind Desktop user**: `.bilimind` package = zip of the course folder + `manifest.json` `{format:'bilimind-course', version:1, exported_at, app_version, course:{uuid, slug, title, language, level}, includes:{progress:false, annotations:false, materials:false, answer_keys:true}}`. Import creates a new course folder (new uuid unless "replace"). This is the closest equivalent of the share link, and it works offline / by email / via chat.
- **Publish as a static site** (replaces is_public + canonical URL + /explore + sitemaps + IndexNow): render the course with the PLT-30 projection rules (live assessments only, no progress/attempts/annotations/private materials; already-generated illustrations and attachments included; never triggers generation) to `<out>/{handle}/{slug}/index.html` + one anchor per lesson (`#{node.key}`) or one page per lesson, plus `index.html` for the handle (the per-user "explore"), `sitemap.xml`, `robots.txt`, OG image (port `og-card.ts`), JSON-LD `Course` with `hasCourseInstance` + free `Offer` + `syllabusSections`. Keep the quality gate: courses with <4 written lessons get `noindex` and are left out of the sitemap (same constant as `INDEXABLE_MIN_LESSONS`).
  - Targets: local folder (default), GitHub Pages (git push with the user's token), Netlify/Cloudflare Pages (their CLIs/APIs with user tokens), or "zip for anything". Optional IndexNow (user key + host) after a deploy; optional search-console verification tags in site settings.
  - Assessments on a static site: choice of "self-check" (answers embedded, revealed on submit — answer keys DO reach the reader) or "questions only" (answer keys stripped, like the web projection). Make the choice explicit; the web never had to decide this because grading ran on the server.
  - Publish record in the course sidecar: `published:{target, url, handle, slug, first_published_at, last_published_at, mode:'self_check'|'questions_only'}`. **Slug freezes once published** (PLT-31): renaming the course renames the folder/title but keeps `published.slug` unless the user explicitly re-slugs ("this breaks links already shared"). **Unpublish** (missing from the web UI) is a first-class button: removes the deployed folder and clears `published`.
- Other exports (all from the same projection): single-file HTML, PDF, EPUB, Markdown zip (the vault folder is already this), Anki `.apkg` from review items, SCORM 1.2/LTI later for the enterprise/LMS track.
- Legacy redirects (PLT-28/63) dropped; desktop deep links `bilimind://course/{uuid}[?node={key}]` and `bilimind://new?topic=…&level=…` replace them (also used from published sites: "Open in BiliMind").

### 12.4 Teams, roles, Telegram, mobile (PLT-10, 11, 36…39)
- Organizations, memberships, invites and roles are dropped (in the web they only pooled billing; courses were always per-user). Collaboration = a shared/synced vault folder (Syncthing, Dropbox, Git, Obsidian Sync) or exchanging `.bilimind` packages; an instructor publishes or sends packages to students.
- Telegram Mini App auth and Capacitor are dropped. The mobile story is "the vault is plain markdown": lessons must degrade gracefully in Obsidian mobile (assessments as readable callouts, `> [!question]`, answers in collapsed `> [!success]-` callouts). A later companion app can read the same vault.

### 12.5 Notifications (PLT-40…43)
- Main process owns a local inbox (`userData/notifications.jsonl`, same row shape `{id, type, title, body, payload, read_at, created_at}`) and pushes to the renderer over IPC — no 45 s polling. Keep the bell, unread dot, optimistic mark-read, "mark all read".
- Implement the types the web defined but never wrote: `course_ready` ("Your course on X is ready — 14 lessons"), `course_failed`, plus `batch_finished` (N lessons written, $cost) and `budget_low`. Use OS notifications (Electron `Notification`) when the window is unfocused; clicking opens the course/lesson via the deep link.
- **Daily digest**: same algorithm as `DailyDigestJob` (recompact active, on-shelf schedules; silent when nothing due; due vs overdue split; same title/body copy; idempotent per local date). Fixes: fire at the user's chosen LOCAL time (default 08:00) instead of server time, and **catch up on launch** if the app was closed at that time. Optional: write it as an Obsidian daily note `<vault>/Daily/{YYYY-MM-DD}.md` (folder configurable, or append to the user's existing daily-notes folder) with a task list linking to lessons (`- [ ] [[Course/Lesson]] (15 min)`), so ticking the box in Obsidian is visible to BiliMind via the file watcher.
- **Failure copy** (PLT-42): keep `FailureNotice`'s friendly sentences, but the "never name the vendor" rule inverts — the user owns the key, so actionable causes must be named: 401/403 → "Your {Provider} key was rejected. Check it in Settings → AI providers."; 402/insufficient credit → "Your {Provider} account is out of credit."; 429 → "{Provider} is rate-limiting this key — retrying in Ns." (auto, respecting `Retry-After`); offline → "You're offline — the queue will resume when you're back."; timeout → SLOW sentence; schema/shape → SHAPE sentence. Raw provider text goes in an expandable "Details" and in the ledger `error`.
- Toasts (PLT-43) port as is (tones, 4200/7000 ms, Undo actions).

### 12.6 Language, time, theme (PLT-44, 45, 47)
- Add real UI i18n (vue-i18n/i18next JSON catalogs; ship `en`, accept community locales; RTL for `ar`). Keep UI language separate from **content language** (default for new courses; the 15-language create list; `languageName()` map).
- Timezone from the OS; "today", overdue and review due dates use it.
- Theme: `light | dark | system` (web lacks "system" as an explicit choice), persisted in app settings, not localStorage.

### 12.7 Settings window (replaces `/account`, PLT-46)
Sections: **General** (name, handle, UI language, default content language, timezone read-only) · **Vault** (location, open/switch/new, folder layout, size, reindex, open in Obsidian) · **AI providers** (keys, base URLs, test connection, Ollama detection) · **Models** (flash/pro presets, per-stage routing, capability warnings) · **Usage & budget** (meter, monthly/per-course caps, confirm threshold, price table, CSV export) · **Images** (enable, model, max per course) · **Reading** (scale/font/theme default) · **Appearance** (theme) · **Notifications** (digest time, OS notifications, daily note on/off + folder) · **Publishing** (handle, default target + credentials in keychain, self-check vs questions-only, IndexNow key, verification tags) · **Privacy** (no telemetry by default; opt-in crash reports) · **Advanced** (concurrency, timeouts 300 s / connect 15 s, max attempts 3, temperature 0.6, max output tokens 32768, logs folder). Deep-linkable sections (`bilimind://settings/{section}`), like `?section=`.

### 12.8 Library, trash, archive, drafts on disk (PLT-48, 55…57)
- Course = folder in the vault with a sidecar (`course.json`) — exact layout belongs to the storage slice. Platform rules to honour:
  - **Archive** = `archived_at` in the sidecar/frontmatter (optionally move to `Archive/`); off Today/review/digest; published site untouched.
  - **Trash** = move the folder to `<vault>/.trash/` (Obsidian's own trash folder) and record `{original_path, deleted_at}` in `.bilimind/trash.json`; Restore puts it back; **Delete forever** is the only confirm dialog and sends it to the OS recycle bin (`shell.trashItem`) rather than unlinking; purge after 30 days runs on launch + daily (one course at a time, failures logged and skipped).
  - **Drafts** = `<vault>/.bilimind/drafts/{uuid}.json`, shown in the "Pick up where you left off" strip; pruned after 30 days untouched, or 1 day after the course reached `outlined|ready`.
  - Library chips/filter/undo toasts port unchanged (they are client logic).
- **Revision thinning** (PLT-56) applies to whatever history store the editing slice picks (snapshots or git): keep everything <90 days, then newest 20 + regenerate/restore boundaries + last per day + current.

### 12.9 Background work, search, limits, diagnostics (PLT-58…62)
- **Scheduler** in the main process (timer + "on launch" catch-up): digest at local time, drafts prune, revision thin, trash purge, ledger rollup. No monthly rollover.
- **Job queue**: persistent (SQLite) and resumable after quit/crash; a job records `attempt_id` + status so a resume never re-sends a paid call that already succeeded (the web's double-run bug class). Concurrency per provider (default 2–4) replaces server rate limiters; honour `429` + `Retry-After`, exponential backoff. Generation/expand/regenerate refuse archived/trashed courses (as today).
- **Search**: a file watcher (chokidar) replaces `SearchIndexObserver` and also catches edits made in Obsidian; SQLite FTS5 index (unicode61 + remove_diacritics, no stemming — mirrors Postgres `simple + unaccent`) is a disposable cache; "Rebuild index" replaces `search:reindex [--verify]`.
- **Repair actions** replace operator CLIs: course menu → "Break steps into lessons again" (`course:subtopics`), "Refresh link previews" (`resources:enrich`); also exposed through a `bilimind` CLI that operates on a vault path (useful for headless/CI generation).
- **Diagnostics panel** replaces the absent admin: provider status, last errors (ledger), logs folder, app/vault versions, "copy debug info".

### 12.10 Dropped from the app, moved to the project site/README
Marketing landing, features/how-it-works/pricing/about/for-institutions, SEO landers (ai-course-generator, ai-quiz-generator, pdf-to-course, study-plan-generator, exam-prep), `/vs/*` comparisons, legal pages, `/explore` as a hosted catalogue, sitemaps for the product site, search-console tags, `/checkout`. The 32 `/learn` roadmaps move INTO the app as offline templates ("Start from a roadmap": topic = "Learn {subject}", stages pre-seeding the outline). Guides become in-app Help pages.

### 12.11 Improvements over the web version (summary)
1. Real per-call cost visible to the learner (web kept `generation_runs` operator-only), per-course totals, CSV export.
2. Pre-flight cost estimate + user-defined budgets instead of opaque lesson counts; Ollama for zero-cost.
3. Per-stage model choice across five providers (web: one provider, two tiers).
4. Digest at local time with catch-up, OS notifications, Obsidian daily-note integration; `course_ready/failed` notifications actually implemented.
5. Publish/unpublish both in the UI (web had no unpublish button), deploy targets, explicit answer-key policy, `.bilimind` packages and Anki/PDF/EPUB export.
6. Real UI i18n + RTL; OS timezone (web had no timezone UI); explicit "system" theme.
7. Offline-first, file-owned data, sync with any tool; trash goes to the OS recycle bin.
8. No account wall anywhere; onboarding keeps the typed prompt.
9. Avoid copying known web drift: team role vocabulary mismatch, missing `organization.role`, unused config keys (`bot_username`, `mini_app_url`), unused notification types.
