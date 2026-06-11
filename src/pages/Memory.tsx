import { Link } from "react-router-dom";
import { EditorialShell, Container, PageMeta, PageTitle, L } from "@/components/editorial/EditorialLayout";
import { SEO } from "@/components/SEO";

// ---------------------------------------------------------------------------
// Visual systems — quiet, archival, notebook-inspired
// ---------------------------------------------------------------------------

function MemoryStrata() {
  // Layered "geological" memory — sediment of conversations over time
  const layers = [
    { label: "Today", note: "Live conversation", op: 1 },
    { label: "Last week", note: "Positioning revisited", op: 0.78 },
    { label: "Month 02", note: "Audience clarified", op: 0.58 },
    { label: "Month 01", note: "First voice notes", op: 0.4 },
    { label: "Day 01", note: "The opening session", op: 0.25 },
  ];
  return (
    <figure
      className="relative"
      style={{
        background: L.paperDeep,
        border: `1px solid ${L.rule}`,
        padding: "clamp(28px, 4vw, 56px)",
      }}
    >
      <FigureCaption index="Fig. 01" title="Memory accumulates as strata, not as files." />
      <div style={{ display: "grid", gap: 14, marginTop: 32 }}>
        {layers.map((l, i) => (
          <div
            key={i}
            className="grid grid-cols-12 items-center gap-4"
            style={{ opacity: l.op }}
          >
            <span
              className="col-span-3 sm:col-span-2"
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 11,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: L.inkMuted,
              }}
            >
              {l.label}
            </span>
            <div
              className="col-span-9 sm:col-span-10 flex items-center gap-4"
            >
              <div
                style={{
                  flex: 1,
                  height: 18 + i * 4,
                  background: i === 0 ? L.amber : L.ink,
                  opacity: i === 0 ? 1 : 0.85,
                }}
              />
              <span
                className="pf"
                style={{
                  fontStyle: "italic",
                  color: L.ink,
                  fontSize: 14,
                  whiteSpace: "nowrap",
                }}
              >
                {l.note}
              </span>
            </div>
          </div>
        ))}
      </div>
      <p
        className="pf"
        style={{
          marginTop: 32,
          fontSize: 13,
          color: L.inkMuted,
          fontStyle: "italic",
          maxWidth: "60ch",
        }}
      >
        Each session settles beneath the next. Older context does not vanish — it
        becomes the bedrock the newer thinking rests upon.
      </p>
    </figure>
  );
}

