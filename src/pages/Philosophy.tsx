import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { EditorialShell, Container, PageMeta, L } from "@/components/editorial/EditorialLayout";

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
              <SectionMark n="III." label="On Patterns" />
            </div>
            <div className="col-span-12 lg:col-span-9">
              <SectionTitle>Every business leaves patterns behind.</SectionTitle>
              <Lede>
                The way you describe your customer at 11pm on a Tuesday. The phrase you keep
                returning to. The category you keep refusing.
              </Lede>
              <Body>
                Founders do not realize how much of their strategy is hidden inside the way they
                talk. The repeated objections. The unconscious vocabulary. The sentence that ends
                three different conversations the same way. These are not asides. They are the raw
                material of brand.
              </Body>
              <Body>
                A thinking partner that pays attention will notice them. A system worth keeping will
                hold onto them. Over weeks, the picture sharpens — not because anyone was forced to
                fill in a form, but because the conversation itself was finally treated as evidence.
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
          <PullQuote attribution="On founder conversations">
            The strategy was already there. It had been hiding inside the way she described her
            own customers.
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
              <SectionTitle>Understanding, like capital, compounds.</SectionTitle>
              <Body>
                Most software flatlines. Day one feels identical to day three hundred. You learn the
                shortcuts; the system learns nothing. Whatever insight you brought into the tool
                walks out with you when you close the tab.
              </Body>
              <Body>
                We wanted a different curve. The longer a founder spends inside Kinika, the more it
                should feel like the workspace is keeping pace with the business — not from
                cleverness, but from accumulation. A second campaign should be sharper than the
                first because the first one happened. A pitch deck written in March should benefit
                from a conversation that happened in January. Nothing is one-off.
              </Body>
              <Body>
                The result is a quiet kind of alignment. Voice does not drift between channels.
                Audience does not contradict itself between decks. The brand stops being a thing
                you defend and starts being a thing the system protects on your behalf.
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
                  Memory is the only feature that gets cheaper to maintain the longer you keep it.
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
                The first version of Kinika was not a product. It was a private notebook kept by a
                founder who had grown tired of explaining her business to machines that immediately
                forgot it. She built a small system to do the remembering for her — a place where
                her positioning, her customer interviews, her half-finished campaigns, and her
                stubborn opinions could finally live in the same room.
              </Body>
              <Body>
                Within a few weeks the notebook had become indispensable. Within a few months it
                had become opinionated. It noticed when her tone drifted. It surfaced an old
                customer quote at exactly the moment a new landing page needed it. It was not
                magical. It was simply paying attention — which, for software, turned out to be
                rare enough to feel like a discovery.
              </Body>
              <Body>
                Kinika is the version of that notebook we wanted other founders to have. A
                workspace built on the suspicion that the real intelligence in a business has
                always been the founder's own — and the only reasonable job of the software is to
                keep it, sharpen it, and hand it back at the right moment.
              </Body>
              <Body>
                We are not building another tool. We are building a place where understanding
                accumulates. A studio that grows alongside the founder, instead of underneath them.
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
  );
}
