import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, Users, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useBrand } from "@/hooks/use-brand";
import { acceptInvite, type AcceptResult } from "@/services/teamMembersService";

/**
 * /invite/:token — joins the signed-in user to a workspace. AuthGuard sends
 * anonymous visitors to sign in first and remembers this path so they land
 * back here afterwards.
 */
export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const { user } = useAuth();
  const { refreshBrands, switchBrand } = useBrand();
  const navigate = useNavigate();
  const [result, setResult] = useState<AcceptResult | null>(null);

  useEffect(() => {
    if (!token || !user?.id) return;
    let active = true;
    acceptInvite(token).then(async (r) => {
      if (!active) return;
      setResult(r);
      if (r.success && r.brand_id) {
        try {
          await refreshBrands();
          await switchBrand(r.brand_id);
        } catch { /* brand list refresh is best-effort */ }
        setTimeout(() => navigate("/team", { replace: true }), 1200);
      }
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.id]);

  const message = !result
    ? "Joining the workspace…"
    : result.success
      ? `You're ${result.already ? "already " : ""}in ${result.brand_name ?? "the workspace"} as ${result.role}. Taking you to the team.`
      : result.error === "EMAIL_MISMATCH"
        ? `This invite was sent to ${result.invited_email}. Sign in with that email to accept it.`
        : result.error === "INVITE_NOT_FOUND"
          ? "This invite link is no longer valid. Ask the workspace owner for a new one."
          : result.error === "OWNER_CANNOT_JOIN"
            ? "You own this workspace already."
            : result.error ?? "Could not accept the invite.";

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-xl border border-card-border bg-card/60 p-8 text-center space-y-3">
        {!result ? <Loader2 className="mx-auto animate-spin text-muted-foreground" size={22} /> : result.success ? <Users className="mx-auto text-primary" size={22} /> : <AlertTriangle className="mx-auto text-amber-500" size={22} />}
        <h1 className="font-display text-2xl text-foreground">{result?.success ? "Welcome aboard" : "Workspace invite"}</h1>
        <p className="font-ui text-[13px] text-muted-foreground">{message}</p>
        {result && !result.success && (
          <button onClick={() => navigate("/home")} className="font-ui text-[12px] text-primary underline">Go to Home</button>
        )}
      </div>
    </div>
  );
}
