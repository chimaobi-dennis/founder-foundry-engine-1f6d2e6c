# Kinika

**An AI operating system for small businesses. Kinika learns the business, writes the plan, hires AI agents for the work, and asks before anything is sent, published or changed.**

Live at [www.kinika.app](https://www.kinika.app). Kinika is in early testing: the current users are testers, and billing runs in Stripe test mode.

## The idea

Most founders stitch together ChatGPT, Canva, Notion, Docs, a scheduler and a folder of brand PDFs, and none of them remember the business. Kinika replaces that pile with one workspace that does.

1. **Tell Kinika about your business.** Kinika reads your words, your website and the tools you connect, then shows back "your business, as Kinika understands it", with a confidence level on every line. Nothing else exists until you approve it.
2. **Kinika writes your plan.** Targets, tasks, and the roles Kinika would hire to do them.
3. **Kinika's team does the work.** Agents (an SEO specialist, a developer that opens pull requests, a designer, a legal drafter and more) run tasks on connected systems while you watch, take over, or leave a note.
4. **You approve.** Anything that sends, publishes or changes a connected system waits for a yes. This step is never removable.
5. **Kinika remembers.** Every run adds to the brand record, so the next one starts smarter.

Two currencies are always kept apart. **Seats** are how many agents can be on the team at once. **Credits** are how much work gets done, and the cost of every run is quoted before it starts.

## What is in this repository

| Area | What it is |
| --- | --- |
| Plan and first run | Understanding read-back, plan builder, plan revisions, weekly check-in |
| Kinika chat and tasks | A conversation per plan task that breaks work into deliverables and writes documents |
| Agents and runs | Agents, hires, automations, a step runner, approvals with send-back-for-changes, team memory |
| Connectors | Shopify, WordPress, Notion, GitHub (pull requests on a protected branch prefix), Ayrshare social publishing, a single-table Postgres connector |
| Creative studios | Scene-based editor (Scene, Nodes, Assets), content studio, logo studio, campaign kit, calendar, reels, document studio, version history |
| Billing | Wallet and credits with reserve, capture and release; plans, seats and top-ups on Stripe; per-run quotes |
| AI gateway | One edge function in front of every model call: routing, failover, usage log, cost accounting |
| Marketplace | Creators can write and publish agents and templates, with an admin review step |
| Admin | Users, billing and pricing, AI models, prompts, agents, templates, error logs |

## Tech stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui (Radix), React Router, TanStack Query
- **Backend:** Supabase (Postgres with row level security, Auth, Storage, Vault, pg_cron) and Deno edge functions
- **Payments:** Stripe (Checkout, subscriptions, webhooks)
- **Hosting:** Vercel for the frontend, Supabase for everything else
- **Tests:** Vitest for unit tests, plain SQL tests for the billing functions

## Repository layout

```
src/pages/            route screens, including src/pages/admin
src/components/       UI, grouped by area (shell, plan, work, workspace, billing, team ...)
src/services/         all data access and business logic; components stay thin
src/config/           Supabase connection settings
src/test/             Vitest unit tests
supabase/functions/   edge functions (ai-gateway, run-step, founder-plan, understanding,
                      task-chat, connector-action, webhook-trigger, create-checkout-session,
                      manage-subscription, stripe-webhook) and _shared/ modules
supabase/migrations/  versioned migrations
supabase/sql/         paste-ready SQL for the Supabase SQL editor
supabase/schema/      snapshot of the live public schema, for reference only
supabase/tests/       SQL tests for billing
CLAUDE.md             product and architecture rules
ROADMAP.md            what is done and what is next
```

## Running it

You need Node 20 or newer and npm. From the project folder:

```bash
npm install
npm run dev
```

The app opens on the Vite dev server. It reads its Supabase URL and public key from `src/config/supabaseConfig.ts`, which currently points at Kinika's own project and takes precedence over `.env`. To use a different project, change the two `EXTERNAL_SUPABASE_*` constants there, or set `window.__KINIKA_SUPABASE__ = { url, anonKey }` before the app loads. `.env.example` lists the matching environment variables for when that order is flipped (see the [roadmap](ROADMAP.md)).

To build for production, run `npm run build`.

### The backend

Running the app against a fresh Supabase project takes more than the steps above, and it is worth knowing before you start.

- The migrations in `supabase/migrations` do not fully describe the live database. The earliest tables were never captured as migrations. `supabase/schema` holds a snapshot of the live schema to check against.
- Newer features ship as paste-ready files in `supabase/sql`. Files that need a secret contain a placeholder to fill in locally. Never commit the filled-in file.
- Edge functions receive `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` from Supabase automatically. The Stripe secrets are set separately:

  ```bash
  supabase secrets set STRIPE_SECRET_KEY=sk_test_... STRIPE_WEBHOOK_SECRET=whsec_...
  ```

- AI provider keys are entered by an admin inside the app and stored server-side in a table that browsers cannot read. Connector credentials are stored in Supabase Vault.

## Tests and checks

```bash
npm test          # unit tests (Vitest)
npm run lint      # ESLint
npm run build     # production build
npm run test:db   # SQL billing tests against a linked Supabase project; the test aborts its own transaction
```

## Security notes

- The service-role key never reaches the browser. A unit test fails the build if any frontend file references a `VITE_` service-role variable. Admin features run on the normal client, gated by row level security policies and `is_admin()` checks in the database.
- Billing and credits are always verified on the server.
- Report security problems privately by opening a GitHub security advisory on this repository rather than a public issue.

## About this project

Kinika is built by Chimaobi Dennis as a solo project, developed with Claude Code as an assistant.

Product and architecture rules live in [CLAUDE.md](CLAUDE.md). Plans live in [ROADMAP.md](ROADMAP.md).

## License

[MIT](LICENSE) © 2026 Chimaobi Dennis
