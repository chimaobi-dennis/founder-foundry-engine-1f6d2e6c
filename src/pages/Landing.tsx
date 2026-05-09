import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";

const C = {
  bg: "#0D1B2A",
  bgDark: "#080F18",
  card: "#1A2A3A",
  cardHover: "#253A4A",
  amber: "#D4A017",
  text: "#F5F0E8",
  muted: "#8A96A3",
  border: "#1A2A3A",
};

// Warm editorial palette (Section 1: Nav + Hero)
const L = {
  paper: "#F2EDE4",         // parchment
  paperDeep: "#EAE3D6",     // slightly deeper ivory for depth
  ink: "#0D1B2A",           // navy ink
  inkSoft: "#3A4856",       // secondary ink
  inkMuted: "#6B7480",      // tertiary ink
  amber: "#B8860B",         // restrained amber for warm bg
  rule: "rgba(13, 27, 42, 0.14)",
  ruleSoft: "rgba(13, 27, 42, 0.08)",
};

const CYCLING = ["actually understood.", "finally connected.", "working as one.", "yours, end to end."];

const MODULES = [
  { emoji: "🧠", name: "Kinika", desc: "Your AI thinking partner. Holds the full picture of your business." },
  { emoji: "📸", name: "ProStudio", desc: "Product visuals without a studio." },
  { emoji: "📢", name: "ContentStudio", desc: "One brief. Eight platforms. Ready to post." },
  { emoji: "📅", name: "ContentCalendar", desc: "Plan your content month visually." },
  { emoji: "📄", name: "DocStudio", desc: "Professional documents drawn from your business context." },
  { emoji: "🎬", name: "ReelBuilder", desc: "Brief to script to teleprompter." },
];

const PROBLEMS = [
  { n: "01", title: "Tools that don't talk", body: "Canva, ChatGPT, Notion, Buffer — each one capable, none of them aware of the others. Your business lives in fragments." },
  { n: "02", title: "Re-explaining everything", body: "You paste positioning, audience and tone into every new tab. The context resets the moment you switch surfaces." },
  { n: "03", title: "Generic, off-brand outputs", body: "Without shared understanding, every tool defaults to a template built for someone else. You spend the day correcting it back to you." },
];

const STEPS = [
  { n: "1", title: "Talk to Kinika", body: "Have a real conversation about your business. No forms. No setup. The context starts forming from the first message." },
  { n: "2", title: "Build shared understanding", body: "Positioning, audience, voice and direction accumulate into one connected business context — not a profile, a working model." },
  { n: "3", title: "Create from one source", body: "Every module reads from the same context. Visuals, copy, docs and campaigns arrive aligned, without re-explaining anything." },
];

function useScrolled() {
  const [s, setS] = useState(false);
  useEffect(() => {
    const fn = () => setS(window.scrollY > 8);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);
  return s;
}

function useReveal<T extends HTMLElement>(): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [v, setV] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => e.isIntersecting && setV(true), { threshold: 0.2 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, v];
}

function ModuleEcosystem() {
  // Modules positioned around the central Kinika core (desktop orbital layout)
  // Coordinates are in % of the 1000x620 stage
  const modules = [
    {
      name: "ProStudio",
      kind: "Visuals",
      inherits: ["voice", "audience", "visual identity"],
      sample: "Founder-grade product visuals.",
      pos: { left: "6%", top: "8%" },
      align: "right",
      float: "float-a",
    },
    {
      name: "ContentStudio",
      kind: "Content",
      inherits: ["voice", "audience", "stage"],
      sample: "Captions that sound like you.",
      pos: { right: "6%", top: "8%" },
      align: "left",
      float: "float-b",
    },
    {
      name: "ContentCalendar",
      kind: "Rhythm",
      inherits: ["cadence", "stage", "channels"],
      sample: "A month of intentional posts.",
      pos: { left: "0%", bottom: "6%" },
      align: "right",
      float: "float-c",
    },
    {
      name: "DocStudio",
      kind: "Documents",
      inherits: ["positioning", "voice", "audience"],
      sample: "Decks, briefs, one-pagers.",
      pos: { left: "50%", bottom: "0%", transform: "translateX(-50%)" },
      align: "center",
      float: "float-a",
    },
    {
      name: "ReelBuilder",
      kind: "Story",
      inherits: ["voice", "promise", "audience"],
      sample: "Scripts that hold attention.",
      pos: { right: "0%", bottom: "6%" },
      align: "left",
      float: "float-b",
    },
  ];

  // Endpoints in viewBox coords (1000x620) for SVG connectors
  const endpoints = [
    { x: 165, y: 110 },   // ProStudio (top-left)
    { x: 835, y: 110 },   // ContentStudio (top-right)
    { x: 130, y: 500 },   // ContentCalendar (bottom-left)
    { x: 500, y: 560 },   // DocStudio (bottom-center)
    { x: 870, y: 500 },   // ReelBuilder (bottom-right)
  ];
  const core = { x: 500, y: 310 };

  return (
    <div>
      {/* ═══ DESKTOP — orbital ecosystem ═══ */}
      <div
        className="hidden lg:block relative mx-auto"
        style={{ maxWidth: 1080, height: 620 }}
      >
        {/* SVG connectors + concentric rings */}
        <svg
          viewBox="0 0 1000 620"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full pointer-events-none"
        >
          {/* concentric memory rings */}
          {[140, 200, 260].map((r, i) => (
            <circle
              key={r}
              cx={core.x}
              cy={core.y}
              r={r}
              fill="none"
              stroke={L.amber}
              strokeWidth={i === 0 ? 0.6 : 0.4}
              strokeDasharray={i === 0 ? "0" : "2 6"}
              opacity={0.18 - i * 0.04}
            />
          ))}

          {/* relationship lines core → modules */}
          {endpoints.map((p, i) => (
            <g key={i}>
              <line
                x1={core.x}
                y1={core.y}
                x2={p.x}
                y2={p.y}
                stroke={L.amber}
                strokeWidth="0.8"
                strokeDasharray="3 5"
                opacity="0.45"
              />
              {/* signal dot mid-line */}
              <circle
                cx={core.x + (p.x - core.x) * 0.55}
                cy={core.y + (p.y - core.y) * 0.55}
                r="2.2"
                fill={L.amber}
                opacity="0.6"
                className="pulse-dot"
              />
            </g>
          ))}
        </svg>

        {/* CORE — Kinika memory */}
        <div
          className="absolute"
          style={{
            left: "50%", top: "50%",
            transform: "translate(-50%, -50%)",
            width: 260,
          }}
        >
          {/* halo */}
          <div
            aria-hidden
            className="absolute"
            style={{
              inset: -28,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(184,134,11,0.18), transparent 70%)",
            }}
          />
          <div
            style={{
              position: "relative",
              background: "#FFFFFF",
              border: `1.5px solid rgba(184,134,11,0.5)`,
              borderRadius: 6,
              padding: "26px 26px 28px",
              boxShadow: "0 24px 60px -28px rgba(184,134,11,0.45), 0 1px 0 rgba(13,27,42,0.04)",
              textAlign: "center",
            }}
          >
            <div className="flex items-center justify-center gap-2" style={{ marginBottom: 10 }}>
              <span className="pulse-dot" style={{
                width: 6, height: 6, borderRadius: "50%", background: L.amber,
              }} />
              <span style={{
                fontFamily: "'DM Sans', sans-serif", fontSize: 10.5,
                letterSpacing: "0.24em", textTransform: "uppercase",
                color: L.amber, fontWeight: 600,
              }}>
                The Core
              </span>
            </div>

            <h3 className="pf" style={{
              color: L.ink, fontSize: 30, lineHeight: 1.05,
              fontWeight: 500, letterSpacing: "-0.015em",
            }}>
              Kinika
            </h3>
            <p style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: 11.5,
              letterSpacing: "0.18em", textTransform: "uppercase",
              color: L.inkMuted, marginTop: 6, fontWeight: 500,
            }}>
              Memory · Mentor · Brand DNA
            </p>

            <div style={{ height: 1, background: L.ruleSoft, margin: "16px auto 14px", width: 36 }} />

            <p style={{
              color: L.inkSoft, fontSize: 13, lineHeight: 1.55,
            }}>
              The intelligence layer every surface listens to.
            </p>
          </div>
        </div>

        {/* MODULES around the core */}
        {modules.map((m) => (
          <div
            key={m.name}
            className={`absolute ${m.float}`}
            style={{ ...m.pos, width: 230 } as React.CSSProperties}
          >
            <div
              style={{
                background: "#FFFFFF",
                border: `1px solid ${L.rule}`,
                borderRadius: 4,
                padding: "16px 18px 18px",
                boxShadow: "0 14px 32px -22px rgba(13,27,42,0.22)",
                textAlign: m.align as React.CSSProperties["textAlign"],
              }}
            >
              <span style={{
                fontFamily: "'DM Sans', sans-serif", fontSize: 10,
                letterSpacing: "0.22em", textTransform: "uppercase",
                color: L.inkMuted, fontWeight: 600,
              }}>
                {m.kind}
              </span>
              <h4 className="pf" style={{
                color: L.ink, fontSize: 19, lineHeight: 1.1,
                fontWeight: 500, letterSpacing: "-0.005em",
                marginTop: 4,
              }}>
                {m.name}
              </h4>
              <p style={{
                color: L.inkSoft, fontSize: 12.5, lineHeight: 1.5,
                marginTop: 8,
              }}>
                {m.sample}
              </p>
              <div style={{
                marginTop: 12, paddingTop: 10,
                borderTop: `1px dashed ${L.ruleSoft}`,
              }}>
                <span style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: 10,
                  letterSpacing: "0.16em", textTransform: "uppercase",
                  color: L.amber, fontWeight: 600,
                }}>
                  inherits ·
                </span>{" "}
                <span style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: 11,
                  color: L.inkSoft,
                }}>
                  {m.inherits.join(" · ")}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ═══ MOBILE / TABLET — vertical stack with center anchored ═══ */}
      <div className="lg:hidden">
        {/* core card */}
        <div
          style={{
            position: "relative",
            background: "#FFFFFF",
            border: `1.5px solid rgba(184,134,11,0.45)`,
            borderRadius: 6,
            padding: "22px 22px 24px",
            boxShadow: "0 18px 44px -24px rgba(184,134,11,0.4)",
            textAlign: "center",
            maxWidth: 420, margin: "0 auto",
          }}
        >
          <div className="flex items-center justify-center gap-2" style={{ marginBottom: 8 }}>
            <span className="pulse-dot" style={{
              width: 6, height: 6, borderRadius: "50%", background: L.amber,
            }} />
            <span style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: 10.5,
              letterSpacing: "0.24em", textTransform: "uppercase",
              color: L.amber, fontWeight: 600,
            }}>
              The Core
            </span>
          </div>
          <h3 className="pf" style={{
            color: L.ink, fontSize: 28, lineHeight: 1.05,
            fontWeight: 500, letterSpacing: "-0.015em",
          }}>
            Kinika
          </h3>
          <p style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: 11,
            letterSpacing: "0.18em", textTransform: "uppercase",
            color: L.inkMuted, marginTop: 6,
          }}>
            Memory · Mentor · Brand DNA
          </p>
        </div>

        {/* connector */}
        <div className="flex justify-center" style={{ margin: "8px 0" }}>
          <svg width="14" height="32" viewBox="0 0 14 32" fill="none">
            <path d="M7 0 V28 M2 23 L7 28 L12 23" stroke={L.amber} strokeWidth="1" fill="none" opacity="0.6" />
          </svg>
        </div>

        {/* shared label */}
        <div className="flex items-center gap-3 justify-center" style={{ marginBottom: 18 }}>
          <span style={{ width: 18, height: 1, background: L.rule }} />
          <span style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: 10.5,
            letterSpacing: "0.22em", textTransform: "uppercase",
            color: L.inkMuted,
          }}>
            Modules · listening to the core
          </span>
          <span style={{ width: 18, height: 1, background: L.rule }} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-[640px] mx-auto">
          {modules.map((m) => (
            <div
              key={m.name}
              style={{
                background: "#FFFFFF",
                border: `1px solid ${L.ruleSoft}`,
                borderRadius: 4,
                padding: "16px 18px 18px",
              }}
            >
              <span style={{
                fontFamily: "'DM Sans', sans-serif", fontSize: 10,
                letterSpacing: "0.22em", textTransform: "uppercase",
                color: L.inkMuted, fontWeight: 600,
              }}>
                {m.kind}
              </span>
              <h4 className="pf" style={{
                color: L.ink, fontSize: 19, lineHeight: 1.1,
                fontWeight: 500, marginTop: 4,
              }}>
                {m.name}
              </h4>
              <p style={{
                color: L.inkSoft, fontSize: 12.5, lineHeight: 1.5,
                marginTop: 8,
              }}>
                {m.sample}
              </p>
              <div style={{
                marginTop: 12, paddingTop: 10,
                borderTop: `1px dashed ${L.ruleSoft}`,
              }}>
                <span style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: 10,
                  letterSpacing: "0.16em", textTransform: "uppercase",
                  color: L.amber, fontWeight: 600,
                }}>
                  inherits ·
                </span>{" "}
                <span style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: 11,
                  color: L.inkSoft,
                }}>
                  {m.inherits.join(" · ")}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* closing line */}
      <div style={{ marginTop: 64, textAlign: "center" }}>
        <p className="pf" style={{
          color: L.ink, fontSize: "clamp(20px, 2vw, 26px)",
          lineHeight: 1.4, fontStyle: "italic", fontWeight: 500,
          letterSpacing: "-0.01em", maxWidth: "36ch", margin: "0 auto",
        }}>
          Five surfaces. One mind underneath all of them.
        </p>
      </div>
    </div>
  );
}

