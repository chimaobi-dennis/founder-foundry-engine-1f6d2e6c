import { useState } from "react";
import { useBrand } from "@/hooks/use-brand";
import { useBrandUrlSync } from "@/hooks/use-brand-url-sync";
import { ReelHome } from "@/components/reelbuilder/ReelHome";
import { ReelBrief } from "@/components/reelbuilder/ReelBrief";
import { ReelStoryboard } from "@/components/reelbuilder/ReelStoryboard";

export type ReelPlatform = "Instagram Reels" | "TikTok" | "YouTube Shorts" | "Facebook Reels";

const ReelBuilder = () => {
  const { activeBrand } = useBrand();
  const [state, setState] = useState<"home" | "brief" | "storyboard">("home");
  const [loading, setLoading] = useState(false);
  const [briefPrefill, setBriefPrefill] = useState<{ topic?: string; tone?: string }>({});

  const handleNewReel = () => {
    setBriefPrefill({});
    setState("brief");
  };

  const handleOpenRecent = () => setState("storyboard");

  const handleBuild = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setState("storyboard");
    }, 1500);
  };

  const handleUseTemplate = (topic: string, tone: string) => {
    setBriefPrefill({ topic, tone });
    setState("brief");
  };

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {state === "home" ? (
          <ReelHome
            brandName={activeBrand?.name || "Roast & Co"}
            onNewReel={handleNewReel}
            onOpenRecent={handleOpenRecent}
            onUseTemplate={handleUseTemplate}
          />
        ) : state === "brief" ? (
          <ReelBrief
            onBack={() => setState("home")}
            onBuild={handleBuild}
            loading={loading}
            initialTopic={briefPrefill.topic}
            initialTone={briefPrefill.tone}
          />
        ) : (
          <ReelStoryboard
            onBackToHome={() => setState("home")}
            onEditBrief={() => setState("brief")}
          />
        )}
      </div>
    </div>
  );
};

export default ReelBuilder;
