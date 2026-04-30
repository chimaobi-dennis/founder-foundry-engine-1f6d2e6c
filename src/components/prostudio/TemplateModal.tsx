import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, Upload, Download, RefreshCw, SlidersHorizontal, Check, ImageIcon, Wand2, Sparkles } from "lucide-react";
import html2canvas from "html2canvas";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TemplateModalProps } from "./types";
import { TemplatePreview } from "./TemplatePreview";
import { VariantLoadingSlot } from "./VariantLoadingSlot";
import { useBrand } from "@/hooks/use-brand";
import { useProductImages } from "@/hooks/use-product-images";
import { useAuth } from "@/contexts/AuthContext";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";
import { QuickEditPanel, type EditState, defaultEditState } from "./QuickEditPanel";
import { StudioButton, Pill } from "./shared";
import { useStudioSession } from "@/contexts/StudioSessionContext";
import {
  getProjectImagesForTemplate,
  getUserCredits,
  calculateTemplateCost,
  generateTemplateOutput,
  uploadProductImage,
  setActiveProductImage,
  saveOutputToLibrary,
} from "@/services/templateService";
import { toast } from "@/hooks/use-toast";

const aspectOptions = ["Auto", "Square", "3:2", "9:16", "16:9"];
const intensityOptions = [
  { label: "Subtle", value: 1 },
  { label: "Balanced", value: 2 },
  { label: "Bold", value: 3 },
] as const;

const intensityInstructions: Record<number, string> = {
  1: "Keep the design restrained and minimal — subtle and sophisticated.",
  2: "Balance visual impact with elegance — strong but not overwhelming.",
  3: "Make a bold visual statement — high contrast and maximum impact.",
};

