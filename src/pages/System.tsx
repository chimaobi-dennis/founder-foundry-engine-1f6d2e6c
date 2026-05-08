import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { EditorialShell, Container, PageMeta, PageTitle, L } from "@/components/editorial/EditorialLayout";

const MODULES = [
  {
    n: "01",
    name: "Mentor",
    role: "The thinking partner",
    body: "One continuous conversation per brand. The thread that quietly builds your Brand DNA in the background, surfacing what matters when you need it.",
  },
  {
    n: "02",
    name: "ProStudio",
    role: "The visual atelier",
    body: "Product imagery composed from your brand's palette, voice, and reference library. No studio. No re-explanation.",
  },
  {
    n: "03",
    name: "ContentStudio",
    role: "The publishing room",
    body: "One brief becomes eight platforms. Each treatment honors the platform's grammar without losing your voice.",
  },
  {
    n: "04",
    name: "ContentCalendar",
    role: "The planning ledger",
    body: "A monthly view of intention. Plans, not algorithms. Reminders, not automations.",
  },
  {
    n: "05",
    name: "DocStudio",
    role: "The correspondence desk",
    body: "Pitch decks, proposals, one-pagers — composed from your memory, ready in the hand of a founder, not a template gallery.",
  },
  {
    n: "06",
    name: "ReelBuilder",
    role: "The storyboard table",
    body: "From brief to scene to teleprompter. Short film, founder-scale.",
  },
];

export default function System() {
  return (
    <EditorialShell>
      <section style={{ background: L.paper }}>
        <Container>
          <PageMeta issue="Vol. 01" section="System" date="Spring 2026" />
          <PageTitle kicker="An anatomy">Six rooms in one workspace.</PageTitle>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 ed-fade ed-d2">
            <div className="lg:col-span-7">
              <p
                className="pf"
                style={{
                  fontSize: "clamp(20px, 1.6vw, 24px)",
                  lineHeight: 1.55,
                  color: L.inkSoft,
                  fontStyle: "italic",
                  marginBottom: 24,
                }}
              >
                The system is not a suite of features. It is a series of rooms — each one a quiet specialist —
                connected by a single, shared memory.
              </p>
              <p style={{ fontSize: 16, lineHeight: 1.75, color: L.inkSoft }}>
                Walk between them and your brand walks with you. Voice, audience, palette, references, decisions
                — all already present, never asked again.
              </p>
            </div>
            <aside className="lg:col-span-5 lg:pl-12 lg:border-l" style={{ borderColor: L.ruleSoft }}>
              <span style={{ fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", color: L.amber, fontWeight: 600 }}>
                The shared memory
              </span>
              <p className="pf" style={{ fontSize: 22, color: L.ink, marginTop: 14, lineHeight: 1.4, fontWeight: 500 }}>
                Brand DNA is the spine. It feeds every room and grows with every visit.
              </p>
            </aside>
          </div>

          <div style={{ height: 1, background: L.rule, margin: "112px 0 64px" }} />

          <div style={{ marginBottom: 56 }}>
            <span style={{ fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", color: L.amber, fontWeight: 600 }}>
              The rooms
            </span>
          </div>

          <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {MODULES.map((m, idx) => (
              <li
                key={m.n}
                className="grid grid-cols-12 gap-6 lg:gap-12 py-12"
                style={{ borderTop: idx === 0 ? `1px solid ${L.rule}` : "none", borderBottom: `1px solid ${L.rule}` }}
              >
                <div className="col-span-12 sm:col-span-2">
                  <span className="pf" style={{ fontSize: 32, color: L.amber, fontStyle: "italic", letterSpacing: "0.01em" }}>
                    {m.n}
                  </span>
                </div>
                <div className="col-span-12 sm:col-span-4">
                  <h3 className="pf" style={{ fontSize: "clamp(28px, 3vw, 40px)", color: L.ink, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.05 }}>
                    {m.name}
                  </h3>
                  <p style={{ fontSize: 12, color: L.inkMuted, marginTop: 10, letterSpacing: "0.18em", textTransform: "uppercase" }}>
                    {m.role}
                  </p>
                </div>
                <div className="col-span-12 sm:col-span-6">
                  <p style={{ fontSize: 16, lineHeight: 1.75, color: L.inkSoft, maxWidth: "44ch" }}>{m.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <div style={{ marginTop: 96 }}>
            <Link
              to="/journal"
              className="inline-flex items-center gap-3 group"
              style={{ color: L.ink, fontSize: 14, letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600 }}
            >
              Read the Journal
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </Container>
      </section>
    </EditorialShell>
  );
}
