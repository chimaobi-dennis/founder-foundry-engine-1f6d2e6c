import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { EditorialShell, Container, PageMeta, L } from "@/components/editorial/EditorialLayout";
import { SEO } from "@/components/SEO";

/* ── Data ───────────────────────────────────────────────────────────────── */

const FEATURED = {
  category: "Workflow",
  title: "The hidden cost of fragmented creative workflows.",
  dek: "A small business now operates across 15–30 separate software tools — design in one, content in another, planning, scheduling, documents and campaigns each in their own surface. The cost isn't licensing. It's the founder, manually carrying business context across every boundary the software refuses to cross.",
  author: "Kinika Team",
  date: "March 2026",
  read: "9 min",
};

const OPENING_NOTE = {
  title: "What we write about, and why.",
  body: [
    "Modern founders don't have a tool problem. They have a continuity problem. Every tool starts the conversation from zero — no idea who the business is, who it's for, or what it sounds like — so the founder spends the day re-explaining the same things in different windows.",
    "We write about that gap: where the operational tax shows up, why outputs drift across surfaces, and what changes when business context becomes a layer the workflows share rather than a brief the founder keeps re-typing.",
    "Pieces are short, practical, and written for founders who run their own creative operations.",
  ],
};

const SECTIONS = [
  {
    code: "I.",
    name: "Founder Workflows",
    intent: "How small teams actually run creative operations across a dozen disconnected tools — and where the day quietly leaks away.",
    items: [
      { title: "The hidden cost of fragmented creative workflows.", date: "Mar 2026", read: "9 min", author: "Kinika Team" },
      { title: "Why every creative workflow starts from zero again.", date: "Feb 2026", read: "6 min", author: "Kinika Team" },
      { title: "The founder becomes the integration layer.", date: "Feb 2026", read: "7 min", author: "Kinika Team" },
      { title: "Context switching is the real cost of running lean.", date: "Jan 2026", read: "5 min", author: "Kinika Team" },
    ],
  },
  {
    code: "II.",
    name: "Business Context",
    intent: "Treating what your business is — voice, audience, positioning, product — as infrastructure that workflows can read from, not a brief you keep re-typing.",
    items: [
      { title: "Why context matters more than prompts.", date: "Feb 2026", read: "7 min", author: "Kinika Team" },
      { title: "What a shared business context layer actually contains.", date: "Jan 2026", read: "8 min", author: "Kinika Team" },
      { title: "The difference between memory and understanding.", date: "Jan 2026", read: "5 min", author: "Kinika Team" },
    ],
  },
  {
    code: "III.",
    name: "Brand Consistency",
    intent: "Why outputs drift across channels when each tool defaults to its own template, and what it takes to keep a brand recognisable at scale.",
    items: [
      { title: "Templates don't understand your business.", date: "Feb 2026", read: "6 min", author: "Kinika Team" },
      { title: "Brand drift is a systems problem, not a taste problem.", date: "Jan 2026", read: "6 min", author: "Kinika Team" },
      { title: "Voice isn't a tone slider — it's a constraint set.", date: "Dec 2025", read: "5 min", author: "Kinika Team" },
    ],
  },
  {
    code: "IV.",
    name: "AI Workflow Design",
    intent: "What changes when AI tools share a single source of truth about the business instead of starting fresh every session.",
    items: [
      { title: "Designing AI around context, not chat.", date: "Jan 2026", read: "6 min", author: "Kinika Team" },
      { title: "Removing the brief: what we replaced it with.", date: "Dec 2025", read: "4 min", author: "Kinika Team" },
      { title: "A connected workspace for solo founders.", date: "Dec 2025", read: "4 min", author: "Kinika Team" },
    ],
  },
];

const READING_LIST = [
  "The hidden cost of fragmented creative workflows",
  "The founder becomes the integration layer",
  "Templates don't understand your business",
  "Why context matters more than prompts",
];

/* ── Small primitives ───────────────────────────────────────────────────── */

