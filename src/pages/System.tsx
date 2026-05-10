import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { EditorialShell, Container, PageMeta, L } from "@/components/editorial/EditorialLayout";

/* ── Editorial primitives (scoped to this page) ─────────────────────────── */

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
        fontSize: "clamp(34px, 4.4vw, 60px)",
        lineHeight: 1.05,
        color: L.ink,
        fontWeight: 500,
        letterSpacing: "-0.025em",
        maxWidth: "20ch",
        marginBottom: 32,
      }}
    >
      {children}
    </h2>
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

/* ── Diagram 01 — Core flow ─────────────────────────────────────────────── */
/* Conversation → Memory → Understanding → Aligned Creation                  */

function CoreFlowDiagram() {
  const stops = [
    { label: "Conversation", note: "Spoken inputs, fragments, asides." },
    { label: "Memory", note: "Captured, indexed, never re-asked." },
    { label: "Understanding", note: "Patterns, voice, positioning." },
    { label: "Aligned Creation", note: "Outputs the brand recognises." },
  ];

  return (
    <figure
      style={{
        width: "100%",
        background: L.paper,
        padding: "clamp(24px, 4vw, 48px) 0",
      }}
    >
      <svg
        viewBox="0 0 1200 280"
        width="100%"
        style={{ display: "block", maxWidth: 1200, overflow: "visible" }}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        {/* horizontal editorial spine */}
        <line x1="160" y1="140" x2="1040" y2="140" stroke={L.rule} strokeWidth="1" />

        {stops.map((s, i) => {
          const x = 160 + i * (880 / 3);
          const isLast = i === stops.length - 1;
          return (
            <g key={s.label}>
              {/* dot — amber on the last (output) */}
              <circle cx={x} cy={140} r={isLast ? 6 : 4} fill={isLast ? L.amber : L.ink} />
              {isLast && (
                <circle cx={x} cy={140} r={14} fill="none" stroke={L.amber} strokeWidth="0.6" opacity="0.6" />
              )}
              {/* number */}
              <text
                x={x}
                y={92}
                textAnchor="middle"
                fontFamily="Playfair Display, serif"
                fontStyle="italic"
                fontSize="20"
                fill={L.amber}
              >
                {`0${i + 1}`}
              </text>
              {/* label */}
              <text
                x={x}
                y={184}
                textAnchor="middle"
                fontFamily="Playfair Display, serif"
                fontSize="22"
                fontWeight="500"
                fill={L.ink}
              >
                {s.label}
              </text>
              {/* note */}
              <text
                x={x}
                y={212}
                textAnchor="middle"
                fontFamily="DM Sans, sans-serif"
                fontSize="11"
                fill={L.inkMuted}
                letterSpacing="0.5"
              >
                {s.note}
              </text>
            </g>
          );
        })}

        {/* feedback loop — thin returning line, "every output strengthens memory" */}
        <path
          d="M 1040,140 C 1100,140 1100,40 1020,40 L 180,40 C 100,40 100,140 160,140"
          fill="none"
          stroke={L.amber}
          strokeWidth="0.8"
          strokeDasharray="2 4"
          opacity="0.6"
        />
        <text
          x={600}
          y={26}
          textAnchor="middle"
          fontFamily="DM Sans, sans-serif"
          fontSize="10"
          letterSpacing="3"
          fill={L.inkMuted}
        >
          EACH OUTPUT RETURNS TO MEMORY
        </text>
      </svg>
      <figcaption
        style={{
          marginTop: 16,
          fontSize: 12,
          color: L.inkMuted,
          textAlign: "center",
          fontStyle: "italic",
          letterSpacing: "0.04em",
        }}
      >
        Fig. 01 — The cognitive flow. A loop, not a funnel.
      </figcaption>
    </figure>
  );
}

/* ── Diagram 02 — Layered context ───────────────────────────────────────── */
/* Conversation transcripts → Brand DNA → Journey Record → Live context     */

