import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { EditorialShell, Container, PageMeta, PageTitle, L } from "@/components/editorial/EditorialLayout";

const TENETS = [
  {
    n: "I.",
    title: "Memory before output.",
    body: "Most tools start with a blank page. Kinika starts with everything it has ever learned about your business. The blank page is a failure of memory, not a feature of creativity.",
  },
  {
    n: "II.",
    title: "Brand is a living document.",
    body: "Your voice, your audience, your positioning — these are not fields in a form. They are observations gathered over time, refined through conversation, and never finished.",
  },
  {
    n: "III.",
    title: "Quiet intelligence.",
    body: "Software should not perform its cleverness. It should sit beside you, notice what matters, and return it when you need it. The best tools are barely audible.",
  },
  {
    n: "IV.",
    title: "Compounding craft.",
    body: "Every conversation, every artifact, every decision feeds the next. Nothing is one-off. The system grows more useful the longer you stay inside it.",
  },
];

export default function Philosophy() {
  return (
    <EditorialShell>
      <section style={{ background: L.paper }}>
        <Container narrow>
          <PageMeta issue="Vol. 01" section="Philosophy" date="Spring 2026" />
          <PageTitle kicker="On thinking partners">A founder's tools should remember.</PageTitle>

          <div className="ed-fade ed-d2" style={{ maxWidth: "62ch" }}>
            <p
              className="pf"
              style={{
                fontSize: "clamp(20px, 1.6vw, 24px)",
                lineHeight: 1.55,
                color: L.inkSoft,
                fontWeight: 400,
                marginBottom: 28,
                fontStyle: "italic",
              }}
            >
              Kinika was built on the suspicion that most software has been designed to forget you the moment
              you close the tab. We disagreed.
            </p>
            <p style={{ fontSize: 17, lineHeight: 1.75, color: L.inkSoft, marginBottom: 22 }}>
              The founder's day is a procession of interruptions. A new tool, a new login, a new explanation of the
              same brand to the same generic intelligence. By the time the work begins, the context is already gone.
            </p>
            <p style={{ fontSize: 17, lineHeight: 1.75, color: L.inkSoft }}>
              We wanted something quieter. A workspace that listens carefully, holds onto what matters, and
              returns it on the next page — and the next, and the next.
            </p>
          </div>

          <div style={{ height: 1, background: L.rule, margin: "96px 0 72px" }} />

          <div style={{ marginBottom: 48 }}>
            <span style={{ fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", color: L.amber, fontWeight: 600 }}>
              Four tenets
            </span>
            <h2
              className="pf"
              style={{
                fontSize: "clamp(32px, 3.6vw, 52px)",
                lineHeight: 1.1,
                color: L.ink,
                marginTop: 16,
                fontWeight: 500,
                letterSpacing: "-0.02em",
                maxWidth: "20ch",
              }}
            >
              The principles that shape every decision we make.
            </h2>
          </div>

          <div className="grid gap-x-12 gap-y-16 md:grid-cols-2">
            {TENETS.map((t) => (
              <article key={t.n}>
                <span
                  className="pf"
                  style={{
                    fontStyle: "italic",
                    color: L.amber,
                    fontSize: 22,
                    letterSpacing: "0.02em",
                  }}
                >
                  {t.n}
                </span>
                <h3
                  className="pf"
                  style={{
                    fontSize: 26,
                    lineHeight: 1.25,
                    color: L.ink,
                    marginTop: 8,
                    marginBottom: 14,
                    fontWeight: 500,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {t.title}
                </h3>
                <p style={{ fontSize: 15, lineHeight: 1.7, color: L.inkSoft }}>{t.body}</p>
              </article>
            ))}
          </div>

          <div style={{ height: 1, background: L.rule, margin: "120px 0 56px" }} />

          <aside
            className="pf"
            style={{
              fontSize: "clamp(24px, 2.4vw, 32px)",
              fontStyle: "italic",
              color: L.ink,
              lineHeight: 1.4,
              fontWeight: 400,
              maxWidth: "26ch",
              marginBottom: 56,
            }}
          >
            "We are not building another tool. We are building a place where your work accumulates."
            <span style={{ display: "block", marginTop: 20, fontStyle: "normal", fontSize: 12, color: L.inkMuted, letterSpacing: "0.18em", textTransform: "uppercase" }}>
              — Editor's Note
            </span>
          </aside>

          <Link
            to="/system"
            className="inline-flex items-center gap-3 group"
            style={{ color: L.ink, fontSize: 14, letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600 }}
          >
            Continue to the System
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </Container>
      </section>
    </EditorialShell>
  );
}
