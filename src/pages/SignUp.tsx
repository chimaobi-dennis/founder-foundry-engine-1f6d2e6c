import { useState } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff, CheckCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

function getStrength(pw: string): { level: number; label: string; color: string } {
  if (!pw) return { level: 0, label: "", color: "" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const map: Record<number, { label: string; color: string }> = {
    0: { label: "Weak", color: "bg-red-500" },
    1: { label: "Weak", color: "bg-red-500" },
    2: { label: "Fair", color: "bg-primary" },
    3: { label: "Good", color: "bg-blue-500" },
    4: { label: "Strong", color: "bg-green-500" },
  };
  return { level: score, ...map[score] };
}

export default function SignUp() {
  const [form, setForm] = useState({ fullName: "", email: "", password: "", confirmPassword: "" });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const errors: Record<string, string> = {};
  if (touched.fullName && !form.fullName.trim()) errors.fullName = "Required";
  if (touched.email && !form.email.trim()) errors.email = "Required";
  else if (touched.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = "Invalid email format";
  if (touched.password && !form.password) errors.password = "Required";
  else if (touched.password && form.password.length < 8) errors.password = "Minimum 8 characters";
  if (touched.confirmPassword && form.confirmPassword !== form.password) errors.confirmPassword = "Passwords do not match";

  const strength = getStrength(form.password);
  const canSubmit = form.fullName.trim() && form.email.trim() && form.password.length >= 8 && form.confirmPassword === form.password;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError("");

    const { error: err } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.fullName } },
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
    }
  };

  const inputClass = "w-full h-[44px] rounded-lg border-[0.5px] border-[#2A3A4A] dark:bg-[#0D1B2A] bg-[#F9F6F1] px-3.5 text-sm font-ui text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-[90%] max-w-[420px] rounded-2xl border-[0.5px] border-[#2A3A4A] dark:bg-[#1A2A3A] bg-white p-10">
        {success ? (
          <div className="flex flex-col items-center text-center gap-3">
            <CheckCircle size={48} className="text-green-500" />
            <h2 className="font-display text-xl text-foreground">Account created</h2>
            <p className="font-ui text-[13px] text-muted-foreground">Check your email to confirm your account, then sign in.</p>
            <Link to="/sign-in" className="font-ui text-sm text-primary hover:underline mt-2">Go to sign in →</Link>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <h1 className="font-display text-[28px] text-primary">FounderForge</h1>
              <p className="font-ui text-[13px] text-muted-foreground mt-1">Your AI brand partner</p>
            </div>
            <h2 className="font-display text-[22px] text-foreground mb-5">Create your account</h2>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Field label="Full name" error={errors.fullName}>
                <input className={inputClass} value={form.fullName} onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))} onBlur={() => setTouched(p => ({ ...p, fullName: true }))} placeholder="Your full name" />
              </Field>

              <Field label="Email" error={errors.email}>
                <input className={inputClass} type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} onBlur={() => setTouched(p => ({ ...p, email: true }))} placeholder="you@example.com" />
              </Field>

              <Field label="Password" error={errors.password}>
                <div className="relative">
                  <input className={inputClass} type={showPw ? "text" : "password"} value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} onBlur={() => setTouched(p => ({ ...p, password: true }))} placeholder="Min 8 characters" />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {form.password && (
                  <div className="mt-2">
                    <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${strength.color}`} style={{ width: `${strength.level * 25}%` }} />
                    </div>
                    <p className="text-[11px] text-muted-foreground text-right mt-1">{strength.label}</p>
                  </div>
                )}
              </Field>

              <Field label="Confirm password" error={errors.confirmPassword}>
                <div className="relative">
                  <input className={inputClass} type={showConfirmPw ? "text" : "password"} value={form.confirmPassword} onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))} onBlur={() => setTouched(p => ({ ...p, confirmPassword: true }))} placeholder="Re-enter password" />
                  <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showConfirmPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </Field>

              {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2.5 text-[13px] font-ui text-destructive">{error}</div>
              )}

              <button type="submit" disabled={!canSubmit || loading} className="w-full h-12 rounded-lg bg-primary text-primary-foreground font-ui text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2 transition-colors">
                {loading ? <><span className="h-2.5 w-2.5 rounded-full bg-current/40 animate-pulse" /> Creating account...</> : "Create account"}
              </button>
            </form>

            <p className="text-center font-ui text-[13px] text-muted-foreground mt-5">
              Already have an account?{" "}
              <Link to="/sign-in" className="text-primary hover:underline">Sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-ui uppercase tracking-[0.08em] text-muted-foreground mb-1.5">{label}</label>
      {children}
      {error && <p className="text-[11px] font-ui text-destructive mt-1">{error}</p>}
    </div>
  );
}
