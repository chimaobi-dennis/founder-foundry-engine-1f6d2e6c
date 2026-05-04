import { useEffect, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useBrand } from "@/hooks/use-brand";

/**
 * Syncs the :brandId URL param with the active brand in BrandContext.
 * - If URL has brandId: switch active brand to it (validating ownership)
 * - If URL has no brandId: redirect to same path with active brand appended
 * - If brandId is invalid: redirect to /home with toast
 *
 * @param basePath e.g. "/library", "/brand-dna"
 */
export function useBrandUrlSync(basePath: string, options?: { skipSearchParam?: string }) {
  const { brandId } = useParams<{ brandId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { brands, activeBrand, switchBrand, isLoading } = useBrand();
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (options?.skipSearchParam && new URLSearchParams(location.search).has(options.skipSearchParam)) return;

    const pathBrandId = location.pathname.startsWith(`${basePath}/`)
      ? location.pathname.split("/").filter(Boolean).at(-1)
      : undefined;
    const currentBrandId = brandId || pathBrandId;

    // No brandId in URL → append active brand
    if (!currentBrandId) {
      if (activeBrand?.id) {
        navigate(`${basePath}/${activeBrand.id}${location.search}`, { replace: true });
      }
      return;
    }

    if (handledRef.current === currentBrandId) return;

    // Validate brandId belongs to user
    const found = brands.find((b) => b.id === currentBrandId);
    if (!found) {
      if (brands.length === 0) return; // brands not loaded yet
      toast.error("Brand not found");
      navigate("/home", { replace: true });
      return;
    }

    handledRef.current = currentBrandId;

    // Switch active brand if URL differs
    if (activeBrand?.id !== currentBrandId) {
      switchBrand(currentBrandId);
    }
  }, [brandId, brands, activeBrand?.id, isLoading, basePath, navigate, switchBrand, location.pathname, location.search, options?.skipSearchParam]);
}
