import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function SignIn() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = form.email.trim() && form.password;

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
        setError("Incorrect email or password.");
      } else if (err.message.includes("Email not confirmed")) {
        setError("Please confirm your email address before signing in. Check your inbox.");
      } else {
        setError(err.message);
      }
    } else {
      navigate("/home");
    }
  };

  const inputClass = "w-full h-[44px] rounded-lg border-[0.5px] border-[#2A3A4A] dark:bg-[#0D1B2A] bg-[#F9F6F1] px-3.5 text-sm font-ui text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-[90%] max-w-[420px] rounded-2xl border-[0.5px] border-[#2A3A4A] dark:bg-[#1A2A3A] bg-white p-10">
        <div className="text-center mb-6">
          <h1 className="font-display text-[28px] text-primary">FounderForge</h1>
          <p className="font-ui text-[13px] text-muted-foreground mt-1">Your AI brand partner</p>
        </div>
        <h2 className="font-display text-[22px] text-foreground mb-5">Welcome back</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-[11px] font-ui uppercase tracking-[0.08em] text-muted-foreground mb-1.5">Email</label>
            <input className={inputClass} type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="you@example.com" />
          </div>

          <div>
            <label className="block text-[11px] font-ui uppercase tracking-[0.08em] text-muted-foreground mb-1.5">Password</label>
            <div className="relative">
              <input className={inputClass} type={showPw ? "text" : "password"} value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="Your password" />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <div className="flex justify-end mt-1.5">
              <span className="text-[12px] font-ui text-primary cursor-pointer hover:underline">Forgot password?</span>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2.5 text-[13px] font-ui text-destructive">{error}</div>
          )}

          <button type="submit" disabled={!canSubmit || loading} className="w-full h-12 rounded-lg bg-primary text-primary-foreground font-ui text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2 transition-colors">
            {loading ? <><span className="h-2.5 w-2.5 rounded-full bg-current/40 animate-pulse" /> Signing in...</> : "Sign in"}
          </button>
        </form>

        <p className="text-center font-ui text-[13px] text-muted-foreground mt-5">
          Don't have an account?{" "}
          <Link to="/sign-up" className="text-primary hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
