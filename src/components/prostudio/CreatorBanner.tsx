import { Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useProfile } from "@/hooks/use-profile";

export function CreatorBanner() {
  const navigate = useNavigate();
  const { profile } = useProfile();

  // Only show for founders
  if (!profile || profile.role !== "founder") return null;

  return (
    <div className="mt-8 h-14 rounded-xl border border-border bg-card px-5 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <Sparkles size={16} className="text-primary flex-shrink-0" />
        <span className="text-[13px] font-ui text-muted-foreground">
          Are you a prompt engineer? Publish your templates and reach thousands of founders.
        </span>
      </div>
      <button
        onClick={() => navigate("/creator/apply")}
        className="text-[13px] font-ui text-primary hover:underline whitespace-nowrap flex-shrink-0"
      >
        Apply to become a creator →
      </button>
    </div>
  );
}
