import { useState } from "react";
import { useBrand } from "@/hooks/use-brand";
import { useBrandUrlSync } from "@/hooks/use-brand-url-sync";
import { PhysicalProductTab } from "@/components/prostudio/PhysicalProductTab";
import { DigitalProductTab } from "@/components/prostudio/DigitalProductTab";
import { cn } from "@/lib/utils";

const tabs = ["Physical Product", "Digital Product"] as const;
type Tab = typeof tabs[number];

const ProStudio = () => {
  useBrandUrlSync('/pro-studio');
  const [activeTab, setActiveTab] = useState<Tab>("Physical Product");
  const { activeBrand } = useBrand();

  return (
    <div className="flex flex-col min-h-0 flex-1">
      {/* Sticky tab bar */}
      <div className="sticky top-[96px] md:top-10 z-[9] bg-background border-b border-border flex-shrink-0">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-5 py-3 text-[13px] font-ui font-medium transition-colors relative",
                activeTab === tab
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content — scrollable region */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-6">
          {activeTab === "Physical Product" ? (
            <PhysicalProductTab brandId={activeBrand?.id || "1"} brandName={activeBrand?.name || ""} brandColor={activeBrand?.primary_color || "bg-primary"} />
          ) : (
            <DigitalProductTab brandId={activeBrand?.id || "1"} brandName={activeBrand?.name || ""} brandColor={activeBrand?.primary_color || "bg-primary"} />
          )}
        </div>
      </div>
    </div>
  );
};

export default ProStudio;
