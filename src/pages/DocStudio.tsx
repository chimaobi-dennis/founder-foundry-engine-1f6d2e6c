import { useState } from "react";
import { useBrand } from "@/hooks/use-brand";
import { useBrandUrlSync } from "@/hooks/use-brand-url-sync";
import { DocHome } from "@/components/docstudio/DocHome";
import { DocBrief } from "@/components/docstudio/DocBrief";
import { DocPreview } from "@/components/docstudio/DocPreview";

export type DocType =
  | "Pitch Deck"
  | "Client Proposal"
  | "One-Pager"
  | "Rate Card"
  | "Case Study"
  | "Project Brief"
  | "Invoice Cover Letter"
  | "Partnership Proposal";

const DocStudio = () => {
  const { activeBrand } = useBrand();
  const [state, setState] = useState<"home" | "brief" | "preview">("home");
  const [selectedType, setSelectedType] = useState<DocType>("One-Pager");
  const [loading, setLoading] = useState(false);

  const handleSelectType = (type: DocType) => {
    setSelectedType(type);
    setState("brief");
  };

  const handleGenerate = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setState("preview");
    }, 1500);
  };

  const handleOpenRecent = () => {
    setState("preview");
  };

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {state === "home" ? (
          <DocHome
            brandName={activeBrand?.name || "Roast & Co"}
            onSelectType={handleSelectType}
            onOpenRecent={handleOpenRecent}
          />
        ) : state === "brief" ? (
          <DocBrief
            docType={selectedType}
            onBack={() => setState("home")}
            onGenerate={handleGenerate}
            loading={loading}
          />
        ) : (
          <DocPreview
            docType={selectedType}
            onBackToHome={() => setState("home")}
            onEditBrief={() => setState("brief")}
          />
        )}
      </div>
    </div>
  );
};

export default DocStudio;
