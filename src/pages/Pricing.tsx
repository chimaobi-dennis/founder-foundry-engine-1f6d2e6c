import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { getCreditPackages, type CreditPackage } from "@/services/stripeService";
import { splitPackages } from "@/services/subscriptionService";
import type { PlanLimits } from "@shared/plans";
import { EditorialShell, Container, PageMeta, L } from "@/components/editorial/EditorialLayout";
import { SEO } from "@/components/SEO";

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

const money = (n: number) => (Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`);
const count = (n: number | undefined, one: string, many: string) => (n == null ? null : n < 0 ? `Unlimited ${many}` : `${n} ${n === 1 ? one : many}`);

/**
 * Plans are rows in credit_packages; this page reads them so the public price
 * is the price Billing charges. The fallback below mirrors the seeded rows and
 * only shows if the database cannot be reached.
 */
function planFromPackage(pkg: CreditPackage, index: number, seats: CreditPackage[]): Plan {
  const lim = pkg.limits as Partial<PlanLimits>;
  const agentSeat = seats.find((s) => s.addonKind === "agent_seat");
  const memberSeat = seats.find((s) => s.addonKind === "member_seat");
  const includes = [
    `${(pkg.monthlyCredits ?? pkg.credits).toLocaleString()} credits every month`,
    count(lim.agents, "agent seat; Kinika hires from your plan", "agent seats; Kinika hires from your plan"),
    count(lim.members, "person in the workspace", "people in the workspace"),
    count(lim.connections, "connected tool", "connected tools"),
    lim.code_repos ? count(lim.code_repos, "connected repository", "connected repositories") : null,
    lim.autonomous_publishing ? "Act without asking, per kind of action, where you turn it on" : "Every result waits for your approval",
    agentSeat && (lim.agents ?? 0) >= 0 ? `Extra agent seat ${money(agentSeat.priceUsd)} a month` : null,
    memberSeat && (lim.members ?? 0) >= 0 ? `Extra person ${money(memberSeat.priceUsd)} a month` : null,
    lim.enterprise ? "Priority support and bespoke connections" : null,
  ].filter((x): x is string => !!x);
  return {
    no: `Plan 0${index + 1}`,
    name: pkg.name,
    intent: pkg.tagline ?? "",
    price: money(pkg.priceUsd),
    cadence: "per month",
    description: pkg.description ?? "",
    includes,
    cta: index === 0 ? "Start with " + pkg.name : `Choose ${pkg.name}`,
    to: `/sign-up?plan=${pkg.slug ?? pkg.id}`,
  };
}

const FALLBACK_PLANS: Plan[] = [
  {
    no: "Plan 01",
    name: "Solo",
    intent: "For one founder with a plan to run.",
    price: "$20",
    cadence: "per month",
    description: "Two agent seats, 1,000 credits a month. Kinika staffs one role at a time and swaps when a role is done. You approve every result.",
    includes: ["1,000 credits every month", "2 agent seats; Kinika hires from your plan", "1 person in the workspace", "2 connected tools", "1 connected repository", "Every result waits for your approval", "Extra agent seat $10 a month", "Extra person $5 a month"],
    cta: "Start with Solo",
    to: "/sign-up?plan=solo",
  },
  {
    no: "Plan 02",
    name: "Startup",
    intent: "For a small team running real work through Kinika.",
    price: "$45",
    cadence: "per month",
    description: "Five agent seats, 2,000 credits a month, people in the workspace, standing tasks on a schedule.",
    includes: ["2,000 credits every month", "5 agent seats; all roles at once", "3 people in the workspace", "Unlimited connected tools", "3 connected repositories", "Every result waits for your approval", "Extra agent seat $10 a month", "Extra person $5 a month"],
    cta: "Choose Startup",
    to: "/sign-up?plan=startup",
  },
  {
    no: "Plan 03",
    name: "Enterprise",
    intent: "For teams and agencies running more than one business.",
    price: "$139",
    cadence: "per month",
    description: "Ten agent seats, several businesses, 6,000 credits a month, twenty people, act-without-asking on kinds of action you choose.",
    includes: ["6,000 credits every month", "10 agent seats across several businesses", "20 people in the workspace", "Unlimited connected tools and repositories", "Act without asking, per kind of action, where you turn it on", "Extra agent seat $10 a month", "Extra person $5 a month", "Priority support and bespoke connections"],
    cta: "Choose Enterprise",
    to: "/sign-up?plan=enterprise",
  },
];

/* What's the same for everyone */
const ALWAYS_INCLUDED = [
  "The free trial is plans and consultation: Kinika reads your business back, writes the plan and advises. No agent seats; 50 credits for that.",
  "Seats are how many agents can be on the team. Credits are how much work they do. Every task is quoted in credits before it runs.",
  "Nothing is sent, published or changed in a connected tool without your approval; every change can be reverted.",
  "Your brand record and memory remain yours. Cancel any month; work already done stays."
];

const FAQ = [
  {
    q: "What is a credit?",
    a: "The unit every task is priced in. A credit is two cents. A research brief costs a few credits, a set of posts a few dozen, and you see the quote before Kinika hires anyone for it. Top-ups never expire.",
  },
  {
    q: "What is a seat, and who hires?",
    a: "A seat is a place on the team for one agent at a time. Your plan names the roles it needs; you confirm once and Kinika hires them. With fewer seats than roles, Kinika hires in plan order and swaps when a role has no open tasks. You never manage agents one by one."
  },
  {
    q: "What if I need more agents or people?",
    a: "Add a seat from Billing at any time. An extra agent seat is ten dollars a month, an extra person five. Remove them just as easily; work already done stays."
  },
  {
    q: "Can I move between plans?",
    a: "At any time, in either direction. Unused credits carry over, and nothing you have already built is gated.",
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
  const [plans, setPlans] = useState<Plan[]>(FALLBACK_PLANS);
  const [topups, setTopups] = useState<CreditPackage[]>([]);

  useEffect(() => {
    let active = true;
    getCreditPackages().then((all) => {
      if (!active) return;
      const { plans: p, seats, topups: t } = splitPackages(all);
      if (p.length) setPlans(p.map((pkg, i) => planFromPackage(pkg, i, seats)));
      setTopups(t);
    }).catch(() => { /* fallback plans stay */ });
    return () => { active = false; };
  }, []);

  return (
    <>
      <SEO
        title="Pricing — Kinika"
        description="Kinika pricing: free to plan; Solo, Startup and Enterprise add agent seats. Work is priced in credits and quoted before it runs."
        path="/pricing"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }}
      />
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
                Free to plan. Pay for seats and work.
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
                Seats for agents. Credits for work.
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
                  Start free: Kinika reads your business back and writes the plan with you. Add seats when you want Kinika to staff the tasks that need an agent.
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
                You pay for seats and for work.
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
                Every plan is the same Kinika. The subscription sets how many agents can be on
                the team at once, and how much work they do each month.
              </p>
              <p style={{ fontSize: 16, lineHeight: 1.78, color: L.inkSoft, maxWidth: "60ch" }}>
                Seats are how many agents Kinika can have working at once. Credits are how much
                work gets done; every task is quoted before it runs. The free trial has no seats:
                Kinika reads your business back, writes the plan and advises, and you do the tasks.
                Add seats when you want Kinika to staff the tasks that need an agent.
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
                Choose how many seats. Move between plans at any time.
              </h2>
            </div>
            <aside className="col-span-12 lg:col-span-3 lg:pt-6">
              <p className="pf" style={{ fontSize: 15, color: L.inkSoft, lineHeight: 1.65, fontStyle: "italic" }}>
                Every plan shares the same brand record, plan and approval rule.
                Only seats, credits and people change.
              </p>
            </aside>
          </div>

          {plans.map((plan, i) => (
            <PlanCard key={plan.no} plan={plan} index={i} />
          ))}
          {topups.length > 0 && (
            <div className="grid grid-cols-12 gap-6 lg:gap-12" style={{ paddingTop: 48, borderTop: `1px solid ${L.rule}` }}>
              <div className="col-span-12 lg:col-span-3">
                <p className="pf" style={{ fontStyle: "italic", color: L.amber, fontSize: 22, marginBottom: 12 }}>Top-ups</p>
                <p className="pf" style={{ fontSize: 16, lineHeight: 1.55, color: L.inkSoft, fontStyle: "italic", maxWidth: "26ch" }}>For a busy month. Credits that never expire.</p>
              </div>
              <div className="col-span-12 lg:col-span-9 flex flex-wrap gap-x-10 gap-y-4">
                {topups.map((t) => (
                  <p key={t.id} style={{ fontSize: 15, color: L.inkSoft }}>
                    <span className="pf" style={{ color: L.ink, fontSize: 22, fontWeight: 500 }}>{money(t.priceUsd)}</span> · {t.credits.toLocaleString()} credits
                  </p>
                ))}
              </div>
            </div>
          )}
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
              "Nothing is sent, published or changed without your yes. That rule does not change with the plan."
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
              — A working principle
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
              <CategoryTag>Common Questions</CategoryTag>
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
                The things founders ask, before they sign up.
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
                Start free: Kinika plans with you. Add seats when the work needs hands.
              </p>
              <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
                <Link
                  to="/sign-up"
                  className="inline-flex items-center text-sm font-medium transition-all hover:-translate-y-px"
                  style={{
                    background: L.amber,
                    color: "#FFFFFF",
                    height: 44,
                    padding: "0 22px",
                    borderRadius: 8,
                    letterSpacing: "0.02em",
                  }}
                >
                  Start free
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
                  See how the system works
                  <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>
            <aside className="col-span-12 lg:col-span-5 lg:pl-12 lg:border-l" style={{ borderColor: L.ruleSoft }}>
              <p style={{ fontSize: 10, letterSpacing: "0.26em", textTransform: "uppercase", color: L.inkMuted, fontWeight: 600, marginBottom: 14 }}>
                About pricing
              </p>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: L.inkSoft, maxWidth: "36ch" }}>
                Kept simple so the decision stays out of the way of the work. Every plan
                is cancellable any month, and what Kinika knows about your business stays yours.
              </p>
            </aside>
          </div>
        </div>
      </section>
    </EditorialShell>
    </>
  );
}