function JourneyRecord() {
  const stages = [
    {
      r: "I", name: "Spark",
      state: "Captured",
      brief: "First instincts, half-formed ideas, the reason this exists.",
      insights: 14, milestones: 2,
      tag: "origin signal",
    },
    {
      r: "II", name: "Shape",
      state: "Captured",
      brief: "The idea sharpens. Audience and problem come into focus.",
      insights: 22, milestones: 3,
      tag: "first conviction",
    },
    {
      r: "III", name: "Validate",
      state: "In progress",
      brief: "Conversations, signals, evidence. What's real vs. assumed.",
      insights: 31, milestones: 4,
      tag: "early traction",
      active: true,
    },
    {
      r: "IV", name: "Brand",
      state: "Forming",
      brief: "Voice, promise, point of view — the way you sound when seen.",
      insights: 9, milestones: 1,
      tag: "identity emerging",
    },
    {
      r: "V", name: "Launch",
      state: "Ahead",
      brief: "First public surface. The world meets the work.",
      insights: 0, milestones: 0,
      tag: "—",
    },
    {
      r: "VI", name: "Grow",
      state: "Ahead",
      brief: "Compounding distribution. The brand starts to remember itself.",
      insights: 0, milestones: 0,
      tag: "—",
    },
  ];

  return (
    <div className="grid grid-cols-12 gap-x-8 lg:gap-x-16 gap-y-12">
      {/* LEFT — Stage map (notebook-style staggered grid) */}
      <div className="col-span-12 lg:col-span-8 relative">
        {/* faint vertical rule on desktop */}
        <div
          className="hidden lg:block absolute pointer-events-none"
          style={{
            top: 18, bottom: 18, left: "50%",
            width: 1, background: L.ruleSoft, transform: "translateX(-0.5px)",
          }}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8 relative">
          {stages.map((s, i) => {
            const isAhead = s.state === "Ahead";
            const isActive = !!s.active;
            const offset = i % 2 === 1 ? "lg:mt-12" : "";
            return (
              <div key={s.name} className={`relative ${offset}`}>
                {/* connector dot to vertical rule (desktop) */}
                <div
                  className="hidden lg:block absolute"
                  style={{
                    top: 22,
                    [i % 2 === 0 ? "right" : "left"]: -40,
                    width: 9, height: 9, borderRadius: "50%",
                    background: isActive ? L.amber : L.paper,
                    border: `1px solid ${isActive ? L.amber : L.rule}`,
                  } as React.CSSProperties}
                />

                {/* layered card */}
                <div className="relative">
                  <div
                    aria-hidden
                    className="absolute inset-0"
                    style={{
                      transform: "translate(5px, 5px)",
                      background: isActive ? "rgba(184,134,11,0.05)" : L.paper,
                      border: `1px solid ${L.ruleSoft}`,
                      borderRadius: 4,
                    }}
                  />
                  <div
                    className={i % 3 === 0 ? "float-a" : i % 3 === 1 ? "float-b" : "float-c"}
                    style={{
                      position: "relative",
                      background: "#FFFFFF",
                      border: `1px solid ${isActive ? "rgba(184,134,11,0.45)" : L.rule}`,
                      borderRadius: 4,
                      padding: "20px 22px 22px",
                      opacity: isAhead ? 0.55 : 1,
                      boxShadow: isActive
                        ? "0 12px 36px -22px rgba(184,134,11,0.55)"
                        : "0 10px 26px -20px rgba(13,27,42,0.18)",
                    }}
                  >
                    {/* head row */}
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="flex items-baseline gap-3">
                        <span className="pf" style={{
                          color: isActive ? L.amber : L.inkMuted,
                          fontSize: 13, letterSpacing: "0.18em",
                          fontWeight: 500,
                        }}>
                          {s.r}
                        </span>
                        <h3 className="pf" style={{
                          color: L.ink, fontSize: 22, lineHeight: 1.1,
                          fontWeight: 500, letterSpacing: "-0.01em",
                        }}>
                          {s.name}
                        </h3>
                      </div>
                      <span style={{
                        fontFamily: "'DM Sans', sans-serif", fontSize: 10,
                        letterSpacing: "0.2em", textTransform: "uppercase",
                        color: isActive ? L.amber : L.inkMuted, fontWeight: 600,
                      }}>
                        {s.state}
                      </span>
                    </div>

                    <div style={{ height: 1, background: L.ruleSoft, margin: "12px 0 12px", width: 32 }} />

                    <p style={{
                      color: L.inkSoft, fontSize: 13.5, lineHeight: 1.55,
                    }}>
                      {s.brief}
                    </p>

                    {/* footer ledger */}
                    <div style={{
                      marginTop: 18, paddingTop: 12,
                      borderTop: `1px dashed ${L.ruleSoft}`,
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                    }}>
                      <div className="flex items-center gap-4">
                        <span style={{
                          fontFamily: "'DM Sans', sans-serif", fontSize: 11,
                          color: L.inkMuted, letterSpacing: "0.04em",
                        }}>
                          <span style={{ color: L.ink, fontWeight: 600 }}>{s.insights}</span> insights
                        </span>
                        <span style={{
                          fontFamily: "'DM Sans', sans-serif", fontSize: 11,
                          color: L.inkMuted, letterSpacing: "0.04em",
                        }}>
                          <span style={{ color: L.ink, fontWeight: 600 }}>{s.milestones}</span> milestones
                        </span>
                      </div>
                      {!isAhead && (
                        <span className={isActive ? "pulse-dot" : ""} style={{
                          width: 6, height: 6, borderRadius: "50%",
                          background: isActive ? L.amber : L.inkMuted,
                          opacity: isActive ? 1 : 0.55,
                        }} />
                      )}
                    </div>

                    {/* tag */}
                    <div style={{ marginTop: 12 }}>
                      <span style={{
                        fontFamily: "'DM Sans', sans-serif", fontSize: 10,
                        letterSpacing: "0.18em", textTransform: "uppercase",
                        color: isActive ? L.amber : L.inkMuted,
                      }}>
                        — {s.tag}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT — Strategic memory archive */}
      <div className="col-span-12 lg:col-span-4">
        <div className="lg:sticky lg:top-32">
          <div style={{
            background: "#FBF7EF",
            border: `1px solid ${L.rule}`,
            borderRadius: 4,
            padding: "26px 26px 28px",
            boxShadow: "0 14px 36px -24px rgba(13,27,42,0.2)",
          }}>
            <div className="flex items-center gap-2" style={{ marginBottom: 14 }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%", background: L.amber,
              }} className="pulse-dot" />
              <span style={{
                fontFamily: "'DM Sans', sans-serif", fontSize: 10.5,
                letterSpacing: "0.22em", textTransform: "uppercase",
                color: L.amber, fontWeight: 600,
              }}>
                The Archive
              </span>
            </div>

            <h3 className="pf" style={{
              color: L.ink, fontSize: 24, lineHeight: 1.15,
              fontWeight: 500, letterSpacing: "-0.01em",
            }}>
              Everything you've thought, captured.
            </h3>

            <div style={{ height: 1, background: L.ruleSoft, margin: "18px 0 16px" }} />

            {/* progressive ledger */}
            <ul style={{ display: "grid", gap: 10 }}>
              {[
                { k: "Origin notes", v: "14" },
                { k: "Audience signals", v: "22" },
                { k: "Validated insights", v: "18" },
                { k: "Brand fragments", v: "9" },
                { k: "Milestones marked", v: "10" },
              ].map((row) => (
                <li key={row.k} style={{
                  display: "flex", alignItems: "baseline", justifyContent: "space-between",
                  borderBottom: `1px dashed ${L.ruleSoft}`,
                  paddingBottom: 8,
                }}>
                  <span style={{
                    fontFamily: "'DM Sans', sans-serif", fontSize: 13,
                    color: L.inkSoft,
                  }}>
                    {row.k}
                  </span>
                  <span className="pf" style={{
                    color: L.ink, fontSize: 16, fontWeight: 500,
                    letterSpacing: "-0.005em",
                  }}>
                    {row.v}
                  </span>
                </li>
              ))}
            </ul>

            {/* understanding meter */}
            <div style={{ marginTop: 22 }}>
              <div className="flex items-baseline justify-between" style={{ marginBottom: 8 }}>
                <span style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: 11,
                  letterSpacing: "0.18em", textTransform: "uppercase",
                  color: L.inkMuted, fontWeight: 500,
                }}>
                  Brand understanding
                </span>
                <span className="pf" style={{
                  color: L.ink, fontSize: 16, fontWeight: 500,
                }}>
                  62%
                </span>
              </div>
              <div style={{
                height: 2, background: L.ruleSoft, position: "relative",
                borderRadius: 2, overflow: "hidden",
              }}>
                <div style={{
                  position: "absolute", inset: 0, width: "62%",
                  background: `linear-gradient(to right, ${L.amber}, rgba(184,134,11,0.55))`,
                }} />
              </div>
              <p style={{
                marginTop: 12, fontSize: 12, lineHeight: 1.55,
                color: L.inkMuted, fontFamily: "'DM Sans', sans-serif",
              }}>
                Compounded across <span style={{ color: L.ink, fontWeight: 600 }}>47 sessions</span> · last entry 2 days ago
              </p>
            </div>
          </div>

          {/* tiny footnote */}
          <p style={{
            marginTop: 18, fontSize: 11,
            letterSpacing: "0.2em", textTransform: "uppercase",
            color: L.inkMuted, fontFamily: "'DM Sans', sans-serif", textAlign: "center",
          }}>
            Memory · not metrics
          </p>
        </div>
      </div>
    </div>
  );
}