function RelationshipMap() {
  // Subtle relationship mapping — entities and the lines between them
  const W = 720, H = 420;
  const nodes = [
    { x: 360, y: 210, label: "Founder", core: true },
    { x: 130, y: 110, label: "Voice" },
    { x: 600, y: 110, label: "Audience" },
    { x: 110, y: 320, label: "Positioning" },
    { x: 620, y: 320, label: "Promise" },
    { x: 360, y: 50, label: "Origin story" },
    { x: 360, y: 380, label: "Customer insight" },
  ];
  const center = nodes[0];
  return (
    <figure
      style={{
        background: L.paper,
        border: `1px solid ${L.rule}`,
        padding: "clamp(24px, 3vw, 40px)",
      }}
    >
      <FigureCaption index="Fig. 02" title="A quiet map of what is remembered, and how it relates." />
      <div style={{ marginTop: 24, overflow: "hidden" }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
          {nodes.slice(1).map((n, i) => (
            <line
              key={i}
              x1={center.x}
              y1={center.y}
              x2={n.x}
              y2={n.y}
              stroke={L.ink}
              strokeOpacity={0.22}
              strokeWidth={1}
            />
          ))}
          {/* faint cross-links */}
          <path
            d={`M${nodes[1].x} ${nodes[1].y} Q ${nodes[2].x - 60} 60 ${nodes[2].x} ${nodes[2].y}`}
            stroke={L.amber}
            strokeOpacity={0.5}
            strokeWidth={1}
            fill="none"
            strokeDasharray="2 4"
          />
          <path
            d={`M${nodes[3].x} ${nodes[3].y} Q ${W / 2} ${H - 30} ${nodes[4].x} ${nodes[4].y}`}
            stroke={L.amber}
            strokeOpacity={0.5}
            strokeWidth={1}
            fill="none"
            strokeDasharray="2 4"
          />
          {nodes.map((n, i) => (
            <g key={i}>
              <circle
                cx={n.x}
                cy={n.y}
                r={n.core ? 7 : 4}
                fill={n.core ? L.amber : L.ink}
              />
              <text
                x={n.x}
                y={n.y - (n.core ? 16 : 12)}
                textAnchor="middle"
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: n.core ? 16 : 13,
                  fontStyle: n.core ? "normal" : "italic",
                  fill: L.ink,
                }}
              >
                {n.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </figure>
  );
}

function FragmentWall() {
  // Layered memory fragments — annotated index cards
  const fragments = [
    {
      tag: "Voice",
      date: "Mar 04",
      body: "“We don't sell calm. We protect it.” — said in passing, kept as a north star.",
    },
    {
      tag: "Audience",
      date: "Mar 19",
      body: "Buyers are second-time founders, not first-timers. Different anxieties.",
    },
    {
      tag: "Positioning",
      date: "Apr 02",
      body: "Not a tool. A studio. Re-write any copy that drifts back to feature language.",
    },
    {
      tag: "Origin",
      date: "Apr 14",
      body: "Started inside a sketchbook on a long train ride. The work still feels like that.",
    },
    {
      tag: "Promise",
      date: "May 01",
      body: "Outputs should feel finished, not generated. No drafts that need apology.",
    },
    {
      tag: "Customer",
      date: "May 12",
      body: "“It finally writes the way I would on a good day.” — feedback worth defending.",
    },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {fragments.map((f, i) => (
        <article
          key={i}
          className="relative"
          style={{
            background: L.paper,
            border: `1px solid ${L.rule}`,
            padding: "22px 22px 20px",
            transform: i % 2 === 0 ? "rotate(-0.3deg)" : "rotate(0.25deg)",
          }}
        >
          <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
            <span
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 10,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: L.amber,
                fontWeight: 600,
              }}
            >
              {f.tag}
            </span>
            <span
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 11,
                color: L.inkMuted,
                letterSpacing: "0.04em",
              }}
            >
              {f.date}
            </span>
          </div>
          <div style={{ height: 1, background: L.ruleSoft, marginBottom: 14 }} />
          <p
            className="pf"
            style={{
              fontSize: 16,
              lineHeight: 1.55,
              color: L.ink,
              fontStyle: "italic",
            }}
          >
            {f.body}
          </p>
        </article>
      ))}
    </div>
  );
}

function CompoundingCurve() {
  // Outputs improving through memory — one quiet line, rising
  const W = 720, H = 260;
  const pts: [number, number][] = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    const y = H - 30 - (H - 70) * (1 - Math.exp(-2.4 * t));
    pts.push([40 + (W - 80) * t, y]);
  }
  const flatY = H - 60;
  return (
    <figure
      style={{
        background: L.paperDeep,
        border: `1px solid ${L.rule}`,
        padding: "clamp(24px, 3vw, 40px)",
      }}
    >
      <FigureCaption index="Fig. 03" title="Output quality, plotted against months of remembered context." />
      <div style={{ marginTop: 24, overflow: "hidden" }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
          {/* axis */}
          <line x1={40} y1={H - 30} x2={W - 20} y2={H - 30} stroke={L.ink} strokeOpacity={0.25} strokeWidth={1} />
          <line x1={40} y1={20} x2={40} y2={H - 30} stroke={L.ink} strokeOpacity={0.25} strokeWidth={1} />
          {/* generic baseline */}
          <line
            x1={40}
            y1={flatY}
            x2={W - 20}
            y2={flatY}
            stroke={L.ink}
            strokeOpacity={0.45}
            strokeDasharray="3 5"
            strokeWidth={1}
          />
          <text
            x={W - 24}
            y={flatY - 8}
            textAnchor="end"
            style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fill: L.inkMuted, letterSpacing: "0.06em" }}
          >
            Generic AI — flat
          </text>
          {/* Kinika curve */}
          <path
            d={`M ${pts.map((p) => p.join(",")).join(" L ")}`}
            fill="none"
            stroke={L.amber}
            strokeWidth={2}
          />
          <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={4} fill={L.amber} />
          <text
            x={pts[pts.length - 1][0] - 8}
            y={pts[pts.length - 1][1] - 12}
            textAnchor="end"
            style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontSize: 13, fill: L.ink }}
          >
            Kinika — compounding
          </text>
          {/* x labels */}
          {["Day 1", "Month 2", "Month 4", "Month 6"].map((lab, i) => (
            <text
              key={i}
              x={40 + ((W - 80) / 3) * i}
              y={H - 12}
              textAnchor={i === 0 ? "start" : i === 3 ? "end" : "middle"}
              style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fill: L.inkMuted, letterSpacing: "0.08em" }}
            >
              {lab}
            </text>
          ))}
        </svg>
      </div>
    </figure>
  );
}

