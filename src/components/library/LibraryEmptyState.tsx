import { Folder } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export function LibraryEmptyState() {
  const navigate = useNavigate();

  return (
    <div className="flex-1 flex flex-col items-center justify-center py-24 px-6">
      <div className="w-[60px] h-[60px] rounded-xl border-2 border-muted-foreground/30 flex items-center justify-center mb-4">
        <Folder size={28} className="text-muted-foreground/40" />
      </div>
      <h2 className="font-display text-lg text-foreground">No assets found</h2>
      <p className="text-[13px] font-ui text-muted-foreground mt-2 text-center max-w-xs">
        Assets you create in ProStudio, DocStudio and ReelBuilder will appear here.
      </p>
      <Button onClick={() => navigate("/pro-studio")} className="mt-5 rounded-lg text-[13px]">
        Create in ProStudio
      </Button>
    </div>
  );
}