function IntelligenceLoop() {
  const stages = [
    {
      kicker: "01 · Input",
      label: "Conversation",
      body: "Founder talks. No forms. Just thinking out loud.",
      pill: "live thread",
    },
    {
      kicker: "02 · Captured",
      label: "Memory",
      body: "Signals saved as structured brand context.",
      pill: "+ 12 signals this week",
    },
    {
      kicker: "03 · Synthesis",
      label: "Understanding",
      body: "Voice, audience, promise, stage — all related.",
      pill: "context · 74%",
    },
    {
      kicker: "04 · Output",
      label: "Aligned creation",
      body: "Every artifact shaped by the same memory.",
      pill: "shaped by memory",
    },
  ];

  const outputs = [
    { label: "Visuals", sub: "ProStudio" },
    { label: "Content", sub: "ContentStudio" },
    { label: "Campaigns", sub: "CampaignKit" },
    { label: "Documents", sub: "DocStudio" },
  ];

  return (
    <div className="relative">
      {/* horizontal connecting rail (desktop only) */}
      <div
        className="hidden lg:block absolute pointer-events-none"
        style={{
          top: 96,
          left: "8%",
          right: "8%",
          height: 1,
          background: `linear-gradient(to right, transparent, ${L.amber} 20%, ${L.amber} 80%, transparent)`,
          opacity: 0.55,
        }}
      />

      {/* stages row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-4 relative">
        {stages.map((s, i) => (
          <div key={s.label} className="relative flex flex-col items-center text-center">
            {/* node dot on the rail */}
            <div
              className="hidden lg:block absolute"
              style={{
                top: 90,
                width: 13,
                height: 13,
                borderRadius: "50%",
                background: L.paper,
                border: `1.5px solid ${L.amber}`,
                boxShadow: `0 0 0 4px ${L.paper}`,
              }}
            >
              <span
                className="pulse-dot block"
                style={{
                  position: "absolute",
                  inset: 2,
                  borderRadius: "50%",
                  background: L.amber,
                }}
              />
            </div>

            {/* kicker */}
            <div style={{ height: 96 }} className="hidden lg:flex items-start justify-center pt-1">
              <span style={{
                fontFamily: "'DM Sans', sans-serif", fontSize: 10.5,
                letterSpacing: "0.22em", textTransform: "uppercase",
                color: L.inkMuted, fontWeight: 500,
              }}>
                {s.kicker}
              </span>
            </div>

            {/* layered card */}
            <div className="relative w-full max-w-[280px]" style={{ marginTop: 24 }}>
              {/* back layer */}
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  transform: "translate(6px, 6px)",
                  background: L.paperDeep,
                  border: `1px solid ${L.ruleSoft}`,
                  borderRadius: 6,
                }}
              />
              {/* front layer */}
              <div
                className={i % 2 === 0 ? "float-a" : "float-b"}
                style={{
                  position: "relative",
                  background: "#FFFFFF",
                  border: `1px solid ${L.rule}`,
                  borderRadius: 6,
                  padding: "20px 20px 22px",
                  boxShadow: "0 1px 0 rgba(13,27,42,0.02), 0 12px 28px -18px rgba(13,27,42,0.18)",
                }}
              >
                <span style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: 10,
                  letterSpacing: "0.22em", textTransform: "uppercase",
                  color: L.amber, fontWeight: 600,
                }} className="lg:hidden block mb-2">
                  {s.kicker}
                </span>

                <h3 className="pf" style={{
                  color: L.ink, fontSize: 22, lineHeight: 1.15,
                  fontWeight: 500, letterSpacing: "-0.01em",
                }}>
                  {s.label}
                </h3>

                <div style={{ height: 1, background: L.ruleSoft, margin: "12px 0 12px", width: 32 }} />

                <p style={{
                  color: L.inkSoft, fontSize: 13.5, lineHeight: 1.55,
                }}>
                  {s.body}
                </p>

                <div style={{
                  marginTop: 16, paddingTop: 12,
                  borderTop: `1px dashed ${L.ruleSoft}`,
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: L.amber,
                  }} className="pulse-dot" />
                  <span style={{
                    fontFamily: "'DM Sans', sans-serif", fontSize: 11,
                    letterSpacing: "0.06em", color: L.inkMuted,
                  }}>
                    {s.pill}
                  </span>
                </div>
              </div>
            </div>

            {/* arrow between stages (mobile) */}
            {i < stages.length - 1 && (
              <div className="lg:hidden flex justify-center" style={{ marginTop: 14, color: L.inkMuted }}>
                <svg width="14" height="22" viewBox="0 0 14 22" fill="none">
                  <path d="M7 0 V20 M2 15 L7 20 L12 15" stroke={L.amber} strokeWidth="1" fill="none" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* feedback loop arc back to memory */}
      <div className="hidden lg:flex justify-center" style={{ marginTop: 36 }}>
        <svg width="100%" height="64" viewBox="0 0 1000 64" preserveAspectRatio="none" style={{ maxWidth: 900, opacity: 0.7 }}>
          <path
            d="M 940 6 Q 940 58 500 58 Q 60 58 60 6"
            stroke={L.amber}
            strokeWidth="1"
            strokeDasharray="3 5"
            fill="none"
          />
          <text x="500" y="52" textAnchor="middle" fontSize="10" fill={L.inkMuted}
            style={{ fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.22em", textTransform: "uppercase" }}>
            output deepens memory · the loop compounds
          </text>
        </svg>
      </div>

      {/* outputs row — branches from "Aligned creation" */}
      <div style={{ marginTop: 56 }}>
        <div className="flex items-center gap-3 justify-center" style={{ marginBottom: 24 }}>
          <span style={{ width: 24, height: 1, background: L.rule }} />
          <span style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: 11,
            letterSpacing: "0.22em", textTransform: "uppercase", color: L.inkMuted,
          }}>
            Outputs · shaped by the same memory
          </span>
          <span style={{ width: 24, height: 1, background: L.rule }} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-[880px] mx-auto">
          {outputs.map((o, i) => (
            <div
              key={o.label}
              className={i % 2 === 0 ? "float-c" : "float-b"}
              style={{
                background: "#FFFFFF",
                border: `1px solid ${L.ruleSoft}`,
                borderRadius: 4,
                padding: "16px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div>
                <p className="pf" style={{
                  color: L.ink, fontSize: 16, fontWeight: 500,
                  letterSpacing: "-0.005em", lineHeight: 1.1,
                }}>
                  {o.label}
                </p>
                <p style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: 10.5,
                  letterSpacing: "0.16em", textTransform: "uppercase",
                  color: L.inkMuted, marginTop: 4,
                }}>
                  {o.sub}
                </p>
              </div>
              <span style={{
                width: 5, height: 5, borderRadius: "50%", background: L.amber,
              }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FragmentedDiagram() {
  // Three isolated "prompt → output" pairs above; one continuous "memory thread" below
  const sessions = [
    { prompt: "Write a LinkedIn post about our launch", output: "5 tips to grow your audience…", tag: "Session 01" },
    { prompt: "Make a tagline for our brand", output: "Empower your potential today.", tag: "Session 02" },
    { prompt: "Draft an email for new customers", output: "Welcome! We're excited to…", tag: "Session 03" },
  ];

  return (
    <div className="relative" style={{ width: "100%" }}>
      {/* Top label */}
      <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
        <span style={{
          fontFamily: "'DM Sans', sans-serif", fontSize: 10,
          letterSpacing: "0.22em", textTransform: "uppercase",
          color: L.inkMuted, fontWeight: 600,
        }}>
          Generic AI · 3 isolated sessions
        </span>
        <span style={{ fontSize: 10, color: L.inkMuted, letterSpacing: "0.04em" }}>
          context = ∅
        </span>
      </div>

      {/* Three disconnected sessions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        {sessions.map((s, i) => (
          <div key={i} className="relative">
            <div style={{
              background: "#FFFFFF", borderRadius: 6,
              padding: "14px 16px",
              border: `1px solid ${L.ruleSoft}`,
              boxShadow: "0 4px 14px rgba(13,27,42,0.04)",
            }}>
              <div className="flex items-center gap-1.5" style={{ marginBottom: 10 }}>
                <span style={{ width: 4, height: 4, borderRadius: 99, background: L.inkMuted }} />
                <span style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: L.inkMuted, fontWeight: 600 }}>
                  {s.tag}
                </span>
              </div>
              <p style={{
                fontFamily: "'DM Sans', sans-serif", fontSize: 11,
                color: L.inkSoft, lineHeight: 1.45, marginBottom: 10,
              }}>
                {s.prompt}
              </p>
              <div style={{ height: 1, background: L.ruleSoft, marginBottom: 10 }} />
              <p className="pf" style={{
                fontSize: 12, color: L.ink, fontStyle: "italic",
                lineHeight: 1.4, opacity: 0.75,
              }}>
                "{s.output}"
              </p>
            </div>
            {/* "context lost" tag */}
            <div className="flex items-center gap-1.5" style={{ marginTop: 10 }}>
              <span style={{ width: 6, height: 1, background: L.inkMuted, opacity: 0.5 }} />
              <span style={{
                fontFamily: "'DM Sans', sans-serif", fontSize: 9,
                letterSpacing: "0.18em", textTransform: "uppercase",
                color: L.inkMuted, opacity: 0.7,
              }}>
                context lost
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* divider with "vs" */}
      <div className="flex items-center gap-4" style={{ margin: "44px 0 24px" }}>
        <div style={{ flex: 1, height: 1, background: L.rule }} />
        <span className="pf" style={{
          fontSize: 13, fontStyle: "italic", color: L.inkMuted,
          letterSpacing: "0.04em",
        }}>
          versus
        </span>
        <div style={{ flex: 1, height: 1, background: L.rule }} />
      </div>

      {/* Kinika continuous memory thread */}
      <div>
        <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
          <span style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: 10,
            letterSpacing: "0.22em", textTransform: "uppercase",
            color: L.amber, fontWeight: 600,
          }}>
            Kinika · One compounding thread
          </span>
          <span style={{ fontSize: 10, color: L.inkSoft, letterSpacing: "0.04em" }}>
            context = +74%
          </span>
        </div>

        <div className="relative" style={{
          background: "#FBF7EF",
          borderRadius: 6,
          padding: "20px 22px",
          border: `1px solid ${L.rule}`,
          boxShadow: "0 10px 28px rgba(13,27,42,0.06)",
        }}>
          {/* continuous vertical thread */}
          <div className="absolute" style={{
            left: 30, top: 28, bottom: 28, width: 1,
            background: `linear-gradient(to bottom, ${L.amber}, ${L.amber}66)`,
          }} />

          <div className="space-y-4">
            {[
              { t: "Conversation", v: "audience surfaced as senior operators" },
              { t: "Memory", v: "voice captured · direct, confident" },
              { t: "Output", v: "post written in your accent — for them" },
            ].map((row, i) => (
              <div key={i} className="flex items-start gap-4" style={{ paddingLeft: 8 }}>
                <span className="pulse-dot" style={{
                  marginTop: 6, width: 8, height: 8, borderRadius: 99,
                  background: L.amber, flexShrink: 0,
                  boxShadow: `0 0 0 4px ${L.paperDeep}`,
                }} />
                <div style={{ flex: 1 }}>
                  <span style={{
                    fontFamily: "'DM Sans', sans-serif", fontSize: 9,
                    letterSpacing: "0.2em", textTransform: "uppercase",
                    color: L.inkMuted, fontWeight: 600,
                  }}>
                    {row.t}
                  </span>
                  <p className="pf" style={{
                    fontSize: 14, color: L.ink, marginTop: 3,
                    lineHeight: 1.4, fontStyle: i === 2 ? "italic" : "normal",
                  }}>
                    {row.v}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p style={{
          fontFamily: "'DM Sans', sans-serif", fontSize: 11,
          color: L.inkMuted, marginTop: 14, letterSpacing: "0.04em",
          textAlign: "right",
        }}>
          Every conversation deepens the next.
        </p>
      </div>
    </div>
  );
}

function LivingWorkspace() {
  return (
    <div className="relative mx-auto lg:ml-auto lg:mr-0" style={{ width: "100%", aspectRatio: "1 / 1.05", maxWidth: 560 }}>
      {/* connecting lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 560 588" fill="none" style={{ zIndex: 1 }}>
        <path className="draw-line" d="M 150 170 C 220 200, 280 240, 340 270" stroke={L.rule} strokeWidth="1" />
        <path className="draw-line" d="M 380 320 C 360 380, 280 410, 200 440" stroke={L.rule} strokeWidth="1" />
        <path className="draw-line" d="M 220 480 C 280 460, 340 470, 420 490" stroke={L.ruleSoft} strokeWidth="1" />
      </svg>

      {/* Card 1 — Mentor conversation fragment */}
      <div
        className="float-a absolute"
        style={{
          top: "4%", left: "0%", width: "58%", zIndex: 3,
          background: "#FFFFFF", borderRadius: 6, padding: "18px 20px",
          boxShadow: "0 12px 32px rgba(13,27,42,0.08), 0 2px 6px rgba(13,27,42,0.04)",
          border: `1px solid ${L.ruleSoft}`,
        }}
      >
        <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
          <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: 99, background: L.amber }} />
          <span style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: L.inkMuted, fontWeight: 600 }}>Mentor</span>
        </div>
        <p className="pf" style={{ fontSize: 15, lineHeight: 1.45, color: L.ink, fontStyle: "italic", marginBottom: 8 }}>
          "Your audience isn't beginners. It's operators who've outgrown their tools."
        </p>
        <p style={{ fontSize: 11, color: L.inkMuted, letterSpacing: "0.04em" }}>captured · 2m ago</p>
      </div>

      {/* Card 2 — Brand memory */}
      <div
        className="float-b absolute"
        style={{
          top: "30%", right: "0%", width: "52%", zIndex: 4,
          background: "#FBF7EF", borderRadius: 6, padding: "16px 18px",
          boxShadow: "0 16px 36px rgba(13,27,42,0.10), 0 2px 6px rgba(13,27,42,0.04)",
          border: `1px solid ${L.rule}`,
        }}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
          <span style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: L.amber, fontWeight: 600 }}>Brand Memory</span>
          <span style={{ fontSize: 10, color: L.inkMuted }}>74%</span>
        </div>
        <div className="space-y-2.5">
          {[
            { k: "Voice", v: "Direct · Confident" },
            { k: "Audience", v: "Senior operators" },
            { k: "Promise", v: "Memory that compounds" },
          ].map((row) => (
            <div key={row.k} className="flex items-baseline justify-between" style={{ borderBottom: `1px dashed ${L.ruleSoft}`, paddingBottom: 6 }}>
              <span style={{ fontSize: 11, color: L.inkMuted, letterSpacing: "0.04em" }}>{row.k}</span>
              <span style={{ fontSize: 12, color: L.ink, fontWeight: 500 }}>{row.v}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, height: 3, background: L.ruleSoft, borderRadius: 2, overflow: "hidden" }}>
          <div style={{ width: "74%", height: "100%", background: L.amber }} />
        </div>
      </div>

      {/* Card 3 — Journey stage */}
      <div
        className="float-c absolute"
        style={{
          top: "56%", left: "8%", width: "44%", zIndex: 3,
          background: "#FFFFFF", borderRadius: 6, padding: "14px 16px",
          boxShadow: "0 10px 28px rgba(13,27,42,0.08)",
          border: `1px solid ${L.ruleSoft}`,
        }}
      >
        <span style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: L.inkMuted, fontWeight: 600 }}>Stage</span>
        <p className="pf" style={{ fontSize: 14, color: L.ink, marginTop: 6, fontWeight: 500 }}>Positioning</p>
        <div className="flex items-center gap-1.5" style={{ marginTop: 10 }}>
          {[1,2,3,4,5].map((i) => (
            <span key={i} style={{
              flex: 1, height: 2, borderRadius: 2,
              background: i <= 3 ? L.ink : L.ruleSoft,
            }} />
          ))}
        </div>
        <p style={{ fontSize: 10, color: L.inkMuted, marginTop: 8, letterSpacing: "0.04em" }}>3 of 5 · in progress</p>
      </div>

      {/* Card 4 — Generated content tied to context */}
      <div
        className="float-a absolute"
        style={{
          bottom: "0%", right: "4%", width: "50%", zIndex: 4,
          background: "#0D1B2A", borderRadius: 6, padding: "16px 18px",
          boxShadow: "0 18px 40px rgba(13,27,42,0.18)",
          color: L.paper,
        }}
      >
        <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
          <span style={{ width: 5, height: 5, borderRadius: 99, background: L.amber }} />
          <span style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(245,240,232,0.6)", fontWeight: 600 }}>
            Generated · LinkedIn
          </span>
        </div>
        <p className="pf" style={{ fontSize: 13, lineHeight: 1.5, fontStyle: "italic" }}>
          "If you've outgrown the tools that got you here — read this."
        </p>
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(245,240,232,0.12)" }}>
          <span style={{ fontSize: 10, color: "rgba(245,240,232,0.55)", letterSpacing: "0.04em" }}>
            shaped by: voice · audience · stage
          </span>
        </div>
      </div>

      {/* small floating tag */}
      <div
        className="float-b absolute"
        style={{
          top: "0%", right: "16%", zIndex: 2,
          background: "transparent",
          fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase",
          color: L.inkMuted, fontWeight: 600,
        }}
      >
        ◦ Living context
      </div>
    </div>
  );
}

