import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Mail, CheckCircle } from "lucide-react";
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

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const initialEmail = params.get("email") ?? "";
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || cooldown > 0) return;
    setLoading(true);
    setError("");
    setSent(false);

    const { error: err } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/home`,
      },
    });

    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      setSent(true);
      setCooldown(45);
    }
  };

  return (
    <AuthLayout
      eyebrow="Verify email"
      narrative={<>One last step before your workspace opens.</>}
      supporting={
        <>
          We've sent a confirmation link to your email. Click it to activate
          your Kinika account. If it didn't arrive within a couple of minutes,
          check spam — or resend it below.
        </>
      }
      formTitle="Confirm your email"
      formSubtitle={
        sent
          ? "A new confirmation link is on its way."
          : "Verify your inbox to continue."
      }
      footer={
        <>
          Already verified?{" "}
          <Link
            to="/sign-in"
            className="hover:underline underline-offset-4"
            style={{ color: L.ink, fontWeight: 500 }}
          >
            Sign in
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex items-start gap-3">
          {sent ? (
            <CheckCircle size={26} style={{ color: L.amber }} />
          ) : (
            <Mail size={26} style={{ color: L.amber }} />
          )}
          <p style={{ fontSize: 14, color: L.inkSoft, lineHeight: 1.65 }}>
            {sent
              ? "Check your inbox for a fresh confirmation link. It expires in 24 hours."
              : "Click the link in the email we sent to activate your account. Need another one?"}
          </p>
        </div>

        <form onSubmit={handleResend} className="flex flex-col gap-6">
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

          <AuthPrimaryButton disabled={!email.trim() || loading || cooldown > 0}>
            {loading
              ? "Sending…"
              : cooldown > 0
              ? `Resend in ${cooldown}s`
              : "Resend confirmation email"}
          </AuthPrimaryButton>
        </form>
      </div>
    </AuthLayout>
  );
}
