import { SEO } from "@/components/SEO";
import { EditorialShell, Container, PageMeta, PageTitle, Section, Card, L } from "@/components/editorial/EditorialLayout";

/** How Kinika works, end to end, as it actually runs today. Honest about what is staged. */

const PARTS = [
  {
    no: "01",
    name: "Understanding",
    lead: "The read-back is the front door.",
    body: "You tell Kinika about the business and give it what it can read: a website, documents, a conversation you already had with another assistant. Kinika writes back what it understood under headings that fit your kind of business, with a source and a confidence on each line, plus what it still does not know. You fix any line and approve. The approved record is what every agent reads from then on, and it keeps growing.",
  },
  {
    no: "02",
    name: "The plan",
    lead: "Targets, tasks, and who does each.",
    body: "From your goal Kinika writes two to five targets, each with checkable tasks, and marks the ones an agent can do with the role it would hire. You tick, skip, add and reorder. When you reach a milestone or change stage, Kinika revises the plan and keeps your edits. A check-in arrives weekly, or daily once Kinika has a live connection to read.",
  },
  {
    no: "03",
    name: "Kinika's team",
    lead: "Seats are how many agents; credits are how much work.",
    body: "The plan says which roles it needs. On the free trial there are no agent seats, so Kinika plans and advises and you do the tasks. On a paid plan you confirm the roster once and Kinika hires it; with fewer seats than roles, Kinika hires in plan order and swaps when a role's tasks are done. Every task is quoted in credits before it runs.",
  },
  {
    no: "04",
    name: "The workspace",
    lead: "One shell. The surface changes with the job.",
    body: "A task opens a workspace: who is working and on what across the top, the task and what Kinika is using down the side, and the work in the middle. A brief is a document you edit line by line. A design is a canvas of scenes you can grab mid-run. A standing task is a board of steps with the review step drawn in. Approve or send back from the same place; there is no separate approval page.",
  },
  {
    no: "05",
    name: "Connections",
    lead: "Read · draft · act after your yes.",
    body: "Connections are kept, not scraped once. Each shows its permission in plain words, and the runner enforces it: a 'draft' connection can never send. Acting without asking is off by default, per kind of action, and Enterprise-only at first. Changes agents make are logged and reverted one by one.",
  },
  {
    no: "06",
    name: "Memory",
    lead: "What was learned goes back in.",
    body: "Every run, approval, correction and revert writes a line to team memory. Kinika reads it before the next plan revision and every agent reads it before the next task. This is why the second month in Kinika is easier than the first.",
  },
];

export default function System() {
  return (
    <EditorialShell>
      <SEO
        title="How it works — Kinika"
        description="How Kinika works end to end: the read-back, the plan, seats and credits, the workspace and its surfaces, connections with plain permissions, and memory."
        path="/system"
      />
      <Container narrow>
        <PageMeta issue="How it works" section="Six parts, one loop" date="October 2026" />
        <PageTitle kicker="As it runs today">Understand. Plan. Hire. Approve. Remember.</PageTitle>
        <p style={{ fontSize: "clamp(17px, 1.5vw, 20px)", lineHeight: 1.6, color: L.inkSoft, maxWidth: "58ch" }}>
          Kinika is one loop: it understands the business, plans the next stage, hires agents for the tasks, waits for your approval, and remembers what it learned. Here is each part as it works right now.
        </p>
      </Container>

      <Section tone="surface">
        <div style={{ display: "grid", gap: 0, maxWidth: 920 }}>
          {PARTS.map((p) => (
            <article key={p.no} className="grid grid-cols-12 gap-6" style={{ padding: "32px 0", borderTop: `1px solid ${L.rule}` }}>
              <div className="col-span-12 md:col-span-4">
                <span style={{ fontSize: 11, letterSpacing: "0.2em", color: L.accentDeep, fontWeight: 600 }}>{p.no}</span>
                <h2 className="pf" style={{ fontSize: 24, lineHeight: 1.2, color: L.ink, marginTop: 8 }}>{p.name}</h2>
                <p style={{ fontSize: 14, color: L.inkMuted, marginTop: 6 }}>{p.lead}</p>
              </div>
              <p className="col-span-12 md:col-span-8" style={{ fontSize: 16, lineHeight: 1.65, color: L.inkSoft }}>{p.body}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section tone="deep" eyebrow="The first run, step by step" title="What a new founder sees, in order.">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            ["1", "Tell Kinika about your business", "Situation and a few sentences."],
            ["2", "Connect what Kinika will read", "Website, documents, a past conversation. Skip is always there."],
            ["3", "Your business, as Kinika understands it", "Approve or fix each line."],
            ["4", "Your goal", "Three suggested from the read-back, or your own."],
            ["5", "Your plan and Kinika's team", "Targets, tasks, roles, and seats if you want them."],
          ].map(([n, t, b]) => (
            <Card key={n} label={`Step ${n}`} title={t}>{b}</Card>
          ))}
        </div>
      </Section>

      <Section eyebrow="Where it stands" title="What is live, and what is next.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" style={{ maxWidth: 920 }}>
          <div>
            <p style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: L.good, fontWeight: 600, marginBottom: 10 }}>Live now</p>
            <ul style={{ display: "grid", gap: 8, fontSize: 15, lineHeight: 1.6, color: L.inkSoft }}>
              <li>The read-back, the plan, revisions on milestones, weekly and daily check-ins.</li>
              <li>Kinika's team with seats, the workspace with document, canvas and board surfaces, approvals in the shell.</li>
              <li>Connections to Shopify, WordPress, Notion and GitHub; social publishing through Ayrshare.</li>
              <li>Model routing with fallback across providers, quoted credits on every run.</li>
            </ul>
          </div>
          <div>
            <p style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: L.accentDeep, fontWeight: 600, marginBottom: 10 }}>Next</p>
            <ul style={{ display: "grid", gap: 8, fontSize: 15, lineHeight: 1.6, color: L.inkSoft }}>
              <li>Gmail, Slack, Instagram and TikTok connected directly, with the same three permission levels.</li>
              <li>Daily morning summaries across every connected tool, with what needs you first.</li>
              <li>Act-without-asking for low-risk kinds of action, per connection, on Enterprise.</li>
            </ul>
          </div>
        </div>
      </Section>
    </EditorialShell>
  );
}
