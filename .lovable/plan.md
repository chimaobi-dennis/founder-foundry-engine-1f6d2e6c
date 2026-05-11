## Kinika Mentor — Workspace Redesign

A pure UI/UX pass on `src/pages/Mentor.tsx`, `src/components/mentor/ChatPanel.tsx`, `src/components/mentor/BrandMilestonePanel.tsx`, and `src/components/mentor/BrandDNAPanel.tsx`. No service, AI, or state logic changes. Same props, same data flow, same handlers.

### Guiding shift

From "AI chat app with sidebars" → "founder operating workspace where understanding accumulates."

Three columns stay. What changes is rhythm, weight, surfaces, naming, and the visual thread connecting them.

### Shared visual language (applied across all three columns)

- **Surfaces**: replace card-heavy `bg-card` + `border` containers with calmer washes — subtle navy gradients, hairline `border-white/[0.04]` dividers instead of full borders, no rounded-xl bubble blocks.
- **Rhythm**: increase vertical spacing scale (12 → 20, 16 → 28). Section headers get small uppercase eyebrow labels (Playfair small caps + amber dot accent) rather than bold titles + badges.
- **Type hierarchy**: Playfair Display for section eyebrows and captured insights; DM Sans for UI chrome. Reduce competing weights — most labels move to `text-muted-foreground` at 11px tracking-wide uppercase.
- **Amber accent**: reserved exclusively for *active state*, *captured insight markers*, and *connection cues* between panels. Removed from buttons, badges, and decorative chrome.
- **Continuity thread**: a 1px amber-fade vertical line runs down the left edge of milestone markers in chat and continues into the Journey Record panel as the spine of captured insights — visually linking conversation → insight → memory.

### Left panel — "Context Sources"

Reframe from utility/file manager to source layer.

- Rename headers: "Project Assets" → **Context Sources**, "Upload Files" → **Add Reference Material**, "Memory" → **Business Context**.
- Brand switcher: shrink dropdown chrome, remove the heavy bordered card; use a quiet inline row with a small color dot, project name in Playfair, and "Started …" as muted micro-copy.
- New project button: ghost text-link style ("+ New project") instead of full bordered button.
- Context Sources list: drop file emoji icons; use a small monochrome doc/link/image glyph + filename + muted source label. Pinned items separated by a hairline divider, not a heading block.
- Business Context summary: render as a single italic Playfair paragraph ("Building Nordform in modular furniture for design-conscious renters…") instead of a card.
- "Add context from document/URL" button stays but restyled as a quiet text-link with a tiny upload glyph.

### Center — Working Session

Move away from messaging-app aesthetics.

- Remove avatar circles and bubble backgrounds for AI messages. AI responses render as **flowing editorial text blocks** with generous line-height, Playfair-tinged first-line emphasis on strategically significant responses, and a thin amber left margin only when the response carries a save prompt.
- Founder messages keep a subtle right-aligned bubble but with softer surface (`bg-white/[0.03]`, no border) and tighter padding — feels like a margin note rather than a chat reply.
- **Section dividers**: when a milestone is created in the timeline, render a horizontal rule with the milestone name centered in small caps + amber dot — a visible chapter break in the working session.
- **Save prompts**: redesigned from amber cards to inline annotations — small italic Playfair line "Capture as Positioning →" with hover-revealed Save / Edit / Dismiss text actions. No box, no fill.
- **Choice prompts**: same restraint — question in Playfair, options as text rows separated by hairlines, amber underline on hover.
- Top brand-context bar (h-10) absorbed into the chat header with more breathing room (24px padding) and a stage chip moved to the right edge.
- Composer: borderless textarea on a slightly raised surface, send affordance is a quiet amber arrow glyph, attach/mic glyphs muted until hover.

### Right panel — Journey Record (elevated)

Treat this as the intelligence layer, not a sidebar.

- Wider gutter on tablet/desktop (panel grows from current ~320px to 360px). More internal padding (24px).
- Header reframed: small Playfair "Journey Record" with a one-line italic subtitle ("Understanding compounding over time.") — no Active badge.
- Stage switcher: compact row at top with stage emoji + Playfair name + muted "Stage 2 of 6" — Change action is a small text-link, dropdown becomes a quiet stacked list with hairline dividers.
- **Captured insights as Strategic Insight Cards**:
  - Each substage with a captured value renders as a structured block: small uppercase eyebrow (field label), Playfair value at 15px line-height 1.55, muted source line ("Captured 3 days ago · from conversation").
  - No card border. Separated by 28px vertical space and a hairline rule.
  - Hover reveals quiet text actions: Refine · Clear.
- Empty substages: a single muted line "Awaiting: target audience · core promise · …" instead of a checklist of empty rows. Reduces visual noise.
- Stage progression: compact horizontal dot-rail (6 dots, current = amber filled, completed = amber outline, future = muted) at the top of the panel — replaces stacked stage cards.
- The amber spine from the chat continues into the panel as the left edge of the insight column, reinforcing flow.

### Mobile / tablet

- Tablet (<1024): right panel collapses to a 44px rail with an amber dot per captured insight; tap expands into a sheet. Left panel collapses to a Sheet trigger (existing behaviour kept, restyled).
- Mobile (<768): stacked workspace sections in this order — Working Session (default), Context Sources (collapsible at top), Journey Record (collapsible at bottom). The dominant view is the active session, but Journey Record gets a persistent peek strip showing the latest captured insight, not just a toggle.

### What is explicitly NOT changing

- All service calls, props, handlers, state, conversation orchestration, milestone detection, save-prompt parsing, AI response logic, choice-prompt flow, refining/clearing logic, stage-change warnings, and onboarding modal behaviour remain identical.
- No DB migrations, no service edits, no `aiService` / `mentorService` / `journeyDataService` changes.

### Files touched

- `src/pages/Mentor.tsx` — column widths, gutter, continuity-spine wrapper, mobile stacking order. No state/handler changes.
- `src/components/mentor/BrandMilestonePanel.tsx` — visual restyle, header renames, surface refinement.
- `src/components/mentor/ChatPanel.tsx` — message rendering, save-prompt and choice-prompt styling, section dividers, composer restyle.
- `src/components/mentor/BrandDNAPanel.tsx` — header, stage switcher, insight-card layout, dot-rail, empty-state line.
- Possibly small additions to `src/index.css` for the amber spine + small-caps eyebrow utility (no token changes).

### Risk

Low — purely presentational. Largest risk is regressions from JSX edits in 1000+ line files; mitigated by keeping all handlers and state intact and editing in scoped passes per file.
