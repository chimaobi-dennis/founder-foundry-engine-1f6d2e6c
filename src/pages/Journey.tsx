import { Link } from "react-router-dom";
import { EditorialShell, Container, PageMeta, PageTitle, L } from "@/components/editorial/EditorialLayout";

// ---------------------------------------------------------------------------
// Stage data — six chapters of founder evolution
// ---------------------------------------------------------------------------

type Stage = {
  numeral: string;
  name: string;
  subtitle: string;
  question: string;
  body: string;
  artefacts: string[];
  memory: string;
  marker: string; // short month-marker for the spine
};

const STAGES: Stage[] = [
  {
    numeral: "I",
    name: "Spark",
    subtitle: "The instinct before the idea has language.",
    question: "What is the thing I cannot stop thinking about?",
    body:
      "The earliest sessions are loose on purpose. The studio listens for repeated phrases, the obsessions you keep returning to, the customer you describe with unusual care. Nothing is structured yet. The point is to leave a trail honest enough to follow later.",
    artefacts: ["Opening notes", "First customer sketch", "Working name"],
    memory: "A handful of fragments. The shape of a curiosity.",
    marker: "Week 01",
  },
  {
    numeral: "II",
    name: "Shape",
    subtitle: "The idea begins to hold its own outline.",
    question: "What exactly am I making, and for whom?",
    body:
      "Conversations turn into a working portrait. Voice. Audience. Promise. The studio reflects back what you have already said — sharpened, organised, and quietly editable. The first version of a brand exists, drawn entirely from your own thinking.",
    artefacts: ["Positioning draft", "Audience portrait", "Voice descriptors"],
    memory: "A first map. Loose, but legible.",
    marker: "Week 04",
  },
  {
    numeral: "III",
    name: "Validate",
    subtitle: "The brand begins to encounter the world.",
    question: "Does the work survive the room it is shown in?",
    body:
      "Customer conversations, early testers, friends with sharp opinions. Their reactions become part of the record. The studio holds what is confirmed and what is contradicted side by side, so the next decision is taken with both in view.",
    artefacts: ["Customer insight log", "Sharpened promise", "Discarded angles"],
    memory: "Evidence, alongside the original instinct.",
    marker: "Month 02",
  },
  {
    numeral: "IV",
    name: "Brand",
    subtitle: "The portrait becomes a system.",
    question: "What do I want this to feel like, every time?",
    body:
      "Visual direction, tonal range, the rules you would want a collaborator to read on day one. The Brand DNA hardens — not into rigidity, but into something the rest of the studio can quietly defer to. Outputs begin to recognise themselves.",
    artefacts: ["Brand DNA", "Tone library", "Visual direction"],
    memory: "A working canon. Cited, not invented.",
    marker: "Month 03",
  },
  {
    numeral: "V",
    name: "Launch",
    subtitle: "The work meets its first real audience.",
    question: "Can it speak in my voice without me in the room?",
    body:
      "Campaigns, documents, reels — all drawn from the accumulated record. The studio writes the way you would on a good day. You spend less time correcting and more time choosing. What goes out feels finished, not generated.",
    artefacts: ["Launch campaign", "Anchor essay", "First reel"],
    memory: "A position, performed in public.",
    marker: "Month 05",
  },
  {
    numeral: "VI",
    name: "Grow",
    subtitle: "The brand becomes something that compounds.",
    question: "What is mine now, and what comes next?",
    body:
      "By here, the studio has months of you behind it. Briefs are shorter. Outputs are sharper. New work begins further down the page than it used to. The journey does not end — it deepens. Each new conversation is added to a record that already knows you well.",
    artefacts: ["Quarterly review", "Second-act positioning", "Founder essays"],
    memory: "An archive that writes back.",
    marker: "Month 09 →",
  },
];

// ---------------------------------------------------------------------------
// Visuals
// ---------------------------------------------------------------------------

