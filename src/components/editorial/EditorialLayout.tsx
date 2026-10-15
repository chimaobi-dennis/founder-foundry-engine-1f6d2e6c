import { Link, NavLink, useLocation } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";

// Theme A (locked 10 Oct 2026) for the public pages. Key names are kept so
// older pages that import `L` keep working: `amber` is the accent slot.
export const L = {
  paper: "#F5F7FA",
  paperDeep: "#EEF1F5",
  ink: "#0B1220",
  inkSoft: "#3F4756",
  inkMuted: "#5B6472",
  amber: "#1E4ED8",
  accentDeep: "#1E40AF",
  accentSoft: "#EAF0FF",
  accentLine: "#C7D7FF",
  good: "#157347",
  goodSoft: "#E6F4EC",
  rule: "#DDE3EC",
  ruleSoft: "#E9EEF4",
  surface: "#FFFFFF",
};

const NAV = [
  { to: "/philosophy", label: "Philosophy" },
  { to: "/system", label: "How it works" },
  { to: "/pricing", label: "Pricing" },
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

export function EditorialNav() {
  const scrolled = useScrolled();
  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 transition-all"
      style={{
        background: scrolled ? `${L.paper}f2` : "transparent",
        backdropFilter: scrolled ? "blur(8px) saturate(1.1)" : "none",
        borderBottom: scrolled ? `1px solid ${L.rule}` : "1px solid transparent",
      }}
    >
      <div className="max-w-[1320px] mx-auto px-6 md:px-12 h-[72px] flex items-center justify-between gap-6">
        <Link to="/" className="pf flex items-baseline gap-2 min-w-0" style={{ color: L.ink }}>
          <span style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.01em" }}>Kinika</span>
          <span className="truncate hidden sm:inline" style={{ fontSize: 11, color: L.inkMuted, letterSpacing: "0.16em", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif" }}>
            The workspace that knows your business
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 flex-shrink-0">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className="transition-opacity hover:opacity-70"
              style={({ isActive }) => ({
                color: isActive ? L.ink : L.inkSoft,
                fontSize: 13,
                letterSpacing: "0.01em",
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: isActive ? 600 : 500,
                borderBottom: isActive ? `2px solid ${L.amber}` : "2px solid transparent",
                paddingBottom: 2,
              })}
            >
              {item.label}
            </NavLink>
          ))}
          <Link to="/sign-in" className="transition-opacity hover:opacity-70" style={{ color: L.inkSoft, fontSize: 13, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
            Sign in
          </Link>
        </nav>

        <Link
          to="/sign-up"
          className="inline-flex items-center text-sm font-medium transition-all hover:-translate-y-px flex-shrink-0 whitespace-nowrap"
          style={{ background: L.amber, color: "#FFFFFF", height: 38, padding: "0 18px", borderRadius: 8, letterSpacing: "0.01em", fontFamily: "'DM Sans', sans-serif" }}
        >
          Start free
        </Link>
      </div>
    </header>
  );
}

export function EditorialFooter({ issueLabel = "Understand first. Plan. Hire. Approve." }: { issueLabel?: string }) {
  return (
    <footer className="relative" style={{ background: L.paper, color: L.ink }}>
      <div className="max-w-[1320px] mx-auto px-6 md:px-12" style={{ padding: "80px 24px 48px" }}>
        <div style={{ height: 1, background: L.rule, marginBottom: 56 }} />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-7">
            <p className="pf" style={{ color: L.ink, fontSize: "clamp(22px, 2.4vw, 28px)", lineHeight: 1.3, fontWeight: 600, letterSpacing: "-0.015em", maxWidth: "32ch" }}>
              The workspace that knows your business.
            </p>
            <div style={{ height: 1, background: L.ruleSoft, margin: "32px 0 36px", width: 48 }} />
            <div className="flex flex-wrap gap-x-10 gap-y-3">
              {NAV.map((item) => (
                <Link key={item.to} to={item.to} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: L.inkSoft }} className="hover:opacity-70 transition-opacity">
                  {item.label}
                </Link>
              ))}
              <Link to="/sign-in" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: L.inkSoft }} className="hover:opacity-70 transition-opacity">
                Sign in
              </Link>
            </div>
          </div>
          <div className="lg:col-span-5 lg:pl-12 lg:border-l" style={{ borderColor: L.ruleSoft }}>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: L.inkMuted, fontWeight: 500 }}>
              Kinika
            </span>
            <p className="pf" style={{ marginTop: 16, fontSize: 18, color: L.ink, fontWeight: 600 }}>
              {issueLabel}
            </p>
            <p style={{ color: L.inkMuted, fontSize: 14, marginTop: 20, lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif" }}>
              Kinika understands your business, writes its plan, hires agents for the work, and asks before anything is sent, published or changed.
            </p>
          </div>
        </div>
        <div style={{ height: 1, background: L.rule, marginTop: 56, marginBottom: 20 }} />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: L.inkMuted, letterSpacing: "0.06em" }}>© 2026 Kinika</span>
          <div className="flex items-center gap-4">
            <a href="#" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: L.inkMuted, letterSpacing: "0.06em" }} className="hover:opacity-70 transition-opacity">Privacy</a>
            <span style={{ color: L.rule }}>·</span>
            <a href="#" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: L.inkMuted, letterSpacing: "0.06em" }} className="hover:opacity-70 transition-opacity">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function EditorialShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <div
      className="h-[100dvh] w-full overflow-y-auto overflow-x-hidden"
      style={{ background: L.paper, color: L.ink, fontFamily: "'DM Sans', sans-serif", WebkitOverflowScrolling: "touch" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700&family=DM+Sans:wght@400;500;600&display=swap');
        .pf { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 600; letter-spacing: -0.01em; }
        @keyframes editorialFadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ed-fade { opacity: 0; animation: editorialFadeUp .8s ease-out forwards; }
        .ed-d1 { animation-delay: .05s; }
        .ed-d2 { animation-delay: .2s; }
        .ed-d3 { animation-delay: .35s; }
        .ed-d4 { animation-delay: .5s; }
        @media (prefers-reduced-motion: reduce) {
          .ed-fade { animation: none !important; opacity: 1 !important; transform: none !important; }
        }
      `}</style>
      <EditorialNav />
      <main>{children}</main>
      <EditorialFooter />
    </div>
  );
}

// Reusable editorial primitives ---------------------------------------------

export function PageMeta({ issue, section, date }: { issue: string; section: string; date: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2" style={{ marginBottom: 48 }}>
      <span style={{ fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", color: L.accentDeep, fontWeight: 600 }}>{issue}</span>
      <span style={{ width: 24, height: 1, background: L.rule }} />
      <span style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: L.inkMuted }}>{section}</span>
      <span style={{ width: 24, height: 1, background: L.rule }} />
      <span style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: L.inkMuted }}>{date}</span>
    </div>
  );
}

export function PageTitle({ children, kicker }: { children: ReactNode; kicker?: string }) {
  return (
    <header style={{ marginBottom: 56 }}>
      {kicker && (
        <p className="ed-fade" style={{ color: L.accentDeep, fontSize: 13, marginBottom: 16, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 600 }}>
          {kicker}
        </p>
      )}
      <h1 className="pf ed-fade ed-d1" style={{ color: L.ink, fontSize: "clamp(40px, 5.5vw, 72px)", lineHeight: 1.05, letterSpacing: "-0.025em", maxWidth: "18ch" }}>
        {children}
      </h1>
    </header>
  );
}

export function Container({ children, narrow = false }: { children: ReactNode; narrow?: boolean }) {
  return (
    <div
      className="mx-auto"
      style={{
        maxWidth: narrow ? 880 : 1320,
        paddingLeft: "clamp(24px, 6vw, 96px)",
        paddingRight: "clamp(24px, 6vw, 96px)",
        paddingTop: "clamp(120px, 16vh, 180px)",
        paddingBottom: "clamp(80px, 12vh, 140px)",
      }}
    >
      {children}
    </div>
  );
}

/** A plain section with an eyebrow and a title; the body is whatever follows. */
export function Section({ eyebrow, title, children, tone = "paper" }: { eyebrow?: string; title?: ReactNode; children: ReactNode; tone?: "paper" | "deep" | "surface" }) {
  const bg = tone === "deep" ? L.paperDeep : tone === "surface" ? L.surface : L.paper;
  return (
    <section style={{ background: bg, borderTop: `1px solid ${L.ruleSoft}` }}>
      <div className="mx-auto" style={{ maxWidth: 1320, padding: "clamp(64px, 9vh, 112px) clamp(24px, 6vw, 96px)" }}>
        {eyebrow && <p style={{ fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: L.accentDeep, fontWeight: 600, marginBottom: 14 }}>{eyebrow}</p>}
        {title && <h2 className="pf" style={{ fontSize: "clamp(28px, 3.4vw, 44px)", lineHeight: 1.1, letterSpacing: "-0.02em", color: L.ink, maxWidth: "26ch", marginBottom: 36 }}>{title}</h2>}
        {children}
      </div>
    </section>
  );
}

/** A card with a number or label, a title and a line. */
export function Card({ label, title, children }: { label?: string; title: string; children?: ReactNode }) {
  return (
    <div style={{ background: L.surface, border: `1px solid ${L.rule}`, borderRadius: 14, padding: "22px 22px 24px", display: "flex", flexDirection: "column", gap: 8 }}>
      {label && <span style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: L.inkMuted, fontWeight: 600 }}>{label}</span>}
      <span className="pf" style={{ fontSize: 18, color: L.ink, lineHeight: 1.3 }}>{title}</span>
      {children && <div style={{ fontSize: 14, lineHeight: 1.6, color: L.inkSoft }}>{children}</div>}
    </div>
  );
}

export function PrimaryLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="inline-flex items-center gap-2 transition-all hover:-translate-y-px" style={{ background: L.amber, color: "#FFFFFF", height: 48, padding: "0 24px", borderRadius: 10, fontSize: 15, fontWeight: 500, fontFamily: "'DM Sans', sans-serif" }}>
      {children}
    </Link>
  );
}

export function SecondaryLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="inline-flex items-center gap-2 transition-all hover:-translate-y-px" style={{ background: L.surface, color: L.ink, border: `1px solid ${L.rule}`, height: 48, padding: "0 20px", borderRadius: 10, fontSize: 15, fontWeight: 500, fontFamily: "'DM Sans', sans-serif" }}>
      {children}
    </Link>
  );
}
