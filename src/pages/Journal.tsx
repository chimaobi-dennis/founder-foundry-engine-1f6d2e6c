import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { EditorialShell, Container, PageMeta, L } from "@/components/editorial/EditorialLayout";

/* ── Data ───────────────────────────────────────────────────────────────── */

const FEATURED = {
  category: "Field Notes",
  no: "No. 12",
  title: "On the patience of memory.",
  dek: "We spent eighteen months removing every onboarding form from Kinika. What replaced them was a quieter assumption: the conversation itself was the brief, and we just had to learn how to listen.",
  author: "Kinika Team",
  date: "March 2026",
  read: "9 min",
};

const OPENING_NOTE = {
  title: "Why we write here.",
  body: [
    "Most product blogs are growth marketing in disguise. We didn't want one of those. We wanted a place to think out loud about the problems Kinika is trying to solve — founder context, persistent memory, AI that actually understands a business.",
    "The pieces here are written for the kind of founder we build for: someone who measures their work in years, not sprints.",
    "Read in any order. We update when we have something worth saying.",
  ],
};

const SECTIONS = [
  {
    code: "I.",
    name: "Field Notes",
    intent: "Short pieces on craft, context, and the discipline of paying attention.",
    items: [
      { no: "No. 11", title: "The blank page is a bug.", date: "Feb 2026", read: "5 min", author: "Kinika Team" },
      { no: "No. 09", title: "Against the prompt.", date: "Feb 2026", read: "6 min", author: "Kinika Team" },
      { no: "No. 06", title: "Why we stopped saying 'AI'.", date: "Jan 2026", read: "4 min", author: "Kinika Team" },
    ],
  },
  {
    code: "II.",
    name: "Founder Stories",
    intent: "Long-form portraits of the founders we build alongside. Decisions, doubts, second drafts.",
    items: [
      { no: "No. 10", title: "How Nordform stopped re-explaining itself.", date: "Feb 2026", read: "7 min", author: "Interview — Anna L." },
      { no: "No. 08", title: "Sthlm Studio, six months in.", date: "Jan 2026", read: "8 min", author: "Interview — Erik R." },
    ],
  },
  {
    code: "III.",
    name: "On Brand",
    intent: "Pieces on positioning, voice, and the slow work of becoming recognisable.",
    items: [
      { no: "No. 07", title: "Voice is not a tone slider.", date: "Jan 2026", read: "6 min", author: "Kinika Team" },
      { no: "No. 05", title: "What a logo cannot say.", date: "Jan 2026", read: "5 min", author: "Kinika Team" },
      { no: "No. 03", title: "On taste, and where it lives.", date: "Dec 2025", read: "7 min", author: "Kinika Team" },
    ],
  },
  {
    code: "IV.",
    name: "Product Notes",
    intent: "What we've shipped, what we've removed, what we've learned building Kinika.",
    items: [
      { no: "No. 04", title: "Brand DNA, year one.", date: "Jan 2026", read: "6 min", author: "Kinika Team" },
      { no: "No. 02", title: "Twelve forms we removed this season.", date: "Dec 2025", read: "4 min", author: "Kinika Team" },
      { no: "No. 01", title: "A workspace that remembers.", date: "Dec 2025", read: "4 min", author: "Kinika Team" },
    ],
  },
];

