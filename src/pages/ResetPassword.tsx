import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, ArrowRight, CheckCircle } from "lucide-react";
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

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);

  // Supabase places a recovery session via the hash fragment when the user
  // clicks the email link. Wait for that session to be active before allowing
  // a new password to be set.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
          setReady(true);
        }
      }
    );
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const canSubmit =
    ready && password.length >= 8 && password === confirm && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError("");

    const { error: err } = await supabase.auth.updateUser({ password });

    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      setDone(true);
      setTimeout(() => navigate("/sign-in", { replace: true }), 2200);
    }
  };

  return (
    <AuthLayout
      eyebrow="New password"
      narrative={<>Set a new password and continue your work.</>}
      supporting={
        <>
          Choose something memorable but strong — at least 8 characters. Your
          brand memory, saved work and workspace stay exactly as you left them.
        </>
      }
      formTitle={done ? "Password updated" : "Choose a new password"}
      formSubtitle={
        done
          ? "Redirecting you to sign in…"
          : ready
          ? "Pick a strong password to secure your account."
          : "Open the link from your email to continue."
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
      {done ? (
        <div className="flex flex-col items-start gap-4">
          <CheckCircle size={28} style={{ color: L.amber }} />
          <p style={{ fontSize: 14, color: L.inkSoft, lineHeight: 1.65 }}>
            Your password has been updated. You can now sign in with your new
            credentials.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div>
            <AuthLabel>New password</AuthLabel>
            <AuthInputWrap>
              <input
                className={authInputClass}
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                style={{ color: L.ink, paddingRight: 32 }}
                disabled={!ready}
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
            </AuthInputWrap>
          </div>

          <div>
            <AuthLabel>Confirm password</AuthLabel>
            <AuthInputWrap>
              <input
                className={authInputClass}
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter password"
                style={{ color: L.ink }}
                disabled={!ready}
              />
            </AuthInputWrap>
            {confirm && confirm !== password && (
              <p
                className="mt-1.5"
                style={{ fontSize: 11.5, color: "#A23A2C" }}
              >
                Passwords do not match
              </p>
            )}
          </div>

          {error && <AuthError>{error}</AuthError>}

          <AuthPrimaryButton disabled={!canSubmit}>
            {loading ? "Updating…" : (
              <>
                Update password
                <ArrowRight size={15} />
              </>
            )}
          </AuthPrimaryButton>
        </form>
      )}
    </AuthLayout>
  );
}
