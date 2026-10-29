# CLAUDE.md

# Kinika

The workspace that knows your business. Kinika understands a business, writes its plan, hires agents for the work, and the founder approves.

Last Updated: 29 October 2026

Design source of truth: the "Kinika — full flow v1" canvas (https://claude.ai/artifact/SYEctJAfdTd5JyZ5JsBJXm) and the research + decision log (https://claude.ai/code/artifact/39339aa1-f925-4a91-b069-c6c89f2d576e). When this file and those disagree, the decision log wins; update this file.

---

# What is Kinika?

Kinika is for shops, services, consultants, creators and people who are just starting — not only "builders".

The founder hands over operations and runs the business by talking to Kinika: it reads what comes in (email, Slack, social comments), drafts what goes out, reports, keeps the plan current, and asks before anything is sent, published or changed.

Replaces the pile of ChatGPT, Canva, Notion, Docs, Hootsuite, Buffer, CapCut and brand PDFs with one workspace that remembers.

The long-term vision:

> Every founder should have an operating system that understands their business better over time.

---

# Framing (locked 10 Oct 2026)

**Kinika is the business manager. Agents are Kinika's staff.**

* Kinika understands the business, writes and revises the plan, names the roles it needs, staffs and briefs them, reports back, remembers everything, and is the only one the founder talks to. Kinika never does the specialist work itself.
* **Staffing is Kinika's, not the founder's (locked 28 Oct 2026).** The founder sets the work up ("Set up" on an agent task, "Start with Kinika" on their own); Kinika picks the role from the task and puts it on the team itself when a seat is free (`ensureStaffed`, hired_by "kinika", told after the fact). There are no hire buttons on the plan. Seats are shown only at the moment they bind: on the trial ("Kinika would run this with the Copywriter; your trial has no seats yet: do it with Kinika, or add a seat") and when every seat is busy ("pause one on Kinika's team, or add a seat"). Kinika's team is a roster view of who is on the team because of which tasks, with pause and stop; adding an agent by hand stays possible there but is not the main path.
* Agents do tasks on surfaces. The founder watches, takes over, approves, or leaves a note on the work. Feedback goes to Kinika or onto the work, never a chat with an agent.
* Chips read "Researcher · on Kinika's team". The team page is "Kinika's team". The input box is "Tell Kinika". Never ask the founder to hire; the verb on their side is "Set up".
* **No pronoun for Kinika, ever.** Not "she", not "it" as a subject. Write "Kinika".

## Vocabulary (use these five; introduce any other term on the screen where it first does something)

Kinika · your plan · Kinika's team · agent · brand

Retired from first-run screens: Mentor, Journey Record, stage, captured, DNA, alignment score, workflow, hive, Describe it.

## Two currencies, never mixed

* **Seats** = how many agents can be on the team at once.
* **Credits** = how much work gets done.

Never say "budget" for both. "This plan needs three roles. Your plan has one seat." vs "This task will use about 3 credits."

---

# The first run (every founder)

Understanding comes before anything else. Nothing else in Kinika exists until step 3 is approved.

1. **Tell Kinika about your business** — one question in plain words; situation chips (thinking of starting · already running · creating content and an audience · something else) are a hint, not a gate.
2. **Connect what Kinika will run** — website (read), email, Slack, Instagram, TikTok, Notion, Shopify, WordPress, GitHub. Connections are real OAuth, kept, read *and* write. Each shows its permission in plain words. Skip is always available; connect later from the plan. ("Thinking of starting" goes to 2b: a loose goal and a business-development road instead.)
3. **Your business, as Kinika understands it** — the trust moment. Headings fit the business type; each section says where it came from and how sure Kinika is (sure · fairly sure · a guess); every line editable. "Yes, that is my business" writes the brand record.
4. **What do you want to achieve?** — three suggested goals from the understanding, or their own words; loose is fine.
5. **Kinika writes the plan** — targets, tasks, and the roles Kinika would hire.
6. **Your plan and Kinika's team** — on the trial: "Kinika would run N of these tasks with agents. Your trial has no seats yet." with Add seats or "I'll do them with Kinika for now" (the card collapses; the founder works the plan with Kinika). Agent tasks stay visible as the reason to upgrade.
7. **Seats** — the founder presses Set up on a task; Kinika staffs it. Fewer seats than roles: Kinika staffs in plan order and says so the moment a seat binds.
8. **Workspace** — the agent works where the founder can see it; approval happens *in the workspace*, never on a separate page.
9. Kinika's one-time note after the first approval ("That is how Kinika's team works").
10. **Home** — today on the plan first, then what waits for you, Kinika's team, brand and outputs. Sidebar: Home, Your plan, Kinika's team, Kinika, Brand. Studio, Calendar, Documents, Reels and Library appear on first use. No tour, no modal, no blank screens.

Activation on the paid path = the first approved agent result. On the trial, the plan is the product.

---

# Core Product Pillars

## 1. Understanding first

The brand record (brands, brand_dna, brand_stage_data, brand_memories) is what every agent reads. It is built from the founder's words, connected tools and documents, shown back for approval, and compounds with every run.

## 2. Human-editable AI

AI generates. Humans edit. Any element an agent made can be taken over mid-run; the agent never overwrites the founder's edits. Every generated asset is editable.

## 3. Structured generation

Copy, visuals, campaigns, strategies, reels and documents are structured editable objects: scenes, nodes, layouts, assets, blocks. Never text blobs.

## 4. Approval is what makes hand-over safe

Connections have three permission levels: **read · draft · act after your yes**. A fourth, *act without asking*, is per action class, off by default, Enterprise-only at first. The approve step is never removable for anything that sends, publishes or changes a connected system. This is never loosened for growth.

## 5. Context persistence

The more a founder works in Kinika, the better Kinika knows the business.

---

# The workspace

* **Opens only from a plan task.** There is no blank surface anywhere in Kinika.
* **One shell, surfaces by output type**: Canvas (designs, UI, social visuals — the scene editor), Document (reports, briefs, contracts), Board (workflows that run on a schedule or event: monitor → summarise → draft → approve → publish/report). Table later if needed. Studio, DocStudio, Calendar and ReelBuilder become surfaces inside this shell, not pages.
* **Shell**: top-left who is working and on what, with Take over; top-centre the surface's own tools; top-right History, Share, Approve. Left rail: the plan task this work comes from, what Kinika is using, versions, Tell Kinika.
* **Tabs are outputs, not agents.** A task with several outputs opens one workspace with a tab per output, each naming its agent.
* Anything an agent cannot decide (a price, a date) becomes a "your decision" chip. Never an invented number.

---

# Current systems

* **Kinika (chat)** — `mentor_*` tables and `src/pages/Mentor.tsx`. Sees the plan; edits it from conversation via `<PLAN_EDIT>` ops.
* **Needs raised in the conversation (locked 16 Oct 2026)** — hiring need is *discovered* in the task conversation and *confirmed* in one card that looks the same everywhere. Kinika never invents or waits on a person who is not in the room, never does specialist work itself, and puts such work in `needs` on the state line (role · label · why · brief), pinned to the deliverable. The card has three doors: let Kinika hire the role (seat flow; on the trial, the upgrade moment with context), bring your own person and paste their text, or have Kinika write the brief for them. Documents never contain placeholder brackets; undecided items are "Your decision: …" lines. Second slice (16 Oct 2026): a deliverable can be handed to an agent from the card; the run is created in place (`createRun`, hire first if the seat flow allows) and stored on the deliverable (`run_id`, `agent_slug`, `agent_name`); it lands as a tab in the same workspace (`RunTab`) with the agent's steps, output and the approval; approving marks the deliverable done with the output as its outcome. The Legal drafter agent (`legal_drafter`, action `agent_legal_draft`) exists; every draft opens with "Draft for review with a licensed lawyer. Not legal advice." and lists the founder's decisions and the lawyer's review points.
* **Founder tasks with Kinika** — a task the founder owns opens `/work/:taskId` as a conversation with Kinika (`FounderWorkspace`, `TaskChat`). Kinika first breaks the task into 2–5 deliverables (`founder-plan` action `breakdown`, stored on `plan_tasks.deliverables`); one conversation per task (`mentor_conversations.plan_task_id`). Kinika ticks a deliverable with `<DELIVERABLE_DONE id/>` and writes documents with `<DOCUMENT title>`; a document takes the surface and the conversation slides to the side. The task is done when every deliverable is.
* **Plan** — `brand_plans` (several per business, one `is_current`; each carries the `goal` it was written for; New plan on the plan page asks only for the goal since Kinika knows the business), `plan_targets`, `plan_tasks`; `founder-plan` function; playbooks (idea · running · creator); milestone- and stage-driven revisions; weekly check-in (daily once connections exist).
* **Approval decisions (16 Oct 2026)** — one control everywhere (`ApprovalActions`): Approve · Send back for changes (note required; the runner adds a revision step that reruns the agent with its previous result and the note, reserves another quote, and asks again; "Round n" on the result) · Stop (ends the run; captured credits stay captured). `approvals.status` includes `revise`.
* **Agents and runs** — `agents`, `agent_hires`, `automations`, `automation_runs`, `automation_run_steps`, `approvals`; `run-step` runner (tick every minute via pg_cron); action classes; build-first PRs; team memory.
* **Connections** — `tool_connections` + Vault secrets; connectors for Notion, Shopify, WordPress, GitHub, Ayrshare (social).
* **Universal OAuth (29 Oct 2026)** — no per-provider connector code for sign-in. An admin adds a provider in Admin → Connections (`oauth_providers`: authorize/token/userinfo URLs, scopes, extra params, PKCE, token auth, client id; the client secret goes to Vault through `set_oauth_client_secret`; presets in `_shared/oauth.ts` for Meta, Google, Slack, TikTok, LinkedIn, X, Notion, GitHub), presses "Verify by signing in" (`oauth-start` mode verify → the provider → `oauth-callback` records who signed in and the granted scopes on the row, status verified) and then Go live. Founders see "Connect <name>" with the permission in plain words (`ConnectProviders`) on the first run step 2 and on Kinika's team; connecting opens the provider in a popup (`oauth-start` mode connect, owner only, provider must be live), the callback writes a `tool_connections` row (`config.oauth_provider_id/key/account/granted_scopes`, `provider` = the connector it drives or the key) with the token in Vault via `store_connection_secret`, and `/oauth/done` tells the opener. One redirect URI for every provider: `<supabase url>/functions/v1/oauth-callback`. Adapters get a fresh token with `getOAuthAccessToken(admin, connectionId)` (refreshes through the provider when about to expire). Reading Gmail, Slack, Instagram etc. through these tokens is the next slice (watch triggers).
* **Social audit from connections (to do, after the current slices; decided 29 Oct 2026)** — when a task needs facts about the founder's own accounts (follower counts, engagement, which platform to focus on), Kinika must not ask the founder to type them. The task conversation offers "Connect your social": the founder picks the accounts, Kinika reads them through the kept connection and runs the audit itself, writing the numbers into the deliverable with their source. Chosen numbers stay "Your decision" lines; read numbers never do.
* **Brand record** — `brands`, `brand_dna`, `brand_stage_data`, `brand_memories`; `buildContextPack`.
* **Editor** — Scene → Nodes → Assets. Everything stays editable. Autosave exists; version history uses snapshots and diffs, never a version per keystroke.
* **Prompts (rule, 16 Oct 2026): no prompt text in code.** Nothing that instructs a model is written in TypeScript. Every prompt is a key in `_shared/prompts.ts` (`PROMPT_REGISTRY`: metadata only: name, where it runs, task type, placeholders, `fixed` when the parser depends on its shape) and its text lives in `ai_system_prompts`, managed in Admin → Prompts (text, further instructions, training examples, model flow, class, history). The seed migration wrote the first versions. `loadPrompt`/`loadPrompts` (server) and `getSystemPrompt`/`requirePrompt` (browser) compose text + instructions + examples; a missing prompt throws `PromptMissingError` ("Prompt x is not set. Open Admin → Prompts"), never a fallback. Helpers like `taskPromptBlock`, `buildTaskPrompt`, `playbookBlock`, `agentsBlock`, `planPromptBlock`, `plannerSystemPrompt` take their text as arguments and only assemble data into it. Data labels that name fields (e.g. "RECORDS (12):") are code; sentences that tell the model what to do are prompts. Agents' own prompts are on `agents.system_prompt`, edited on the same page. Adding a feature means adding a registry entry and a seed row, never a string.
* **Narrated progress (28 Oct 2026)** — long waits show the real steps, never timed phases. `_shared/progress.ts`: a function plans its steps (the to-do list) and marks each doing/done/failed/skipped with a plain-words note. Two sinks: streamed NDJSON on the response for work the browser waits for (`narratedResponse(req, …)`: the read-back, the plan, the breakdown; sent only when the client asks with `Accept: application/x-ndjson`, otherwise plain JSON) and `storedNarrator` writing `mentor_conversations.progress` for task chat, which the browser already polls. Browser: `postNarrated` (`src/services/narrated.ts`) and `ProgressSteps` (`components/ui/progress-steps.tsx`), used by the first run, the workspace rail, task chat and the run tab (the runner's pre-planned steps are the list there). `ThinkingLine` remains only on the Kinika page, where tokens stream.
* **Set up, in the board (29 Oct 2026)** — Set up on an agent task opens the board itself, `/board/new?task=…` (`src/pages/BoardSetup.tsx`), never a dialog or a page of fields. The sheet (`components/work/BoardCanvas.tsx`: pan, zoom, fit; nothing is dragged, the layout is Kinika's) is never blank: Kinika's cursor is on it and a Tell Kinika conversation sits beside it. `founder-plan` action `plan_board` (prompt key `plan_board`, task type `plan_automation`, narrated) returns the same `PlanDraft` Describe it produces, plus the role, one clarifying question with chips only where the design forks (each chip a `DraftPatch` applied in the browser, no second call: `_shared/boardDraft.ts`) and what must be connected (`boardNeeds`: the recipe's provider required, others helpful, each marked connected). As the steps stream, the cursor's label is the current step; when the draft lands, the cursor moves to each circle and places it (`draftBoardCards` + `BoardPicture`), then the sentence writes itself. The question, the needs and the price arrive as Kinika bubbles; the founder's messages redesign the board. Run once / Set up and run once sits top right where Approve sits elsewhere: it staffs every role on the draft (`ensureStaffed`), creates through `executeDraft` (createRun / createAutomation), links the task and opens the work or the standing board. Describe it on the team page is the manual fallback ("Describe it yourself instead").
* **Watch triggers (29 Oct 2026)** — a board can begin when something new arrives in a connected system: `automations.trigger_type = 'watch'` with `watch` jsonb (source, connection_id, options, interval_minutes, cursor, started_from). Sources are a catalog in `_shared/watch.ts` (`WATCH_SOURCES`: gmail_inbox, slack_channel, shopify_orders, wordpress_comments, github_issues; each names the `tool_connections.provider` it reads through, its noun and its interval) with one reader per source returning items in one shape (`WatchItem`). The runner's tick (`watchDue` in run-step) takes boards whose `next_watch_at` has passed, reads what is newer than the cursor (at most three items a tick), queues one run per item (`external_event_id = watch:<item id>`, the item in `input.event` and appended to the brief by `itemForBrief`), moves the cursor, and backs off on a read error (`last_watch_error`). No new polling: the existing minute tick does it, each board on its own interval. The planner proposes `schedule: "watch"` with `watch.source` only from the sources the workspace's connections allow (`{{sources}}` in the plan_board and automation_planner prompts, `PlannerContext.sources`, `coercePlanDraft`). "Start from": at set-up, `watch-source` (actions sources, peek) returns the last real item; the founder chooses "Start from this one" (the first run works on it, the cursor begins after it) or "Only what arrives from now". OAuth-based sources get their token through `getOAuthAccessToken`.
* **Model routing** — `ai-gateway`; admin-managed task types, classes, profiles, failover. Understanding and plan building run on the reasoning class.
* **Support (planned)** — a floating support chat, reachable from anywhere. The first caller is the first run: when the read-back fails twice, "Contact support" dispatches the `kinika:support` event (`src/services/supportService.ts`) with where, the problem and context; the chat calls `preventDefault` when it opens. The read-back never drops the founder's sources: Kinika's memory of the business is built from them.

---

# Billing

Wallet-based. Credits are the usage currency (wallets, wallet_transactions, generations, generation_billing_events, credit_packages). Reservation billing: reserve → AI call → capture → complete; failure before the call releases, after the call stays captured.

Seats live on the subscription (`extra_agent_seats`, `effectiveLimit("agents")`).

## Plans

* **Free trial** — plans and consultation, **no agent seats**. 50 credits fund understanding, the plan, revisions and Kinika; they do not fund agent runs. Agent tasks stay visible in the plan as the reason to upgrade; Kinika says so inside the plan, never a wall.
* **Solo** — 1 seat; Kinika staffs one role at a time. [price and credits TBD]
* **Startup** — 3 seats; all roles at once; invite 2 people. [price and credits TBD]
* **Enterprise** — seats per business, several businesses, act-without-asking on chosen classes, own connectors.

Billing and credits are always server-verified.

---

# Design language — Theme A (locked)

Dependable software, not a magazine.

Tokens: canvas `#F5F7FA` · surface `#FFFFFF` · ink `#0B1220` · text `#3F4756` · muted `#5B6472` · border `#DDE3EC` · divider `#E9EEF4` · primary `#1E4ED8` (white text) · primary text `#1E40AF` · primary soft `#EAF0FF` with border `#C7D7FF` (active nav, tabs, selection) · rail `#F0F3F7` · good `#157347` on `#E6F4EC` · needs-you `#8A5A00` on `#FFF1D6`.

Type: headings Plus Jakarta Sans 600; body DM Sans.

Rules: status colours (green done, amber needs-you) are never used for decoration; no AI-specific colour or gradients; text contrast ≥ 4.5:1; buttons name the result ("Write my plan", "Approve the brief"), never "Submit"; costs shown before the click in credits with the balance after; every empty state has three lines (what appears here, how it gets here, one action).

Avoid: gradients, neon, gaming UI, serif display type, warm cream/gold (retired).

---

# Mobile

Desktop-first. Separate DesktopShell and MobileShell; do not patch responsive bugs one by one. First-run screens are single-column and work at 320 px.

---

# Technical principles

1. Never break existing flows; backward compatibility matters.
2. Avoid duplicate systems; extend what exists (wallets, generations, assets, scenes, versions, plans, runs, connections). Check before adding a table.
3. Business logic in service layers, not components.
4. Database truth; frontend state is never the source of truth.
5. Optimistic UI carefully; billing always server-verified.
6. Production is on nano compute: no new polling; use the visible-tab interval; the tick does the work.
7. Secrets never reach the browser or the repo. Paste-ready SQL files in `supabase/sql/` are filled in locally by the user; stage commits by path, never `git add -A`.

# AI principles

Every AI interaction consumes context, produces structured output, improves memory, and stays editable. Nothing an agent makes is a dead end.

---

# If you are a new developer

Understand first: the brand record and `buildContextPack`; the plan and `founder-plan`; the runner (`run-step`), approvals and action classes; wallet billing and seats; the scene editor. Read the decision log linked at the top before changing a flow.

When unsure: preserve user data, editability, context and billing integrity. Kinika is optimised for long-term understanding, not one-time generation.