function FigureCaption({ index, title }: { index: string; title: string }) {
  return (
    <figcaption className="flex items-baseline gap-4">
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
        {index}
      </span>
      <span
        className="pf"
        style={{ fontSize: 14, fontStyle: "italic", color: L.inkSoft }}
      >
        {title}
      </span>
    </figcaption>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Memory() {
  return (
    <>
      <SEO
        title="Memory — Kinika"
        description="Brand memory in Kinika: persistent business context that compounds as you work, so nothing has to be re-explained between tools."
        path="/memory"
      />
    <EditorialShell>
      <Container>
        <PageMeta issue="Kinika" section="Memory" date="The core of the product" />
        <PageTitle kicker="Persistent business memory for founders">
          A workspace that remembers your business.
        </PageTitle>

        {/* Lede */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-12" style={{ marginBottom: 120 }}>
          <div className="lg:col-span-7 lg:col-start-1">
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
              Most tools forget you the moment the window closes. Kinika does the
              opposite. Every conversation, every revision, every late-night
              note about who the work is really for — it stays. It thickens.
              And it begins to write back.
            </p>
          </div>
          <aside
            className="lg:col-span-4 lg:col-start-9"
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
              On this page
            </span>
            <ol style={{ marginTop: 16, listStyle: "none", padding: 0 }}>
              {[
                "I. What memory means here",
                "II. Fragments into structure",
                "III. The relationships between things",
                "IV. The compounding output",
                "V. A workspace that grows with you",
              ].map((t, i) => (
                <li
                  key={i}
                  className="pf"
                  style={{
                    fontSize: 15,
                    color: L.inkSoft,
                    padding: "10px 0",
                    borderTop: i === 0 ? "none" : `1px solid ${L.ruleSoft}`,
                    fontStyle: "italic",
                  }}
                >
                  {t}
                </li>
              ))}
            </ol>
          </aside>
        </section>

        {/* I. What memory means here */}
        <Section number="I" title="What memory means here" lead="Not a transcript. A living account of what you are building.">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-7">
              <Prose>
                Memory, in Kinika, is not a log. It is the careful re-reading of
                everything you have ever said about your work, organised into
                the shape of a brand. The platform listens for the lines that
                matter — a phrase you keep returning to, a customer you describe
                with unusual care, a position you defend more than once — and it
                holds them as evidence.
              </Prose>
              <Prose>
                Over weeks, this evidence becomes a portrait. Voice. Audience.
                Promise. Positioning. Origin. The portrait is editable, but it is
                not invented. It is drawn from your own words, returned to you in
                a form you can use.
              </Prose>
            </div>
            <aside className="lg:col-span-5">
              <MemoryStrata />
            </aside>
          </div>
        </Section>

        {/* II. Fragments into structure */}
        <Section
          number="II"
          title="Fragments into structure"
          lead="The studio keeps the small things. The small things turn out to be the brand."
        >
          <FragmentWall />
          <p
            className="pf"
            style={{
              marginTop: 36,
              fontSize: 16,
              fontStyle: "italic",
              color: L.inkMuted,
              maxWidth: "62ch",
            }}
          >
            Each fragment is a single observation, captured with its date and its
            origin. Together they form an index — searchable, revisable, and
            quietly authoritative.
          </p>
        </Section>

        {/* III. Relationship map */}
        <Section
          number="III"
          title="The relationships between things"
          lead="A brand is not a list. It is a set of careful connections."
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            <div className="lg:col-span-7">
              <RelationshipMap />
            </div>
            <div className="lg:col-span-5">
              <Prose>
                A new piece of audience insight changes how the promise should be
                phrased. A revised positioning quietly re-tunes the tone of the
                next campaign. The studio holds these threads so that nothing has
                to be re-explained twice.
              </Prose>
              <Prose>
                When you open a new module — a campaign, a document, a reel — it
                arrives already aware of these relationships. The work begins
                further down the page.
              </Prose>
            </div>
          </div>
        </Section>

        {/* Pull quote */}
        <section
          style={{
            margin: "120px 0",
            padding: "clamp(56px, 8vw, 96px) 0",
            borderTop: `1px solid ${L.rule}`,
            borderBottom: `1px solid ${L.rule}`,
          }}
        >
          <blockquote
            className="pf mx-auto"
            style={{
              fontSize: "clamp(30px, 4.2vw, 54px)",
              lineHeight: 1.18,
              color: L.ink,
              fontWeight: 500,
              letterSpacing: "-0.02em",
              maxWidth: "22ch",
              fontStyle: "italic",
            }}
          >
            “The longer you stay, the more like you the work becomes.”
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

        {/* IV. Compounding */}
        <Section
          number="IV"
          title="The compounding output"
          lead="Every conversation is an investment in the next thing you make."
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            <div className="lg:col-span-7">
              <CompoundingCurve />
            </div>
            <div className="lg:col-span-5">
              <Prose>
                A generic AI begins each request from zero. Its quality is
                bounded by what you can fit in a single prompt. Kinika begins
                with months of you behind it. The same brief, written in week
                one and again in month six, returns very different work.
              </Prose>
              <Prose>
                This is the moat — not faster generation, but better grounding.
                The studio simply has more of you to draw from.
              </Prose>
            </div>
          </div>
        </Section>

        {/* V. The promise */}
        <Section
          number="V"
          title="A workspace that grows with you"
          lead="Not software you use. Software that changes with the work."
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-8">
              <Prose>
                A brand is not a document signed off in week one. It is a
                position you refine across years. Kinika is built around that
                truth. The system you sign into in month nine will not be the
                same system you signed into on day one — it will know more, and
                so will the work.
              </Prose>
              <Prose>
                That is the promise underneath every other promise. Memory is
                not a feature here. It is the ground.
              </Prose>
            </div>
            <aside
              className="lg:col-span-4"
              style={{
                borderLeft: `1px solid ${L.ruleSoft}`,
                paddingLeft: 28,
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
                Related
              </span>
              <ul style={{ listStyle: "none", padding: 0, marginTop: 18 }}>
                {[
                  { to: "/philosophy", label: "Why Kinika exists" },
                  { to: "/system", label: "How the system works" },
                  { to: "/journal", label: "Notes from the team" },
                ].map((l, i) => (
                  <li
                    key={i}
                    style={{
                      borderTop: i === 0 ? "none" : `1px solid ${L.ruleSoft}`,
                      padding: "14px 0",
                    }}
                  >
                    <Link
                      to={l.to}
                      className="pf hover:opacity-70 transition-opacity"
                      style={{
                        color: L.ink,
                        fontStyle: "italic",
                        fontSize: 16,
                      }}
                    >
                      {l.label} →
                    </Link>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </Section>

        {/* Closing */}
        <section
          style={{
            marginTop: 120,
            paddingTop: 56,
            borderTop: `1px solid ${L.rule}`,
          }}
          className="grid grid-cols-1 md:grid-cols-12 gap-8 items-end"
        >
          <div className="md:col-span-8">
            <p
              className="pf"
              style={{
                fontSize: "clamp(22px, 2.4vw, 30px)",
                lineHeight: 1.32,
                color: L.ink,
                letterSpacing: "-0.015em",
                maxWidth: "26ch",
              }}
            >
              Start a brand memory today. Read it back, in your own voice,
              a year from now.
            </p>
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
    </>
  );
}

// ---------------------------------------------------------------------------
// Small primitives, local to this page
// ---------------------------------------------------------------------------

function Section({
  number,
  title,
  lead,
  children,
}: {
  number: string;
  title: string;
  lead: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 120 }}>
      <header className="grid grid-cols-1 lg:grid-cols-12 gap-12" style={{ marginBottom: 48 }}>
        <div className="lg:col-span-2">
          <span
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 11,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: L.amber,
              fontWeight: 600,
            }}
          >
            Section {number}
          </span>
        </div>
        <div className="lg:col-span-10">
          <h2
            className="pf"
            style={{
              fontSize: "clamp(28px, 3.6vw, 46px)",
              lineHeight: 1.1,
              fontWeight: 500,
              letterSpacing: "-0.02em",
              color: L.ink,
              maxWidth: "22ch",
            }}
          >
            {title}
          </h2>
          <p
            className="pf"
            style={{
              marginTop: 16,
              fontSize: 18,
              fontStyle: "italic",
              color: L.inkSoft,
              maxWidth: "44ch",
            }}
          >
            {lead}
          </p>
        </div>
      </header>
      {children}
    </section>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="pf"
      style={{
        fontSize: 17,
        lineHeight: 1.7,
        color: L.inkSoft,
        marginBottom: 20,
        maxWidth: "60ch",
      }}
    >
      {children}
    </p>
  );
}