export default function Landing() {
  const scrolled = useScrolled();
  const [wordIdx, setWordIdx] = useState(0);
  const [wordVisible, setWordVisible] = useState(true);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const interval = setInterval(() => {
      setWordVisible(false);
      setTimeout(() => {
        setWordIdx((i) => (i + 1) % CYCLING.length);
        setWordVisible(true);
      }, 400);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const [p1Ref, p1V] = useReveal<HTMLDivElement>();
  const [p2Ref, p2V] = useReveal<HTMLDivElement>();
  const [p3Ref, p3V] = useReveal<HTMLDivElement>();
  const probs = [
    { ref: p1Ref, v: p1V, ...PROBLEMS[0], delay: 0 },
    { ref: p2Ref, v: p2V, ...PROBLEMS[1], delay: 150 },
    { ref: p3Ref, v: p3V, ...PROBLEMS[2], delay: 300 },
  ];

  return (
    <div className="min-h-screen w-full" style={{ background: C.bg, color: C.text, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&family=DM+Sans:wght@400;500;600&display=swap');
        .pf { font-family: 'Playfair Display', serif; }
        @keyframes diagDrift {
          from { background-position: 0 0; }
          to   { background-position: 0 -200px; }
        }
        .diag-bg {
          background-image: repeating-linear-gradient(45deg, transparent 0, transparent 39px, #1A2A3A 39px, #1A2A3A 40px);
          animation: diagDrift 30s linear infinite;
        }
        @keyframes lineGrow { from { width: 0; } to { width: 40%; } }
        .amber-line { animation: lineGrow 1s ease-out forwards; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .fade-up-1 { opacity: 0; animation: fadeUp .7s ease-out .3s forwards; }
        .fade-up-2 { opacity: 0; animation: fadeUp .7s ease-out .5s forwards; }
        .word-fade { transition: opacity .4s ease, transform .4s ease; }
        .arrow-shift { transition: transform .2s ease; }
        .btn-primary:hover .arrow-shift { transform: translateX(4px); }
        .reveal { opacity: 0; transform: translateY(24px); transition: opacity .7s ease, transform .7s ease; }
        .reveal.in { opacity: 1; transform: translateY(0); }
        .module-card { transition: background .25s ease, transform .25s ease; }
        .module-card:hover { background: ${C.cardHover}; transform: translateY(-2px); }
        @keyframes floatA { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes floatB { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes floatC { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes pulseDot { 0%,100% { opacity: .35; } 50% { opacity: 1; } }
        @keyframes drawLine { from { stroke-dashoffset: 200; } to { stroke-dashoffset: 0; } }
        .float-a { animation: floatA 7s ease-in-out infinite; }
        .float-b { animation: floatB 9s ease-in-out infinite .8s; }
        .float-c { animation: floatC 8s ease-in-out infinite .4s; }
        .pulse-dot { animation: pulseDot 2.4s ease-in-out infinite; }
        .draw-line { stroke-dasharray: 200; animation: drawLine 2s ease-out .6s forwards; }
        @media (prefers-reduced-motion: reduce) {
          .diag-bg, .amber-line, .fade-up-1, .fade-up-2, .reveal,
          .float-a, .float-b, .float-c, .pulse-dot, .draw-line { animation: none !important; transition: none !important; opacity: 1 !important; transform: none !important; width: 40% !important; }
        }
      `}</style>

      {/* ───────── NAV (editorial) ───────── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 transition-all"
        style={{
          background: scrolled ? `${L.paper}f2` : "transparent",
          backdropFilter: scrolled ? "blur(8px) saturate(1.1)" : "none",
          borderBottom: scrolled ? `1px solid ${L.rule}` : "1px solid transparent",
        }}
      >
        <div className="max-w-[1320px] mx-auto px-6 md:px-12 h-[72px] flex items-center justify-between">
          <Link to="/" className="pf flex items-baseline gap-2" style={{ color: L.ink }}>
            <span style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.01em" }}>Kinika</span>
            <span style={{ fontSize: 11, color: L.inkMuted, letterSpacing: "0.18em", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif" }}>
              — Brand Intelligence
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-7">
            {[
              { to: "/philosophy", label: "Philosophy" },
              { to: "/system", label: "System" },
              { to: "/journal", label: "Journal" },
              { to: "/pricing", label: "Pricing" },
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                style={{
                  color: L.inkSoft,
                  fontSize: 13,
                  letterSpacing: "0.02em",
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 500,
                }}
                className="hover:opacity-70 transition-opacity"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-7">
            <Link to="/sign-in" style={{ color: L.inkSoft, fontSize: 14, letterSpacing: "0.01em" }} className="hover:opacity-70 transition-opacity hidden sm:inline">
              Sign in
            </Link>
            <Link
              to="/sign-up"
              className="inline-flex items-center text-sm font-medium transition-all hover:-translate-y-px"
              style={{
                background: L.ink,
                color: L.paper,
                height: 38,
                padding: "0 18px",
                borderRadius: 2,
                letterSpacing: "0.01em",
              }}
            >
              Enter Kinika
            </Link>
          </div>
        </div>
      </header>

      {/* ───────── HERO (split editorial — living workspace) ───────── */}
      <section className="relative overflow-hidden" style={{ background: L.paper, minHeight: "100vh" }}>
        {/* paper grain */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            opacity: 0.5,
            mixBlendMode: "multiply",
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.05  0 0 0 0 0.07  0 0 0 0 0.1  0 0 0 0.06 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
          }}
        />
        {/* warm radial wash */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: "-10%",
            right: "-10%",
            width: "70%",
            height: "70%",
            background: `radial-gradient(circle at 60% 40%, ${L.paperDeep} 0%, transparent 60%)`,
            opacity: 0.6,
          }}
        />

        <div
          className="relative w-full mx-auto"
          style={{
            maxWidth: 1320,
            paddingLeft: "clamp(24px, 6vw, 96px)",
            paddingRight: "clamp(24px, 6vw, 96px)",
            paddingTop: "clamp(120px, 16vh, 180px)",
            paddingBottom: "clamp(80px, 12vh, 140px)",
          }}
        >
          <div className="grid grid-cols-12 gap-x-8 lg:gap-x-16 gap-y-16 items-center">
            {/* ─── LEFT: editorial copy ─── */}
            <div className="col-span-12 lg:col-span-6">
              {/* eyebrow */}
              <div className="fade-up-1 flex items-center gap-3" style={{ marginBottom: 32 }}>
                <span style={{ width: 24, height: 1, background: L.amber }} />
                <span
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 11,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: L.inkSoft,
                    fontWeight: 500,
                  }}
                >
                  AI Brand Intelligence for Founders
                </span>
              </div>

              <h1
                className="pf fade-up-1"
                style={{
                  color: L.ink,
                  fontSize: "clamp(40px, 5.6vw, 78px)",
                  lineHeight: 1.02,
                  fontWeight: 500,
                  letterSpacing: "-0.025em",
                }}
              >
                Your business
                <br />
                finally has{" "}
                <span style={{ fontStyle: "italic" }}>memory</span>
                <span style={{ color: L.amber }}>.</span>
              </h1>

              <div className="fade-up-2" style={{ height: 1, background: L.rule, marginTop: 36, marginBottom: 28, maxWidth: 420 }} />

              <p
                className="fade-up-2"
                style={{
                  color: L.inkSoft,
                  fontSize: "clamp(16px, 1.3vw, 18px)",
                  lineHeight: 1.6,
                  maxWidth: "46ch",
                  fontWeight: 400,
                }}
              >
                Most AI tools forget everything the moment you close the tab. Kinika remembers your conversations, positioning, audience and brand direction — so every output is shaped by real business context.
              </p>

              <div className="fade-up-2 flex flex-wrap items-center gap-4" style={{ marginTop: 40 }}>
                <Link
                  to="/sign-up"
                  className="btn-primary inline-flex items-center gap-3 transition-all hover:-translate-y-px"
                  style={{
                    background: L.ink,
                    color: L.paper,
                    height: 50,
                    padding: "0 26px",
                    fontSize: 14,
                    fontWeight: 500,
                    borderRadius: 2,
                    letterSpacing: "0.02em",
                  }}
                >
                  Start building with Kinika
                  <ArrowRight className="w-4 h-4 arrow-shift" />
                </Link>
                <a
                  href="#how"
                  className="inline-flex items-center gap-2 transition-all hover:-translate-y-px"
                  style={{
                    color: L.ink,
                    height: 50,
                    padding: "0 22px",
                    fontSize: 14,
                    fontWeight: 500,
                    border: `1px solid ${L.ink}`,
                    borderRadius: 2,
                    background: "transparent",
                    letterSpacing: "0.02em",
                  }}
                >
                  Watch the system think
                </a>
              </div>
            </div>

            {/* ─── RIGHT: living workspace composition ─── */}
            <div className="col-span-12 lg:col-span-6 fade-up-2">
              <LivingWorkspace />
            </div>
          </div>
        </div>

        {/* footer rule */}
        <div
          className="absolute bottom-0 left-0 right-0"
          style={{
            borderTop: `1px solid ${L.rule}`,
            paddingLeft: "clamp(24px, 6vw, 96px)",
            paddingRight: "clamp(24px, 6vw, 96px)",
          }}
        >
          <div className="max-w-[1320px] mx-auto flex items-center justify-between" style={{ height: 56 }}>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: L.inkMuted }}>
              Persistent business memory for founders
            </span>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: L.inkMuted }} className="hidden md:inline">
              Scroll to read ↓
            </span>
          </div>
        </div>
      </section>

      {/* ───────── SECTION 02 — The Memory Problem (warm editorial) ───────── */}
      <section className="relative overflow-hidden" style={{ background: L.paperDeep }}>
        {/* paper grain */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            opacity: 0.4,
            mixBlendMode: "multiply",
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.05  0 0 0 0 0.07  0 0 0 0 0.1  0 0 0 0.05 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
          }}
        />

        <div
          className="relative w-full mx-auto"
          style={{
            maxWidth: 1320,
            paddingLeft: "clamp(24px, 6vw, 96px)",
            paddingRight: "clamp(24px, 6vw, 96px)",
            paddingTop: "clamp(96px, 14vh, 160px)",
            paddingBottom: "clamp(96px, 14vh, 160px)",
          }}
        >
          {/* chapter marker */}
          <div className="flex items-center gap-3" style={{ marginBottom: 64 }}>
            <span style={{ width: 24, height: 1, background: L.amber }} />
            <span style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: 11,
              letterSpacing: "0.22em", textTransform: "uppercase",
              color: L.inkSoft, fontWeight: 500,
            }}>
              Chapter 02 · The Memory Problem
            </span>
          </div>

          <div className="grid grid-cols-12 gap-x-8 lg:gap-x-20 gap-y-16 items-start">
            {/* LEFT — fragmented interactions diagram */}
            <div className="col-span-12 lg:col-span-7 order-2 lg:order-1">
              <FragmentedDiagram />
            </div>

            {/* RIGHT — editorial copy */}
            <div className="col-span-12 lg:col-span-5 order-1 lg:order-2 lg:pt-6">
              <h2
                className="pf"
                style={{
                  color: L.ink,
                  fontSize: "clamp(34px, 4.4vw, 56px)",
                  lineHeight: 1.05,
                  fontWeight: 500,
                  letterSpacing: "-0.02em",
                }}
              >
                AI without memory creates{" "}
                <span style={{ fontStyle: "italic" }}>generic</span> brands
                <span style={{ color: L.amber }}>.</span>
              </h2>

              <div style={{ height: 1, background: L.rule, margin: "32px 0 28px", width: 80 }} />

              <p style={{
                color: L.inkSoft, fontSize: "clamp(15px, 1.2vw, 17px)",
                lineHeight: 1.65, maxWidth: "42ch",
              }}>
                Every conversation resets. Every prompt starts from zero. Every output lacks continuity. You explain your audience, your voice and your direction over and over — and the work still arrives in someone else's accent.
              </p>

              <p style={{
                color: L.inkSoft, fontSize: "clamp(15px, 1.2vw, 17px)",
                lineHeight: 1.65, maxWidth: "42ch", marginTop: 20,
              }}>
                It isn't a prompting problem. It's a memory problem.
              </p>

              {/* pull quote */}
              <div style={{ marginTop: 44, paddingLeft: 22, borderLeft: `2px solid ${L.amber}` }}>
                <p className="pf" style={{
                  color: L.ink, fontSize: "clamp(18px, 1.6vw, 22px)",
                  lineHeight: 1.4, fontStyle: "italic", fontWeight: 500,
                  letterSpacing: "-0.005em",
                }}>
                  Business context isn't a prompt. It's something that compounds — quietly, conversation by conversation.
                </p>
                <p style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: 11,
                  letterSpacing: "0.18em", textTransform: "uppercase",
                  color: L.inkMuted, fontWeight: 600, marginTop: 14,
                }}>
                  — The Kinika Premise
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* footer rule */}
        <div style={{
          borderTop: `1px solid ${L.rule}`,
          paddingLeft: "clamp(24px, 6vw, 96px)",
          paddingRight: "clamp(24px, 6vw, 96px)",
        }}>
          <div className="max-w-[1320px] mx-auto flex items-center justify-between" style={{ height: 56 }}>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: L.inkMuted }}>
              № 02 — On Forgetting
            </span>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: L.inkMuted }} className="hidden md:inline">
              Continued ↓
            </span>
          </div>
        </div>
      </section>

      {/* ───────── SECTION 03 — How Kinika Works (intelligence loop) ───────── */}
      <section className="relative overflow-hidden" style={{ background: L.paper }}>
        {/* paper grain */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            opacity: 0.35,
            mixBlendMode: "multiply",
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.05  0 0 0 0 0.07  0 0 0 0 0.1  0 0 0 0.04 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
          }}
        />
        {/* warm vignette to add depth */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 50% 0%, rgba(184,134,11,0.06), transparent 60%)",
          }}
        />

        <div
          className="relative w-full mx-auto"
          style={{
            maxWidth: 1320,
            paddingLeft: "clamp(24px, 6vw, 96px)",
            paddingRight: "clamp(24px, 6vw, 96px)",
            paddingTop: "clamp(96px, 14vh, 160px)",
            paddingBottom: "clamp(96px, 14vh, 160px)",
          }}
        >
          {/* chapter marker */}
          <div className="flex items-center gap-3" style={{ marginBottom: 56 }}>
            <span style={{ width: 24, height: 1, background: L.amber }} />
            <span style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: 11,
              letterSpacing: "0.22em", textTransform: "uppercase",
              color: L.inkSoft, fontWeight: 500,
            }}>
              Chapter 03 · The Intelligence Loop
            </span>
          </div>

          {/* header — editorial split */}
          <div className="grid grid-cols-12 gap-x-8 lg:gap-x-20 gap-y-8 items-end" style={{ marginBottom: 80 }}>
            <div className="col-span-12 lg:col-span-7">
              <h2
                className="pf"
                style={{
                  color: L.ink,
                  fontSize: "clamp(34px, 4.4vw, 56px)",
                  lineHeight: 1.05,
                  fontWeight: 500,
                  letterSpacing: "-0.02em",
                }}
              >
                How Kinika{" "}
                <span style={{ fontStyle: "italic" }}>compounds</span> understanding
                <span style={{ color: L.amber }}>.</span>
              </h2>
            </div>
            <div className="col-span-12 lg:col-span-5">
              <p style={{
                color: L.inkSoft, fontSize: "clamp(15px, 1.15vw, 17px)",
                lineHeight: 1.65, maxWidth: "44ch",
              }}>
                Each conversation thickens the next. Memory becomes understanding. Understanding becomes the surface every output is shaped on.
              </p>
            </div>
          </div>

          {/* ═══ Intelligence loop diagram ═══ */}
          <IntelligenceLoop />

          {/* closing line */}
          <div style={{ marginTop: 96, textAlign: "center" }}>
            <p className="pf" style={{
              color: L.ink, fontSize: "clamp(20px, 2vw, 26px)",
              lineHeight: 1.4, fontStyle: "italic", fontWeight: 500,
              letterSpacing: "-0.01em", maxWidth: "32ch", margin: "0 auto",
            }}>
              The system gets quieter, sharper, and more like you — every week.
            </p>
          </div>
        </div>

        {/* footer rule */}
        <div style={{
          borderTop: `1px solid ${L.rule}`,
          paddingLeft: "clamp(24px, 6vw, 96px)",
          paddingRight: "clamp(24px, 6vw, 96px)",
        }}>
          <div className="max-w-[1320px] mx-auto flex items-center justify-between" style={{ height: 56 }}>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: L.inkMuted }}>
              № 03 — On Compounding
            </span>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: L.inkMuted }} className="hidden md:inline">
              Continued ↓
            </span>
          </div>
        </div>
      </section>

      {/* ───────── SECTION 04 — Journey Record (founder evolution map) ───────── */}
      <section className="relative overflow-hidden" style={{ background: L.paperDeep }}>
        {/* paper grain */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            opacity: 0.4,
            mixBlendMode: "multiply",
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.05  0 0 0 0 0.07  0 0 0 0 0.1  0 0 0 0.05 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
          }}
        />

        <div
          className="relative w-full mx-auto"
          style={{
            maxWidth: 1320,
            paddingLeft: "clamp(24px, 6vw, 96px)",
            paddingRight: "clamp(24px, 6vw, 96px)",
            paddingTop: "clamp(96px, 14vh, 160px)",
            paddingBottom: "clamp(96px, 14vh, 160px)",
          }}
        >
          {/* chapter marker */}
          <div className="flex items-center gap-3" style={{ marginBottom: 56 }}>
            <span style={{ width: 24, height: 1, background: L.amber }} />
            <span style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: 11,
              letterSpacing: "0.22em", textTransform: "uppercase",
              color: L.inkSoft, fontWeight: 500,
            }}>
              Chapter 04 · The Journey Record
            </span>
          </div>

          {/* header */}
          <div className="grid grid-cols-12 gap-x-8 lg:gap-x-20 gap-y-8 items-end" style={{ marginBottom: 72 }}>
            <div className="col-span-12 lg:col-span-7">
              <h2 className="pf" style={{
                color: L.ink,
                fontSize: "clamp(34px, 4.4vw, 56px)",
                lineHeight: 1.05,
                fontWeight: 500,
                letterSpacing: "-0.02em",
              }}>
                A living record of the{" "}
                <span style={{ fontStyle: "italic" }}>founder you're becoming</span>
                <span style={{ color: L.amber }}>.</span>
              </h2>
            </div>
            <div className="col-span-12 lg:col-span-5">
              <p style={{
                color: L.inkSoft, fontSize: "clamp(15px, 1.15vw, 17px)",
                lineHeight: 1.65, maxWidth: "44ch",
              }}>
                Kinika moves with you — from the first spark to a brand at scale. Every insight, decision and milestone is kept inside one quiet, evolving archive.
              </p>
            </div>
          </div>

          <JourneyRecord />

          {/* closing line */}
          <div style={{ marginTop: 88, textAlign: "center" }}>
            <p className="pf" style={{
              color: L.ink, fontSize: "clamp(20px, 2vw, 26px)",
              lineHeight: 1.4, fontStyle: "italic", fontWeight: 500,
              letterSpacing: "-0.01em", maxWidth: "34ch", margin: "0 auto",
            }}>
              Not an onboarding flow. An operating system for your becoming.
            </p>
          </div>
        </div>

        {/* footer rule */}
        <div style={{
          borderTop: `1px solid ${L.rule}`,
          paddingLeft: "clamp(24px, 6vw, 96px)",
          paddingRight: "clamp(24px, 6vw, 96px)",
        }}>
          <div className="max-w-[1320px] mx-auto flex items-center justify-between" style={{ height: 56 }}>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: L.inkMuted }}>
              № 04 — On Becoming
            </span>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: L.inkMuted }} className="hidden md:inline">
              Continued ↓
            </span>
          </div>
        </div>
      </section>

      {/* ───────── SECTION 05 — Module Ecosystem (one intelligence, many surfaces) ───────── */}
      <section className="relative overflow-hidden" style={{ background: L.paper }}>
        {/* paper grain */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            opacity: 0.35,
            mixBlendMode: "multiply",
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.05  0 0 0 0 0.07  0 0 0 0 0.1  0 0 0 0.04 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
          }}
        />
        {/* warm center glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 50% 60%, rgba(184,134,11,0.08), transparent 55%)",
          }}
        />

        <div
          className="relative w-full mx-auto"
          style={{
            maxWidth: 1320,
            paddingLeft: "clamp(24px, 6vw, 96px)",
            paddingRight: "clamp(24px, 6vw, 96px)",
            paddingTop: "clamp(96px, 14vh, 160px)",
            paddingBottom: "clamp(96px, 14vh, 160px)",
          }}
        >
          {/* chapter marker */}
          <div className="flex items-center gap-3" style={{ marginBottom: 56 }}>
            <span style={{ width: 24, height: 1, background: L.amber }} />
            <span style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: 11,
              letterSpacing: "0.22em", textTransform: "uppercase",
              color: L.inkSoft, fontWeight: 500,
            }}>
              Chapter 05 · The Ecosystem
            </span>
          </div>

          {/* header */}
          <div className="grid grid-cols-12 gap-x-8 lg:gap-x-20 gap-y-8 items-end" style={{ marginBottom: 56 }}>
            <div className="col-span-12 lg:col-span-7">
              <h2 className="pf" style={{
                color: L.ink,
                fontSize: "clamp(34px, 4.4vw, 56px)",
                lineHeight: 1.05,
                fontWeight: 500,
                letterSpacing: "-0.02em",
              }}>
                One intelligence.{" "}
                <span style={{ fontStyle: "italic" }}>Many surfaces</span>
                <span style={{ color: L.amber }}>.</span>
              </h2>
            </div>
            <div className="col-span-12 lg:col-span-5">
              <p style={{
                color: L.inkSoft, fontSize: "clamp(15px, 1.15vw, 17px)",
                lineHeight: 1.65, maxWidth: "44ch",
              }}>
                Every module pulls from the same brand memory. The voice in your captions, the tone of your decks and the rhythm of your visuals — all sourced from the same understanding.
              </p>
            </div>
          </div>

          <ModuleEcosystem />
        </div>

        {/* footer rule */}
        <div style={{
          borderTop: `1px solid ${L.rule}`,
          paddingLeft: "clamp(24px, 6vw, 96px)",
          paddingRight: "clamp(24px, 6vw, 96px)",
        }}>
          <div className="max-w-[1320px] mx-auto flex items-center justify-between" style={{ height: 56 }}>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: L.inkMuted }}>
              № 05 — On Continuity
            </span>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: L.inkMuted }} className="hidden md:inline">
              Continued ↓
            </span>
          </div>
        </div>
      </section>

      {/* PROBLEM */}

      {/* EDITORIAL FOOTER — closing spread */}
      <footer
        style={{
          background: L.paperDeep,
          borderTop: `1px solid ${L.rule}`,
          position: "relative",
        }}
      >
        {/* subtle paper grain */}
        <svg aria-hidden className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.35 }}>
          <filter id="footerGrain">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer><feFuncA type="linear" slope="0.06" /></feComponentTransfer>
          </filter>
          <rect width="100%" height="100%" filter="url(#footerGrain)" />
        </svg>

        <div className="relative max-w-[1320px] mx-auto" style={{ padding: "80px 24px 64px" }}>
          {/* top rule */}
          <div style={{ height: 1, background: L.rule, marginBottom: 56 }} />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-12">
            {/* LEFT — closing statement + nav */}
            <div className="lg:col-span-7">
              {/* editorial closing statement */}
              <p className="pf" style={{
                color: L.ink,
                fontSize: "clamp(22px, 2.6vw, 30px)",
                lineHeight: 1.35,
                fontWeight: 500,
                letterSpacing: "-0.015em",
                maxWidth: "32ch",
              }}>
                Built for founders who think long-term.
              </p>

              <div style={{ height: 1, background: L.ruleSoft, margin: "32px 0 36px", width: 48 }} />

              {/* small elegant nav groups */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
                {[
                  { title: "Philosophy", links: [{ label: "Read", to: "/philosophy" }] },
                  { title: "System", links: [{ label: "Six rooms", to: "/system" }] },
                  { title: "Journal", links: [{ label: "Field notes", to: "/journal" }] },
                  {
                    title: "Access",
                    links: [
                      { label: "Pricing", to: "/pricing" },
                      { label: "Sign in", to: "/sign-in" },
                      { label: "Enter Kinika", to: "/sign-up" },
                    ],
                  },
                ].map((group) => (
                  <div key={group.title}>
                    <span style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 10,
                      letterSpacing: "0.22em",
                      textTransform: "uppercase",
                      color: L.amber,
                      fontWeight: 600,
                    }}>
                      {group.title}
                    </span>
                    <ul style={{ marginTop: 14, display: "grid", gap: 9 }}>
                      {group.links.map((link) => (
                        <li key={link.label}>
                          <Link
                            to={link.to}
                            className="inline-block transition-opacity duration-200 hover:opacity-70"
                            style={{
                              fontFamily: "'DM Sans', sans-serif",
                              fontSize: 13,
                              color: L.inkSoft,
                              letterSpacing: "0.01em",
                            }}
                          >
                            {link.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT — publication metadata */}
            <div className="lg:col-span-5 lg:pl-12">
              <div
                style={{
                  borderLeft: `1px solid ${L.ruleSoft}`,
                  paddingLeft: 32,
                  height: "100%",
                }}
                className="hidden lg:block"
              />
              <div className="lg:pl-8 -mt-0 lg:-mt-[100%]">
                <div style={{ marginBottom: 28 }}>
                  <span style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 10,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: L.inkMuted,
                    fontWeight: 500,
                  }}>
                    Kinika
                  </span>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <span className="pf" style={{
                    color: L.ink,
                    fontSize: 20,
                    fontWeight: 500,
                    letterSpacing: "-0.01em",
                  }}>
                    A workspace that remembers.
                  </span>
                </div>

                <div style={{ height: 1, background: L.ruleSoft, margin: "24px 0", width: 32 }} />

                <p style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 12,
                  color: L.inkMuted,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                }}>
                  Built for founders
                </p>

                <p className="pf" style={{
                  color: L.inkMuted,
                  fontSize: 14,
                  fontStyle: "italic",
                  marginTop: 20,
                  lineHeight: 1.5,
                }}>
                  An intelligent founder workspace with persistent business memory.
                </p>

                <div style={{ marginTop: 32 }}>
                  <span style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 11,
                    color: L.inkMuted,
                    letterSpacing: "0.06em",
                  }}>
                    © 2026 Kinika
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* bottom rule + quiet sign-off */}
          <div style={{ height: 1, background: L.rule, marginTop: 64, marginBottom: 24 }} />
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <span style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 11,
              color: L.inkMuted,
              letterSpacing: "0.06em",
            }}>
              A system that remembers.
            </span>
            <div className="flex items-center gap-4">
              <a
                href="#"
                className="transition-colors duration-200"
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 11,
                  color: L.inkMuted,
                  letterSpacing: "0.06em",
                }}
                onMouseEnter={(e) => { (e.target as HTMLElement).style.color = L.ink; }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.color = L.inkMuted; }}
              >
                Privacy
              </a>
              <span style={{ color: L.rule }}>·</span>
              <a
                href="#"
                className="transition-colors duration-200"
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 11,
                  color: L.inkMuted,
                  letterSpacing: "0.06em",
                }}
                onMouseEnter={(e) => { (e.target as HTMLElement).style.color = L.ink; }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.color = L.inkMuted; }}
              >
                Terms
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
