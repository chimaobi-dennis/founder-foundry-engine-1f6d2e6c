import { Link } from "react-router-dom";
import { useEffect, useRef } from "react";
import {
  MessageCircle,
  Camera,
  Megaphone,
  Calendar,
  FileText,
  Film,
  Sparkles,
  Unlink,
  Mountain,
  ArrowRight,
} from "lucide-react";

const COLORS = {
  bg: "#0D1B2A",
  card: "#1A2A3A",
  amber: "#D4A017",
  text: "#F5F0E8",
  muted: "#8A96A3",
  border: "#22344A",
};

function ParticlesBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let w = (canvas.width = canvas.offsetWidth * window.devicePixelRatio);
    let h = (canvas.height = canvas.offsetHeight * window.devicePixelRatio);
    const resize = () => {
      w = canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      h = canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    };
    window.addEventListener("resize", resize);
    const N = 36;
    const dots = Array.from({ length: N }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: (Math.random() * 1.6 + 0.4) * window.devicePixelRatio,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.15,
      a: Math.random() * 0.5 + 0.15,
    }));
    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      for (const d of dots) {
        d.x += d.vx;
        d.y += d.vy;
        if (d.x < 0 || d.x > w) d.vx *= -1;
        if (d.y < 0 || d.y > h) d.vy *= -1;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(212, 160, 23, ${d.a})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none opacity-70"
    />
  );
}

const modules = [
  { icon: MessageCircle, name: "Mentor", desc: "Your AI thinking partner" },
  { icon: Camera, name: "ProStudio", desc: "Product visuals without a studio" },
  { icon: Megaphone, name: "ContentStudio", desc: "One brief. Eight platforms." },
  { icon: Calendar, name: "ContentCalendar", desc: "Plan your content month" },
  { icon: FileText, name: "DocStudio", desc: "Professional documents, instantly" },
  { icon: Film, name: "ReelBuilder", desc: "Brief to script to teleprompter" },
];

const problems = [
  {
    icon: Sparkles,
    title: "Generic AI content",
    body: "Tools that don't know your business give you content that sounds like everyone else.",
  },
  {
    icon: Unlink,
    title: "Context lost every time",
    body: "You explain your brand from scratch with every new tool. Nothing remembers what you built.",
  },
  {
    icon: Mountain,
    title: "Stuck between built and marketed",
    body: "You built something real. But getting it in front of people feels like a different job entirely.",
  },
];

const steps = [
  {
    n: "01",
    title: "Tell Mentor your story",
    body: "Start a conversation. Kinika learns your brand, your stage, your voice — and never forgets.",
  },
  {
    n: "02",
    title: "Build your Brand DNA",
    body: "Every insight gets captured. Your brand knowledge grows with every session.",
  },
  {
    n: "03",
    title: "Create everything from it",
    body: "Content, visuals, documents — all generated from your actual brand context. Never generic.",
  },
];

