import { SEO } from "@/components/SEO";
import { EditorialShell, Container, PageMeta, PageTitle, Section, L } from "@/components/editorial/EditorialLayout";

/** What Kinika believes, and what it refuses to be. Short, because beliefs that need a long page are not held. */

const BELIEFS = [
  {
    title: "Understanding comes before output.",
    body: "Most tools ask what you want made. Kinika first asks what your business is, then shows you what it understood and lets you correct it. Everything it makes later starts from that record, so a founder explains the business once, not every time.",
  },
  {
    title: "One manager, not a crowd of tools.",
    body: "Kinika is the business manager. Agents are the staff Kinika hires for a task, briefs from the brand record, and reports on. The founder talks to Kinika. Nobody should have to learn six products to run one small business.",
  },
  {
    title: "Approval is what makes handing over safe.",
    body: "A business lives in its email, its shop, its social accounts. Letting software write there is only sane if the person whose name is on the door sees it first. So agents draft and stop; nothing is sent, published or changed without a yes; every change can be reverted. This rule is never relaxed to make a chart go up.",
  },
  {
    title: "Everything an agent makes stays editable.",
    body: "Copy, designs, documents and workflows are structured things you can take over mid-run. The agent never overwrites your edits. A result you cannot change is a dead end, and Kinika does not make dead ends.",
  },
  {
    title: "Numbers come from somewhere, or they are not written.",
    body: "A price, a date, a claim: if nothing told Kinika, it leaves a chip that says 'your decision' instead of inventing one. Each line of the read-back says its source and how sure Kinika is.",
  },
  {
    title: "Context compounds.",
    body: "Every run, every approval, every correction goes back into what Kinika knows. The longer a founder works in Kinika, the less they have to explain, and the better the next result is.",
  },
];

const NOT = [
  "Not a chat box with a blank cursor. You never start from nothing; the plan and the read-back are already there.",
  "Not a prompt library or a template marketplace. Templates do not know your business; the brand record does.",
  "Not an autopilot. Kinika is fast at drafting and patient about waiting for your yes.",
  "Not built for builders only. A bakery, a consultant, a creator and a first-time founder get the same first run, with headings that fit their kind of business.",
];

export default function Philosophy() {
  return (
    <EditorialShell>
      <SEO
        title="Philosophy — Kinika"
        description="What Kinika believes: understanding before output, one manager not a crowd of tools, approval that makes handing over safe, and context that compounds."
        path="/philosophy"
      />
      <Container narrow>
        <PageMeta issue="Philosophy" section="Six beliefs, four refusals" date="October 2026" />
        <PageTitle kicker="Why Kinika is built this way">Know the business first. Then do the work.</PageTitle>
        <p style={{ fontSize: "clamp(17px, 1.5vw, 20px)", lineHeight: 1.6, color: L.inkSoft, maxWidth: "58ch" }}>
          Founders do not lack tools. They lack a system that knows their business well enough to carry it. Kinika is built around that one gap, and the beliefs below follow from it.
        </p>
      </Container>

      <Section tone="surface">
        <div className="grid grid-cols-1 gap-0" style={{ maxWidth: 880 }}>
          {BELIEFS.map((b, i) => (
            <article key={b.title} style={{ display: "grid", gridTemplateColumns: "56px 1fr", gap: 20, padding: "28px 0", borderTop: `1px solid ${L.rule}` }}>
              <span style={{ fontSize: 12, letterSpacing: "0.18em", color: L.accentDeep, fontWeight: 600, paddingTop: 6 }}>0{i + 1}</span>
              <div>
                <h2 className="pf" style={{ fontSize: "clamp(22px, 2.4vw, 28px)", lineHeight: 1.2, color: L.ink, letterSpacing: "-0.015em" }}>{b.title}</h2>
                <p style={{ marginTop: 12, fontSize: 16, lineHeight: 1.65, color: L.inkSoft, maxWidth: "62ch" }}>{b.body}</p>
              </div>
            </article>
          ))}
        </div>
      </Section>

      <Section tone="deep" eyebrow="And what Kinika is not" title="Four things we decided against, on purpose.">
        <ul style={{ display: "grid", gap: 14, maxWidth: 820 }}>
          {NOT.map((n) => (
            <li key={n} style={{ fontSize: 16, lineHeight: 1.65, color: L.inkSoft, paddingLeft: 18, borderLeft: `2px solid ${L.accentLine}` }}>{n}</li>
          ))}
        </ul>
      </Section>
    </EditorialShell>
  );
}