function LayeredContextDiagram() {
  const layers = [
    { label: "Live conversation", note: "What is being said, right now.", offset: 0, opacity: 1 },
    { label: "Journey Record", note: "Where the founder stands today.", offset: 28, opacity: 0.85 },
    { label: "Brand DNA", note: "Voice, audience, positioning, taste.", offset: 56, opacity: 0.7 },
    { label: "Memory archive", note: "Every prior exchange, indexed.", offset: 84, opacity: 0.55 },
  ];

  return (
    <figure
      style={{
        background: L.paperDeep,
        padding: "clamp(40px, 6vw, 80px) clamp(24px, 4vw, 48px)",
        borderTop: `1px solid ${L.rule}`,
        borderBottom: `1px solid ${L.rule}`,
      }}
    >
      <svg
        viewBox="0 0 1040 360"
        width="100%"
        style={{ display: "block", maxWidth: 1040, margin: "0 auto", overflow: "visible" }}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        {/* Stacked translucent strata — like geological layers of memory */}
        {layers
          .slice()
          .reverse()
          .map((l, i) => {
            const y = 40 + i * 56;
            return (
              <g key={l.label}>
                <rect
                  x={120 + l.offset}
                  y={y}
                  width={620 - l.offset * 2}
                  height={42}
                  fill={L.ink}
                  opacity={0.05 + i * 0.04}
                />
                <line
                  x1={120 + l.offset}
                  y1={y + 42}
                  x2={740 - l.offset}
                  y2={y + 42}
                  stroke={L.ink}
                  strokeWidth="0.6"
                  opacity="0.3"
                />
              </g>
            );
          })}

        {/* Right-side annotations */}
        {layers.map((l, i) => {
          const y = 40 + (layers.length - 1 - i) * 56 + 28;
          return (
            <g key={l.label}>
              <line
                x1={740 - l.offset}
                y1={y}
                x2={780}
                y2={y}
                stroke={L.amber}
                strokeWidth="0.6"
              />
              <text
                x={788}
                y={y - 4}
                fontFamily="Playfair Display, serif"
                fontSize="15"
                fontWeight="500"
                fill={L.ink}
              >
                {l.label}
              </text>
              <text
                x={788}
                y={y + 12}
                fontFamily="DM Sans, sans-serif"
                fontSize="10"
                fill={L.inkMuted}
                letterSpacing="0.5"
              >
                {l.note}
              </text>
            </g>
          );
        })}

        {/* Vertical depth indicator on the left */}
        <line x1={100} y1={40} x2={100} y2={264} stroke={L.amber} strokeWidth="0.8" />
        <text
          x={92}
          y={48}
          textAnchor="end"
          fontFamily="DM Sans, sans-serif"
          fontSize="10"
          letterSpacing="2"
          fill={L.inkMuted}
        >
          NOW
        </text>
        <text
          x={92}
          y={262}
          textAnchor="end"
          fontFamily="DM Sans, sans-serif"
          fontSize="10"
          letterSpacing="2"
          fill={L.inkMuted}
        >
          ARCHIVE
        </text>

        {/* Output arrow — bottom */}
        <line x1={300} y1={310} x2={620} y2={310} stroke={L.ink} strokeWidth="0.8" />
        <polygon points="620,310 612,306 612,314" fill={L.ink} />
        <text
          x={460}
          y={302}
          textAnchor="middle"
          fontFamily="DM Sans, sans-serif"
          fontSize="11"
          letterSpacing="2"
          fill={L.inkMuted}
        >
          ASSEMBLED INTO EVERY OUTPUT
        </text>
      </svg>
      <figcaption
        style={{
          marginTop: 24,
          fontSize: 12,
          color: L.inkMuted,
          textAlign: "center",
          fontStyle: "italic",
          letterSpacing: "0.04em",
        }}
      >
        Fig. 02 — Four strata of context, present at every prompt.
      </figcaption>
    </figure>
  );
}

