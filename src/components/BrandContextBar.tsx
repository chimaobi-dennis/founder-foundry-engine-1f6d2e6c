import { useBrand } from "@/contexts/BrandContext";
import { ChevronDown, Check, Plus } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export function BrandContextBar() {
  const { brands, activeBrand, switchBrand, createNewBrand, isLoading } = useBrand();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleCreateBrand = async () => {
    const newBrand = await createNewBrand('Untitled Brand');
    if (newBrand) {
      setOpen(false);
      navigate('/mentor?mode=idea');
    }
  };

  if (isLoading) {
    return (
      <div className="h-10 flex items-center px-4 md:px-6 bg-muted/30 border-b border-border text-[12px] font-ui text-muted-foreground flex-shrink-0">
        <span className="text-[11px] font-ui text-muted-foreground mr-2">Working on:</span>
        <div className="w-16 h-4 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  if (!activeBrand) {
    return (
      <div className="h-10 flex items-center px-4 md:px-6 bg-muted/30 border-b border-border text-[12px] font-ui text-muted-foreground flex-shrink-0">
        <span className="text-[11px] font-ui text-muted-foreground mr-2">Working on:</span>
        <button
          onClick={handleCreateBrand}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-card hover:border-card-border-hover transition-colors duration-200"
        >
          <Plus size={12} className="text-muted-foreground" />
          <span className="text-[12px] font-ui text-muted-foreground">No brand yet</span>
        </button>
      </div>
    );
  }

  return (
    <div className="h-10 flex items-center px-4 md:px-6 bg-muted/30 border-b border-border flex-shrink-0" ref={ref}>
      <span className="text-[11px] font-ui text-muted-foreground mr-2">Working on:</span>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-card hover:border-card-border-hover transition-colors duration-200"
      >
        <div 
          className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
          style={{ backgroundColor: activeBrand.primary_color }}
        />
        <span className="text-[12px] font-ui text-foreground">{activeBrand.name}</span>
        <ChevronDown size={12} className="text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute top-[calc(100%+4px)] left-4 md:left-6 w-[220px] rounded-xl bg-card border border-card-border shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="py-1">
            {brands.map((brand) => (
              <button
                key={brand.id}
                onClick={async () => { 
                  await switchBrand(brand.id); 
                  setOpen(false); 
                }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-ui text-foreground hover:bg-muted/50 transition-colors duration-200"
              >
                <div 
                  className="w-3 h-3 rounded-full flex-shrink-0" 
                  style={{ backgroundColor: brand.primary_color }}
                />
                <span className="flex-1 text-left">{brand.name}</span>
                {activeBrand?.id === brand.id && <Check size={14} className="text-primary" />}
              </button>
            ))}
          </div>
          <div className="border-t border-border">
            <button 
              onClick={handleCreateBrand}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-[12px] font-ui text-primary hover:bg-muted/50 transition-colors duration-200"
            >
              + New brand
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