function cleanAIHtml(raw: string | null): string | null {
  if (!raw) return null;
  let cleaned = raw.trim();
  // Strip markdown code fences
  cleaned = cleaned.replace(/^```(?:html)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
  return cleaned.trim();
}

function ensureProductImage(html: string | null, imageBase64?: string, imageMimeType?: string): string | null {
  if (!html || !imageBase64) {
    console.log('[ensureProductImage] Skipping - no html or imageBase64', { hasHtml: !!html, hasImage: !!imageBase64 });
    return html;
  }
  
  // Check for img tag (case insensitive)
  if (html.toLowerCase().includes('<img')) {
    console.log('[ensureProductImage] Image already present in HTML');
    return html;
  }
  
  console.log('[ensureProductImage] No image found - injecting product image');
  const imgTag = `<img src="data:${imageMimeType || 'image/jpeg'};base64,${imageBase64}" style="position:absolute;width:140px;height:auto;object-fit:contain;top:50%;left:50%;transform:translate(-50%,-60%);z-index:10;filter:drop-shadow(0 8px 24px rgba(0,0,0,0.2));" />`;
  
  // Try multiple injection strategies
  // Strategy 1: Replace last closing div
  if (html.match(/<\/div>\s*$/)) {
    return html.replace(/<\/div>\s*$/, imgTag + '</div>');
  }
  
  // Strategy 2: Find the main container div and inject before its closing tag
  const divMatch = html.match(/(<div[^>]*style="[^"]*width:600px[^"]*"[^>]*>)([\s\S]*?)(<\/div>\s*$)/);
  if (divMatch) {
    return divMatch[1] + divMatch[2] + imgTag + divMatch[3];
  }
  
  // Strategy 3: Just append before the last closing div tag
  const lastDivIndex = html.lastIndexOf('</div>');
  if (lastDivIndex !== -1) {
    return html.substring(0, lastDivIndex) + imgTag + html.substring(lastDivIndex);
  }
  
  console.warn('[ensureProductImage] Could not inject image - no suitable injection point found');
  return html;
}

export function TemplateModal({ template, open, onClose, type, brandName, brandInitials }: TemplateModalProps) {
  const navigate = useNavigate();
  const { setSession } = useStudioSession();
  const { activeBrand, activeBrandDNA } = useBrand();
  const { images: productImages, selectedImage, selectImage: selectProductImage, setImages: setProductImages } = useProductImages();
  const [selectedAspect, setSelectedAspect] = useState("Auto");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const productCarouselRef = useRef<HTMLDivElement>(null);
  const variationCarouselRef = useRef<HTMLDivElement>(null);
  const [styleIntensity, setStyleIntensity] = useState(2);

  const { user } = useAuth();

  // AI generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [variantCount, setVariantCount] = useState<number>(1);
  const [variations, setVariations] = useState<(string | null)[]>([null]);
  const [outputIds, setOutputIds] = useState<(string | null)[]>([null]);
  const [generationSessionId, setGenerationSessionId] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);
  const [activeVariation, setActiveVariation] = useState(0);
  const [regeneratingIdx, setRegeneratingIdx] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelWidth, setPanelWidth] = useState(400);

  // Live data: project images, credits, cost
  const [projectAssets, setProjectAssets] = useState<any[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [userCredits, setUserCredits] = useState<number | null>(null);
  const [cost, setCost] = useState<{ credits: number; breakdown: string[] }>({ credits: 1, breakdown: ["Base template: 1 credit"] });
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Export / save-to-library state (per variation index)
  const [downloadingIdx, setDownloadingIdx] = useState<number | null>(null);
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const [savedIdxs, setSavedIdxs] = useState<Set<number>>(new Set());

  // Carousel scroll function
  const scrollCarousel = (ref: React.RefObject<HTMLDivElement>, direction: 'left' | 'right') => {
    if (ref.current) {
      const scrollAmount = 200;
      ref.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // Quick edit state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editStates, setEditStates] = useState<Record<number, EditState>>({});

  // Studio editor (full-screen overlay)
  const [studioOpen, setStudioOpen] = useState(false);

  // Digital inputs
  const [customerName, setCustomerName] = useState("Erik L.");
  const [customerQuote, setCustomerQuote] = useState("I have tried every supplement brand. Nordform is the first one I actually trust.");
  const [customerRole, setCustomerRole] = useState("Product designer, Stockholm");
  const [rating, setRating] = useState(4);
  const [planName, setPlanName] = useState("Pro Plan");
  const [price, setPrice] = useState("$29/mo");
  const [features, setFeatures] = useState("Unlimited exports\nBrand kit\nPriority support");
  const [ctaText, setCtaText] = useState("Get started");
  const [headlineValue, setHeadlineValue] = useState(`${brandName} — New Release`);
  const [descriptionValue, setDescriptionValue] = useState("Describe what makes this special...");
  const [ctaValue, setCtaValue] = useState("Learn more");

  // Optional free-form brief (physical templates)
  const [briefOpen, setBriefOpen] = useState(false);
  const [designBrief, setDesignBrief] = useState("");

  useEffect(() => {
    if (panelRef.current) {
      const obs = new ResizeObserver(entries => {
        for (const entry of entries) {
          setPanelWidth(entry.contentRect.width);
        }
      });
      obs.observe(panelRef.current);
      return () => obs.disconnect();
    }
  }, [open]);

  // Reset state when template changes
  useEffect(() => {
    if (template) {
      setGenerated(false);
      setSelectedAspect("Auto");
      setStyleIntensity(2);
      setVariantCount(1);
      setVariations([null]);
      setOutputIds([null]);
      setGenerationSessionId(null);
      setActiveVariation(0);
      setEditorOpen(false);
      setEditStates({});
      setUploadError(null);
      setSavedIdxs(new Set());
      setBriefOpen(false);
      setDesignBrief("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template?.id]);

  // Pre-fill digital fields intelligently from Brand DNA when the modal opens
  useEffect(() => {
    if (!open || type !== "digital" || !template) return;
    const isTestimonialTpl = template.name.toLowerCase().includes("testimonial") || template.name.toLowerCase().includes("social proof");
    const isPricingTpl = template.name.toLowerCase().includes("pricing");
    if (isTestimonialTpl || isPricingTpl) return;

    const promise = activeBrandDNA?.core_promise?.trim();
    const audience = activeBrandDNA?.target_audience?.trim();
    setHeadlineValue(promise || `${brandName} — New Release`);
    setDescriptionValue(audience ? (audience.length > 120 ? audience.slice(0, 120) : audience) : "");
    setCtaValue("Learn more");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, template?.id, type, activeBrandDNA?.core_promise, activeBrandDNA?.target_audience, brandName]);

  // Adjust variations array length when variantCount changes (pre-generation only)
  useEffect(() => {
    if (!generated && !isGenerating) {
      setVariations(Array(variantCount).fill(null));
      setOutputIds(Array(variantCount).fill(null));
      setActiveVariation(0);
    }
  }, [variantCount, generated, isGenerating]);


  // Helper to convert public URL → base64 (so AI can ingest it)
  const urlToBase64 = async (url: string): Promise<{ base64: string; mimeType: string } | null> => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const mimeType = blob.type || "image/jpeg";
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      return { base64, mimeType };
    } catch (e) {
      console.error("[urlToBase64] failed", e);
      return null;
    }
  };

  // Load project assets + active product image when modal opens
  const loadProjectAssets = useCallback(async () => {
    if (!activeBrand?.id) return;
    setAssetsLoading(true);
    const { images: assets, activeImageId } = await getProjectImagesForTemplate(activeBrand.id);
    setProjectAssets(assets);

    // Map DB assets → context shape (with base64 for AI)
    const mapped = await Promise.all(
      assets.map(async (a: any) => {
        const url = a.file_url as string;
        let base64: string | undefined;
        let mimeType: string | undefined = a.mime_type || "image/jpeg";
        if (url) {
          const conv = await urlToBase64(url);
          if (conv) {
            base64 = conv.base64;
            mimeType = conv.mimeType;
          }
        }
        return {
          id: a.id as string,
          name: a.name as string,
          color: "#2D4A3E",
          url,
          base64,
          mimeType,
          templateCount: 0,
        };
      })
    );

    // Replace context images entirely with DB-backed list (no hardcoded defaults)
    setProductImages(mapped);

    if (mapped.length > 0) {
      const preselect = activeImageId ? mapped.find(m => m.id === activeImageId) : null;
      selectProductImage((preselect ?? mapped[0]).id);
    }

    setAssetsLoading(false);
  }, [activeBrand?.id, setProductImages, selectProductImage]);

  useEffect(() => {
    if (open && activeBrand?.id) {
      loadProjectAssets();
    }
  }, [open, activeBrand?.id, loadProjectAssets]);

  // Load user credits when modal opens
  useEffect(() => {
    if (open && user?.id) {
      getUserCredits(user.id).then(({ credits }) => setUserCredits(credits));
    }
  }, [open, user?.id]);

  // Recalculate cost when aspect/intensity/template changes
  useEffect(() => {
    if (!template?.id || !open) return;
    const aspectParam = selectedAspect.toLowerCase() === "auto" ? "auto" : selectedAspect.toLowerCase();
    const intensityParam = styleIntensity === 3 ? "bold" : styleIntensity === 2 ? "balanced" : "subtle";
    calculateTemplateCost(template.id, aspectParam, intensityParam).then(({ credits, breakdown }) => {
      setCost({ credits: credits || 1, breakdown: breakdown.length ? breakdown : ["Base template: 1 credit"] });
    });
  }, [template?.id, selectedAspect, styleIntensity, open]);

  if (!template) return null;

  const isPhysical = type === "physical";
  const templatePrompt = template.generation_prompt || "";

  const buildAspectParam = () => (selectedAspect.toLowerCase() === "auto" ? "auto" : selectedAspect.toLowerCase());
  const buildIntensityParam = (): "subtle" | "balanced" | "bold" =>
    styleIntensity === 3 ? "bold" : styleIntensity === 2 ? "balanced" : "subtle";

  const buildDigitalInputs = (): Record<string, string> | undefined => {
    if (isPhysical) return undefined;
    const isTestimonialTpl = template!.name.toLowerCase().includes("testimonial") || template!.name.toLowerCase().includes("social proof");
    const isPricingTpl = template!.name.toLowerCase().includes("pricing");
    if (isTestimonialTpl) {
      return {
        'Customer name': customerName,
        'Quote': customerQuote,
        'Role': customerRole,
        'Rating': `${rating} out of 5 stars`,
      };
    }
    if (isPricingTpl) {
      return {
        'Plan name': planName,
        'Price': price,
        'Features': features,
        'CTA text': ctaText,
      };
    }
    return {
      'Headline': headlineValue,
      'Description': descriptionValue,
      'CTA': ctaValue,
    };
  };

  const handleRun = async () => {
    if (!template?.id || !activeBrand?.id) {
      toast({
        title: "Missing context",
        description: "We couldn't identify the template or brand. Please try again.",
        variant: "destructive",
      });
      return;
    }

    console.log('[handleRun] Starting generation with selectedImage:', {
      hasSelectedImage: !!selectedImage,
      hasBase64: !!selectedImage?.base64,
      hasMimeType: !!selectedImage?.mimeType,
      hasUrl: !!selectedImage?.url,
      imageName: selectedImage?.name,
    });

    setIsGenerating(true);
    setGenerated(false);
    setVariations(Array(variantCount).fill(null));
    setOutputIds(Array(variantCount).fill(null));
    setGenerationSessionId(null);
    setActiveVariation(0);

    const aspectParam = selectedAspect.toLowerCase() === "auto" ? "auto" : selectedAspect.toLowerCase();
    const intensityParam = styleIntensity === 3 ? "bold" : styleIntensity === 2 ? "balanced" : "subtle";

    // Build digital content inputs (only relevant for digital templates)
    const digitalInputs = buildDigitalInputs();

    let firstArrived = false;

    try {
      const { variants, outputIds: ids, generationSessionId: sessionId, error } = await generateTemplateOutput({
        templateId: template.id,
        brandId: activeBrand.id,
        productImageUrl: selectedImage?.url || "",
        aspectRatio: aspectParam,
        styleIntensity: intensityParam,
        variantCount,
        imageBase64: selectedImage?.base64,
        imageMimeType: selectedImage?.mimeType || "image/jpeg",
        digitalInputs,
        designBrief: designBrief,
        onVariant: ({ index, html, outputId }) => {
          // For physical templates, inject product image fallback if model omitted it.
          // Digital templates don't need that — they're pure layouts.
          const safe = isPhysical
            ? ensureProductImage(html, selectedImage?.base64, selectedImage?.mimeType || "image/jpeg")
            : cleanAIHtml(html);
          setVariations(prev => prev.map((v, i) => (i === index ? safe : v)));
          setOutputIds(prev => prev.map((v, i) => (i === index ? outputId : v)));
          // Show the first completed variant immediately in the main preview
          if (!firstArrived) {
            firstArrived = true;
            setActiveVariation(index);
          }
        },
      });

      if (error) {
        toast({ title: "Generation failed", description: error, variant: "destructive" });
        return;
      }

      // Final reconciliation in case any variant skipped the streaming callback
      setVariations(prev => prev.map((v, i) => {
        if (v) return v;
        const raw = variants[i];
        if (!raw) return null;
        return isPhysical
          ? ensureProductImage(raw, selectedImage?.base64, selectedImage?.mimeType || "image/jpeg")
          : cleanAIHtml(raw);
      }));
      setOutputIds(prev => prev.map((v, i) => v ?? (ids[i] || null)));
      if (sessionId) setGenerationSessionId(sessionId);
      setGenerated(true);
    } catch (e: any) {
      console.error("Generation failed:", e);
      toast({ title: "Generation failed", description: e?.message || "Unknown error", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const regenerateSingle = async (variationIndex: number) => {
    if (!template?.id || !activeBrand?.id) return;
    const suffixes = [
      "Generate a completely fresh primary variation.",
      "Generate a completely fresh alternative layout.",
      "Generate a completely fresh bold variation.",
    ];
    setRegeneratingIdx(variationIndex);
    // Clear only this slot so the loading state shows immediately —
    // other already-generated variants are untouched.
    setVariations(prev => prev.map((v, i) => (i === variationIndex ? null : v)));
    try {
      const { variants, error } = await generateTemplateOutput({
        templateId: template.id,
        brandId: activeBrand.id,
        productImageUrl: selectedImage?.url || "",
        aspectRatio: buildAspectParam(),
        styleIntensity: buildIntensityParam(),
        variantCount: 1,
        imageBase64: selectedImage?.base64,
        imageMimeType: selectedImage?.mimeType || "image/jpeg",
        digitalInputs: buildDigitalInputs(),
        designBrief: designBrief,
        extraInstructions: suffixes[variationIndex],
      });
      const html = variants[0] || null;
      const cleaned = cleanAIHtml(html);
      if (error || !cleaned) {
        toast({ title: "Variant regeneration failed", description: error || "Please try again.", variant: "destructive" });
        return;
      }
      const safe = ensureProductImage(cleaned, selectedImage?.base64, selectedImage?.mimeType || "image/jpeg");
      setVariations(prev => prev.map((v, i) => (i === variationIndex ? safe : v)));
    } catch (e: any) {
      console.error("Regenerate failed:", e);
      toast({ title: "Variant regeneration failed", description: e?.message || "Unknown error", variant: "destructive" });
    } finally {
      setRegeneratingIdx(null);
    }
  };

  const regenerateWithEdits = async (editInstructions: string) => {
    if (!template?.id || !activeBrand?.id) return;
    const suffixes = [
      "Generate a refined primary variation.",
      "Generate a refined alternative layout.",
      "Generate a refined bold variation.",
    ];
    setRegeneratingIdx(activeVariation);
    try {
      const { variants } = await generateTemplateOutput({
        templateId: template.id,
        brandId: activeBrand.id,
        productImageUrl: selectedImage?.url || "",
        aspectRatio: buildAspectParam(),
        styleIntensity: buildIntensityParam(),
        variantCount: 1,
        imageBase64: selectedImage?.base64,
        imageMimeType: selectedImage?.mimeType || "image/jpeg",
        digitalInputs: buildDigitalInputs(),
        designBrief: designBrief,
        extraInstructions: `${suffixes[activeVariation]}\n\nAPPLY THESE EDITS:\n${editInstructions}`,
      });
      const cleaned = cleanAIHtml(variants[0] || null);
      const safe = ensureProductImage(cleaned, selectedImage?.base64, selectedImage?.mimeType || "image/jpeg");
      setVariations(prev => prev.map((v, i) => (i === activeVariation ? safe : v)));
      // Reset edit state for this variation after regen
      setEditStates(prev => {
        const next = { ...prev };
        delete next[activeVariation];
        return next;
      });
    } finally {
      setRegeneratingIdx(null);
    }
  };

  // Apply live edits to HTML
  const getEditedHtml = (html: string | null, variationIdx: number): string | null => {
    if (!html) return null;
    const edits = editStates[variationIdx];
    if (!edits) return html;

    let edited = html;

    // Apply text replacements
    for (const t of edits.texts) {
      if (t.original !== t.edited) {
        edited = edited.split(t.original).join(t.edited);
      }
    }

    // Apply brightness/contrast via wrapper filter
    // Apply color replacements
    if (edits.primaryColor !== '#2D4A3E') {
      edited = edited.replace(/#2D4A3E/gi, edits.primaryColor);
    }
    if (edits.secondaryColor !== '#F5F0E8') {
      edited = edited.replace(/#F5F0E8/gi, edits.secondaryColor);
    }

    // Wrap in a filter div for brightness/contrast
    if (edits.brightness !== 100 || edits.contrast !== 100) {
      edited = `<div style="filter:brightness(${edits.brightness / 100}) contrast(${edits.contrast / 100});width:600px;height:600px;">${edited}</div>`;
    }

    return edited;
  };

  // (downloadingIdx / savingIdx / savedIdxs declared above to keep hook order valid)


  /**
   * Render the active variation as PNG and trigger a browser download.
   * Targets the live DOM node with id `variation-{index}` (the inner stage
   * inside TemplatePreview). We temporarily neutralise its scale transform
   * so html2canvas captures at the intrinsic 600x600 size at 2x resolution.
   */
  const downloadVariation = async (variationIndex: number) => {
    const el = document.getElementById(`variation-${variationIndex}`);
    if (!el) {
      toast({ title: "Nothing to export", description: "Generate a variation first.", variant: "destructive" });
      return;
    }

    setDownloadingIdx(variationIndex);
    const originalTransform = el.style.transform;
    try {
      el.style.transform = "scale(1)";
      const canvas = await html2canvas(el, {
        width: el.offsetWidth || 600,
        height: el.offsetHeight || 600,
        scale: 2,
        backgroundColor: null,
        useCORS: true,
        logging: false,
      });
      const safeBrand = (brandName || "brand").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const safeTpl = (template.name || template.id).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const link = document.createElement("a");
      link.download = `${safeBrand}-${safeTpl}-v${variationIndex + 1}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e: any) {
      console.error("Download failed:", e);
      toast({ title: "Export failed", description: e?.message || "Could not render PNG.", variant: "destructive" });
    } finally {
      el.style.transform = originalTransform;
      setDownloadingIdx(null);
    }
  };

  /**
   * Capture a small thumbnail of the active variation (scale 1) and persist
   * it to Supabase Storage, flipping is_saved_to_library on the row.
   */
  const saveVariationToLibrary = async (variationIndex: number) => {
    if (!activeBrand?.id) {
      toast({ title: "No active brand", variant: "destructive" });
      return;
    }
    const el = document.getElementById(`variation-${variationIndex}`);
    if (!el) {
      toast({ title: "Nothing to save", description: "Generate a variation first.", variant: "destructive" });
      return;
    }

    setSavingIdx(variationIndex);
    const originalTransform = el.style.transform;
    try {
      el.style.transform = "scale(1)";
      const canvas = await html2canvas(el, {
        width: el.offsetWidth || 600,
        height: el.offsetHeight || 600,
        scale: 1,
        backgroundColor: null,
        useCORS: true,
        logging: false,
      });
      const thumbBase64 = canvas.toDataURL("image/png");

      const result = await saveOutputToLibrary({
        outputId: outputIds[variationIndex] || null,
        brandId: activeBrand.id,
        templateId: template.id,
        outputHtml: variations[variationIndex] || "",
        thumbnailBase64: thumbBase64,
      });

      if (result.error) {
        toast({ title: "Save failed", description: result.error, variant: "destructive" });
        return;
      }

      // Persist any newly created outputId back into local state
      setOutputIds(prev => prev.map((v, i) => (i === variationIndex ? result.outputId : v)));
      setSavedIdxs(prev => {
        const next = new Set(prev);
        next.add(variationIndex);
        return next;
      });
      toast({ title: "Saved to Library" });
    } catch (e: any) {
      console.error("Save failed:", e);
      toast({ title: "Save failed", description: e?.message || "Could not save thumbnail.", variant: "destructive" });
    } finally {
      el.style.transform = originalTransform;
      setSavingIdx(null);
    }
  };


  const previewScale = Math.min((panelWidth - 48) / 600, 1);

  const isTestimonial = template.name.toLowerCase().includes("testimonial") || template.name.toLowerCase().includes("social proof");
  const isPricing = template.name.toLowerCase().includes("pricing");


  // Reset all generation state when the modal is dismissed
  const handleClose = () => {
    setStudioOpen(false);
    setGenerated(false);
    setVariations(Array(variantCount).fill(null));
    setOutputIds(Array(variantCount).fill(null));
    setActiveVariation(0);
    setIsGenerating(false);
    setEditorOpen(false);
    setEditStates({});
    onClose();
  };

  // Open the studio as a dedicated route. We snapshot the current variations
  // into the StudioSession context (so they survive this modal unmounting),
  // then navigate to /pro-studio/editor and close the modal. On exit the
  // editor calls session.onExit which fully resets template selection here.
  const openStudio = () => {
    const tplId = template.id;
    const snapshotCanvases: { id: string; html: string | null }[] = variations.map((html, i) => ({
      id: `${tplId}-${i}`,
      html: getEditedHtml(html, i),
    }));
    const initialActiveId = `${tplId}-${activeVariation}`;

    // Map canvas id → template_outputs.id for round-trip persistence later
    const outputIdsByCanvas: Record<string, string> = {};
    snapshotCanvases.forEach((c, i) => {
      const oid = outputIds[i];
      if (oid) outputIdsByCanvas[c.id] = oid;
    });

    setSession({
      templateName: template.name,
      variationId: initialActiveId,
      variationHtml: snapshotCanvases[activeVariation]?.html ?? null,
      outputId: outputIds[activeVariation] ?? null,
      outputIdsByCanvas,
      brandId: activeBrand?.id ?? null,
      templateId: template.id,
      savedCanvasIds: Array.from(savedIdxs).map((i) => `${tplId}-${i}`),
      onDownload: () => downloadVariation(activeVariation),
      canvases: snapshotCanvases,
      activeCanvasId: initialActiveId,
      onSelectCanvas: (id) => {
        setSession((prev: any) => {
          if (!prev) return prev;
          const found = prev.canvases?.find((c: any) => c.id === id);
          return {
            ...prev,
            activeCanvasId: id,
            variationId: id,
            variationHtml: found?.html ?? null,
            outputId: prev.outputIdsByCanvas?.[id] ?? null,
          };
        });
      },
      onAddBlankCanvas: () => {
        setSession((prev: any) => {
          if (!prev) return prev;
          const newId = `${tplId}-blank-${Date.now()}`;
          const nextCanvases = [...(prev.canvases || []), { id: newId, html: null }];
          return { ...prev, canvases: nextCanvases, activeCanvasId: newId, variationId: newId, variationHtml: null };
        });
      },
      onAddCanvasFromTemplate: async () => {
        const newId = `${tplId}-gen-${Date.now()}`;
        setSession((prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            canvases: [...(prev.canvases || []), { id: newId, html: null }],
            activeCanvasId: newId,
            variationId: newId,
            variationHtml: null,
          };
        });
        try {
          if (!template?.id || !activeBrand?.id) throw new Error("Missing template or brand");
          const { variants } = await generateTemplateOutput({
            templateId: template.id,
            brandId: activeBrand.id,
            productImageUrl: selectedImage?.url || "",
            aspectRatio: buildAspectParam(),
            styleIntensity: buildIntensityParam(),
            variantCount: 1,
            imageBase64: selectedImage?.base64,
            imageMimeType: selectedImage?.mimeType || "image/jpeg",
            digitalInputs: buildDigitalInputs(),
            designBrief: designBrief,
            extraInstructions: "Generate a fresh additional variation — explore a different visual angle while staying on-brand.",
          });
          const cleaned = cleanAIHtml(variants[0] || null);
          const safe = ensureProductImage(cleaned, selectedImage?.base64, selectedImage?.mimeType || "image/jpeg");
          setSession((prev: any) => {
            if (!prev) return prev;
            const nextCanvases = (prev.canvases || []).map((c: any) => (c.id === newId ? { ...c, html: safe } : c));
            return {
              ...prev,
              canvases: nextCanvases,
              variationHtml: prev.activeCanvasId === newId ? safe : prev.variationHtml,
            };
          });
        } catch (e) {
          console.error("Add variant failed:", e);
        }
      },
      onDuplicateCanvas: (id) => {
        setSession((prev: any) => {
          if (!prev) return prev;
          const idx = (prev.canvases || []).findIndex((c: any) => c.id === id);
          if (idx < 0) return prev;
          const dup = { ...prev.canvases[idx], id: `${prev.canvases[idx].id}-dup-${Date.now()}` };
          const nextCanvases = [...prev.canvases];
          nextCanvases.splice(idx + 1, 0, dup);
          return { ...prev, canvases: nextCanvases, activeCanvasId: dup.id, variationId: dup.id, variationHtml: dup.html };
        });
      },
      onDeleteCanvas: (id) => {
        setSession((prev: any) => {
          if (!prev) return prev;
          if ((prev.canvases || []).length <= 1) return prev;
          const nextCanvases = prev.canvases.filter((c: any) => c.id !== id);
          const newActive = nextCanvases[0];
          return { ...prev, canvases: nextCanvases, activeCanvasId: newActive.id, variationId: newActive.id, variationHtml: newActive.html };
        });
      },
      onSetMainCanvas: (id) => {
        setSession((prev: any) => {
          if (!prev) return prev;
          const idx = (prev.canvases || []).findIndex((c: any) => c.id === id);
          if (idx <= 0) return prev;
          const nextCanvases = [...prev.canvases];
          const [moved] = nextCanvases.splice(idx, 1);
          nextCanvases.unshift(moved);
          return { ...prev, canvases: nextCanvases, activeCanvasId: moved.id, variationId: moved.id, variationHtml: moved.html };
        });
      },
      onExit: () => {
        // Full reset of the originating template selection + generation state.
        handleClose();
      },
    });

    const activeOutputId = outputIds[activeVariation];
    if (generationSessionId && activeOutputId) {
      navigate(`/pro-studio/editor?session=${generationSessionId}&active=${activeOutputId}`);
    } else {
      navigate("/pro-studio/editor");
    }
  };


  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-[96vw] w-[96vw] h-[90vh] md:h-[94vh] max-h-[90vh] md:max-h-[94vh] p-0 overflow-y-auto md:overflow-hidden rounded-2xl border-border gap-0" aria-describedby={undefined}>
        <DialogTitle className="sr-only">{template?.name ?? "Template"}</DialogTitle>
        <button
          onClick={handleClose}
          className="fixed md:absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-muted/80 backdrop-blur-sm flex items-center justify-center hover:bg-muted transition-colors"
        >
          <X size={16} className="text-foreground" />
        </button>

        <div className="flex flex-col md:flex-row h-full">
          {/* Left panel */}
          <div className="w-full md:w-[480px] md:flex-shrink-0 p-4 md:p-7 overflow-y-auto bg-card md:border-r border-border">
            <h2 className="font-display text-[20px] text-foreground">{template.name}</h2>
            <div className="flex items-center gap-2 mt-2">
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                <span className="text-[9px] font-ui font-bold text-primary-foreground">P</span>
              </div>
              <span className="text-[13px] font-ui text-muted-foreground">{template.creator}</span>
              <span className="text-[11px] font-ui px-2.5 py-0.5 rounded-[10px] bg-primary/10 text-primary">
                {template.uses} uses
              </span>
            </div>

            <div className="h-px bg-border my-4" />

            {isPhysical ? (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={async (e) => {
                    const files = e.target.files;
                    if (!files || !user?.id || !activeBrand?.id) return;
                    const fileArray = Array.from(files);
                    setUploadingFile(true);
                    setUploadError(null);
                    let lastUploadedAssetId: string | null = null;
                    let anyFailed = false;
                    try {
                      for (const file of fileArray) {
                        const result = await uploadProductImage(activeBrand.id, file);
                        if (!result.success) {
                          anyFailed = true;
                        } else if (result.asset?.id) {
                          lastUploadedAssetId = result.asset.id;
                        }
                      }
                      if (anyFailed) {
                        setUploadError("Upload failed — please try again");
                      }
                      // Refresh from DB so context contains the new image with base64
                      await loadProjectAssets();
                      // Auto-select the most recently uploaded image and persist as active
                      if (lastUploadedAssetId) {
                        selectProductImage(lastUploadedAssetId);
                        setActiveProductImage(activeBrand.id, lastUploadedAssetId);
                      }
                    } catch (err: any) {
                      setUploadError("Upload failed — please try again");
                    } finally {
                      setUploadingFile(false);
                      e.target.value = "";
                    }
                  }}
                />
                
                {/* Product Images Carousel */}
                <div>
                  <label className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider mb-2 block">
                    Product image
                  </label>
                  {productImages.length === 0 && !assetsLoading ? (
                    /* Empty state — only Upload new */
                    <div
                      onClick={() => !uploadingFile && fileInputRef.current?.click()}
                      className={cn(
                        "rounded-lg border-[1.5px] border-dashed border-primary/40 p-6 flex flex-col items-center justify-center gap-2 transition-all",
                        uploadingFile ? "opacity-60 cursor-wait" : "cursor-pointer hover:border-primary/60 hover:bg-primary/5"
                      )}
                    >
                      <Upload size={24} className="text-primary" />
                      <span className="text-[13px] font-ui font-medium text-foreground">
                        {uploadingFile ? "Uploading..." : "Upload new"}
                      </span>
                      <span className="text-[11px] font-ui text-muted-foreground text-center">
                        Upload a product photo to get started
                      </span>
                    </div>
                  ) : (
                    <div className="relative -mx-1">
                      <div 
                        ref={productCarouselRef}
                        className="flex gap-2 overflow-x-auto pb-2 px-1 scrollbar-thin md:scrollbar-thumb-border scrollbar-track-transparent"
                        style={{ scrollbarWidth: 'none', WebkitScrollbarDisplay: 'none' } as React.CSSProperties}
                      >
                        {/* Upload card */}
                        <div
                          onClick={() => !uploadingFile && fileInputRef.current?.click()}
                          className={cn(
                            "flex-shrink-0 w-[72px] md:w-[90px] h-[88px] md:h-[110px] rounded-lg border-[1.5px] border-dashed border-primary/40 flex flex-col items-center justify-center gap-1 transition-all",
                            uploadingFile ? "opacity-60 cursor-wait" : "cursor-pointer hover:border-primary/60 hover:bg-primary/5"
                          )}
                        >
                          <Upload size={16} className="text-primary" />
                          <span className="text-[9px] font-ui text-primary text-center px-1">
                            {uploadingFile ? "Uploading..." : "Upload new"}
                          </span>
                        </div>

                        {/* Existing images from context */}
                        {productImages.map((img) => {
                          const isSelected = selectedImage?.id === img.id;
                          return (
                            <div
                              key={img.id}
                              onClick={() => selectProductImage(img.id)}
                              className={cn(
                                "flex-shrink-0 w-[72px] md:w-[90px] h-[88px] md:h-[110px] rounded-lg overflow-hidden cursor-pointer transition-all relative group",
                                isSelected ? "ring-2 ring-primary shadow-lg" : "border border-border hover:border-primary/60"
                              )}
                            >
                              {img.url ? (
                                <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: img.color }}>
                                  <span className="text-[9px] font-ui text-white/80 font-medium text-center px-1">{img.name}</span>
                                </div>
                              )}

                              {/* Name overlay */}
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1">
                                <span className="text-[8px] font-ui text-white line-clamp-1">{img.name}</span>
                              </div>

                              {/* Selected indicator */}
                              {isSelected && (
                                <>
                                  <div className="absolute top-1 right-1 w-[14px] h-[14px] rounded-full bg-primary flex items-center justify-center">
                                    <Check size={8} className="text-primary-foreground" />
                                  </div>
                                  <div className="absolute inset-0 border-2 border-primary rounded-lg pointer-events-none" />
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Navigation arrows for product images */}
                      <button
                        onClick={() => scrollCarousel(productCarouselRef, 'left')}
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-background border border-border shadow-sm flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                        style={{ opacity: productCarouselRef.current?.scrollLeft > 10 ? 1 : 0 }}
                      >
                        <ChevronLeft size={12} className="text-foreground" />
                      </button>
                      <button
                        onClick={() => scrollCarousel(productCarouselRef, 'right')}
                        className="absolute right-0 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-background border border-border shadow-sm flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                      >
                        <ChevronRight size={12} className="text-foreground" />
                      </button>
                    </div>
                  )}

                  {/* Inline upload error */}
                  {uploadError && (
                    <div className="mt-2 text-[11px] font-ui text-destructive">
                      {uploadError}
                    </div>
                  )}

                  {/* Status indicator */}
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      selectedImage?.url ? "bg-emerald-500" : "bg-amber-500"
                    )} />
                    <span className="text-[11px] font-ui text-muted-foreground">
                      {selectedImage?.url 
                        ? "Product photo included in generation" 
                        : "Upload a real photo for best results"}
                    </span>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider mb-2 block">
                    Aspect ratio
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {aspectOptions.map((a) => (
                      <Pill key={a} selected={selectedAspect === a} onClick={() => setSelectedAspect(a)}>
                        {a}
                      </Pill>
                    ))}
                  </div>
                </div>

                {/* Style intensity */}
                <div className="mt-4">
                  <label className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider mb-2 block">
                    Style intensity
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {intensityOptions.map((opt) => (
                      <Pill
                        key={opt.value}
                        selected={styleIntensity === opt.value}
                        onClick={() => setStyleIntensity(opt.value)}
                      >
                        {opt.label}
                      </Pill>
                    ))}
                  </div>
                </div>

                {/* Variant count */}
                <div className="mt-4">
                  <label className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider mb-2 block">
                    How many variants
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {[1, 2, 3, 4].map((n) => (
                      <Pill
                        key={n}
                        minWidth
                        selected={variantCount === n}
                        onClick={() => setVariantCount(n)}
                      >
                        {n}
                      </Pill>
                    ))}
                  </div>
                  <p className="text-[11px] font-ui text-muted-foreground mt-1.5">
                    Each variant is a unique interpretation of the template
                  </p>
                </div>

                {/* Optional brief */}
                <div className="mt-4">
                  {!briefOpen ? (
                    <button
                      type="button"
                      onClick={() => setBriefOpen(true)}
                      className="text-[12px] font-ui text-primary hover:underline"
                    >
                      ＋ Add a specific brief
                    </button>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider">
                          Brief (optional)
                        </label>
                        <button
                          type="button"
                          onClick={() => { setBriefOpen(false); setDesignBrief(""); }}
                          className="text-[11px] font-ui text-primary hover:underline"
                        >
                          ✕ Remove
                        </button>
                      </div>
                      <Textarea
                        value={designBrief}
                        onChange={(e) => setDesignBrief(e.target.value)}
                        rows={3}
                        placeholder="What's this design for? e.g. 'Launch post for our new adaptogens range' or 'Black Friday sale, 40% off'"
                      />
                    </div>
                  )}
                </div>

                {/* Brand context indicator */}
                <div className="flex items-center gap-1.5 mt-4">
                  <Sparkles size={12} className="text-primary" />
                  <span className="text-[11px] font-ui text-muted-foreground">
                    Using your brand context from Mentor
                  </span>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                {isTestimonial ? (
                  <>
                    <div>
                      <label className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider mb-1 block">Customer name</label>
                      <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="h-10" />
                    </div>
                    <div>
                      <label className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider mb-1 block">Quote</label>
                      <Textarea value={customerQuote} onChange={(e) => setCustomerQuote(e.target.value)} rows={3} />
                    </div>
                    <div>
                      <label className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider mb-1 block">Role</label>
                      <Input value={customerRole} onChange={(e) => setCustomerRole(e.target.value)} className="h-10" />
                    </div>
                    <div>
                      <label className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider mb-1 block">Rating</label>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <button key={s} onClick={() => setRating(s)}>
                            <Star size={20} className={cn(s <= rating ? "text-primary fill-primary" : "text-muted-foreground")} />
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                ) : isPricing ? (
                  <>
                    <div>
                      <label className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider mb-1 block">Plan name</label>
                      <Input value={planName} onChange={(e) => setPlanName(e.target.value)} className="h-10" />
                    </div>
                    <div>
                      <label className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider mb-1 block">Price</label>
                      <Input value={price} onChange={(e) => setPrice(e.target.value)} className="h-10" />
                    </div>
                    <div>
                      <label className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider mb-1 block">Features</label>
                      <Textarea value={features} onChange={(e) => setFeatures(e.target.value)} rows={3} />
                    </div>
                    <div>
                      <label className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider mb-1 block">CTA text</label>
                      <Input value={ctaText} onChange={(e) => setCtaText(e.target.value)} className="h-10" />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider mb-1 block">Headline</label>
                      <Input value={headlineValue} onChange={(e) => setHeadlineValue(e.target.value)} className="h-10" />
                    </div>
                    <div>
                      <label className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider mb-1 block">Description</label>
                      <Textarea value={descriptionValue} onChange={(e) => setDescriptionValue(e.target.value)} rows={3} />
                    </div>
                    <div>
                      <label className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider mb-1 block">CTA</label>
                      <Input value={ctaValue} onChange={(e) => setCtaValue(e.target.value)} className="h-10" />
                    </div>
                  </>
                )}

                {/* Optional brief */}
                <div>
                  {!briefOpen ? (
                    <button
                      type="button"
                      onClick={() => setBriefOpen(true)}
                      className="text-[12px] font-ui text-primary hover:underline"
                    >
                      ＋ Add a specific brief
                    </button>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider">
                          Brief (optional)
                        </label>
                        <button
                          type="button"
                          onClick={() => { setBriefOpen(false); setDesignBrief(""); }}
                          className="text-[11px] font-ui text-primary hover:underline"
                        >
                          ✕ Remove
                        </button>
                      </div>
                      <Textarea
                        value={designBrief}
                        onChange={(e) => setDesignBrief(e.target.value)}
                        rows={3}
                        placeholder="What's this design for? e.g. 'Scholarship announcement targeting Lagos students' or 'Welcome back to campus post'"
                      />
                    </div>
                  )}
                </div>

                {/* Brand context indicator */}
                <div className="flex items-center gap-1.5 pt-1">
                  <Sparkles size={12} className="text-primary" />
                  <span className="text-[11px] font-ui text-muted-foreground">
                    Using your brand context from Mentor
                  </span>
                </div>

                {/* Aspect ratio */}
                <div className="pt-2">
                  <label className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider mb-2 block">
                    Aspect ratio
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {aspectOptions.map((a) => (
                      <Pill key={a} selected={selectedAspect === a} onClick={() => setSelectedAspect(a)}>
                        {a}
                      </Pill>
                    ))}
                  </div>
                </div>

                {/* Style intensity */}
                <div>
                  <label className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider mb-2 block">
                    Style intensity
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {intensityOptions.map((opt) => (
                      <Pill
                        key={opt.value}
                        selected={styleIntensity === opt.value}
                        onClick={() => setStyleIntensity(opt.value)}
                      >
                        {opt.label}
                      </Pill>
                    ))}
                  </div>
                </div>

                {/* Variant count */}
                <div>
                  <label className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider mb-2 block">
                    How many variants
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {[1, 2, 3, 4].map((n) => (
                      <Pill
                        key={n}
                        minWidth
                        selected={variantCount === n}
                        onClick={() => setVariantCount(n)}
                      >
                        {n}
                      </Pill>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            <div className="sticky md:static bottom-0 left-0 right-0 bg-card md:bg-transparent pt-3 pb-3 md:pb-0 -mx-4 md:mx-0 px-4 md:px-0 z-5 border-t md:border-t-0 border-border md:border-none">
              {(() => {
                const totalCredits = cost.credits * variantCount;
                const needsImage = isPhysical && !selectedImage;
                const insufficient = userCredits !== null && userCredits < totalCredits;
                const disabled = isGenerating || needsImage || insufficient;
                const variantLabel = variantCount === 1 ? "1 variant" : `${variantCount} variants`;
                const creditLabel = `${totalCredits} credit${totalCredits === 1 ? "" : "s"}`;
                const label = isGenerating
                  ? "Generating..."
                  : insufficient
                  ? "Not enough credits — upgrade your plan"
                  : needsImage
                  ? "Select a product image to continue"
                  : `Generate ${variantLabel} — uses ${creditLabel}`;
                return (
                  <TooltipProvider delayDuration={150}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="block">
                          <Button
                            onClick={handleRun}
                            disabled={disabled}
                            className="w-full h-12 rounded-lg text-[14px] font-ui font-medium bg-[#D4A017] hover:bg-[#B8890F] text-[#1A1A2E] disabled:opacity-60"
                          >
                            {label}
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[260px]">
                        <div className="text-[11px] font-ui space-y-0.5">
                          {cost.breakdown.map((b, i) => (
                            <div key={i}>{b}</div>
                          ))}
                          {variantCount > 1 && (
                            <div>× {variantCount} variants = {creditLabel}</div>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })()}
              <div className="flex items-center justify-between gap-2 mt-2">
                <p className="text-[11px] font-ui text-muted-foreground">
                  {`${cost.credits} per variant × ${variantCount} = ${cost.credits * variantCount} credit${cost.credits * variantCount === 1 ? "" : "s"}`}
                </p>
                {userCredits !== null && (
                  <p className="text-[11px] font-ui text-muted-foreground">
                    You have {userCredits} credit{userCredits === 1 ? "" : "s"}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div ref={panelRef} className="w-full md:flex-1 bg-background flex flex-col items-center justify-start p-4 md:p-6 overflow-y-auto">
            {(isGenerating || generated) ? (
              <div className="flex flex-col items-center gap-4 w-full">
                {/* Active variation preview */}
                <div className="w-full flex items-center justify-center flex-1 min-h-0" style={{ maxHeight: editorOpen ? '340px' : '500px', transition: 'max-height 200ms ease', overflow: 'hidden' }}>
                  {variations[activeVariation] ? (
                    <TemplatePreview
                      html={getEditedHtml(variations[activeVariation], activeVariation)}
                      scale={editorOpen ? 0.55 : Math.min(previewScale, 0.85)}
                      id={`variation-${activeVariation}`}
                    />
                  ) : (
                    <div
                      className="rounded-lg overflow-hidden animate-fade-in"
                      style={{
                        width: 600 * Math.min(previewScale, 0.85),
                        height: 600 * Math.min(previewScale, 0.85),
                      }}
                    >
                      <VariantLoadingSlot
                        slotIndex={activeVariation}
                        size="hero"
                        failed={!isGenerating && generated && regeneratingIdx !== activeVariation}
                        onRetry={() => regenerateSingle(activeVariation)}
                        caption={
                          isGenerating || regeneratingIdx === activeVariation
                            ? `Generating ${variantCount} variant${variantCount === 1 ? "" : "s"}...`
                            : undefined
                        }
                      />
                    </div>
                  )}
                </div>

                {isGenerating && (
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full bg-primary"
                      style={{ animation: "spin 1s linear infinite" }}
                    />
                    <span className="text-[13px] font-ui text-muted-foreground">
                      Generating {variantCount} variant{variantCount === 1 ? "" : "s"}…
                    </span>
                  </div>
                )}


                {/* Variation thumbnails */}
                <div className="relative w-full -mx-4 md:-mx-6 px-8 md:px-10">
                  <div 
                    ref={variationCarouselRef}
                    className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin md:scrollbar-thumb-border scrollbar-track-transparent snap-x snap-mandatory"
                    style={{ scrollSnapType: 'x mandatory', maxWidth: 'none', scrollbarWidth: 'none', WebkitScrollbarDisplay: 'none' } as React.CSSProperties}
                  >
                    {variations.map((html, i) => (
                      <div key={i} className="relative group flex-shrink-0 snap-start">
                        <button
                          onClick={() => setActiveVariation(i)}
                          className={cn(
                            "w-[120px] aspect-square rounded-lg overflow-hidden border-2 transition-colors",
                            activeVariation === i ? "border-primary" : "border-transparent hover:border-border"
                          )}
                        >
                          {html ? (
                            <div
                              className="w-full h-full animate-fade-in"
                              style={{ transform: "scale(0.15)", transformOrigin: "top left", width: 600, height: 600 }}
                            >
                              <div dangerouslySetInnerHTML={{ __html: getEditedHtml(html, i) || '' }} />
                            </div>
                          ) : (
                            // Loading while generating (or regenerating); failed once generation has completed.
                            <VariantLoadingSlot
                              slotIndex={i}
                              size="thumb"
                              failed={!isGenerating && regeneratingIdx !== i && generated}
                              onRetry={() => regenerateSingle(i)}
                            />
                          )}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); regenerateSingle(i); }}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity border border-border"
                          title="Regenerate"
                        >
                          <RefreshCw size={10} className="text-foreground" />
                        </button>
                      </div>
                    ))}
                  </div>
                  
                  {/* Navigation arrows for variations */}
                  <button
                    onClick={() => scrollCarousel(variationCarouselRef, 'left')}
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-background border border-border shadow-md flex items-center justify-center transition-all hover:scale-110 z-10"
                  >
                    <ChevronLeft size={14} className="text-foreground" />
                  </button>
                  <button
                    onClick={() => scrollCarousel(variationCarouselRef, 'right')}
                    className="absolute right-0 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-background border border-border shadow-md flex items-center justify-center transition-all hover:scale-110 z-10"
                  >
                    <ChevronRight size={14} className="text-foreground" />
                  </button>
                </div>

                {generated && !isGenerating && (
                  <>
                    {/* Edit in Studio — primary editing entry point */}
                    <button
                      onClick={openStudio}
                      className="h-10 rounded-lg px-5 text-[13px] font-ui font-semibold flex items-center gap-2 transition-all hover:opacity-90 shadow-sm"
                      style={{
                        background: 'linear-gradient(180deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.9) 100%)',
                        color: 'hsl(var(--primary-foreground))',
                        boxShadow: '0 4px 14px -4px hsl(var(--primary) / 0.4)',
                      }}
                    >
                      <Wand2 size={14} />
                      Edit in Studio
                    </button>

                    <div className="flex gap-3 w-full max-w-[320px]">
                      <Button
                        variant="outline"
                        className="flex-1 h-10 text-[13px] gap-1.5"
                        onClick={() => downloadVariation(activeVariation)}
                        disabled={downloadingIdx === activeVariation}
                      >
                        {downloadingIdx === activeVariation ? (
                          <>
                            <span className="h-2.5 w-2.5 rounded-full bg-current/40 animate-pulse" /> Exporting…
                          </>
                        ) : (
                          <>
                            <Download size={14} /> Download
                          </>
                        )}
                      </Button>
                      {savedIdxs.has(activeVariation) ? (
                        <Button
                          disabled
                          variant="outline"
                          className="flex-1 h-10 text-[13px] gap-1.5 border-primary/40 text-primary opacity-90"
                        >
                          <Check size={14} /> Saved
                        </Button>
                      ) : (
                        <Button
                          className="flex-1 h-10 text-[13px] gap-1.5"
                          onClick={() => saveVariationToLibrary(activeVariation)}
                          disabled={savingIdx === activeVariation}
                        >
                          {savingIdx === activeVariation ? (
                            <>
                              <span className="h-2.5 w-2.5 rounded-full bg-current/40 animate-pulse" /> Saving…
                            </>
                          ) : (
                            <>Save to Library</>
                          )}
                        </Button>
                      )}
                    </div>

                  </>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div
                  className={cn(
                    "w-full max-w-[300px] rounded-lg flex items-center justify-center",
                    isPhysical ? "aspect-square" : "aspect-[4/3]"
                  )}
                  style={{ backgroundColor: template.color }}
                >
                  <span className="text-[13px] font-ui text-white/30">{template.name}</span>
                </div>
                <span className="text-[11px] font-ui text-muted-foreground text-center">
                  {isPhysical
                    ? "Example output — upload your product to generate"
                    : "Example output — fill in your content and generate"}
                </span>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

