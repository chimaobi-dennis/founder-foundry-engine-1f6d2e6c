import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { EditorialShell, Container, PageMeta, PageTitle, L } from "@/components/editorial/EditorialLayout";

const PLANS = [
  {
    n: "I.",
    name: "The Notebook",
    price: "Free",
    cadence: "Forever",
    intent: "For founders sketching their first ideas.",
    includes: [
      "One brand memory",
      "Mentor conversations",
      "Limited generations across the system",
      "Brand DNA, growing quietly",
    ],
    cta: "Begin",
    to: "/sign-up",
  },
  {
    n: "II.",
    name: "The Studio",
    price: "$28",
    cadence: "per month",
    intent: "For founders building in earnest.",
    includes: [
      "Three brand memories",
      "Full access to every room",
      "Generous monthly generations",
      "Calendar, ReelBuilder & DocStudio",
      "Priority Mentor responses",
    ],
    cta: "Open the Studio",
    to: "/sign-up",
    featured: true,
  },
  {
    n: "III.",
    name: "The Atelier",
    price: "By arrangement",
    cadence: "Annual",
    intent: "For studios, agencies and small teams.",
    includes: [
      "Unlimited brands",
      "Shared brand memory",
      "White-label DocStudio exports",
      "Dedicated correspondence",
      "Custom integrations",
    ],
    cta: "Write to us",
    to: "mailto:hello@kinika.studio",
  },
];

export default function Pricing() {
  return (
    <EditorialShell>
      <section style={{ background: L.paper }}>
        <Container>
          <PageMeta issue="Vol. 01" section="Pricing" date="Spring 2026" />
          <PageTitle kicker="Three editions">A subscription to a quieter way of working.</PageTitle>

          <div className="ed-fade ed-d2 grid grid-cols-1 lg:grid-cols-12 gap-12" style={{ marginBottom: 96 }}>
            <p className="lg:col-span-7" style={{ fontSize: 17, lineHeight: 1.75, color: L.inkSoft, maxWidth: "60ch" }}>
              Kinika is sold the way it was built — patiently, and with a clear sense of who it is for.
              Three editions, no upsells, no asterisks.
            </p>
            <p className="pf lg:col-span-5 lg:pl-12 lg:border-l" style={{ borderColor: L.ruleSoft, fontSize: 18, fontStyle: "italic", color: L.ink, lineHeight: 1.5 }}>
              Cancel any time. Your memory is yours — exportable, portable, never held hostage.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3" style={{ borderTop: `1px solid ${L.rule}`, borderBottom: `1px solid ${L.rule}` }}>
            {PLANS.map((p, idx) => {
              const featured = !!p.featured;
              return (
                <article
                  key={p.name}
                  className="p-8 lg:p-12 flex flex-col"
                  style={{
                    background: featured ? L.paperDeep : "transparent",
                    borderLeft: idx === 0 ? "none" : `1px solid ${L.rule}`,
                    minHeight: 520,
                  }}
                >
                  <div className="flex items-baseline gap-3" style={{ marginBottom: 24 }}>
                    <span className="pf" style={{ color: L.amber, fontStyle: "italic", fontSize: 22 }}>
                      {p.n}
                    </span>
                    <h3 className="pf" style={{ fontSize: 30, color: L.ink, fontWeight: 500, letterSpacing: "-0.01em" }}>
                      {p.name}
                    </h3>
                  </div>

                  <p style={{ fontSize: 14, color: L.inkSoft, lineHeight: 1.6, marginBottom: 32, fontStyle: "italic", maxWidth: "30ch" }}>
                    {p.intent}
                  </p>

                  <div style={{ marginBottom: 32 }}>
                    <span className="pf" style={{ fontSize: 44, color: L.ink, fontWeight: 500, letterSpacing: "-0.02em" }}>
                      {p.price}
                    </span>
                    <span style={{ marginLeft: 10, fontSize: 13, color: L.inkMuted, letterSpacing: "0.04em" }}>
                      {p.cadence}
                    </span>
                  </div>

                  <div style={{ height: 1, background: L.ruleSoft, marginBottom: 28 }} />

                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 14, marginBottom: 40, flex: 1 }}>
                    {p.includes.map((line) => (
                      <li
                        key={line}
                        style={{ fontSize: 14, lineHeight: 1.6, color: L.inkSoft, paddingLeft: 18, position: "relative" }}
                      >
                        <span
                          aria-hidden
                          style={{
                            position: "absolute",
                            left: 0,
                            top: 9,
                            width: 8,
                            height: 1,
                            background: L.amber,
                          }}
                        />
                        {line}
                      </li>
                    ))}
                  </ul>

                  {p.to.startsWith("mailto:") ? (
                    <a
                      href={p.to}
                      className="inline-flex items-center justify-center gap-2 group transition-all hover:-translate-y-px"
                      style={{
                        background: featured ? L.ink : "transparent",
                        color: featured ? L.paper : L.ink,
                        border: featured ? "none" : `1px solid ${L.ink}`,
                        height: 44,
                        padding: "0 22px",
                        borderRadius: 2,
                        fontSize: 13,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        fontWeight: 600,
                        alignSelf: "flex-start",
                      }}
                    >
                      {p.cta}
                      <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                    </a>
                  ) : (
                    <Link
                      to={p.to}
                      className="inline-flex items-center justify-center gap-2 group transition-all hover:-translate-y-px"
                      style={{
                        background: featured ? L.ink : "transparent",
                        color: featured ? L.paper : L.ink,
                        border: featured ? "none" : `1px solid ${L.ink}`,
                        height: 44,
                        padding: "0 22px",
                        borderRadius: 2,
                        fontSize: 13,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        fontWeight: 600,
                        alignSelf: "flex-start",
                      }}
                    >
                      {p.cta}
                      <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                    </Link>
                  )}
                </article>
              );
            })}
          </div>

          <aside className="pf" style={{ marginTop: 96, fontSize: "clamp(22px, 2.2vw, 28px)", fontStyle: "italic", color: L.ink, maxWidth: "32ch", lineHeight: 1.4 }}>
            "We charge for the room. Everything you write inside it remains yours."
            <span style={{ display: "block", marginTop: 18, fontStyle: "normal", fontSize: 11, color: L.inkMuted, letterSpacing: "0.2em", textTransform: "uppercase" }}>
              — On Pricing
            </span>
          </aside>
        </Container>
      </section>
    </EditorialShell>
  );
}
