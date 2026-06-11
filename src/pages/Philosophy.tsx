import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { EditorialShell, Container, PageMeta, L } from "@/components/editorial/EditorialLayout";
import { SEO } from "@/components/SEO";

/* ── Small editorial primitives, scoped to this essay ───────────────────── */

function SectionMark({ n, label }: { n: string; label: string }) {
  return (
    <div className="flex items-center gap-4" style={{ marginBottom: 28 }}>
      <span
        className="pf"
        style={{ fontStyle: "italic", color: L.amber, fontSize: 22, letterSpacing: "0.01em" }}
      >
        {n}
      </span>
      <span style={{ width: 32, height: 1, background: L.rule }} />
      <span
        style={{
          fontSize: 11,
          letterSpacing: "0.24em",
          textTransform: "uppercase",
          color: L.inkMuted,
          fontWeight: 600,
        }}
      >
        {label}
      </span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="pf"
      style={{
        fontSize: "clamp(36px, 4.6vw, 64px)",
        lineHeight: 1.04,
        color: L.ink,
        fontWeight: 500,
        letterSpacing: "-0.025em",
        maxWidth: "18ch",
        marginBottom: 40,
      }}
    >
      {children}
    </h2>
  );
}

function Lede({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="pf"
      style={{
        fontSize: "clamp(20px, 1.7vw, 26px)",
        lineHeight: 1.55,
        color: L.inkSoft,
        fontStyle: "italic",
        fontWeight: 400,
        marginBottom: 28,
        maxWidth: "44ch",
      }}
    >
      {children}
    </p>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: 17,
        lineHeight: 1.78,
        color: L.inkSoft,
        marginBottom: 22,
        maxWidth: "62ch",
      }}
    >
      {children}
    </p>
  );
}

function PullQuote({ children, attribution }: { children: React.ReactNode; attribution?: string }) {
  return (
    <aside
      style={{
        margin: "72px 0",
        paddingLeft: "clamp(20px, 4vw, 56px)",
        borderLeft: `1px solid ${L.amber}`,
      }}
    >
      <p
        className="pf"
        style={{
          fontSize: "clamp(28px, 3.4vw, 44px)",
          lineHeight: 1.25,
          color: L.ink,
          fontStyle: "italic",
          fontWeight: 400,
          letterSpacing: "-0.02em",
          maxWidth: "26ch",
        }}
      >
        “{children}”
      </p>
      {attribution && (
        <p
          style={{
            marginTop: 18,
            fontSize: 11,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: L.inkMuted,
            fontWeight: 600,
          }}
        >
          — {attribution}
        </p>
      )}
    </aside>
  );
}

function FirstLetter({ letter, children }: { letter: string; children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: 17,
        lineHeight: 1.78,
        color: L.inkSoft,
        marginBottom: 22,
        maxWidth: "62ch",
      }}
    >
      <span
        className="pf"
        style={{
          float: "left",
          fontSize: 86,
          lineHeight: 0.85,
          color: L.ink,
          marginRight: 14,
          marginTop: 6,
          fontWeight: 500,
          letterSpacing: "-0.04em",
        }}
      >
        {letter}
      </span>
      {children}
    </p>
  );
}

/* ── Memory diagram (subtle, hand-drawn feel) ───────────────────────────── */

