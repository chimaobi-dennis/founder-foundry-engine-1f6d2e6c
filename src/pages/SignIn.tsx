import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
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

export default function SignIn() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = !!form.email.trim() && !!form.password;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError("");

    const { error: err } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    });

    setLoading(false);
    if (err) {
      if (err.message.includes("Invalid login")) {
        setError("Those credentials don't match an account.");
      } else if (err.message.includes("Email not confirmed")) {
        setError("Please confirm your email address before signing in.");
      } else {
        setError(err.message);
      }
    } else {
      navigate("/home");
    }
  };

  return (
    <AuthLayout
      eyebrow="Sign in"
      narrative={<>Your business context, ready when you return.</>}
      supporting={
        <>
          Kinika holds the connective tissue across your content, documents,
          strategy and creative workflows — so nothing has to be re-explained.
          Sign in to continue where your operating layer left off.
        </>
      }
      annotation={
        <div className="grid grid-cols-3 gap-6 max-w-md">
          {[
            { k: "01", v: "One shared context" },
            { k: "02", v: "Connected workflows" },
            { k: "03", v: "Calmer operations" },
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
      formTitle="Welcome back"
      formSubtitle="Continue to your workspace."
      footer={
        <>
          New to Kinika?{" "}
          <Link
            to="/sign-up"
            className="underline-offset-4 hover:underline"
            style={{ color: L.ink, fontWeight: 500 }}
          >
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div>
          <AuthLabel>Email</AuthLabel>
          <AuthInputWrap>
            <input
              className={authInputClass}
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              placeholder="you@company.com"
              style={{ color: L.ink }}
            />
          </AuthInputWrap>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <AuthLabel>Password</AuthLabel>
            <Link
              to="/forgot-password"
              className="text-[11px] tracking-[0.04em] hover:underline underline-offset-4"
              style={{ color: L.inkSoft, marginBottom: 8 }}
            >
              Forgot?
            </Link>
          </div>
          <AuthInputWrap>
            <input
              className={authInputClass}
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              value={form.password}
              onChange={(e) =>
                setForm((p) => ({ ...p, password: e.target.value }))
              }
              placeholder="Your password"
              style={{ color: L.ink, paddingRight: 32 }}
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              className="absolute right-0 top-1/2 -translate-y-1/2 transition-colors"
              style={{ color: L.inkMuted }}
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </AuthInputWrap>
        </div>

        {error && <AuthError>{error}</AuthError>}

        <AuthPrimaryButton disabled={!canSubmit || loading}>
          {loading ? "Signing in…" : (
            <>
              Enter Kinika
              <ArrowRight size={15} />
            </>
          )}
        </AuthPrimaryButton>
      </form>
    </AuthLayout>
  );
}