function StageSpine() {
  // A vertical, archival spine of the six stages — quiet, editorial
  return (
    <aside
      className="hidden lg:block"
      style={{
        position: "sticky",
        top: 120,
        alignSelf: "start",
        borderLeft: `1px solid ${L.rule}`,
        paddingLeft: 24,
      }}
    >
      <span
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 10,
          letterSpacing: "0.24em",
          textTransform: "uppercase",
          color: L.inkMuted,
          fontWeight: 600,
        }}
      >
        The Spine
      </span>
      <ol style={{ listStyle: "none", padding: 0, margin: "20px 0 0" }}>
        {STAGES.map((s, i) => (
          <li
            key={s.numeral}
            style={{
              padding: "14px 0",
              borderTop: i === 0 ? "none" : `1px solid ${L.ruleSoft}`,
            }}
          >
            <a
              href={`#stage-${s.numeral.toLowerCase()}`}
              className="block hover:opacity-70 transition-opacity"
            >
              <div className="flex items-baseline gap-3">
                <span
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 10,
                    letterSpacing: "0.22em",
                    color: L.amber,
                    fontWeight: 600,
                    width: 22,
                  }}
                >
                  {s.numeral}
                </span>
                <span
                  className="pf"
                  style={{ fontSize: 17, color: L.ink, fontStyle: "italic" }}
                >
                  {s.name}
                </span>
              </div>
              <span
                style={{
                  display: "block",
                  marginLeft: 34,
                  marginTop: 4,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 11,
                  letterSpacing: "0.06em",
                  color: L.inkMuted,
                }}
              >
                {s.marker}
              </span>
            </a>
          </li>
        ))}
      </ol>
    </aside>
  );
}