export default function Landing() {
  return (
    <div
      className="min-h-screen w-full font-ui"
      style={{ background: COLORS.bg, color: COLORS.text }}
    >
      {/* NAV */}
      <header className="sticky top-0 z-50 backdrop-blur-md" style={{ background: `${COLORS.bg}cc`, borderBottom: `0.5px solid ${COLORS.border}` }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="font-display text-2xl tracking-tight" style={{ color: COLORS.amber }}>
            kinika
          </Link>
          <div className="flex items-center gap-5">
            <Link to="/sign-in" className="text-sm hover:opacity-80 transition-opacity" style={{ color: COLORS.text }}>
              Sign in
            </Link>
            <Link
              to="/sign-up"
              className="text-sm font-medium px-4 py-2 rounded-md transition-transform hover:-translate-y-0.5"
              style={{ background: COLORS.amber, color: COLORS.bg }}
            >
              Get started free
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <ParticlesBackground />
        <div className="relative max-w-6xl mx-auto px-6 pt-28 pb-32 md:pt-40 md:pb-44">
          <h1
            className="font-display font-semibold leading-[1.05] tracking-tight"
            style={{ fontSize: "clamp(40px, 7vw, 72px)", color: COLORS.text }}
          >
            Your brand, finally
            <br />
            <span style={{ color: COLORS.amber }}>understood.</span>
          </h1>
          <p
            className="mt-8 max-w-[540px] text-lg md:text-xl leading-relaxed"
            style={{ color: COLORS.muted }}
          >
            Kinika is the AI thinking partner that knows your business from day one — and turns that knowledge into content, visuals, and documents that actually sound like you.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3">
            <Link
              to="/sign-up"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-md font-medium text-sm transition-transform hover:-translate-y-0.5"
              style={{ background: COLORS.amber, color: COLORS.bg }}
            >
              Start building free <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="#how"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-md font-medium text-sm border transition-colors"
              style={{ borderColor: COLORS.border, color: COLORS.text }}
            >
              See how it works
            </a>
          </div>
          <p className="mt-8 text-xs tracking-wide" style={{ color: COLORS.muted }}>
            Used by founders building in Stockholm, Lagos, and beyond
          </p>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="py-24" style={{ borderTop: `0.5px solid ${COLORS.border}` }}>
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="font-display text-center text-3xl md:text-[40px] mb-14 tracking-tight">
            Every founder hits the same wall.
          </h2>
          <div className="grid md:grid-cols-3 gap-5">
            {problems.map((p) => (
              <div
                key={p.title}
                className="p-7 rounded-lg"
                style={{ background: COLORS.card, border: `0.5px solid ${COLORS.border}` }}
              >
                <div
                  className="w-10 h-10 rounded-md flex items-center justify-center mb-5"
                  style={{ background: `${COLORS.amber}1a`, color: COLORS.amber }}
                >
                  <p.icon className="w-5 h-5" />
                </div>
                <h3 className="font-display text-xl mb-2">{p.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: COLORS.muted }}>
                  {p.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SOLUTION */}
      <section className="py-28" style={{ borderTop: `0.5px solid ${COLORS.border}` }}>
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="font-display text-4xl md:text-5xl tracking-tight mb-4">
            Kinika remembers everything.
          </h2>
          <p className="text-lg mb-14 max-w-xl" style={{ color: COLORS.muted }}>
            One conversation builds your Brand DNA. Every module uses it.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {modules.map((m) => (
              <div
                key={m.name}
                className="group p-6 rounded-lg transition-all hover:-translate-y-1"
                style={{
                  background: COLORS.card,
                  borderLeft: `2px solid ${COLORS.amber}`,
                  border: `0.5px solid ${COLORS.border}`,
                  borderLeftWidth: "2px",
                  borderLeftColor: COLORS.amber,
                }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-9 h-9 rounded-md flex items-center justify-center"
                    style={{ background: `${COLORS.amber}1a`, color: COLORS.amber }}
                  >
                    <m.icon className="w-4 h-4" />
                  </div>
                  <h3 className="font-display text-lg">{m.name}</h3>
                </div>
                <p className="text-sm" style={{ color: COLORS.muted }}>
                  {m.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="py-28" style={{ borderTop: `0.5px solid ${COLORS.border}` }}>
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="font-display text-4xl md:text-5xl tracking-tight mb-14">
            Built different from day one.
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {steps.map((s) => (
              <div key={s.n} className="p-7 rounded-lg" style={{ background: COLORS.card, border: `0.5px solid ${COLORS.border}` }}>
                <div className="font-display text-3xl mb-4" style={{ color: COLORS.amber }}>
                  {s.n}
                </div>
                <h3 className="font-display text-xl mb-3">{s.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: COLORS.muted }}>
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* QUOTE */}
      <section className="py-28" style={{ borderTop: `0.5px solid ${COLORS.border}` }}>
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="font-display text-5xl mb-4" style={{ color: COLORS.amber }}>
            “
          </div>
          <blockquote className="font-display italic text-2xl md:text-[28px] leading-snug">
            I built the product. Kinika helped me tell the world about it.
          </blockquote>
          <p className="mt-6 text-sm" style={{ color: COLORS.muted }}>
            — Solo founder, Stockholm
          </p>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-32" style={{ borderTop: `0.5px solid ${COLORS.border}`, background: "#0A1623" }}>
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-display text-4xl md:text-5xl tracking-tight mb-4">
            Start building your brand.
          </h2>
          <p className="text-base mb-10" style={{ color: COLORS.muted }}>
            Free to start. No credit card required.
          </p>
          <Link
            to="/sign-up"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-md font-medium text-base transition-transform hover:-translate-y-0.5"
            style={{ background: COLORS.amber, color: COLORS.bg }}
          >
            Create your account <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="mt-8 text-sm" style={{ color: COLORS.muted }}>
            Already have an account?{" "}
            <Link to="/sign-in" className="underline" style={{ color: COLORS.text }}>
              Sign in
            </Link>
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: `0.5px solid ${COLORS.border}` }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs" style={{ color: COLORS.muted }}>
          <span className="font-display text-base" style={{ color: COLORS.amber }}>
            kinika
          </span>
          <div className="flex gap-5">
            <a href="#" className="hover:opacity-80">Privacy</a>
            <a href="#" className="hover:opacity-80">Terms</a>
            <a href="#" className="hover:opacity-80">Contact</a>
          </div>
          <span>© 2025 Kinika</span>
        </div>
      </footer>
    </div>
  );
}