function CategoryTag({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 10,
        letterSpacing: "0.24em",
        textTransform: "uppercase",
        color: L.amber,
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}

function ArticleMeta({ date, read, author }: { date: string; read: string; author: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span style={{ fontSize: 11, color: L.inkMuted, letterSpacing: "0.14em", textTransform: "uppercase" }}>{date}</span>
      <span style={{ width: 4, height: 1, background: L.rule }} />
      <span style={{ fontSize: 11, color: L.inkMuted, letterSpacing: "0.14em", textTransform: "uppercase" }}>{read}</span>
      <span style={{ width: 4, height: 1, background: L.rule }} />
      <span className="pf" style={{ fontSize: 12, color: L.inkMuted, fontStyle: "italic" }}>{author}</span>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export default function Journal() {
  return (
    <>
      <SEO
        title="Journal — Kinika"
        description="Essays on founder workflows, brand operations, and the hidden cost of running a business across 15+ disconnected tools."
        path="/journal"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Kinika Journal",
          description: "Writing on founder workflows and connected creative operations.",
          url: "https://kinika.studio/journal",
        }}
      />
    <EditorialShell>
      {/* ── Cover spread ────────────────────────────────────────────────── */}
      <section style={{ background: L.paper }}>
        <Container>
          <PageMeta issue="Kinika" section="Writing" date="From the team" />

          <div className="grid grid-cols-12 gap-8 lg:gap-16">
            <div className="col-span-12 lg:col-span-8">
              <p
                className="pf ed-fade"
                style={{
                  fontStyle: "italic",
                  color: L.amber,
                  fontSize: 18,
                  marginBottom: 20,
                  letterSpacing: "0.01em",
                }}
              >
                Writing from the Kinika team.
              </p>
              <h1
                className="pf ed-fade ed-d1"
                style={{
                  color: L.ink,
                  fontSize: "clamp(48px, 8vw, 132px)",
                  lineHeight: 0.94,
                  fontWeight: 500,
                  letterSpacing: "-0.035em",
                  maxWidth: "16ch",
                }}
              >
                Notes on founder workflows and connected systems.
              </h1>
            </div>

            <aside className="col-span-12 lg:col-span-4 lg:pt-24">
              <div
                className="ed-fade ed-d2"
                style={{ borderTop: `1px solid ${L.amber}`, paddingTop: 18, maxWidth: 320 }}
              >
                <p
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.24em",
                    textTransform: "uppercase",
                    color: L.inkMuted,
                    fontWeight: 600,
                    marginBottom: 14,
                  }}
                >
                  About this writing
                </p>
                <p className="pf" style={{ fontSize: 17, lineHeight: 1.6, color: L.inkSoft, fontStyle: "italic" }}>
                  Pieces on the operational reality of running creative
                  work as a founder — fragmented tools, scattered context,
                  and what changes when the system holds it together.
                </p>
              </div>
            </aside>
          </div>

          <div style={{ height: 1, background: L.rule, marginTop: 96 }} />
        </Container>
      </section>

      {/* ── Featured essay ──────────────────────────────────────────────── */}
      <section style={{ background: L.paper }}>
        <div
          className="mx-auto"
          style={{
            maxWidth: 1320,
            paddingLeft: "clamp(24px, 6vw, 96px)",
            paddingRight: "clamp(24px, 6vw, 96px)",
            paddingTop: "clamp(48px, 6vh, 88px)",
            paddingBottom: "clamp(96px, 12vh, 140px)",
          }}
        >
          <div className="grid grid-cols-12 gap-8 lg:gap-16">
            <div className="col-span-12 lg:col-span-3">
              <CategoryTag>Featured · {FEATURED.category}</CategoryTag>
              <p
                className="pf"
                style={{
                  marginTop: 20,
                  fontStyle: "italic",
                  fontSize: 22,
                  color: L.amber,
                  letterSpacing: "0.01em",
                  lineHeight: 1.3,
                }}
              >
                15–30 tools. One founder holding it all together.
              </p>
              <div style={{ height: 1, background: L.rule, margin: "32px 0", width: 56 }} />
              <ArticleMeta date={FEATURED.date} read={FEATURED.read} author={FEATURED.author} />
            </div>

            <div className="col-span-12 lg:col-span-9">
              <h2
                className="pf"
                style={{
                  fontSize: "clamp(40px, 6vw, 92px)",
                  lineHeight: 0.98,
                  color: L.ink,
                  fontWeight: 500,
                  letterSpacing: "-0.03em",
                  marginBottom: 32,
                  maxWidth: "18ch",
                }}
              >
                {FEATURED.title}
              </h2>
              <p
                className="pf"
                style={{
                  fontSize: "clamp(20px, 1.7vw, 26px)",
                  lineHeight: 1.55,
                  color: L.inkSoft,
                  fontStyle: "italic",
                  fontWeight: 400,
                  maxWidth: "48ch",
                  marginBottom: 40,
                }}
              >
                {FEATURED.dek}
              </p>
              <a
                href="#"
                className="inline-flex items-center gap-3 group"
                style={{
                  color: L.ink,
                  fontSize: 13,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                  borderBottom: `1px solid ${L.amber}`,
                  paddingBottom: 4,
                }}
              >
                Read the piece
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Opening note ────────────────────────────────────────────────── */}
      <section style={{ background: L.paperDeep, borderTop: `1px solid ${L.rule}`, borderBottom: `1px solid ${L.rule}` }}>
        <div
          className="mx-auto"
          style={{
            maxWidth: 1320,
            paddingLeft: "clamp(24px, 6vw, 96px)",
            paddingRight: "clamp(24px, 6vw, 96px)",
            paddingTop: "clamp(96px, 12vh, 140px)",
            paddingBottom: "clamp(96px, 12vh, 140px)",
          }}
        >
          <div className="grid grid-cols-12 gap-8 lg:gap-16">
            <div className="col-span-12 lg:col-span-3">
              <CategoryTag>Orientation</CategoryTag>
              <p
                className="pf"
                style={{
                  marginTop: 16,
                  fontSize: 14,
                  color: L.inkMuted,
                  fontStyle: "italic",
                }}
              >
                A short note from the team
              </p>
            </div>

            <div className="col-span-12 lg:col-span-9">
              <h3
                className="pf"
                style={{
                  fontSize: "clamp(28px, 3.4vw, 46px)",
                  lineHeight: 1.1,
                  color: L.ink,
                  fontWeight: 500,
                  letterSpacing: "-0.02em",
                  marginBottom: 36,
                  maxWidth: "24ch",
                }}
              >
                {OPENING_NOTE.title}
              </h3>
              {OPENING_NOTE.body.map((p, i) => (
                <p
                  key={i}
                  style={{
                    fontSize: 17,
                    lineHeight: 1.78,
                    color: L.inkSoft,
                    marginBottom: 22,
                    maxWidth: "62ch",
                  }}
                >
                  {p}
                </p>
              ))}
              <p
                className="pf"
                style={{
                  marginTop: 28,
                  fontSize: 15,
                  color: L.inkMuted,
                  fontStyle: "italic",
                  letterSpacing: "0.01em",
                }}
              >
                — The Kinika team
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Sectioned archive ───────────────────────────────────────────── */}
      <section style={{ background: L.paper }}>
        <div
          className="mx-auto"
          style={{
            maxWidth: 1320,
            paddingLeft: "clamp(24px, 6vw, 96px)",
            paddingRight: "clamp(24px, 6vw, 96px)",
            paddingTop: "clamp(96px, 12vh, 140px)",
            paddingBottom: "clamp(48px, 6vh, 80px)",
          }}
        >
          {/* Section masthead */}
          <div className="grid grid-cols-12 gap-8 lg:gap-16" style={{ marginBottom: 80 }}>
            <div className="col-span-12 lg:col-span-9">
              <CategoryTag>All writing</CategoryTag>
              <h2
                className="pf"
                style={{
                  fontSize: "clamp(36px, 4.4vw, 60px)",
                  lineHeight: 1.05,
                  color: L.ink,
                  fontWeight: 500,
                  letterSpacing: "-0.025em",
                  marginTop: 20,
                  maxWidth: "22ch",
                }}
              >
                Four threads. Workflows, context, consistency, and AI design.
              </h2>
            </div>
            <aside className="col-span-12 lg:col-span-3 lg:pt-6">
              <p style={{ fontSize: 15, color: L.inkSoft, lineHeight: 1.7, fontStyle: "italic" }} className="pf">
                Grouped by topic. Read in any order.
              </p>
            </aside>
          </div>

          <div className="grid grid-cols-12 gap-8 lg:gap-16">
            {/* Main column — sections */}
            <div className="col-span-12 lg:col-span-9">
              {SECTIONS.map((section, sIdx) => (
                <div
                  key={section.code}
                  style={{
                    paddingTop: sIdx === 0 ? 0 : 80,
                    paddingBottom: 64,
                    borderTop: sIdx === 0 ? "none" : `1px solid ${L.rule}`,
                  }}
                >
                  <div className="grid grid-cols-12 gap-6" style={{ marginBottom: 48 }}>
                    <div className="col-span-12 sm:col-span-3">
                      <p
                        className="pf"
                        style={{
                          fontStyle: "italic",
                          color: L.amber,
                          fontSize: 28,
                          letterSpacing: "0.01em",
                          marginBottom: 8,
                        }}
                      >
                        {section.code}
                      </p>
                      <h3
                        className="pf"
                        style={{
                          fontSize: "clamp(26px, 2.8vw, 36px)",
                          lineHeight: 1.1,
                          color: L.ink,
                          fontWeight: 500,
                          letterSpacing: "-0.02em",
                        }}
                      >
                        {section.name}
                      </h3>
                    </div>
                    <div className="col-span-12 sm:col-span-9 sm:pt-2">
                      <p className="pf" style={{ fontSize: 18, color: L.inkSoft, fontStyle: "italic", lineHeight: 1.55, maxWidth: "52ch" }}>
                        {section.intent}
                      </p>
                    </div>
                  </div>

                  <ol style={{ listStyle: "none", padding: 0, margin: 0, borderTop: `1px solid ${L.rule}` }}>
                    {section.items.map((a) => (
                      <li
                        key={a.title}
                        className="grid grid-cols-12 gap-4 lg:gap-8 py-8 group cursor-pointer"
                        style={{ borderBottom: `1px solid ${L.rule}` }}
                      >
                        <div className="col-span-12 sm:col-span-9">
                          <h4
                            className="pf"
                            style={{
                              fontSize: "clamp(22px, 2.2vw, 28px)",
                              lineHeight: 1.2,
                              color: L.ink,
                              fontWeight: 500,
                              letterSpacing: "-0.015em",
                              marginBottom: 8,
                              transition: "color 200ms ease",
                            }}
                          >
                            {a.title}
                          </h4>
                          <span className="pf" style={{ fontSize: 13, color: L.inkMuted, fontStyle: "italic" }}>
                            {a.author}
                          </span>
                        </div>
                        <div className="col-span-12 sm:col-span-3 sm:text-right flex sm:flex-col gap-3 sm:gap-1">
                          <span style={{ fontSize: 11, color: L.inkMuted, letterSpacing: "0.16em", textTransform: "uppercase" }}>
                            {a.date}
                          </span>
                          <span style={{ fontSize: 11, color: L.inkMuted, letterSpacing: "0.04em" }}>{a.read}</span>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>

            {/* Sidebar */}
            <aside className="col-span-12 lg:col-span-3">
              <div className="lg:sticky lg:top-24 space-y-12">
                <div style={{ borderTop: `1px solid ${L.amber}`, paddingTop: 18 }}>
                  <CategoryTag>About</CategoryTag>
                  <p className="pf" style={{ fontSize: 18, color: L.ink, marginTop: 12, fontWeight: 500, letterSpacing: "-0.01em", lineHeight: 1.4 }}>
                    Writing from the team behind Kinika.
                  </p>
                  <ul style={{ listStyle: "none", padding: 0, margin: "20px 0 0", display: "grid", gap: 6 }}>
                    {[
                      ["Last updated", "March 2026"],
                      ["Pieces", "13"],
                      ["Cadence", "Roughly monthly"],
                    ].map(([k, v]) => (
                      <li key={k} className="flex items-baseline justify-between" style={{ fontSize: 12, color: L.inkMuted }}>
                        <span style={{ letterSpacing: "0.14em", textTransform: "uppercase" }}>{k}</span>
                        <span style={{ color: L.inkSoft }}>{v}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div style={{ borderTop: `1px solid ${L.rule}`, paddingTop: 18 }}>
                  <CategoryTag>Start here</CategoryTag>
                  <ol style={{ listStyle: "none", padding: 0, margin: "16px 0 0", display: "grid", gap: 14 }}>
                    {READING_LIST.map((t, i) => (
                      <li key={t} className="flex gap-3" style={{ fontSize: 14, color: L.inkSoft, lineHeight: 1.4 }}>
                        <span className="pf" style={{ color: L.amber, fontStyle: "italic", minWidth: 20 }}>
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="pf">{t}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                <div style={{ borderTop: `1px solid ${L.rule}`, paddingTop: 18 }}>
                  <CategoryTag>Get new pieces</CategoryTag>
                  <p className="pf" style={{ fontSize: 17, color: L.ink, fontStyle: "italic", marginTop: 12, lineHeight: 1.55 }}>
                    A short email when something new is published.
                  </p>
                  <p style={{ fontSize: 13, color: L.inkSoft, marginTop: 12, lineHeight: 1.65 }}>
                    No marketing. No drip sequences. Just the writing.
                  </p>
                  <form
                    onSubmit={(e) => e.preventDefault()}
                    style={{ marginTop: 18, display: "flex", borderBottom: `1px solid ${L.ink}` }}
                  >
                    <input
                      type="email"
                      placeholder="your@email.com"
                      style={{
                        flex: 1,
                        background: "transparent",
                        border: "none",
                        outline: "none",
                        padding: "10px 0",
                        fontSize: 14,
                        color: L.ink,
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    />
                    <button
                      type="submit"
                      aria-label="Subscribe"
                      style={{
                        background: "transparent",
                        border: "none",
                        color: L.ink,
                        cursor: "pointer",
                        padding: "10px 4px",
                      }}
                    >
                      <ArrowRight size={16} />
                    </button>
                  </form>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* ── Pull quote ──────────────────────────────────────────────────── */}
      <section style={{ background: L.paperDeep, borderTop: `1px solid ${L.rule}`, borderBottom: `1px solid ${L.rule}` }}>
        <div
          className="mx-auto"
          style={{
            maxWidth: 1100,
            paddingLeft: "clamp(24px, 6vw, 96px)",
            paddingRight: "clamp(24px, 6vw, 96px)",
            paddingTop: "clamp(96px, 12vh, 140px)",
            paddingBottom: "clamp(96px, 12vh, 140px)",
          }}
        >
          <aside style={{ paddingLeft: "clamp(20px, 4vw, 56px)", borderLeft: `1px solid ${L.amber}` }}>
            <p
              className="pf"
              style={{
                fontSize: "clamp(28px, 3.6vw, 48px)",
                lineHeight: 1.25,
                color: L.ink,
                fontStyle: "italic",
                fontWeight: 400,
                letterSpacing: "-0.02em",
                maxWidth: "28ch",
              }}
            >
              "A brand isn't inconsistent because the founder lacks taste.
              It's inconsistent because the business process is spread
              across software boundaries that humans have to bridge by
              hand."
            </p>
            <p
              style={{
                marginTop: 24,
                fontSize: 11,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: L.inkMuted,
                fontWeight: 600,
              }}
            >
              — From "Brand drift is a systems problem, not a taste problem"
            </p>
          </aside>
        </div>
      </section>

      {/* ── Closing ─────────────────────────────────────────────────────── */}
      <section style={{ background: L.paper }}>
        <div
          className="mx-auto"
          style={{
            maxWidth: 1100,
            paddingLeft: "clamp(24px, 6vw, 96px)",
            paddingRight: "clamp(24px, 6vw, 96px)",
            paddingTop: "clamp(96px, 12vh, 140px)",
            paddingBottom: "clamp(96px, 12vh, 140px)",
          }}
        >
          <div style={{ height: 1, background: L.rule, marginBottom: 56 }} />
          <div className="grid grid-cols-12 gap-8 lg:gap-12">
            <div className="col-span-12 lg:col-span-7">
              <p
                className="pf"
                style={{
                  fontSize: "clamp(24px, 2.6vw, 34px)",
                  lineHeight: 1.4,
                  color: L.ink,
                  fontStyle: "italic",
                  fontWeight: 400,
                  letterSpacing: "-0.015em",
                  maxWidth: "32ch",
                  marginBottom: 32,
                }}
              >
                More writing soon. The rest of the thinking shows up inside the product.
              </p>
              <Link
                to="/system"
                className="inline-flex items-center gap-3 group"
                style={{
                  color: L.ink,
                  fontSize: 13,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                  borderBottom: `1px solid ${L.amber}`,
                  paddingBottom: 4,
                }}
              >
                See how the system works
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
            <aside className="col-span-12 lg:col-span-5 lg:pl-12 lg:border-l" style={{ borderColor: L.ruleSoft }}>
              <p style={{ fontSize: 10, letterSpacing: "0.26em", textTransform: "uppercase", color: L.inkMuted, fontWeight: 600, marginBottom: 14 }}>
                About this writing
              </p>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: L.inkSoft, maxWidth: "36ch" }}>
                Notes from the team building Kinika — short pieces on
                founder workflows, business context, and the systems
                behind consistent creative output.
              </p>
            </aside>
          </div>
        </div>
      </section>
    </EditorialShell>
    </>
  );
}
