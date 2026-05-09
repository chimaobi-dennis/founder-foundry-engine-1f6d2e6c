import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { EditorialShell, Container, PageMeta, L } from "@/components/editorial/EditorialLayout";

/* ── Data ───────────────────────────────────────────────────────────────── */

type Plan = {
  no: string;
  name: string;
  intent: string;
  price: string;
  cadence: string;
  description: string;
  includes: string[];
  cta: string;
  to: string;
};

const PLANS: Plan[] = [
  {
    no: "Plan 01",
    name: "Starter",
    intent: "For founders setting up their first brand memory.",
    price: "Free",
    cadence: "always",
    description:
      "One brand memory, one ongoing Mentor conversation, and a Brand DNA that begins to take shape as you work.",
    includes: [
      "One brand memory",
      "Mentor — the continuous conversation",
      "Modest monthly generations",
      "Brand DNA, in progress",
    ],
    cta: "Start for free",
    to: "/sign-up",
  },
  {
    no: "Plan 02",
    name: "Studio",
    intent: "For founders building in earnest across multiple brands.",
    price: "$28",
    cadence: "per month",
    description:
      "Full access to every module. Memory deepens. Outputs sharpen. The work begins to compound.",
    includes: [
      "Three brand memories",
      "Every module — Mentor, ProStudio, Calendar, DocStudio, ReelBuilder",
      "Generous monthly generations",
      "Priority Mentor responses",
      "Library, exports, and version history",
    ],
    cta: "Start building with Kinika",
    to: "/sign-up",
  },
  {
    no: "Plan 03",
    name: "Atelier",
    intent: "For studios, agencies, and small teams.",
    price: "By arrangement",
    cadence: "annual",
    description:
      "A shared workspace for collaborators, with a private memory the whole team writes into and draws from.",
    includes: [
      "Unlimited brand memories",
      "Shared memory across the team",
      "White-label DocStudio exports",
      "Dedicated support",
      "Bespoke integrations",
    ],
    cta: "Get in touch",
    to: "mailto:hello@kinika.studio",
  },
];

/* What's the same for everyone */
const ALWAYS_INCLUDED = [
  "Your memory remains yours — exportable, portable.",
  "No usage tracking sold to third parties.",
  "Cancel any month. Your archive is downloadable.",
  "A single, considered email when something material changes.",
];

