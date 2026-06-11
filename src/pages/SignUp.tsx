import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, CheckCircle, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  AuthLayout,
  AuthLabel,
  AuthInputWrap,
  authInputClass,
  AuthPrimaryButton,
  AuthError,
  authTokens as L,
} from "@/components/auth/AuthLayout";

function getStrength(pw: string): { level: number; label: string } {
  if (!pw) return { level: 0, label: "" };
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const labels = ["", "Weak", "Fair", "Good", "Strong"];
  return { level: s, label: labels[s] };
}

export default function SignUp() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const errors: Record<string, string> = {};
  if (touched.fullName && !form.fullName.trim()) errors.fullName = "Required";
  if (touched.email && !form.email.trim()) errors.email = "Required";
  else if (touched.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
    errors.email = "Invalid email format";
  if (touched.password && !form.password) errors.password = "Required";
  else if (touched.password && form.password.length < 8)
    errors.password = "Minimum 8 characters";
  if (touched.confirmPassword && form.confirmPassword !== form.password)
    errors.confirmPassword = "Passwords do not match";

  const strength = getStrength(form.password);
  const canSubmit =
    !!form.fullName.trim() &&
    !!form.email.trim() &&
    form.password.length >= 8 &&
    form.confirmPassword === form.password;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError("");

    const { error: err } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/home`,
        data: { full_name: form.fullName },
      },
    });

    setLoading(false);
    if (err) {
      if (err.message.includes("already registered")) {
        setError("An account with this email already exists. Sign in instead.");
      } else if (err.message.includes("at least 6")) {
        setError("Password must be at least 8 characters.");
      } else {
        setError(err.message);
      }
    } else {
      setSuccess(true);
      navigate(`/verify-email?email=${encodeURIComponent(form.email)}`, {
        replace: true,
      });
    }
  };

  return (
    <AuthLayout
      eyebrow="Create account"
      narrative={<>One place where your business is understood.</>}
      supporting={
        <>
          Kinika is a shared context system for modern founders — the operating
          layer underneath your content, strategy, documents and creative work.
          Set up your workspace once. Stop re-explaining your business.
        </>
      }
      annotation={
        <div className="grid grid-cols-3 gap-6 max-w-md">
          {[
            { k: "01", v: "Talk to Kinika" },
            { k: "02", v: "Build shared context" },
            { k: "03", v: "Create from one source" },
          ].map((it) => (
            <div key={it.k}>
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: "0.2em",
                  color: L.amber,
                  fontWeight: 500,
                }}
              >
                {it.k}
              </div>
              <div
                className="mt-1.5"
                style={{ fontSize: 12.5, color: L.inkSoft, lineHeight: 1.5 }}
              >
                {it.v}
              </div>
            </div>
          ))}
        </div>
      }
      formTitle={success ? "Check your inbox" : "Open your workspace"}
      formSubtitle={
        success
          ? "We've sent a confirmation link to your email."
          : "It takes about a minute."
      }
      footer={
        success ? (
          <Link
            to="/sign-in"
            className="hover:underline underline-offset-4"
            style={{ color: L.ink, fontWeight: 500 }}
          >
            Go to sign in →
          </Link>
        ) : (
          <>
            Already have an account?{" "}
            <Link
              to="/sign-in"
              className="hover:underline underline-offset-4"
              style={{ color: L.ink, fontWeight: 500 }}
            >
              Sign in
            </Link>
          </>
        )
      }
    >
      {success ? (
        <div className="flex flex-col items-start gap-4">
          <CheckCircle size={28} style={{ color: L.amber }} />
          <p style={{ fontSize: 14, color: L.inkSoft, lineHeight: 1.65 }}>
            Confirm your email to activate your account, then return here to
            sign in. The link expires in 24 hours.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <Field label="Full name" error={errors.fullName}>
            <input
              className={authInputClass}
              value={form.fullName}
              autoComplete="name"
              onChange={(e) =>
                setForm((p) => ({ ...p, fullName: e.target.value }))
              }
              onBlur={() => setTouched((p) => ({ ...p, fullName: true }))}
              placeholder="Your name"
              style={{ color: L.ink }}
            />
          </Field>

          <Field label="Email" error={errors.email}>
            <input
              className={authInputClass}
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) =>
                setForm((p) => ({ ...p, email: e.target.value }))
              }
              onBlur={() => setTouched((p) => ({ ...p, email: true }))}
              placeholder="you@company.com"
              style={{ color: L.ink }}
            />
          </Field>

          <Field label="Password" error={errors.password}>
            <input
              className={authInputClass}
              type={showPw ? "text" : "password"}
              autoComplete="new-password"
              value={form.password}
              onChange={(e) =>
                setForm((p) => ({ ...p, password: e.target.value }))
              }
              onBlur={() => setTouched((p) => ({ ...p, password: true }))}
              placeholder="Minimum 8 characters"
              style={{ color: L.ink, paddingRight: 32 }}
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              className="absolute right-0 top-1/2 -translate-y-1/2"
              style={{ color: L.inkMuted }}
              aria-label="Toggle password visibility"
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            {form.password && (
              <div className="mt-2 flex items-center gap-3 absolute -bottom-6 left-0 right-0">
                <div
                  className="flex-1 h-[2px] overflow-hidden"
                  style={{ background: "rgba(13,27,42,0.08)" }}
                >
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${strength.level * 25}%`,
                      background: L.amber,
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: L.inkMuted,
                  }}
                >
                  {strength.label}
                </span>
              </div>
            )}
          </Field>

          <Field label="Confirm password" error={errors.confirmPassword}>
            <input
              className={authInputClass}
              type={showConfirmPw ? "text" : "password"}
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={(e) =>
                setForm((p) => ({ ...p, confirmPassword: e.target.value }))
              }
              onBlur={() =>
                setTouched((p) => ({ ...p, confirmPassword: true }))
              }
              placeholder="Re-enter password"
              style={{ color: L.ink, paddingRight: 32 }}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPw((s) => !s)}
              className="absolute right-0 top-1/2 -translate-y-1/2"
              style={{ color: L.inkMuted }}
              aria-label="Toggle password visibility"
            >
              {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </Field>

          {error && <AuthError>{error}</AuthError>}

          <AuthPrimaryButton disabled={!canSubmit || loading}>
            {loading ? "Creating account…" : (
              <>
                Create workspace
                <ArrowRight size={15} />
              </>
            )}
          </AuthPrimaryButton>
        </form>
      )}
    </AuthLayout>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <AuthLabel>{label}</AuthLabel>
      <AuthInputWrap>{children}</AuthInputWrap>
      {error && (
        <p
          className="mt-1.5"
          style={{ fontSize: 11.5, color: "#A23A2C", letterSpacing: "0.02em" }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
