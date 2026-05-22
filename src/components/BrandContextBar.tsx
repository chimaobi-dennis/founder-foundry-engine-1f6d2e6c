import { useBrand } from "@/contexts/BrandContext";
import { ChevronDown, Check, Plus } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";

export function BrandContextBar() {
  const { brands, activeBrand, switchBrand, createNewBrand, isLoading } = useBrand();
  const [open, setOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Update dropdown position when opening
  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
      });
    }
  }, [open]);

  // Close on click outside - but not when clicking inside the portal dropdown
  const dropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      // Don't close if clicking inside the bar or inside the portal dropdown
      if (ref.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    if (open) {
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }
  }, [open]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    if (open) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [open]);

  const BRAND_SCOPED_MODULES = new Set([
    "mentor",
    "pro-studio",
    "content-studio",
    "content-calendar",
    "doc-studio",
    "reel-builder",
    "library",
    "brand-dna",
  ]);

  const handleSwitchBrand = async (brandId: string) => {
    await switchBrand(brandId);
    setOpen(false);

    // Preserve the current module segment and replace/append the brandId.
    // Never drop the module name (was causing /{brandId} 404s).
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const moduleSegment = pathSegments[0];
    if (moduleSegment && BRAND_SCOPED_MODULES.has(moduleSegment)) {
      navigate(`/${moduleSegment}/${brandId}`, { replace: true });
    }
  };

  const handleCreateBrand = async () => {
    const newBrand = await createNewBrand('Untitled Project');
    if (newBrand) {
      setOpen(false);
      navigate('/mentor?mode=idea');
    }
  };

  if (isLoading) {
    return (
    <div className="h-10 flex items-center px-4 md:px-6 bg-background border-b border-border text-[12px] font-ui text-muted-foreground flex-shrink-0">
        <span className="text-[11px] font-ui text-muted-foreground mr-2">Working on:</span>
        <div className="w-16 h-4 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  if (!activeBrand) {
    return (
      <div className="h-10 flex items-center px-4 md:px-6 bg-background border-b border-border text-[12px] font-ui text-muted-foreground flex-shrink-0">
        <span className="text-[11px] font-ui text-muted-foreground mr-2">Working on:</span>
        <button
          onClick={handleCreateBrand}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-card hover:border-card-border-hover transition-colors duration-200"
        >
          <Plus size={12} className="text-muted-foreground" />
          <span className="text-[12px] font-ui text-muted-foreground">No project yet</span>
        </button>
      </div>
    );
  }

  return (
    <div className="h-10 flex items-center px-4 md:px-6 bg-background border-b border-border flex-shrink-0" ref={ref}>
      <span className="text-[11px] font-ui text-muted-foreground mr-2">Working on:</span>
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-card hover:border-card-border-hover transition-colors duration-200"
      >
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: activeBrand.primary_color }}
        />
        <span key={activeBrand.name} className="text-[12px] font-ui text-foreground animate-name-fade">{activeBrand.name}</span>
        <ChevronDown size={12} className="text-muted-foreground" />
      </button>

      {/* Portal dropdown - renders at document root to escape all containers */}
      {open && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[1000] w-[220px] rounded-xl bg-card border border-card-border shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
          style={{
            top: dropdownPos.top,
            left: dropdownPos.left,
          }}
        >
          <div className="py-1">
            {brands.map((brand) => (
              <button
                key={brand.id}
                onClick={() => handleSwitchBrand(brand.id)}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-ui text-foreground hover:bg-muted/50 transition-colors duration-200 text-left"
              >
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: brand.primary_color }}
                />
                <span className="flex-1">{brand.name}</span>
                {activeBrand?.id === brand.id && <Check size={14} className="text-primary" />}
              </button>
            ))}
          </div>
          <div className="border-t border-border">
            <button
              onClick={handleCreateBrand}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-[12px] font-ui text-primary hover:bg-muted/50 transition-colors duration-200 text-left"
            >
              <Plus size={14} />
              New project
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
