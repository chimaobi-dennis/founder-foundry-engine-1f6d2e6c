import { Link, NavLink, useLocation } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";

// Shared warm editorial palette (mirrors src/pages/Landing.tsx)
export const L = {
  paper: "#F2EDE4",
  paperDeep: "#EAE3D6",
  ink: "#0D1B2A",
  inkSoft: "#3A4856",
  inkMuted: "#6B7480",
  amber: "#B8860B",
  rule: "rgba(13, 27, 42, 0.14)",
  ruleSoft: "rgba(13, 27, 42, 0.08)",
};

const NAV = [
  { to: "/philosophy", label: "Philosophy" },
  { to: "/system", label: "System" },
  { to: "/journal", label: "Journal" },
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
      <div className="max-w-[1320px] mx-auto px-6 md:px-12 h-[72px] flex items-center justify-between">
        <Link to="/" className="pf flex items-baseline gap-2" style={{ color: L.ink }}>
          <span style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.01em" }}>Kinika</span>
          <span
            style={{
              fontSize: 11,
              color: L.inkMuted,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontFamily: "'DM Sans', sans-serif",
            }}
            className="hidden md:inline"
          >
            — Brand Intelligence
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className="transition-opacity hover:opacity-70"
              style={({ isActive }) => ({
                color: isActive ? L.ink : L.inkSoft,
                fontSize: 13,
                letterSpacing: "0.02em",
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: isActive ? 600 : 500,
                borderBottom: isActive ? `1px solid ${L.amber}` : "1px solid transparent",
                paddingBottom: 2,
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

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
    </header>
  );
}

export function EditorialFooter({ issueLabel = "Persistent business memory for founders." }: { issueLabel?: string }) {
  return (
    <footer className="relative" style={{ background: L.paper, color: L.ink }}>
      <div className="max-w-[1320px] mx-auto px-6 md:px-12" style={{ padding: "80px 24px 48px" }}>
        <div style={{ height: 1, background: L.rule, marginBottom: 56 }} />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-7">
            <p
              className="pf"
              style={{
                color: L.ink,
                fontSize: "clamp(22px, 2.4vw, 28px)",
                lineHeight: 1.35,
                fontWeight: 500,
                letterSpacing: "-0.015em",
                maxWidth: "32ch",
              }}
            >
              A system that remembers.
            </p>
            <div style={{ height: 1, background: L.ruleSoft, margin: "32px 0 36px", width: 48 }} />
            <div className="flex flex-wrap gap-x-10 gap-y-3">
              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 13,
                    color: L.inkSoft,
                    letterSpacing: "0.02em",
                  }}
                  className="hover:opacity-70 transition-opacity"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                to="/sign-in"
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13,
                  color: L.inkSoft,
                  letterSpacing: "0.02em",
                }}
                className="hover:opacity-70 transition-opacity"
              >
                Sign in
              </Link>
            </div>
          </div>
          <div className="lg:col-span-5 lg:pl-12 lg:border-l" style={{ borderColor: L.ruleSoft }}>
            <span
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 10,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: L.inkMuted,
                fontWeight: 500,
              }}
            >
              Kinika Studio
            </span>
            <p className="pf" style={{ marginTop: 16, fontSize: 18, color: L.ink, fontWeight: 500 }}>
              {issueLabel}
            </p>
            <p
              className="pf"
              style={{
                color: L.inkMuted,
                fontSize: 14,
                fontStyle: "italic",
                marginTop: 24,
                lineHeight: 1.5,
              }}
            >
              "The next conversation begins inside."
            </p>
          </div>
        </div>
        <div style={{ height: 1, background: L.rule, marginTop: 56, marginBottom: 20 }} />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: L.inkMuted, letterSpacing: "0.06em" }}>
            © 2026 Kinika
          </span>
          <div className="flex items-center gap-4">
            <a href="#" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: L.inkMuted, letterSpacing: "0.06em" }} className="hover:opacity-70 transition-opacity">
              Privacy
            </a>
            <span style={{ color: L.rule }}>·</span>
            <a href="#" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: L.inkMuted, letterSpacing: "0.06em" }} className="hover:opacity-70 transition-opacity">
              Terms
            </a>
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
      className="min-h-screen w-full"
      style={{ background: L.paper, color: L.ink, fontFamily: "'DM Sans', sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=DM+Sans:wght@400;500;600&display=swap');
        .pf { font-family: 'Playfair Display', serif; }
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

export function PageMeta({
  issue,
  section,
  date,
}: {
  issue: string;
  section: string;
  date: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2" style={{ marginBottom: 48 }}>
      <span style={{ fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", color: L.amber, fontWeight: 600 }}>
        {issue}
      </span>
      <span style={{ width: 24, height: 1, background: L.rule }} />
      <span style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: L.inkMuted }}>
        {section}
      </span>
      <span style={{ width: 24, height: 1, background: L.rule }} />
      <span style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: L.inkMuted }}>
        {date}
      </span>
    </div>
  );
}

export function PageTitle({ children, kicker }: { children: ReactNode; kicker?: string }) {
  return (
    <header style={{ marginBottom: 56 }}>
      {kicker && (
        <p
          className="pf ed-fade"
          style={{
            fontStyle: "italic",
            color: L.amber,
            fontSize: 18,
            marginBottom: 16,
            letterSpacing: "0.01em",
          }}
        >
          {kicker}
        </p>
      )}
      <h1
        className="pf ed-fade ed-d1"
        style={{
          color: L.ink,
          fontSize: "clamp(44px, 6vw, 88px)",
          lineHeight: 1.02,
          fontWeight: 500,
          letterSpacing: "-0.025em",
          maxWidth: "16ch",
        }}
      >
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