const READING_LIST = [
  "On the patience of memory",
  "Against the prompt",
  "Voice is not a tone slider",
  "How Nordform stopped re-explaining itself",
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
      <span className="pf" style={{ fontSize: 12, color: L.inkMuted, fontStyle: "italic" }}>by {author}</span>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export default function Journal() {
  return (
    <EditorialShell>
      {/* ── Cover spread ────────────────────────────────────────────────── */}
      <section style={{ background: L.paper }}>
        <Container>
          <PageMeta issue="Kinika" section="Notes" date="Writing from the team" />

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
                  maxWidth: "14ch",
                }}
              >
                Notes on memory, brand, and building.
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
                  About this section
                </p>
                <p className="pf" style={{ fontSize: 17, lineHeight: 1.6, color: L.inkSoft, fontStyle: "italic" }}>
                  Pieces on the problems Kinika is built around — founder
                  context, persistent memory, and AI that understands a
                  business over time.
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
                  fontSize: 28,
                  color: L.amber,
                  letterSpacing: "0.01em",
                }}
              >
                {FEATURED.no}
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
                  maxWidth: "16ch",
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
                  maxWidth: "44ch",
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
                Read the essay
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
              <CategoryTag>About this section</CategoryTag>
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
                  maxWidth: "22ch",
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

      {/* ── Sectioned archive (publication grid) ────────────────────────── */}
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
              <CategoryTag>The Index</CategoryTag>
              <h2
                className="pf"
                style={{
                  fontSize: "clamp(36px, 4.4vw, 60px)",
                  lineHeight: 1.05,
                  color: L.ink,
                  fontWeight: 500,
                  letterSpacing: "-0.025em",
                  marginTop: 20,
                  maxWidth: "20ch",
                }}
              >
                Four sections. Read in any order.
              </h2>
            </div>
            <aside className="col-span-12 lg:col-span-3 lg:pt-6">
              <p style={{ fontSize: 15, color: L.inkSoft, lineHeight: 1.7, fontStyle: "italic" }} className="pf">
                Organised by theme rather than date.
              </p>
            </aside>
          </div>

          {/* Two-column publication layout */}
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
                  {/* Section header */}
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
                      <p className="pf" style={{ fontSize: 18, color: L.inkSoft, fontStyle: "italic", lineHeight: 1.55, maxWidth: "48ch" }}>
                        {section.intent}
                      </p>
                    </div>
                  </div>

                  {/* Article rows */}
                  <ol style={{ listStyle: "none", padding: 0, margin: 0, borderTop: `1px solid ${L.rule}` }}>
                    {section.items.map((a) => (
                      <li
                        key={a.no}
                        className="grid grid-cols-12 gap-4 lg:gap-8 py-8 group cursor-pointer"
                        style={{ borderBottom: `1px solid ${L.rule}` }}
                      >
                        <div className="col-span-3 sm:col-span-2">
                          <span className="pf" style={{ fontSize: 18, color: L.amber, fontStyle: "italic" }}>
                            {a.no}
                          </span>
                        </div>
                        <div className="col-span-9 sm:col-span-7">
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
                            by {a.author}
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

            {/* Sidebar — publication metadata */}
            <aside className="col-span-12 lg:col-span-3">
              <div className="lg:sticky lg:top-24 space-y-12">
                {/* Issue metadata */}
                <div style={{ borderTop: `1px solid ${L.amber}`, paddingTop: 18 }}>
                  <CategoryTag>Issue</CategoryTag>
                  <p className="pf" style={{ fontSize: 24, color: L.ink, marginTop: 12, fontWeight: 500, letterSpacing: "-0.01em" }}>
                    Vol. 01
                  </p>
                  <p className="pf" style={{ fontSize: 14, color: L.inkSoft, fontStyle: "italic", marginTop: 4 }}>
                    The Memory Issue
                  </p>
                  <ul style={{ listStyle: "none", padding: 0, margin: "20px 0 0", display: "grid", gap: 6 }}>
                    {[
                      ["Published", "March 2026"],
                      ["Pages", "12 essays"],
                      ["Edition", "Spring"],
                      ["Edited by", "The Studio"],
                    ].map(([k, v]) => (
                      <li key={k} className="flex items-baseline justify-between" style={{ fontSize: 12, color: L.inkMuted }}>
                        <span style={{ letterSpacing: "0.14em", textTransform: "uppercase" }}>{k}</span>
                        <span style={{ color: L.inkSoft }}>{v}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Reading list */}
                <div style={{ borderTop: `1px solid ${L.rule}`, paddingTop: 18 }}>
                  <CategoryTag>Editors' picks</CategoryTag>
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

                {/* Subscribe */}
                <div style={{ borderTop: `1px solid ${L.rule}`, paddingTop: 18 }}>
                  <CategoryTag>Correspondence</CategoryTag>
                  <p className="pf" style={{ fontSize: 17, color: L.ink, fontStyle: "italic", marginTop: 12, lineHeight: 1.55 }}>
                    Receive the next edition by post.
                  </p>
                  <p style={{ fontSize: 13, color: L.inkSoft, marginTop: 12, lineHeight: 1.65 }}>
                    A single, considered email when each issue is published. No marketing.
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

      {/* ── Inter-section quote spread ──────────────────────────────────── */}
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
                maxWidth: "26ch",
              }}
            >
              "The work of a brand is the work of being remembered correctly. Everything else is
              decoration."
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
              — From No. 07, "Voice is not a tone slider"
            </p>
          </aside>
        </div>
      </section>

      {/* ── Closing colophon ────────────────────────────────────────────── */}
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
                  maxWidth: "28ch",
                  marginBottom: 32,
                }}
              >
                The next edition arrives in summer. Until then, the conversation continues
                inside.
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
                Return to the System
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
            <aside className="col-span-12 lg:col-span-5 lg:pl-12 lg:border-l" style={{ borderColor: L.ruleSoft }}>
              <p style={{ fontSize: 10, letterSpacing: "0.26em", textTransform: "uppercase", color: L.inkMuted, fontWeight: 600, marginBottom: 14 }}>
                Colophon
              </p>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: L.inkSoft, maxWidth: "36ch" }}>
                <em>The Journal</em> is published quarterly by Kinika Studio. Set in Playfair
                Display and DM Sans. Printed in pixels for founders who think long-term.
              </p>
            </aside>
          </div>
        </div>
      </section>
    </EditorialShell>
  );
}