/* ── Diagram 03 — Module web ────────────────────────────────────────────── */
/* Six rooms, one shared memory                                              */

function ModuleWebDiagram() {
  const cx = 400;
  const cy = 260;
  const R = 200;

  const modules = [
    { name: "Kinika", role: "Conversation", a: -90 },
    { name: "ProStudio", role: "Visuals", a: -30 },
    { name: "ContentStudio", role: "Channels", a: 30 },
    { name: "Calendar", role: "Cadence", a: 90 },
    { name: "DocStudio", role: "Documents", a: 150 },
    { name: "ReelBuilder", role: "Story", a: 210 },
  ];

  return (
    <figure
      style={{
        padding: "clamp(40px, 6vw, 80px) clamp(24px, 4vw, 48px)",
        background: L.paper,
      }}
    >
      <svg
        viewBox="0 0 800 560"
        width="100%"
        style={{ display: "block", maxWidth: 800, margin: "0 auto" }}
        aria-hidden
      >
        <defs>
          <radialGradient id="memCore" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={L.amber} stopOpacity="0.25" />
            <stop offset="100%" stopColor={L.amber} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* faint orbital rings */}
        <circle cx={cx} cy={cy} r={R - 50} fill="none" stroke={L.ink} strokeWidth="0.4" opacity="0.15" />
        <circle cx={cx} cy={cy} r={R} fill="none" stroke={L.ink} strokeWidth="0.4" opacity="0.2" />
        <circle cx={cx} cy={cy} r={R + 30} fill="none" stroke={L.ink} strokeWidth="0.3" opacity="0.1" strokeDasharray="2 4" />

        {/* memory core */}
        <circle cx={cx} cy={cy} r={70} fill="url(#memCore)" />
        <circle cx={cx} cy={cy} r={28} fill="none" stroke={L.amber} strokeWidth="0.8" />
        <circle cx={cx} cy={cy} r={6} fill={L.amber} />
        <text
          x={cx}
          y={cy - 44}
          textAnchor="middle"
          fontFamily="DM Sans, sans-serif"
          fontSize="10"
          letterSpacing="3"
          fill={L.amber}
          fontWeight="600"
        >
          BRAND DNA
        </text>
        <text
          x={cx}
          y={cy + 56}
          textAnchor="middle"
          fontFamily="Playfair Display, serif"
          fontStyle="italic"
          fontSize="14"
          fill={L.inkMuted}
        >
          shared memory
        </text>

        {/* spokes + module nodes */}
        {modules.map((m) => {
          const rad = (m.a * Math.PI) / 180;
          const x = cx + Math.cos(rad) * R;
          const y = cy + Math.sin(rad) * R;
          // label positioning offset outward
          const lx = cx + Math.cos(rad) * (R + 36);
          const ly = cy + Math.sin(rad) * (R + 36);
          const anchor =
            Math.cos(rad) > 0.3 ? "start" : Math.cos(rad) < -0.3 ? "end" : "middle";
          return (
            <g key={m.name}>
              <line
                x1={cx + Math.cos(rad) * 70}
                y1={cy + Math.sin(rad) * 70}
                x2={x}
                y2={y}
                stroke={L.ink}
                strokeWidth="0.6"
                opacity="0.4"
              />
              <circle cx={x} cy={y} r={9} fill={L.paper} stroke={L.ink} strokeWidth="1" />
              <circle cx={x} cy={y} r={3} fill={L.ink} />
              <text
                x={lx}
                y={ly - 4}
                textAnchor={anchor}
                fontFamily="Playfair Display, serif"
                fontSize="17"
                fontWeight="500"
                fill={L.ink}
              >
                {m.name}
              </text>
              <text
                x={lx}
                y={ly + 12}
                textAnchor={anchor}
                fontFamily="DM Sans, sans-serif"
                fontSize="10"
                letterSpacing="2"
                fill={L.inkMuted}
              >
                {m.role.toUpperCase()}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption
        style={{
          marginTop: 24,
          fontSize: 12,
          color: L.inkMuted,
          textAlign: "center",
          fontStyle: "italic",
          letterSpacing: "0.04em",
        }}
      >
        Fig. 03 — Six rooms, one memory. Walk between them; the brand walks with you.
      </figcaption>
    </figure>
  );
}

/* ── Diagram 04 — Compounding curve ─────────────────────────────────────── */

function CompoundingDiagram() {
  return (
    <figure style={{ padding: "clamp(24px, 4vw, 48px) 0" }}>
      <svg
        viewBox="0 0 900 280"
        width="100%"
        style={{ display: "block", maxWidth: 900, margin: "0 auto" }}
        aria-hidden
      >
        {/* axes */}
        <line x1="80" y1="240" x2="840" y2="240" stroke={L.rule} strokeWidth="1" />
        <line x1="80" y1="40" x2="80" y2="240" stroke={L.rule} strokeWidth="1" />

        {/* flat line — generic AI tools */}
        <line x1="80" y1="200" x2="840" y2="200" stroke={L.inkMuted} strokeWidth="0.8" strokeDasharray="3 4" opacity="0.6" />
        <text x={848} y={204} fontFamily="DM Sans, sans-serif" fontSize="11" fill={L.inkMuted}>
          Generic tools — flat
        </text>

        {/* compounding curve — Kinika */}
        <path
          d="M 80,200 C 220,196 360,180 480,150 S 720,80 840,50"
          fill="none"
          stroke={L.amber}
          strokeWidth="1.4"
        />
        <circle cx={840} cy={50} r={4} fill={L.amber} />
        <text x={848} y={54} fontFamily="DM Sans, sans-serif" fontSize="11" fill={L.amber} fontWeight="600">
          Kinika — compounding
        </text>

        {/* axis labels */}
        <text x={80} y={262} fontFamily="DM Sans, sans-serif" fontSize="10" letterSpacing="2" fill={L.inkMuted}>
          DAY ONE
        </text>
        <text x={840} y={262} textAnchor="end" fontFamily="DM Sans, sans-serif" fontSize="10" letterSpacing="2" fill={L.inkMuted}>
          MONTH TWELVE
        </text>
        <text
          x={36}
          y={140}
          fontFamily="DM Sans, sans-serif"
          fontSize="10"
          letterSpacing="2"
          fill={L.inkMuted}
          transform="rotate(-90 36 140)"
        >
          OUTPUT QUALITY
        </text>
      </svg>
      <figcaption
        style={{
          marginTop: 16,
          fontSize: 12,
          color: L.inkMuted,
          textAlign: "center",
          fontStyle: "italic",
          letterSpacing: "0.04em",
        }}
      >
        Fig. 04 — Every conversation strengthens future outputs.
      </figcaption>
    </figure>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export default function System() {
  return (
    <EditorialShell>
      {/* Opening spread ----------------------------------------------------- */}
      <section style={{ background: L.paper }}>
        <Container>
          <PageMeta issue="Kinika" section="The System" date="How it works" />

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
                How Kinika thinks.
              </p>
              <h1
                className="pf ed-fade ed-d1"
                style={{
                  color: L.ink,
                  fontSize: "clamp(48px, 7.4vw, 120px)",
                  lineHeight: 0.96,
                  fontWeight: 500,
                  letterSpacing: "-0.035em",
                  maxWidth: "16ch",
                }}
              >
                One mind, many rooms.
              </h1>
            </div>
            <aside className="col-span-12 lg:col-span-4 lg:pt-24">
              <div
                style={{ borderTop: `1px solid ${L.amber}`, paddingTop: 18, maxWidth: 320 }}
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
                  The thesis
                </p>
                <p className="pf" style={{ fontSize: 17, lineHeight: 1.6, color: L.inkSoft, fontStyle: "italic" }}>
                  Kinika is not a suite of tools. It is a single intelligence with several
                  workrooms — all listening, all remembering, all yours.
                </p>
              </div>
            </aside>
          </div>

          <div style={{ height: 1, background: L.rule, margin: "96px 0 0" }} />
        </Container>
      </section>

      {/* Diagram 01 — Core flow -------------------------------------------- */}
      <section style={{ background: L.paper }}>
        <div
          className="mx-auto"
          style={{
            maxWidth: 1320,
            paddingLeft: "clamp(24px, 6vw, 96px)",
            paddingRight: "clamp(24px, 6vw, 96px)",
            paddingTop: "clamp(40px, 6vh, 80px)",
            paddingBottom: "clamp(80px, 10vh, 120px)",
          }}
        >
          <div className="grid grid-cols-12 gap-8 lg:gap-16" style={{ marginBottom: 56 }}>
            <div className="col-span-12 lg:col-span-3">
              <SectionMark n="I." label="The Flow" />
            </div>
            <div className="col-span-12 lg:col-span-9">
              <SectionTitle>Conversation, then memory, then everything else.</SectionTitle>
              <Body>
                The system has a single direction of travel. Founders speak. The system listens
                and keeps. What it keeps becomes understanding. What it understands becomes the
                raw material of every future output. There are no other ingredients.
              </Body>
            </div>
          </div>

          <CoreFlowDiagram />
        </div>
      </section>

      {/* II — Mentor (Conversation) ---------------------------------------- */}
      <section style={{ background: L.paper, borderTop: `1px solid ${L.rule}` }}>
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
            <div className="col-span-12 lg:col-span-5">
              <SectionMark n="II." label="Kinika — The Mouth" />
              <SectionTitle>Conversation is the input.</SectionTitle>
              <Body>
                Kinika is one continuous conversation per brand — not a thread you have to
                manage, but a thinking partner that picks up where you left off. There are no
                onboarding forms, because the conversation <em>is</em> the onboarding. There is no
                separate "settings" screen for your brand, because the brand is being assembled
                while you talk.
              </Body>
              <Body>
                Each session adds a new layer to the record. Old observations are not overwritten.
                They are <em>refined</em>.
              </Body>
            </div>

            <aside className="col-span-12 lg:col-span-7 lg:pl-12 lg:border-l" style={{ borderColor: L.ruleSoft }}>
              {/* Editorial transcript fragment */}
              <p style={{ fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", color: L.amber, fontWeight: 600, marginBottom: 18 }}>
                Excerpt — Kinika session, day 47
              </p>
              <div style={{ borderTop: `1px solid ${L.rule}` }}>
                {[
                  { who: "Founder", line: "I keep saying \"approachable\" but I think I mean \"unintimidating\"." },
                  { who: "Kinika", line: "You've used the word three times this month. Each time about pricing pages. Worth noting." },
                  { who: "Founder", line: "Maybe that's the positioning." },
                  { who: "Kinika", line: "I'll add it to your Brand DNA as a working hypothesis. We can sharpen it later." },
                ].map((row, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "20px 0",
                      borderBottom: `1px solid ${L.rule}`,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        letterSpacing: "0.2em",
                        textTransform: "uppercase",
                        color: row.who === "Kinika" ? L.amber : L.inkMuted,
                        fontWeight: 600,
                        marginRight: 14,
                      }}
                    >
                      {row.who}
                    </span>
                    <span
                      className="pf"
                      style={{
                        fontSize: 18,
                        color: L.ink,
                        fontStyle: row.who === "Kinika" ? "italic" : "normal",
                        lineHeight: 1.5,
                      }}
                    >
                      {row.line}
                    </span>
                  </div>
                ))}
              </div>
              <p
                style={{
                  marginTop: 14,
                  fontSize: 12,
                  color: L.inkMuted,
                  fontStyle: "italic",
                  letterSpacing: "0.04em",
                }}
              >
                The conversation is not a transcript. It is the brand, mid-formation.
              </p>
            </aside>
          </div>
        </div>
      </section>

      {/* III — Layered Context (Memory + Brand DNA + Journey Record) ------- */}
      <section style={{ background: L.paper, borderTop: `1px solid ${L.rule}` }}>
        <div
          className="mx-auto"
          style={{
            maxWidth: 1320,
            paddingLeft: "clamp(24px, 6vw, 96px)",
            paddingRight: "clamp(24px, 6vw, 96px)",
            paddingTop: "clamp(80px, 10vh, 120px)",
            paddingBottom: "clamp(40px, 6vh, 80px)",
          }}
        >
          <div className="grid grid-cols-12 gap-8 lg:gap-16" style={{ marginBottom: 56 }}>
            <div className="col-span-12 lg:col-span-3">
              <SectionMark n="III." label="The Strata" />
            </div>
            <div className="col-span-12 lg:col-span-9">
              <SectionTitle>Memory is not flat. It is layered.</SectionTitle>
              <Body>
                Beneath every prompt you ever issue, four strata of context are quietly assembled
                and handed to the model. The live conversation sits on top. Below it, the
                <em> Journey Record</em> — a moving picture of where the founder stands this
                quarter. Below that, the <em>Brand DNA</em> — the slowly hardening core of voice,
                audience, taste. And beneath all of it, the <em>memory archive</em> — every prior
                exchange, indexed, retrievable, never re-asked.
              </Body>
              <Body>
                Most tools give the model your sentence. Kinika gives the model your business.
              </Body>
            </div>
          </div>
        </div>

        <LayeredContextDiagram />

        {/* Three definitions, side-by-side */}
        <div
          className="mx-auto"
          style={{
            maxWidth: 1320,
            paddingLeft: "clamp(24px, 6vw, 96px)",
            paddingRight: "clamp(24px, 6vw, 96px)",
            paddingTop: "clamp(64px, 8vh, 96px)",
            paddingBottom: "clamp(80px, 10vh, 120px)",
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              {
                t: "Persistent Memory",
                b: "Every conversation is captured. Nothing has to be re-uploaded, re-explained, or re-pasted. The system forgets nothing on your behalf.",
              },
              {
                t: "Brand DNA",
                b: "Voice, audience, positioning, references, taste — distilled progressively from what you actually say, not from a form you filled out once.",
              },
              {
                t: "Journey Record",
                b: "A living account of the stage you're at, the decisions you're weighing, the season you're in. Outputs adjust accordingly.",
              },
            ].map((c) => (
              <div key={c.t}>
                <div style={{ width: 24, height: 1, background: L.amber, marginBottom: 18 }} />
                <h3 className="pf" style={{ fontSize: 24, color: L.ink, fontWeight: 500, letterSpacing: "-0.01em", marginBottom: 12 }}>
                  {c.t}
                </h3>
                <p style={{ fontSize: 15, lineHeight: 1.7, color: L.inkSoft }}>{c.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* IV — Connected modules -------------------------------------------- */}
      <section style={{ background: L.paper, borderTop: `1px solid ${L.rule}` }}>
        <div
          className="mx-auto"
          style={{
            maxWidth: 1320,
            paddingLeft: "clamp(24px, 6vw, 96px)",
            paddingRight: "clamp(24px, 6vw, 96px)",
            paddingTop: "clamp(80px, 10vh, 120px)",
            paddingBottom: "clamp(40px, 6vh, 80px)",
          }}
        >
          <div className="grid grid-cols-12 gap-8 lg:gap-16" style={{ marginBottom: 32 }}>
            <div className="col-span-12 lg:col-span-3">
              <SectionMark n="IV." label="The Rooms" />
            </div>
            <div className="col-span-12 lg:col-span-9">
              <SectionTitle>Six rooms, one shared mind.</SectionTitle>
              <Body>
                Each module is a specialist — a quiet professional with a single craft. None of
                them re-asks who you are. They draw on the same memory, return their work to the
                same memory, and hand off cleanly between one another.
              </Body>
            </div>
          </div>
        </div>

        <ModuleWebDiagram />

        {/* Inline editorial table — what each room produces */}
        <div
          className="mx-auto"
          style={{
            maxWidth: 1100,
            paddingLeft: "clamp(24px, 6vw, 96px)",
            paddingRight: "clamp(24px, 6vw, 96px)",
            paddingTop: "clamp(40px, 6vh, 80px)",
            paddingBottom: "clamp(80px, 10vh, 120px)",
          }}
        >
          <div style={{ borderTop: `1px solid ${L.rule}` }}>
            {[
              ["Kinika", "Conversation", "Notices, reflects, sharpens."],
              ["ProStudio", "Visuals", "Product imagery in your own light."],
              ["ContentStudio", "Channels", "One brief, eight platforms, one voice."],
              ["Calendar", "Cadence", "Plans, not algorithms."],
              ["DocStudio", "Documents", "Decks, proposals, one-pagers — already on-brand."],
              ["ReelBuilder", "Story", "Brief to scene to teleprompter."],
            ].map(([name, role, body]) => (
              <div
                key={name}
                className="grid grid-cols-12 gap-4 py-7"
                style={{ borderBottom: `1px solid ${L.rule}` }}
              >
                <div className="col-span-4 sm:col-span-3">
                  <p className="pf" style={{ fontSize: 22, color: L.ink, fontWeight: 500, letterSpacing: "-0.01em" }}>
                    {name}
                  </p>
                </div>
                <div className="col-span-4 sm:col-span-3">
                  <p style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: L.amber, fontWeight: 600, marginTop: 8 }}>
                    {role}
                  </p>
                </div>
                <div className="col-span-12 sm:col-span-6">
                  <p className="pf" style={{ fontSize: 18, color: L.inkSoft, fontStyle: "italic", lineHeight: 1.4 }}>
                    {body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* V — Compounding outputs ------------------------------------------- */}
      <section style={{ background: L.paperDeep, borderTop: `1px solid ${L.rule}` }}>
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
          <div className="grid grid-cols-12 gap-8 lg:gap-16" style={{ marginBottom: 56 }}>
            <div className="col-span-12 lg:col-span-3">
              <SectionMark n="V." label="On Compounding" />
            </div>
            <div className="col-span-12 lg:col-span-9">
              <SectionTitle>Every conversation strengthens every future output.</SectionTitle>
              <Body>
                The second campaign is sharper than the first because the first one happened. A
                pitch deck written in March benefits from a conversation that happened in
                January. A reel script borrows phrasing from an old customer interview without
                being asked to.
              </Body>
              <Body>
                The work is not a series of one-offs. It is a body. And bodies, properly cared
                for, get stronger over time.
              </Body>
            </div>
          </div>

          <CompoundingDiagram />
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
                  fontSize: "clamp(26px, 2.8vw, 36px)",
                  lineHeight: 1.4,
                  color: L.ink,
                  fontStyle: "italic",
                  fontWeight: 400,
                  letterSpacing: "-0.015em",
                  maxWidth: "26ch",
                  marginBottom: 32,
                }}
              >
                A founder intelligence operating system. Quiet on the surface. Considered
                underneath.
              </p>
              <Link
                to="/journal"
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
                Continue to the Journal
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
            <aside className="col-span-12 lg:col-span-5 lg:pl-12 lg:border-l" style={{ borderColor: L.ruleSoft }}>
              <p style={{ fontSize: 10, letterSpacing: "0.26em", textTransform: "uppercase", color: L.inkMuted, fontWeight: 600, marginBottom: 14 }}>
                About this page
              </p>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: L.inkSoft, maxWidth: "36ch" }}>
                A short walk-through of the architecture beneath Kinika —
                the conversation, the memory, the modules — for founders
                who want to see how the workspace is wired before they sign in.
              </p>
            </aside>
          </div>
        </div>
      </section>
    </EditorialShell>
  );
}