function MemoryDiagram() {
  // A quiet asymmetric diagram: scattered conversation marks → gathered points → a single line of pattern
  return (
    <figure className="my-8" aria-hidden>
      <svg
        viewBox="0 0 800 320"
        width="100%"
        style={{ display: "block", maxWidth: 760, margin: "0 auto" }}
      >
        <defs>
          <pattern id="dotgrid" width="14" height="14" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.7" fill={L.inkMuted} opacity="0.18" />
          </pattern>
        </defs>
        <rect width="800" height="320" fill="url(#dotgrid)" opacity="0.5" />

        {/* Left cluster — scattered marks (conversations) */}
        <g opacity="0.85">
          {[
            [60, 90], [110, 60], [140, 130], [80, 170], [180, 100], [100, 220],
            [200, 180], [70, 250], [220, 60], [150, 220], [190, 260], [240, 130],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={2.5} fill={L.inkSoft} />
          ))}
          <text
            x="60"
            y="290"
            fontFamily="DM Sans, sans-serif"
            fontSize="10"
            letterSpacing="2"
            fill={L.inkMuted}
          >
            DISCONNECTED TOOLS
          </text>
        </g>

        {/* Drift lines — gathering inward */}
        <g stroke={L.inkMuted} strokeWidth="0.6" fill="none" opacity="0.6">
          <path d="M 250,120 Q 340,80 420,160" />
          <path d="M 250,160 Q 340,140 420,160" />
          <path d="M 250,200 Q 340,200 420,160" />
        </g>

        {/* Center node — unified context */}
        <g>
          <circle cx="430" cy="160" r="36" fill="none" stroke={L.amber} strokeWidth="1" />
          <circle cx="430" cy="160" r="22" fill="none" stroke={L.amber} strokeWidth="0.6" opacity="0.6" />
          <circle cx="430" cy="160" r="4" fill={L.amber} />
          <text
            x="430"
            y="232"
            textAnchor="middle"
            fontFamily="DM Sans, sans-serif"
            fontSize="10"
            letterSpacing="2"
            fill={L.inkMuted}
          >
            BUSINESS CONTEXT
          </text>
        </g>

        {/* Right side — coherent output as a quiet line */}
        <g stroke={L.ink} strokeWidth="1" fill="none">
          <path d="M 472,160 C 540,140 600,200 660,150 S 760,170 780,150" />
        </g>
        <g>
          <text
            x="780"
            y="180"
            textAnchor="end"
            fontFamily="DM Sans, sans-serif"
            fontSize="10"
            letterSpacing="2"
            fill={L.inkMuted}
          >
            COHERENT OUTPUT
          </text>
        </g>
      </svg>
      <figcaption
        style={{
          marginTop: 18,
          fontSize: 12,
          color: L.inkMuted,
          textAlign: "center",
          fontStyle: "italic",
          letterSpacing: "0.04em",
        }}
      >
        Fig. 01 — Disconnected tools resolve into a single business context. Context produces coherent output.
      </figcaption>
    </figure>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export default function Philosophy() {
  return (
    <>
      <SEO
        title="Philosophy — Kinika"
        description="Why Kinika exists: context as infrastructure for founders, not another tool that resets the conversation every time."
        path="/philosophy"
        ogType="article"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "The Kinika Philosophy",
          author: { "@type": "Organization", name: "Kinika" },
          datePublished: "2026-03-01",
          publisher: { "@type": "Organization", name: "Kinika" },
        }}
      />
    <EditorialShell>
      {/* Opening spread ----------------------------------------------------- */}
      <section style={{ background: L.paper }}>
        <Container>
          <PageMeta issue="Kinika" section="Philosophy" date="Why we built it" />

          <div className="grid grid-cols-12 gap-8 lg:gap-16">
            <div className="col-span-12 lg:col-span-8">
              <p
                className="pf ed-fade"
                style={{
                  fontStyle: "italic",
                  color: L.amber,
                  fontSize: 18,
                  marginBottom: 24,
                  letterSpacing: "0.01em",
                }}
              >
                Why Kinika exists.
              </p>
              <h1
                className="pf ed-fade ed-d1"
                style={{
                  color: L.ink,
                  fontSize: "clamp(52px, 8vw, 132px)",
                  lineHeight: 0.94,
                  fontWeight: 500,
                  letterSpacing: "-0.035em",
                }}
              >
                The tools work. The system doesn't.
              </h1>
            </div>
            <aside className="col-span-12 lg:col-span-4 lg:pt-24">
              <div
                style={{
                  borderTop: `1px solid ${L.amber}`,
                  paddingTop: 18,
                  maxWidth: 320,
                }}
                className="ed-fade ed-d2"
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
                  In short
                </p>
                <p
                  className="pf"
                  style={{
                    fontSize: 17,
                    lineHeight: 1.6,
                    color: L.inkSoft,
                    fontStyle: "italic",
                  }}
                >
                  Kinika is a unified business context layer for the modern
                  founder — one place where positioning, audience and creative
                  work stay connected across every workflow.
                </p>
              </div>
            </aside>
          </div>

          <div style={{ height: 1, background: L.rule, margin: "96px 0 0" }} />
        </Container>
      </section>

      {/* I — AI forgot the founder ----------------------------------------- */}
      <section style={{ background: L.paper }}>
        <div
          className="mx-auto"
          style={{
            maxWidth: 1320,
            paddingLeft: "clamp(24px, 6vw, 96px)",
            paddingRight: "clamp(24px, 6vw, 96px)",
            paddingTop: "clamp(80px, 10vh, 120px)",
            paddingBottom: "clamp(80px, 10vh, 120px)",
          }}
        >
          <div className="grid grid-cols-12 gap-8 lg:gap-16">
            <div className="col-span-12 lg:col-span-3">
              <SectionMark n="I." label="The Fragmentation" />
            </div>
            <div className="col-span-12 lg:col-span-9">
              <SectionTitle>Modern creative work is fragmented at the level of understanding.</SectionTitle>
              <Lede>
                A founder runs a single business across a dozen disconnected systems. None of them know that.
              </Lede>
              <FirstLetter letter="T">
                he modern founder operates a different tool for design, content, planning,
                documents, campaigns, scheduling and creative production. Each one is competent
                inside its own surface. None of them understand the business they are working on.
                Strategy lives in one window, voice in another, audience somewhere else entirely —
                and the only thing connecting them is the founder, holding the thread by hand.
              </FirstLetter>
              <Body>
                The result is a quiet operational tax. Positioning gets re-explained at the start
                of every task. Audience gets re-described in every brief. Tone gets approximated
                from memory. The same context is rebuilt, manually, every time the founder switches
                surfaces — and a small amount of the brand is lost in the handoff each time.
              </Body>
              <Body>
                What looks like a productivity stack is, in practice, a set of isolated workflows
                with the founder acting as the integration layer. The tools are not weak. They are
                simply working alone — on a business none of them have ever met.
              </Body>
            </div>
          </div>
        </div>
      </section>

      {/* Pull quote */}
      <section style={{ background: L.paperDeep }}>
        <div
          className="mx-auto"
          style={{
            maxWidth: 1100,
            paddingLeft: "clamp(24px, 6vw, 96px)",
            paddingRight: "clamp(24px, 6vw, 96px)",
            paddingTop: "clamp(72px, 9vh, 112px)",
            paddingBottom: "clamp(72px, 9vh, 112px)",
          }}
        >
          <PullQuote attribution="On disconnected workflows">
            The problem was never that the tools were weak. It was that they were working alone.
          </PullQuote>
        </div>
      </section>

      {/* II — Why context matters more than prompts ------------------------ */}
      <section style={{ background: L.paper }}>
        <div
          className="mx-auto"
          style={{
            maxWidth: 1320,
            paddingLeft: "clamp(24px, 6vw, 96px)",
            paddingRight: "clamp(24px, 6vw, 96px)",
            paddingTop: "clamp(80px, 10vh, 120px)",
            paddingBottom: "clamp(80px, 10vh, 120px)",
          }}
        >
          <div className="grid grid-cols-12 gap-8 lg:gap-16">
            <div className="col-span-12 lg:col-span-9 lg:col-start-4">
              <SectionMark n="II." label="On Context" />
              <SectionTitle>A brief is a sentence. Context is a worldview.</SectionTitle>
              <Body>
                Most creative tools begin from zero. A blank brief, a fresh prompt, a new project
                — and an implicit assumption that the founder will, once again, supply everything
                the tool needs to know about the business. Better briefs do not solve this. The
                problem is structural: the tool has no idea who you are, and no way to find out
                that survives the session.
              </Body>
              <Body>
                Generic input produces generic output because isolated tools have no choice. Without
                your audience, your competitors, your taste, your prior decisions, your objections,
                your story — any system is forced to average. And what is averaged is, by
                definition, not yours.
              </Body>
              <Body>
                Context is the difference between a workflow that asks you to start over and a
                workspace that already knows what the brand is for. We are not interested in the
                first. We are building toward the second.
              </Body>

              {/* Inline asymmetric framing */}
              <div
                className="grid grid-cols-12 gap-6"
                style={{ marginTop: 56, paddingTop: 32, borderTop: `1px solid ${L.rule}` }}
              >
                <div className="col-span-12 sm:col-span-5">
                  <p
                    style={{
                      fontSize: 11,
                      letterSpacing: "0.24em",
                      textTransform: "uppercase",
                      color: L.amber,
                      fontWeight: 600,
                      marginBottom: 10,
                    }}
                  >
                    Disconnected
                  </p>
                  <p className="pf" style={{ fontSize: 22, lineHeight: 1.4, color: L.ink, fontStyle: "italic", fontWeight: 400 }}>
                    Re-explaining the business at the start of every task.
                  </p>
                </div>
                <div className="col-span-12 sm:col-span-2 hidden sm:block" aria-hidden>
                  <div style={{ height: "100%", width: 1, background: L.rule, margin: "0 auto" }} />
                </div>
                <div className="col-span-12 sm:col-span-5">
                  <p
                    style={{
                      fontSize: 11,
                      letterSpacing: "0.24em",
                      textTransform: "uppercase",
                      color: L.amber,
                      fontWeight: 600,
                      marginBottom: 10,
                    }}
                  >
                    Connected
                  </p>
                  <p className="pf" style={{ fontSize: 22, lineHeight: 1.4, color: L.ink, fontStyle: "italic", fontWeight: 400 }}>
                    The business already in the room when the work begins.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* III — Every business leaves patterns behind ----------------------- */}
      <section style={{ background: L.paper }}>
        <div
          className="mx-auto"
          style={{
            maxWidth: 1320,
            paddingLeft: "clamp(24px, 6vw, 96px)",
            paddingRight: "clamp(24px, 6vw, 96px)",
            paddingTop: "clamp(80px, 10vh, 120px)",
            paddingBottom: "clamp(80px, 10vh, 120px)",
            borderTop: `1px solid ${L.rule}`,
          }}
        >
          <div className="grid grid-cols-12 gap-8 lg:gap-16">
            <div className="col-span-12 lg:col-span-3">
              <SectionMark n="III." label="On Coherence" />
            </div>
            <div className="col-span-12 lg:col-span-9">
              <SectionTitle>A brand is a system, not a stack of outputs.</SectionTitle>
              <Lede>
                When every workflow runs in isolation, the brand drifts — quietly, in every
                handoff, in every channel.
              </Lede>
              <Body>
                Founders rarely lose their brand in a single decision. They lose it in the spaces
                between tools. The deck contradicts the landing page. The campaign forgets the
                positioning. The new template feels generic because the system that produced it
                never met the audience. Each output, on its own, looks reasonable. Together, they
                describe a slightly different business each time.
              </Body>
              <Body>
                Coherence is not a content problem. It is an architecture problem. A workspace that
                holds one shared business context across every workflow makes consistency a
                property of the system, not a discipline imposed by the founder after the fact.
              </Body>

              <MemoryDiagram />
            </div>
          </div>
        </div>
      </section>

      {/* Pull quote II */}
      <section style={{ background: L.paperDeep }}>
        <div
          className="mx-auto"
          style={{
            maxWidth: 1100,
            paddingLeft: "clamp(24px, 6vw, 96px)",
            paddingRight: "clamp(24px, 6vw, 96px)",
            paddingTop: "clamp(72px, 9vh, 112px)",
            paddingBottom: "clamp(72px, 9vh, 112px)",
          }}
        >
          <PullQuote attribution="On the integration layer">
            Founders should not have to rebuild business context every time they switch tools.
          </PullQuote>
        </div>
      </section>

      {/* IV — Understanding compounds -------------------------------------- */}
      <section style={{ background: L.paper }}>
        <div
          className="mx-auto"
          style={{
            maxWidth: 1320,
            paddingLeft: "clamp(24px, 6vw, 96px)",
            paddingRight: "clamp(24px, 6vw, 96px)",
            paddingTop: "clamp(80px, 10vh, 120px)",
            paddingBottom: "clamp(80px, 10vh, 120px)",
          }}
        >
          <div className="grid grid-cols-12 gap-8 lg:gap-16">
            <div className="col-span-12 lg:col-span-9">
              <SectionMark n="IV." label="On Compounding" />
              <SectionTitle>Connected context compounds. Disconnected work resets.</SectionTitle>
              <Body>
                Most software flatlines. Day one feels identical to day three hundred, because
                each session begins on an empty canvas. Whatever the founder taught the tool walks
                out with them when the tab closes.
              </Body>
              <Body>
                A connected workspace behaves differently. The longer a founder works inside one
                shared business context, the more every new workflow inherits — positioning,
                audience, voice, prior decisions, the things that worked and the things that
                didn't. A second campaign is sharper than the first because the first one happened.
                A document written in March benefits from a brief written in January. Nothing is
                one-off, because nothing is isolated.
              </Body>
              <Body>
                The result is a quiet kind of alignment. Voice does not drift between channels.
                Audience does not contradict itself between decks. The brand stops being a thing
                the founder defends manually and starts being a property of the system itself.
              </Body>
            </div>

            <aside className="col-span-12 lg:col-span-3 lg:pt-20">
              <div
                style={{
                  borderTop: `1px solid ${L.amber}`,
                  paddingTop: 18,
                }}
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
                  In practice
                </p>
                <p
                  className="pf"
                  style={{ fontSize: 18, lineHeight: 1.55, color: L.inkSoft, fontStyle: "italic" }}
                >
                  A connected business context is the only layer in the stack that gets more
                  valuable the longer it runs.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* V — Why Kinika exists --------------------------------------------- */}
      <section style={{ background: L.paper }}>
        <div
          className="mx-auto"
          style={{
            maxWidth: 1320,
            paddingLeft: "clamp(24px, 6vw, 96px)",
            paddingRight: "clamp(24px, 6vw, 96px)",
            paddingTop: "clamp(80px, 10vh, 120px)",
            paddingBottom: "clamp(80px, 10vh, 120px)",
            borderTop: `1px solid ${L.rule}`,
          }}
        >
          <div className="grid grid-cols-12 gap-8 lg:gap-16">
            <div className="col-span-12 lg:col-span-3">
              <SectionMark n="V." label="The Origin" />
            </div>
            <div className="col-span-12 lg:col-span-9">
              <SectionTitle>Why Kinika exists.</SectionTitle>
              <Lede>
                It began with one founder, eleven open tabs, and the unmistakable feeling of being
                the only thing in the room holding everything together.
              </Lede>
              <Body>
                The first version of Kinika was not a product. It was a private operating layer
                built by a founder who had grown tired of being the connective tissue between her
                own tools — re-explaining the business in every brief, reconciling outputs that
                quietly contradicted each other, carrying positioning by hand from one workflow to
                the next.
              </Body>
              <Body>
                The fix turned out to be structural, not creative. One shared business context.
                Positioning, audience, voice, prior decisions and creative work, all sitting in the
                same room. The individual workflows did not need to be more powerful. They needed
                to stop working alone.
              </Body>
              <Body>
                Kinika is the version of that layer we wanted other founders to have. A unified
                business context across every creative workflow — so the brand stays coherent by
                default, not by discipline.
              </Body>
              <Body>
                We are not building another tool. We are building the connective layer the modern
                founder has been quietly providing for free.
              </Body>
            </div>
          </div>
        </div>
      </section>

      {/* Closing colophon --------------------------------------------------- */}
      <section style={{ background: L.paper }}>
        <div
          className="mx-auto"
          style={{
            maxWidth: 1100,
            paddingLeft: "clamp(24px, 6vw, 96px)",
            paddingRight: "clamp(24px, 6vw, 96px)",
            paddingTop: "clamp(64px, 8vh, 96px)",
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
                  maxWidth: "26ch",
                  marginBottom: 32,
                }}
              >
                Start building with Kinika.
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
              <p
                style={{
                  fontSize: 10,
                  letterSpacing: "0.26em",
                  textTransform: "uppercase",
                  color: L.inkMuted,
                  fontWeight: 600,
                  marginBottom: 14,
                }}
              >
                About this page
              </p>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: L.inkSoft, maxWidth: "36ch" }}>
                A short statement of what Kinika is for and why it works the way
                it does. Written for founders who think long-term about the
                business they're building.
              </p>
            </aside>
          </div>
        </div>
      </section>
    </EditorialShell>
    </>
  );
}
