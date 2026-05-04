import { useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
export function useBrandUrlSync(basePath: string) {
  const { brandId } = useParams<{ brandId?: string }>();
  const navigate = useNavigate();
  const { brands, activeBrand, switchBrand, isLoading } = useBrand();
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    if (isLoading) return;

    // No brandId in URL → append active brand
    if (!brandId) {
      if (activeBrand?.id) {
        navigate(`${basePath}/${activeBrand.id}`, { replace: true });
      }
      return;
    }

    if (handledRef.current === brandId) return;

    // Validate brandId belongs to user
    const found = brands.find((b) => b.id === brandId);
    if (!found) {
      if (brands.length === 0) return; // brands not loaded yet
      toast.error("Brand not found");
      navigate("/", { replace: true });
      return;
    }

    handledRef.current = brandId;

    // Switch active brand if URL differs
    if (activeBrand?.id !== brandId) {
      switchBrand(brandId);
    }
  }, [brandId, brands, activeBrand?.id, isLoading, basePath, navigate, switchBrand]);
}
