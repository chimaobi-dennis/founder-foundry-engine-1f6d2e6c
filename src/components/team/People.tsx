import { useEffect, useState } from "react";
import { Users, Plus, Loader2, Copy, Trash2, Crown, Clock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listMembers, inviteMember, setMemberRole, removeMember, inviteLink, ROLE_LABEL, type BrandMember, type BrandRole } from "@/services/teamMembersService";

/**
 * Who is in the workspace. Owners invite by email and get a link to send
 * (no email delivery yet); the invitee signs in with that email and lands on
 * /invite/<token>. Members share the owner's credit pool and plan limits.
 */
export function PeopleSection({ brandId, userId, myRole, ownerName, memberLimit, onChanged }: {
  brandId: string;
  userId: string;
  myRole: BrandRole | null;
  ownerName: string;
  /** -1 unlimited; includes the owner */
  memberLimit: number;
  onChanged?: () => void;
}) {
  const [members, setMembers] = useState<BrandMember[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [busy, setBusy] = useState<string | null>(null);
  const [lastLink, setLastLink] = useState<string | null>(null);
  const isOwner = myRole === "owner";

  const reload = async () => { setMembers(await listMembers(brandId)); setLoaded(true); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, [brandId]);

  const copy = (link: string) => navigator.clipboard?.writeText(link).then(() => toast("Invite link copied")).catch(() => toast.error("Copy failed; select the link and copy it"));

  const invite = async () => {
    setBusy("invite");
    const r = await inviteMember(brandId, email, role, userId);
    setBusy(null);
    if (!r.success) { toast.error(r.error ?? "Could not invite"); return; }
    setEmail("");
    setLastLink(r.link ?? null);
    toast("Invited. Send them the link.");
    await reload();
    onChanged?.();
  };

  if (!loaded) return null;
  const used = 1 + members.length;
  const full = memberLimit >= 0 && used >= memberLimit;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-muted-foreground" />
          <h2 className="font-ui text-[11px] uppercase tracking-[0.16em] text-muted-foreground">People</h2>
          <span className="font-ui text-[11px] text-muted-foreground">· {used}{memberLimit >= 0 ? `/${memberLimit}` : ""}</span>
        </div>
      </div>

      <div className="grid gap-2">
        <div className="rounded-lg border border-border/60 bg-card/30 px-4 py-2.5 flex items-center gap-3">
          <Crown size={14} className="text-primary" />
          <div className="min-w-0 flex-1">
            <p className="font-ui text-[13px] text-foreground truncate">{ownerName}</p>
            <p className="font-ui text-[11px] text-muted-foreground">Owner · pays the plan and holds the credit pool</p>
          </div>
        </div>
        {members.map((m) => (
          <div key={m.id} className="rounded-lg border border-border/60 bg-card/30 px-4 py-2.5 flex items-center gap-3 flex-wrap">
            {m.status === "invited" ? <Clock size={14} className="text-amber-500" /> : <Users size={14} className="text-muted-foreground" />}
            <div className="min-w-0 flex-1">
              <p className="font-ui text-[13px] text-foreground truncate">{m.profile?.full_name || m.email}{m.profile?.full_name ? <span className="text-muted-foreground"> · {m.email}</span> : null}</p>
              <p className="font-ui text-[11px] text-muted-foreground">{m.status === "invited" ? "Invited, not joined yet" : ROLE_LABEL[m.role].blurb}</p>
            </div>
            {isOwner ? (
              <div className="flex items-center gap-2">
                <select value={m.role} onChange={async (e) => { setBusy(m.id); await setMemberRole(m.id, e.target.value as "editor" | "viewer"); setBusy(null); reload(); }} disabled={busy === m.id} className="h-8 rounded-md border border-input bg-background px-2 text-[12px] font-ui">
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
                {m.status === "invited" && (
                  <button onClick={() => copy(inviteLink(m))} className="inline-flex items-center gap-1 text-[12px] font-ui text-muted-foreground hover:text-foreground"><Copy size={12} /> link</button>
                )}
                <button onClick={async () => { setBusy(m.id); if (await removeMember(m.id)) toast(`${m.email} removed`); setBusy(null); reload(); onChanged?.(); }} disabled={busy === m.id} className="text-muted-foreground hover:text-destructive" aria-label={`Remove ${m.email}`}><Trash2 size={13} /></button>
              </div>
            ) : (
              <span className="font-ui text-[11px] text-muted-foreground">{ROLE_LABEL[m.role].name}</span>
            )}
          </div>
        ))}
      </div>

      {isOwner && (
        <div className="mt-3 rounded-lg border border-dashed border-border/70 p-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_140px_auto] gap-2 items-end">
            <div>
              <Label htmlFor="invite-email" className="text-[12px]">Invite by email</Label>
              <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@company.com" className="mt-1" disabled={full} />
            </div>
            <div>
              <Label htmlFor="invite-role" className="text-[12px]">Role</Label>
              <select id="invite-role" value={role} onChange={(e) => setRole(e.target.value as "editor" | "viewer")} className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-[13px] font-ui" disabled={full}>
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <button onClick={invite} disabled={busy === "invite" || !email.trim() || full} className={cn("inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-ui font-medium disabled:opacity-50", "bg-primary text-primary-foreground")}>
              {busy === "invite" ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Invite
            </button>
          </div>
          <p className="font-ui text-[11px] text-muted-foreground mt-2">
            {full ? `Your plan includes ${memberLimit} ${memberLimit === 1 ? "person" : "people"}. Add a member seat on Billing to invite more.` : "Editors give tasks and approve work; viewers only look. Everyone shares your credits. You'll get a link to send; there's no email yet."}
          </p>
          {lastLink && (
            <div className="mt-2 flex items-center gap-2 min-w-0">
              <code className="truncate bg-muted/60 rounded px-1.5 py-0.5 text-[11px]">{lastLink}</code>
              <button onClick={() => copy(lastLink)} className="inline-flex items-center gap-1 shrink-0 text-[12px] font-ui text-muted-foreground hover:text-foreground"><Copy size={11} /> copy</button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default PeopleSection;
