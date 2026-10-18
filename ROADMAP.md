# Kinika roadmap

Last updated: 18 October 2026.

Kinika is in early testing with a small group of testers, and billing runs in Stripe test mode. This file lists what has shipped, what is next, and what is deliberately later. Product rules that shape the order are in [CLAUDE.md](CLAUDE.md).

## Shipped

- **Foundations:** a server-side AI gateway with model routing and failover, database-driven pricing rules, per-run quotes, and a usage log for cost accounting.
- **Agents:** agents, hires, automations, a step runner driven by a one-minute tick, approvals, and send-back-for-changes with a revision round.
- **Connectors:** Shopify, WordPress, Notion, GitHub, Ayrshare publishing and a single-table Postgres connector, with change sets and revert.
- **Developer agent:** snapshot, plan, read, edit, review, then a pull request on a protected branch prefix, with settle and merge actions.
- **Plans and billing:** plans, seats and top-ups on Stripe subscriptions, entitlement checks in the database, wallet billing with reserve, capture and release, and SQL tests for the billing functions.
- **Teams:** members, roles and row level security across the data model, with an invite page.
- **Marketplace:** creators can write and publish agents, with earnings tracking and an admin review page.
- **First run:** understanding read-back, plan builder, task conversations that produce deliverables and documents, and a prompt registry so no prompt text lives in code.
- **Security:** no service-role key in the frontend, admin access through row level security and `is_admin()`, and a test that guards it.

## Next

Ordered by what unblocks real use.

1. **Exercise the connectors against real accounts.** None of the Shopify, WordPress, Ayrshare, Notion and Postgres adapters has run against a live customer account yet, and GitHub has not been tested with CI on the target repository. Fix what breaks and add integration tests.
2. **Invite emails.** Invites work by link today. Add an email provider, send the invite, and verify invite, accept and act-as-member with a second account.
3. **Fund and verify the model providers.** The standard and reasoning tiers need a funded provider account. Replace the estimated cost rate for the fast tier with the real published rate so cost reports are accurate.
4. **Go live on payments.** Finalise plan prices and credit amounts, move Stripe from test to live mode, and set up webhook monitoring.
5. **Continuous integration.** Add a GitHub Actions workflow that runs lint, unit tests and the production build on every pull request. There is none today.
6. **Make the environment the default for local setup.** `src/config/supabaseConfig.ts` currently overrides `.env`. Flip the order so contributors can point the app at their own project without editing code.
7. **A reproducible database.** Capture the early tables as migrations so a fresh Supabase project can be created from the repository alone, and keep the live schema snapshot as a check.
8. **Support chat.** A floating chat reachable from any screen, first used when the understanding read-back fails twice.

## Later

- **OAuth connections** for Slack, Gmail, Canva and Google Drive, which need provider app registrations. Connections stay at three levels: read, draft, and act after your yes.
- **A Scheduler agent**, a publishing service interface, and the content calendar as a staging area.
- **Social engagement in team memory**, so replies and comments feed the brand record.
- **Mobile.** A purpose-built mobile shell for the first run and approvals, separate from the desktop shell.
- **Enterprise controls:** act-without-asking on chosen action classes, several businesses per account, and own connectors.
- **End-to-end tests** with Playwright for the first run, approval and checkout flows.
- **Scale and cost:** the production database runs on the smallest compute tier, so move up a tier once usage grows and keep avoiding polling.

## Not planned

- Removing the approval step for anything that sends, publishes or changes a connected system.
- Scraping instead of real, permissioned connections.