const FAQ = [
  {
    q: "Why three plans and not five?",
    a: "Because three is the smallest number of decisions a founder should have to make about a tool that lives quietly in the background. We made the choice simple on purpose.",
  },
  {
    q: "What happens to my work if I leave?",
    a: "It comes with you. Brand DNA, conversations, generated assets — all exportable in plain formats. We do not believe in held-hostage memory.",
  },
  {
    q: "Can I move between plans?",
    a: "At any time, in either direction. The system does not penalise downsizing, and it does not gate work you have already done.",
  },
  {
    q: "Do you offer a discount for annual billing?",
    a: "Studio is fifteen percent less when paid annually. Atelier is annual by default.",
  },
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

function PlanCard({ plan, index }: { plan: Plan; index: number }) {
  const isMail = plan.to.startsWith("mailto:");
  const CtaInner = (
    <span
      className="inline-flex items-center gap-2 group"
      style={{
        color: L.ink,
        fontSize: 12,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        fontWeight: 600,
        borderBottom: `1px solid ${L.amber}`,
        paddingBottom: 4,
      }}
    >
      {plan.cta}
      <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
    </span>
  );

  return (
    <article
      className="grid grid-cols-12 gap-6 lg:gap-12"
      style={{
        paddingTop: index === 0 ? 0 : 64,
        paddingBottom: 64,
        borderTop: index === 0 ? "none" : `1px solid ${L.rule}`,
      }}
    >
      {/* Left — number + name */}
      <div className="col-span-12 lg:col-span-3">
        <p
          className="pf"
          style={{
            fontStyle: "italic",
            color: L.amber,
            fontSize: 22,
            letterSpacing: "0.01em",
            marginBottom: 12,
          }}
        >
          {plan.no}
        </p>
        <h3
          className="pf"
          style={{
            fontSize: "clamp(34px, 4.4vw, 56px)",
            lineHeight: 1.02,
            color: L.ink,
            fontWeight: 500,
            letterSpacing: "-0.025em",
            marginBottom: 16,
          }}
        >
          {plan.name}
        </h3>
        <p
          className="pf"
          style={{
            fontSize: 16,
            lineHeight: 1.55,
            color: L.inkSoft,
            fontStyle: "italic",
            maxWidth: "26ch",
          }}
        >
          {plan.intent}
        </p>
      </div>

      {/* Middle — description + includes */}
      <div className="col-span-12 lg:col-span-6">
        <p
          style={{
            fontSize: 17,
            lineHeight: 1.78,
            color: L.inkSoft,
            marginBottom: 32,
            maxWidth: "52ch",
          }}
        >
          {plan.description}
        </p>

        <p
          style={{
            fontSize: 11,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: L.inkMuted,
            fontWeight: 600,
            marginBottom: 18,
          }}
        >
          Included
        </p>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 14 }}>
          {plan.includes.map((line) => (
            <li
              key={line}
              style={{
                fontSize: 15,
                lineHeight: 1.65,
                color: L.inkSoft,
                paddingLeft: 22,
                position: "relative",
              }}
            >
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  left: 0,
                  top: 11,
                  width: 10,
                  height: 1,
                  background: L.amber,
                }}
              />
              {line}
            </li>
          ))}
        </ul>
      </div>

      {/* Right — price + CTA */}
      <div className="col-span-12 lg:col-span-3 lg:text-right">
        <div className="lg:sticky lg:top-32">
          <p
            style={{
              fontSize: 11,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: L.inkMuted,
              fontWeight: 600,
              marginBottom: 14,
            }}
          >
            Subscription
          </p>
          <p
            className="pf"
            style={{
              fontSize: "clamp(40px, 4.6vw, 56px)",
              lineHeight: 1,
              color: L.ink,
              fontWeight: 500,
              letterSpacing: "-0.03em",
              marginBottom: 6,
            }}
          >
            {plan.price}
          </p>
          <p
            style={{
              fontSize: 12,
              color: L.inkMuted,
              letterSpacing: "0.06em",
              marginBottom: 36,
              fontStyle: "italic",
            }}
            className="pf"
          >
            {plan.cadence}
          </p>

          {isMail ? (
            <a href={plan.to}>{CtaInner}</a>
          ) : (
            <Link to={plan.to}>{CtaInner}</Link>
          )}
        </div>
      </div>
    </article>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export default function Pricing() {
  return (
    <EditorialShell>
      {/* ── Cover spread ────────────────────────────────────────────────── */}
      <section style={{ background: L.paper }}>
        <Container>
          <PageMeta issue="Kinika" section="Pricing" date="Plans & access" />

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
                Three plans. One workspace.
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
                Access to an intelligent founder workspace.
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
                  A note before you choose
                </p>
                <p className="pf" style={{ fontSize: 17, lineHeight: 1.6, color: L.inkSoft, fontStyle: "italic" }}>
                  Pricing should be the smallest, calmest decision in your day.
                  We've tried to make ours exactly that.
                </p>
              </div>
            </aside>
          </div>

          <div style={{ height: 1, background: L.rule, marginTop: 96 }} />
        </Container>
      </section>

      {/* ── Framing essay (two-column) ──────────────────────────────────── */}
      <section style={{ background: L.paper }}>
        <div
          className="mx-auto"
          style={{
            maxWidth: 1320,
            paddingLeft: "clamp(24px, 6vw, 96px)",
            paddingRight: "clamp(24px, 6vw, 96px)",
            paddingTop: "clamp(48px, 6vh, 80px)",
            paddingBottom: "clamp(96px, 12vh, 140px)",
          }}
        >
          <div className="grid grid-cols-12 gap-8 lg:gap-16">
            <div className="col-span-12 lg:col-span-5">
              <CategoryTag>The Premise</CategoryTag>
              <h2
                className="pf"
                style={{
                  fontSize: "clamp(34px, 4vw, 52px)",
                  lineHeight: 1.05,
                  color: L.ink,
                  fontWeight: 500,
                  letterSpacing: "-0.025em",
                  marginTop: 20,
                  maxWidth: "16ch",
                }}
              >
                You are paying for the room.
              </h2>
            </div>
            <div className="col-span-12 lg:col-span-7">
              <p
                className="pf"
                style={{
                  fontSize: "clamp(20px, 1.7vw, 24px)",
                  lineHeight: 1.55,
                  color: L.inkSoft,
                  fontStyle: "italic",
                  marginBottom: 24,
                  maxWidth: "44ch",
                }}
              >
                A subscription to Kinika is access to an intelligent founder workspace — not a
                license to a piece of software.
              </p>
              <p style={{ fontSize: 16, lineHeight: 1.78, color: L.inkSoft, maxWidth: "60ch" }}>
                What you take away from the studio is yours. The brand you sharpen, the writing you
                accumulate, the memory the system keeps on your behalf — all exportable, all
                portable, never held against you. The fee is for the desk, the lighting, and the
                careful colleague in the next chair.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Editions ────────────────────────────────────────────────────── */}
      <section style={{ background: L.paper, borderTop: `1px solid ${L.rule}` }}>
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
          <div className="grid grid-cols-12 gap-8 lg:gap-16" style={{ marginBottom: 80 }}>
            <div className="col-span-12 lg:col-span-9">
              <CategoryTag>The Plans</CategoryTag>
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
                Choose the level of access. Move between plans at any time.
              </h2>
            </div>
            <aside className="col-span-12 lg:col-span-3 lg:pt-6">
              <p className="pf" style={{ fontSize: 15, color: L.inkSoft, lineHeight: 1.65, fontStyle: "italic" }}>
                Every plan shares the same memory and the same principles.
                Only the scope changes.
              </p>
            </aside>
          </div>

          {PLANS.map((plan, i) => (
            <PlanCard key={plan.no} plan={plan} index={i} />
          ))}
        </div>
      </section>

      {/* ── What's always included ──────────────────────────────────────── */}
      <section
        style={{ background: L.paperDeep, borderTop: `1px solid ${L.rule}`, borderBottom: `1px solid ${L.rule}` }}
      >
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
            <div className="col-span-12 lg:col-span-4">
              <CategoryTag>Standing Principles</CategoryTag>
              <h3
                className="pf"
                style={{
                  fontSize: "clamp(28px, 3vw, 38px)",
                  lineHeight: 1.15,
                  color: L.ink,
                  fontWeight: 500,
                  letterSpacing: "-0.02em",
                  marginTop: 20,
                  maxWidth: "18ch",
                }}
              >
                The same in every plan. Always.
              </h3>
            </div>
            <ul
              className="col-span-12 lg:col-span-8"
              style={{ listStyle: "none", padding: 0, margin: 0 }}
            >
              {ALWAYS_INCLUDED.map((line, i) => (
                <li
                  key={line}
                  className="grid grid-cols-12 gap-4 py-6"
                  style={{
                    borderTop: i === 0 ? `1px solid ${L.rule}` : "none",
                    borderBottom: `1px solid ${L.rule}`,
                  }}
                >
                  <div className="col-span-2 sm:col-span-1">
                    <span className="pf" style={{ fontSize: 16, color: L.amber, fontStyle: "italic" }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="col-span-10 sm:col-span-11">
                    <p className="pf" style={{ fontSize: "clamp(18px, 1.8vw, 22px)", lineHeight: 1.45, color: L.ink, fontWeight: 500, letterSpacing: "-0.01em" }}>
                      {line}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── A note on enterprise ────────────────────────────────────────── */}
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
          <aside style={{ paddingLeft: "clamp(20px, 4vw, 56px)", borderLeft: `1px solid ${L.amber}` }}>
            <p
              className="pf"
              style={{
                fontSize: "clamp(28px, 3.4vw, 44px)",
                lineHeight: 1.3,
                color: L.ink,
                fontStyle: "italic",
                fontWeight: 400,
                letterSpacing: "-0.02em",
                maxWidth: "28ch",
              }}
            >
              "We do not sell seats. We make a workspace, and we let founders walk in."
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
              — On Pricing, Vol. 01
            </p>
          </aside>
        </div>
      </section>

      {/* ── Quiet questions ─────────────────────────────────────────────── */}
      <section style={{ background: L.paper, borderTop: `1px solid ${L.rule}` }}>
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
          <div className="grid grid-cols-12 gap-8 lg:gap-16" style={{ marginBottom: 64 }}>
            <div className="col-span-12 lg:col-span-4">
              <CategoryTag>Quiet Questions</CategoryTag>
              <h3
                className="pf"
                style={{
                  fontSize: "clamp(28px, 3vw, 40px)",
                  lineHeight: 1.1,
                  color: L.ink,
                  fontWeight: 500,
                  letterSpacing: "-0.02em",
                  marginTop: 20,
                  maxWidth: "16ch",
                }}
              >
                The things founders tend to ask, before they begin.
              </h3>
            </div>
            <div className="col-span-12 lg:col-span-8">
              <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {FAQ.map((item, i) => (
                  <li
                    key={item.q}
                    className="grid grid-cols-12 gap-4 lg:gap-8 py-10"
                    style={{
                      borderTop: i === 0 ? `1px solid ${L.rule}` : "none",
                      borderBottom: `1px solid ${L.rule}`,
                    }}
                  >
                    <div className="col-span-2 sm:col-span-1">
                      <span className="pf" style={{ fontSize: 18, color: L.amber, fontStyle: "italic" }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <div className="col-span-10 sm:col-span-11">
                      <p
                        className="pf"
                        style={{
                          fontSize: "clamp(20px, 2.2vw, 26px)",
                          lineHeight: 1.3,
                          color: L.ink,
                          fontWeight: 500,
                          letterSpacing: "-0.015em",
                          marginBottom: 14,
                          maxWidth: "32ch",
                        }}
                      >
                        {item.q}
                      </p>
                      <p style={{ fontSize: 16, lineHeight: 1.75, color: L.inkSoft, maxWidth: "58ch" }}>
                        {item.a}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* ── Closing colophon ────────────────────────────────────────────── */}
      <section style={{ background: L.paper, borderTop: `1px solid ${L.rule}` }}>
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
          <div className="grid grid-cols-12 gap-8 lg:gap-12">
            <div className="col-span-12 lg:col-span-7">
              <p
                className="pf"
                style={{
                  fontSize: "clamp(24px, 2.8vw, 36px)",
                  lineHeight: 1.4,
                  color: L.ink,
                  fontStyle: "italic",
                  fontWeight: 400,
                  letterSpacing: "-0.015em",
                  maxWidth: "26ch",
                  marginBottom: 32,
                }}
              >
                Begin with the Notebook. Move when you are ready.
              </p>
              <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
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
                  Enter Kinika
                </Link>
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
                  See the system first
                  <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>
            <aside className="col-span-12 lg:col-span-5 lg:pl-12 lg:border-l" style={{ borderColor: L.ruleSoft }}>
              <p style={{ fontSize: 10, letterSpacing: "0.26em", textTransform: "uppercase", color: L.inkMuted, fontWeight: 600, marginBottom: 14 }}>
                Colophon
              </p>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: L.inkSoft, maxWidth: "36ch" }}>
                Pricing notes from <em>Kinika Studio</em>, Vol. 01 — The Memory Issue. Set
                deliberately small, in the hope it stays out of the way.
              </p>
            </aside>
          </div>
        </div>
      </section>
    </EditorialShell>
  );
}
