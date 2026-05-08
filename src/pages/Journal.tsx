import { EditorialShell, Container, PageMeta, PageTitle, L } from "@/components/editorial/EditorialLayout";

const FEATURED = {
  category: "Field Notes",
  title: "On the patience of memory.",
  excerpt:
    "We spent eighteen months removing every onboarding form from Kinika. What replaced them was something quieter: a conversation that listens, and a system that keeps every word.",
  read: "9 min read",
  date: "March 2026",
  author: "The Editors",
};

const ENTRIES = [
  {
    n: "No. 04",
    category: "Founder Stories",
    title: "How Nordform stopped re-explaining itself.",
    excerpt:
      "A studio of three, a brand of one voice. A look at how a Stockholm furniture maker compressed a year of brand decisions into a single living document.",
    date: "Feb 2026",
    read: "7 min",
  },
  {
    n: "No. 03",
    category: "Field Notes",
    title: "The blank page is a bug.",
    excerpt:
      "Why every prompt should arrive pre-loaded with everything the system already knows about you — and what changes when it does.",
    date: "Feb 2026",
    read: "5 min",
  },
  {
    n: "No. 02",
    category: "Release Notes",
    title: "Brand DNA, year one.",
    excerpt:
      "What we learned watching a thousand founders teach the system who they are. Twelve quiet improvements that arrived this season.",
    date: "Jan 2026",
    read: "6 min",
  },
  {
    n: "No. 01",
    category: "Manifesto",
    title: "A workspace that remembers.",
    excerpt:
      "The opening letter. A short essay on why the next decade of software has to learn how to keep notes.",
    date: "Jan 2026",
    read: "4 min",
  },
];

export default function Journal() {
  return (
    <EditorialShell>
      <section style={{ background: L.paper }}>
        <Container>
          <PageMeta issue="Vol. 01" section="Journal" date="Spring 2026" />
          <PageTitle kicker="Field notes & founder stories">Slow writing for builders.</PageTitle>

          <div className="ed-fade ed-d2" style={{ maxWidth: "60ch", marginBottom: 96 }}>
            <p style={{ fontSize: 17, lineHeight: 1.75, color: L.inkSoft }}>
              The Journal is where Kinika thinks out loud — essays, observations, and the occasional letter from
              the founders we build alongside. Read at the pace of a long evening.
            </p>
          </div>

          {/* Featured entry */}
          <article className="grid grid-cols-12 gap-6 lg:gap-12" style={{ borderTop: `1px solid ${L.rule}`, paddingTop: 56, marginBottom: 96 }}>
            <div className="col-span-12 lg:col-span-4">
              <span style={{ fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", color: L.amber, fontWeight: 600 }}>
                Featured · {FEATURED.category}
              </span>
              <p style={{ fontSize: 12, color: L.inkMuted, marginTop: 16, letterSpacing: "0.16em", textTransform: "uppercase" }}>
                {FEATURED.date} · {FEATURED.read}
              </p>
              <p style={{ fontSize: 13, color: L.inkMuted, marginTop: 8, fontStyle: "italic" }}>By {FEATURED.author}</p>
            </div>
            <div className="col-span-12 lg:col-span-8">
              <h2
                className="pf"
                style={{
                  fontSize: "clamp(36px, 4.4vw, 60px)",
                  lineHeight: 1.05,
                  color: L.ink,
                  fontWeight: 500,
                  letterSpacing: "-0.025em",
                  marginBottom: 24,
                  maxWidth: "18ch",
                }}
              >
                {FEATURED.title}
              </h2>
              <p style={{ fontSize: 17, lineHeight: 1.7, color: L.inkSoft, maxWidth: "52ch" }}>
                {FEATURED.excerpt}
              </p>
              <a href="#" className="inline-block group" style={{ marginTop: 32, color: L.ink, fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${L.amber}`, paddingBottom: 4 }}>
                Read the essay
              </a>
            </div>
          </article>

          {/* Archive list */}
          <div style={{ marginBottom: 24 }}>
            <span style={{ fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", color: L.amber, fontWeight: 600 }}>
              The archive
            </span>
          </div>

          <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {ENTRIES.map((e, idx) => (
              <li
                key={e.n}
                className="grid grid-cols-12 gap-6 lg:gap-12 py-10 group cursor-pointer"
                style={{ borderTop: idx === 0 ? `1px solid ${L.rule}` : "none", borderBottom: `1px solid ${L.rule}`, transition: "background 0.3s ease" }}
              >
                <div className="col-span-12 sm:col-span-2">
                  <span className="pf" style={{ fontSize: 22, color: L.amber, fontStyle: "italic" }}>
                    {e.n}
                  </span>
                </div>
                <div className="col-span-12 sm:col-span-7">
                  <p style={{ fontSize: 11, color: L.inkMuted, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 12 }}>
                    {e.category}
                  </p>
                  <h3
                    className="pf"
                    style={{
                      fontSize: "clamp(22px, 2.4vw, 30px)",
                      lineHeight: 1.2,
                      color: L.ink,
                      fontWeight: 500,
                      letterSpacing: "-0.015em",
                      marginBottom: 12,
                    }}
                  >
                    {e.title}
                  </h3>
                  <p style={{ fontSize: 15, lineHeight: 1.7, color: L.inkSoft, maxWidth: "52ch" }}>{e.excerpt}</p>
                </div>
                <div className="col-span-12 sm:col-span-3 sm:text-right">
                  <p style={{ fontSize: 12, color: L.inkMuted, letterSpacing: "0.16em", textTransform: "uppercase" }}>
                    {e.date}
                  </p>
                  <p style={{ fontSize: 12, color: L.inkMuted, marginTop: 6, letterSpacing: "0.04em" }}>{e.read}</p>
                </div>
              </li>
            ))}
          </ol>
        </Container>
      </section>
    </EditorialShell>
  );
}
