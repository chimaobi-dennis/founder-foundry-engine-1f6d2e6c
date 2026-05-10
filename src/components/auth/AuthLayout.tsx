import { Link } from "react-router-dom";
import { ReactNode } from "react";

// Warm editorial palette — mirrors Landing page
const L = {
  paper: "#F2EDE4",
  paperDeep: "#EAE3D6",
  ink: "#0D1B2A",
  inkSoft: "#3A4856",
  inkMuted: "#6B7480",
  amber: "#B8860B",
  rule: "rgba(13, 27, 42, 0.14)",
  ruleSoft: "rgba(13, 27, 42, 0.08)",
};

const displayFont = '"Playfair Display", "Cormorant Garamond", Georgia, serif';
const uiFont = '"DM Sans", "Inter", system-ui, sans-serif';

interface AuthLayoutProps {
  /** Eyebrow tag above narrative headline (e.g. "Sign in", "Create account"). */
  eyebrow: string;
  /** Editorial headline shown on the left narrative column. */
  narrative: ReactNode;
  /** Supporting paragraph beneath the narrative. */
  supporting: ReactNode;
  /** Optional small structured annotation block beneath supporting copy. */
  annotation?: ReactNode;
  /** Form column heading (e.g. "Welcome back"). */
  formTitle: string;
  /** Optional form column sub-line. */
  formSubtitle?: ReactNode;
  /** The form itself. */
  children: ReactNode;
  /** Footer line under the form (e.g. "Don't have an account? …"). */
  footer?: ReactNode;
}

export function AuthLayout({
  eyebrow,
  narrative,
  supporting,
  annotation,
  formTitle,
  formSubtitle,
  children,
  footer,
}: AuthLayoutProps) {
  return (
    <div
      className="min-h-screen w-full"
      style={{
        background: L.paper,
        color: L.ink,
        fontFamily: uiFont,
      }}
    >
      {/* Top hairline brand bar */}
      <header
        className="w-full"
        style={{ borderBottom: `0.5px solid ${L.ruleSoft}` }}
      >
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 h-14 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 group"
            style={{ color: L.ink }}
          >
            <span
              style={{
                fontFamily: displayFont,
                fontSize: 20,
                letterSpacing: "-0.01em",
                fontWeight: 500,
              }}
            >
              Kinika
            </span>
            <span
              className="hidden sm:inline"
              style={{
                fontSize: 11,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: L.inkMuted,
                fontWeight: 500,
              }}
            >
              — Founders' Workspace
            </span>
          </Link>
          <Link
            to="/"
            className="text-[12px] transition-colors"
            style={{
              color: L.inkSoft,
              letterSpacing: "0.04em",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = L.ink)}
            onMouseLeave={(e) => (e.currentTarget.style.color = L.inkSoft)}
          >
            ← Back to home
          </Link>
        </div>
      </header>

      {/* Split editorial body */}
      <main className="max-w-[1280px] mx-auto px-6 md:px-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 py-12 md:py-20 lg:py-24">
          {/* LEFT — narrative */}
          <section className="lg:col-span-7 lg:pr-10 flex flex-col">
            <span
              style={{
                fontSize: 11,
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                color: L.amber,
                fontWeight: 500,
              }}
            >
              {eyebrow}
            </span>

            <h1
              className="mt-5"
              style={{
                fontFamily: displayFont,
                fontSize: "clamp(34px, 4.6vw, 56px)",
                lineHeight: 1.06,
                letterSpacing: "-0.015em",
                fontWeight: 400,
                color: L.ink,
                maxWidth: "20ch",
              }}
            >
              {narrative}
            </h1>

            <p
              className="mt-7"
              style={{
                fontSize: 15,
                lineHeight: 1.7,
                color: L.inkSoft,
                maxWidth: "52ch",
              }}
            >
              {supporting}
            </p>

            {annotation && (
              <div
                className="mt-10 hidden md:block"
                style={{ borderTop: `0.5px solid ${L.rule}`, paddingTop: 18 }}
              >
                {annotation}
              </div>
            )}
          </section>

          {/* Vertical divider on lg+ */}
          <div className="hidden lg:block lg:col-span-5">
            <div className="relative h-full">
              <div
                className="absolute left-0 top-0 bottom-0 hidden lg:block"
                style={{ width: 1, background: L.rule }}
                aria-hidden
              />
              <div className="lg:pl-12">
                <FormColumn
                  title={formTitle}
                  subtitle={formSubtitle}
                  footer={footer}
                >
                  {children}
                </FormColumn>
              </div>
            </div>
          </div>

          {/* Mobile / tablet form */}
          <div className="lg:hidden">
            <div
              style={{
                borderTop: `0.5px solid ${L.rule}`,
                paddingTop: 28,
              }}
            >
              <FormColumn
                title={formTitle}
                subtitle={formSubtitle}
                footer={footer}
              >
                {children}
              </FormColumn>
            </div>
          </div>
        </div>
      </main>

      {/* Footer hairline */}
      <footer
        className="w-full mt-auto"
        style={{ borderTop: `0.5px solid ${L.ruleSoft}` }}
      >
        <div
          className="max-w-[1280px] mx-auto px-6 md:px-10 h-14 flex items-center justify-between"
          style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: L.inkMuted }}
        >
          <span>Shared business context for modern founders</span>
          <span className="hidden sm:inline">© Kinika</span>
        </div>
      </footer>
    </div>
  );
}

function FormColumn({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="w-full max-w-[420px]">
      <h2
        style={{
          fontFamily: displayFont,
          fontSize: 26,
          lineHeight: 1.15,
          letterSpacing: "-0.01em",
          color: L.ink,
          fontWeight: 500,
        }}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className="mt-2"
          style={{ fontSize: 13.5, color: L.inkMuted, lineHeight: 1.6 }}
        >
          {subtitle}
        </p>
      )}

      <div className="mt-7">{children}</div>

      {footer && (
        <div
          className="mt-7"
          style={{
            borderTop: `0.5px solid ${L.ruleSoft}`,
            paddingTop: 18,
            fontSize: 13,
            color: L.inkSoft,
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}

// --- Reusable form primitives sharing the same editorial language ---

export const authTokens = L;

export function AuthLabel({ children }: { children: ReactNode }) {
  return (
    <label
      className="block mb-2"
      style={{
        fontSize: 11,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: L.inkMuted,
        fontWeight: 500,
      }}
    >
      {children}
    </label>
  );
}

export const authInputClass =
  "w-full h-[46px] px-0 bg-transparent text-[15px] outline-none transition-colors";

export function AuthInputWrap({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative"
      style={{ borderBottom: `0.5px solid ${L.rule}` }}
    >
      {children}
    </div>
  );
}

export function AuthPrimaryButton({
  children,
  disabled,
  type = "submit",
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  type?: "submit" | "button";
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="w-full inline-flex items-center justify-center gap-2 transition-colors"
      style={{
        height: 50,
        background: disabled ? "rgba(13,27,42,0.4)" : L.ink,
        color: L.paper,
        fontSize: 13,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        fontWeight: 500,
        borderRadius: 2,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = "#1A2A3A";
      }}
      onMouseLeave={(e) => {
        if (!disabled) e.currentTarget.style.background = L.ink;
      }}
    >
      {children}
    </button>
  );
}

export function AuthError({ children }: { children: ReactNode }) {
  return (
    <div
      className="mt-1"
      style={{
        fontSize: 12.5,
        color: "#A23A2C",
        background: "rgba(162, 58, 44, 0.06)",
        borderLeft: "2px solid #A23A2C",
        padding: "10px 12px",
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}
