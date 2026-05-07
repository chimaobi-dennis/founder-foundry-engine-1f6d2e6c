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

const CYCLING = ["finally understood.", "finally heard.", "finally alive.", "finally yours."];

const MODULES = [
  { emoji: "🧠", name: "Kinika", desc: "Your AI thinking partner. Remembers everything." },
  { emoji: "📸", name: "ProStudio", desc: "Product visuals without a studio." },
  { emoji: "📢", name: "ContentStudio", desc: "One brief. Eight platforms. Ready to post." },
  { emoji: "📅", name: "ContentCalendar", desc: "Plan your content month visually." },
  { emoji: "📄", name: "DocStudio", desc: "Professional documents from your brand memory." },
  { emoji: "🎬", name: "ReelBuilder", desc: "Brief to script to teleprompter." },
];

const PROBLEMS = [
  { n: "01", title: "Generic content", body: "AI tools that don't know your business give you content that sounds like everyone else's." },
  { n: "02", title: "No memory between tools", body: "You explain your brand from scratch every single time. Nothing carries over. Nothing compounds." },
  { n: "03", title: "Built ≠ marketed", body: "You built something real. But telling the world about it feels like a completely different job." },
];

const STEPS = [
  { n: "1", title: "Talk to Kinika", body: "Start a conversation about your business. No forms. No setup. Just talk." },
  { n: "2", title: "Build your Brand DNA", body: "Every insight is captured automatically. Your brand knowledge compounds over time." },
  { n: "3", title: "Create from context", body: "Every module uses what Kinika learned. Content, visuals, docs — all on-brand, always." },
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
        @media (prefers-reduced-motion: reduce) {
          .diag-bg, .amber-line, .fade-up-1, .fade-up-2, .reveal { animation: none !important; transition: none !important; opacity: 1 !important; transform: none !important; width: 40% !important; }
        }
      `}</style>

      {/* NAV */}
      <header
        className="fixed top-0 left-0 right-0 z-50 transition-all"
        style={{
          background: scrolled ? `${C.bg}cc` : "transparent",
          backdropFilter: scrolled ? "blur(12px)" : "none",
          borderBottom: scrolled ? `1px solid ${C.border}` : "1px solid transparent",
        }}
      >
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 h-[64px] flex items-center justify-between">
          <Link to="/" className="pf" style={{ color: C.amber, fontSize: 24, fontWeight: 600 }}>
            kinika
          </Link>
          <div className="flex items-center gap-5">
            <Link to="/sign-in" style={{ color: C.muted, fontSize: 14 }} className="hover:opacity-80">
              Sign in
            </Link>
            <Link
              to="/sign-up"
              className="rounded-full px-4 flex items-center text-sm font-medium hover:-translate-y-0.5 transition-transform"
              style={{ background: C.amber, color: C.bg, height: 36 }}
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative min-h-screen flex items-center overflow-hidden" style={{ background: C.bg }}>
        <div className="absolute inset-0 diag-bg opacity-[0.35] pointer-events-none" />
        <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at 30% 50%, transparent 0%, ${C.bg} 80%)` }} />
        <div className="relative w-full" style={{ paddingLeft: "clamp(24px, 10%, 160px)", paddingRight: 24 }}>
          <div style={{ maxWidth: 700 }}>
            <h1 className="pf" style={{ fontSize: "clamp(40px, 7vw, 72px)", lineHeight: 1.05, fontStyle: "italic", color: C.text, fontWeight: 600 }}>
              Your brand,
              <br />
              <span
                className="word-fade inline-block"
                style={{
                  color: C.amber,
                  opacity: wordVisible ? 1 : 0,
                  transform: wordVisible ? "translateY(0)" : "translateY(8px)",
                }}
              >
                {CYCLING[wordIdx]}
              </span>
            </h1>
            <p className="fade-up-1 mt-8" style={{ color: C.muted, fontSize: 20, lineHeight: 1.6, maxWidth: 480 }}>
              A tool that knows your business from day one. Every piece of content, every visual, every document — generated from your actual brand context.
            </p>
            <div className="fade-up-2 mt-10 flex flex-col sm:flex-row gap-4">
              <Link
                to="/sign-up"
                className="btn-primary inline-flex items-center justify-center gap-2 rounded-md font-medium hover:-translate-y-0.5 transition-transform"
                style={{ background: C.amber, color: C.bg, height: 48, padding: "0 24px", fontSize: 15 }}
              >
                Start building free <ArrowRight className="w-4 h-4 arrow-shift" />
              </Link>
              <a
                href="#"
                className="inline-flex items-center justify-center rounded-md font-medium border"
                style={{ color: C.amber, borderColor: C.amber, height: 48, padding: "0 24px", fontSize: 15 }}
              >
                Watch 60s demo
              </a>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 amber-line" style={{ height: 2, background: C.amber }} />
      </section>

      {/* PROBLEM */}
      <section style={{ background: C.bgDark, padding: "120px 0" }}>
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-16">
          {probs.map((p) => (
            <div
              key={p.n}
              ref={p.ref}
              className={`reveal ${p.v ? "in" : ""}`}
              style={{ transitionDelay: `${p.delay}ms` }}
            >
              <div className="pf" style={{ color: C.amber, fontSize: 64, opacity: 0.4, lineHeight: 1, fontWeight: 600 }}>
                {p.n}
              </div>
              <h3 className="mt-6" style={{ color: C.text, fontSize: 20, fontWeight: 600 }}>
                {p.title}
              </h3>
              <p className="mt-3" style={{ color: C.muted, fontSize: 16, lineHeight: 1.6, maxWidth: 260 }}>
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* SOLUTION */}
      <section style={{ background: C.bg, padding: "120px 0" }}>
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 grid grid-cols-1 md:grid-cols-2 gap-16">
          <div className="md:sticky md:top-32 md:self-start">
            <h2 className="pf" style={{ color: C.text, fontSize: "clamp(36px, 4.5vw, 52px)", lineHeight: 1.1, fontWeight: 600 }}>
              One conversation.
              <br />
              Everything your
              <br />
              brand needs.
            </h2>
            <div className="mt-8" style={{ width: 60, height: 2, background: C.amber }} />
            <p className="mt-8" style={{ color: C.muted, fontSize: 18, lineHeight: 1.6, maxWidth: 380 }}>
              Tell Kinika your story once. Kinika builds your Brand DNA and powers every module from it.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            {MODULES.map((m) => (
              <div
                key={m.name}
                className="module-card flex items-start gap-4 p-6 rounded-md"
                style={{ background: C.card, borderLeft: `3px solid ${C.amber}` }}
              >
                <div style={{ fontSize: 28 }}>{m.emoji}</div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 style={{ color: C.text, fontSize: 18, fontWeight: 600 }}>{m.name}</h4>
                    <ArrowRight className="w-4 h-4" style={{ color: C.amber }} />
                  </div>
                  <p className="mt-1" style={{ color: C.muted, fontSize: 16, lineHeight: 1.5 }}>
                    {m.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ background: C.bgDark, padding: "120px 0" }}>
        <div className="max-w-[1280px] mx-auto px-6 md:px-10">
          <h2 className="pf text-center" style={{ color: C.text, fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 600 }}>
            Built for how founders actually work.
          </h2>
          <div className="relative mt-20 grid grid-cols-1 md:grid-cols-3 gap-12">
            <div
              className="hidden md:block absolute top-7 left-[16.66%] right-[16.66%]"
              style={{
                height: 1,
                backgroundImage: `repeating-linear-gradient(to right, ${C.amber} 0 6px, transparent 6px 14px)`,
                opacity: 0.5,
              }}
            />
            {STEPS.map((s) => (
              <div key={s.n} className="relative flex flex-col items-center text-center">
                <div
                  className="pf flex items-center justify-center rounded-full"
                  style={{
                    width: 56,
                    height: 56,
                    background: C.amber,
                    color: C.bg,
                    fontSize: 22,
                    fontWeight: 700,
                    border: `4px solid ${C.bgDark}`,
                  }}
                >
                  {s.n}
                </div>
                <h3 className="pf mt-6" style={{ color: C.text, fontSize: 22, fontWeight: 600 }}>
                  {s.title}
                </h3>
                <p className="mt-3" style={{ color: C.muted, fontSize: 16, lineHeight: 1.6, maxWidth: 280 }}>
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* QUOTE */}
      <section style={{ background: C.amber, padding: "140px 24px" }}>
        <div className="max-w-[700px] mx-auto text-center">
          <blockquote className="pf italic" style={{ color: C.bg, fontSize: "clamp(32px, 4.5vw, 48px)", lineHeight: 1.2, fontWeight: 600 }}>
            "I built the product.
            <br />
            Kinika helped me tell
            <br />
            the world about it."
          </blockquote>
          <p className="mt-8" style={{ color: C.bg, opacity: 0.7, fontSize: 16 }}>
            — Solo founder, Stockholm
          </p>
        </div>
      </section>

      {/* FINAL CTA */}
      <section style={{ background: C.bg, padding: "140px 24px" }}>
        <div className="max-w-[700px] mx-auto text-center">
          <h2 className="pf" style={{ color: C.text, fontSize: "clamp(40px, 5vw, 56px)", fontWeight: 600 }}>
            Start building.
          </h2>
          <p className="mt-5" style={{ color: C.muted, fontSize: 18 }}>
            Free to start. No credit card required.
          </p>
          <Link
            to="/sign-up"
            className="mt-10 inline-flex items-center justify-center gap-2 rounded-md font-medium hover:-translate-y-0.5 transition-transform"
            style={{ background: C.amber, color: C.bg, height: 56, width: 240, fontSize: 16 }}
          >
            Create your account <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="mt-8 text-sm" style={{ color: C.muted }}>
            Already have an account?{" "}
            <Link to="/sign-in" style={{ color: C.amber }} className="hover:underline">
              Sign in →
            </Link>
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: C.bgDark, borderTop: `1px solid ${C.border}` }}>
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 h-16 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs" style={{ color: C.muted }}>
          <span className="pf" style={{ color: C.amber, fontSize: 18, fontWeight: 600 }}>
            kinika
          </span>
          <div className="flex gap-5">
            <a href="#" className="hover:opacity-80">Privacy</a>
            <span>·</span>
            <a href="#" className="hover:opacity-80">Terms</a>
            <span>·</span>
            <a href="#" className="hover:opacity-80">Contact</a>
          </div>
          <span>© 2025 Kinika</span>
        </div>
      </footer>
    </div>
  );
}