function EvolutionBand() {
  // A single horizontal band showing memory thickening across the six stages
  const W = 1200, H = 180;
  const stops = STAGES.map((s, i) => ({
    x: 60 + ((W - 120) / (STAGES.length - 1)) * i,
    s,
    op: 0.18 + (i / (STAGES.length - 1)) * 0.82,
  }));
  return (
    <figure
      style={{
        background: L.paperDeep,
        border: `1px solid ${L.rule}`,
        padding: "clamp(24px, 3vw, 40px)",
        marginBottom: 96,
      }}
    >
      <div className="flex items-baseline gap-4" style={{ marginBottom: 20 }}>
        <span
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 10,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color: L.amber,
            fontWeight: 600,
          }}
        >
          Fig. 01
        </span>
        <span
          className="pf"
          style={{ fontSize: 14, fontStyle: "italic", color: L.inkSoft }}
        >
          The thickening of context across the six stages.
        </span>
      </div>
      <div style={{ overflow: "hidden" }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
          {/* horizon */}
          <line x1={40} y1={H - 50} x2={W - 40} y2={H - 50} stroke={L.ink} strokeOpacity={0.22} strokeWidth={1} />
          {/* memory rectangles, growing */}
          {stops.map((p, i) => {
            const h = 18 + i * 14;
            const w = 70 + i * 14;
            return (
              <g key={i}>
                <rect
                  x={p.x - w / 2}
                  y={H - 50 - h}
                  width={w}
                  height={h}
                  fill={i === stops.length - 1 ? L.amber : L.ink}
                  opacity={p.op}
                />
                <line
                  x1={p.x}
                  y1={H - 50}
                  x2={p.x}
                  y2={H - 36}
                  stroke={L.ink}
                  strokeOpacity={0.4}
                  strokeWidth={1}
                />
                <text
                  x={p.x}
                  y={H - 20}
                  textAnchor="middle"
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontStyle: "italic",
                    fontSize: 14,
                    fill: L.ink,
                  }}
                >
                  {p.s.name}
                </text>
                <text
                  x={p.x}
                  y={H - 6}
                  textAnchor="middle"
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 9,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    fill: L.inkMuted,
                  }}
                >
                  {p.s.marker}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Journey() {
  return (
    <EditorialShell>
      <Container>
        <PageMeta issue="Kinika" section="Founder Journey" date="Six stages" />
        <PageTitle kicker="How understanding accumulates over time">
          A map of how a founder becomes legible to themselves.
        </PageTitle>

        {/* Lede */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-12" style={{ marginBottom: 96 }}>
          <div className="lg:col-span-8">
            <p
              className="pf ed-fade ed-d2"
              style={{
                fontSize: "clamp(22px, 2.4vw, 30px)",
                lineHeight: 1.4,
                color: L.ink,
                fontWeight: 400,
                letterSpacing: "-0.01em",
              }}
            >
              A company is not a checklist. It is a long, uneven act of paying
              attention. The Kinika journey traces six chapters in that act —
              not as steps to complete, but as states of understanding the studio
              learns to hold on your behalf.
            </p>
          </div>
          <aside
            className="lg:col-span-4"
            style={{ borderLeft: `1px solid ${L.ruleSoft}`, paddingLeft: 28 }}
          >
            <span
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 10,
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                color: L.inkMuted,
                fontWeight: 600,
              }}
            >
              A note on pacing
            </span>
            <p
              className="pf"
              style={{
                marginTop: 16,
                fontSize: 15,
                lineHeight: 1.6,
                color: L.inkSoft,
                fontStyle: "italic",
              }}
            >
              Stages overlap. They repeat. A founder in month nine may return to
              Spark for a second product and Validate for a third. The studio
              keeps its place either way.
            </p>
          </aside>
        </section>

        <EvolutionBand />

        {/* Stages */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20">
          <div className="lg:col-span-2">
            <StageSpine />
          </div>
          <div className="lg:col-span-10">
            {STAGES.map((s, i) => (
              <StageSection key={s.numeral} stage={s} index={i} />
            ))}
          </div>
        </div>

        {/* Pull quote */}
        <section
          style={{
            margin: "24px 0 96px",
            padding: "clamp(56px, 8vw, 96px) 0",
            borderTop: `1px solid ${L.rule}`,
            borderBottom: `1px solid ${L.rule}`,
          }}
        >
          <blockquote
            className="pf mx-auto"
            style={{
              fontSize: "clamp(28px, 4vw, 50px)",
              lineHeight: 1.2,
              color: L.ink,
              fontWeight: 500,
              letterSpacing: "-0.02em",
              maxWidth: "26ch",
              fontStyle: "italic",
            }}
          >
            “The map is not the brand. The walking is the brand.”
          </blockquote>
          <div
            style={{
              marginTop: 32,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 11,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: L.inkMuted,
            }}
          >
            — A working principle inside Kinika
          </div>
        </section>

        {/* Closing */}
        <section
          className="grid grid-cols-1 md:grid-cols-12 gap-8 items-end"
          style={{ paddingTop: 24 }}
        >
          <div className="md:col-span-8">
            <p
              className="pf"
              style={{
                fontSize: "clamp(22px, 2.4vw, 30px)",
                lineHeight: 1.32,
                color: L.ink,
                letterSpacing: "-0.015em",
                maxWidth: "30ch",
              }}
            >
              You do not have to know which stage you are in. The studio will
              recognise the shape, and meet you there.
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2" style={{ marginTop: 28 }}>
              <Link
                to="/memory"
                className="pf hover:opacity-70 transition-opacity"
                style={{ color: L.inkSoft, fontStyle: "italic", fontSize: 16 }}
              >
                How memory accumulates →
              </Link>
              <Link
                to="/system"
                className="pf hover:opacity-70 transition-opacity"
                style={{ color: L.inkSoft, fontStyle: "italic", fontSize: 16 }}
              >
                How the system works →
              </Link>
            </div>
          </div>
          <div className="md:col-span-4 flex md:justify-end">
            <Link
              to="/sign-up"
              className="inline-flex items-center text-sm font-medium transition-all hover:-translate-y-px"
              style={{
                background: L.ink,
                color: L.paper,
                height: 44,
                padding: "0 22px",
                borderRadius: 2,
                letterSpacing: "0.02em",
              }}
            >
              Start building with Kinika
            </Link>
          </div>
        </section>
      </Container>
    </EditorialShell>
  );
}

// ---------------------------------------------------------------------------
// Stage section — asymmetric, alternating composition
// ---------------------------------------------------------------------------

function StageSection({ stage, index }: { stage: Stage; index: number }) {
  const isLast = index === STAGES.length - 1;
  const flip = index % 2 === 1;
  return (
    <section
      id={`stage-${stage.numeral.toLowerCase()}`}
      style={{
        paddingTop: index === 0 ? 0 : 80,
        paddingBottom: 80,
        borderBottom: isLast ? "none" : `1px solid ${L.ruleSoft}`,
      }}
    >
      {/* Header line */}
      <div className="flex items-baseline gap-6" style={{ marginBottom: 28 }}>
        <span
          className="pf"
          style={{
            fontSize: "clamp(48px, 6vw, 88px)",
            lineHeight: 1,
            fontWeight: 500,
            color: L.amber,
            letterSpacing: "-0.02em",
            fontStyle: "italic",
          }}
        >
          {stage.numeral}
        </span>
        <div style={{ flex: 1, height: 1, background: L.rule }} />
        <span
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 11,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: L.inkMuted,
            fontWeight: 600,
          }}
        >
          {stage.marker}
        </span>
      </div>

      <div
        className={`grid grid-cols-1 lg:grid-cols-12 gap-12 ${
          flip ? "lg:[&>*:first-child]:order-2" : ""
        }`}
      >
        {/* Title + body */}
        <div className="lg:col-span-7">
          <h2
            className="pf"
            style={{
              fontSize: "clamp(36px, 5vw, 64px)",
              lineHeight: 1.05,
              fontWeight: 500,
              color: L.ink,
              letterSpacing: "-0.025em",
            }}
          >
            {stage.name}
          </h2>
          <p
            className="pf"
            style={{
              marginTop: 12,
              fontSize: 18,
              fontStyle: "italic",
              color: L.inkSoft,
              maxWidth: "44ch",
            }}
          >
            {stage.subtitle}
          </p>
          <p
            className="pf"
            style={{
              marginTop: 32,
              fontSize: 17,
              lineHeight: 1.7,
              color: L.inkSoft,
              maxWidth: "60ch",
            }}
          >
            {stage.body}
          </p>
        </div>

        {/* Aside: question, artefacts, memory */}
        <aside
          className="lg:col-span-5"
          style={{
            background: index % 3 === 1 ? L.paperDeep : L.paper,
            border: `1px solid ${L.rule}`,
            padding: "clamp(24px, 3vw, 36px)",
          }}
        >
          <span
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 10,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: L.amber,
              fontWeight: 600,
            }}
          >
            The question
          </span>
          <p
            className="pf"
            style={{
              marginTop: 12,
              fontSize: 22,
              lineHeight: 1.3,
              color: L.ink,
              fontStyle: "italic",
              letterSpacing: "-0.01em",
            }}
          >
            “{stage.question}”
          </p>

          <div style={{ height: 1, background: L.ruleSoft, margin: "28px 0" }} />

          <span
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 10,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: L.inkMuted,
              fontWeight: 600,
            }}
          >
            What gets captured
          </span>
          <ul style={{ listStyle: "none", padding: 0, marginTop: 14 }}>
            {stage.artefacts.map((a, i) => (
              <li
                key={i}
                className="pf flex items-baseline gap-3"
                style={{
                  fontSize: 15,
                  color: L.inkSoft,
                  padding: "8px 0",
                  borderTop: i === 0 ? "none" : `1px solid ${L.ruleSoft}`,
                }}
              >
                <span
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 10,
                    color: L.inkMuted,
                    width: 20,
                    letterSpacing: "0.06em",
                  }}
                >
                  0{i + 1}
                </span>
                <span style={{ fontStyle: "italic" }}>{a}</span>
              </li>
            ))}
          </ul>

          <div style={{ height: 1, background: L.ruleSoft, margin: "28px 0 20px" }} />

          <div className="flex items-baseline gap-3">
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: L.amber,
                display: "inline-block",
                transform: "translateY(-2px)",
              }}
            />
            <p
              className="pf"
              style={{
                fontSize: 14,
                color: L.inkSoft,
                fontStyle: "italic",
                lineHeight: 1.5,
              }}
            >
              <span
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontStyle: "normal",
                  fontSize: 10,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: L.inkMuted,
                  marginRight: 8,
                }}
              >
                Memory state
              </span>
              {stage.memory}
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
