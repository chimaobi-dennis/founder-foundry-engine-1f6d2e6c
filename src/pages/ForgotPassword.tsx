import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Mail } from "lucide-react";
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

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");

    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);
    if (err) setError(err.message);
    else setSent(true);
  };

  return (
    <AuthLayout
      eyebrow="Reset access"
      narrative={<>A short pause. Then back to your workspace.</>}
      supporting={
        <>
          Enter the email tied to your Kinika account and we'll send you a
          secure link to set a new password. Your business context, brand
          memory and saved work remain exactly where you left them.
        </>
      }
      formTitle={sent ? "Check your inbox" : "Forgot password"}
      formSubtitle={
        sent
          ? "If an account exists for this email, you'll receive a reset link shortly."
          : "We'll send a one-time reset link to your email."
      }
      footer={
        <>
          Remembered it?{" "}
          <Link
            to="/sign-in"
            className="hover:underline underline-offset-4"
            style={{ color: L.ink, fontWeight: 500 }}
          >
            Back to sign in
          </Link>
        </>
      }
    >
      {sent ? (
        <div className="flex flex-col items-start gap-4">
          <Mail size={26} style={{ color: L.amber }} />
          <p style={{ fontSize: 14, color: L.inkSoft, lineHeight: 1.65 }}>
            The link expires in 30 minutes. If it doesn't arrive within a few
            minutes, check your spam folder or try again.
          </p>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="text-[12px] hover:underline underline-offset-4"
            style={{ color: L.inkSoft }}
          >
            Try a different email
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div>
            <AuthLabel>Email</AuthLabel>
            <AuthInputWrap>
              <input
                className={authInputClass}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                style={{ color: L.ink }}
              />
            </AuthInputWrap>
          </div>

          {error && <AuthError>{error}</AuthError>}

          <AuthPrimaryButton disabled={!email.trim() || loading}>
            {loading ? "Sending link…" : (
              <>
                Send reset link
                <ArrowRight size={15} />
              </>
            )}
          </AuthPrimaryButton>
        </form>
      )}
    </AuthLayout>
  );
}
