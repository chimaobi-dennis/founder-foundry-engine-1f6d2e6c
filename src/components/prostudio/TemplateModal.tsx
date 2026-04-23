import { useState, useCallback, useRef, useEffect } from "react";
import { X, Upload, Download, RefreshCw, SlidersHorizontal, Check, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TemplateModalProps } from "./types";
import { TemplatePreview } from "./TemplatePreview";
import { callAI } from "@/lib/ai";
import { useBrand } from "@/hooks/use-brand";
import { useProductImages } from "@/hooks/use-product-images";
import { useAuth } from "@/contexts/AuthContext";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";
import { QuickEditPanel, type EditState, defaultEditState } from "./QuickEditPanel";
import {
  getProjectImagesForTemplate,
  getUserCredits,
  calculateTemplateCost,
} from "@/services/templateService";
import { uploadProjectFile } from "@/services/projectAssetsService";
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
  const { activeBrand } = useBrand();
  const { images: productImages, selectedImage, selectImage: selectProductImage, addImages } = useProductImages();
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

  // Digital inputs
  const [customerName, setCustomerName] = useState("Erik L.");
  const [customerQuote, setCustomerQuote] = useState("I have tried every supplement brand. Nordform is the first one I actually trust.");
  const [customerRole, setCustomerRole] = useState("Product designer, Stockholm");
  const [rating, setRating] = useState(4);
  const [planName, setPlanName] = useState("Pro Plan");
  const [price, setPrice] = useState("$29/mo");
  const [features, setFeatures] = useState("Unlimited exports\nBrand kit\nPriority support");
  const [ctaText, setCtaText] = useState("Get started");

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
      setVariations([null, null, null]);
      setActiveVariation(0);
      setEditorOpen(false);
      setEditStates({});
    }
  }, [template?.id]);

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
    const { assets, activeProductImageId } = await getProjectImagesForTemplate(activeBrand.id);
    setProjectAssets(assets);

    // Sync into the shared product images context (with base64 for AI)
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

    // Replace context images with DB-backed list
    if (mapped.length > 0) {
      // Use addImages by clearing first via a fresh selection — simplest: just push and select
      addImages(mapped);
      const preselect = activeProductImageId && mapped.find(m => m.id === activeProductImageId);
      selectProductImage((preselect ?? mapped[0]).id);
    }
    setAssetsLoading(false);
  }, [activeBrand?.id, addImages, selectProductImage]);

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

  const buildBasePrompt = () => {
    const brandDNA = {
      name: activeBrand?.name || brandName,
      industry: "Premium consumer goods",
      primaryColor: "#2D4A3E",
      secondaryColor: "#F5F0E8",
      voice: "Premium and considered",
      corePromise: "",
      productName: (activeBrand?.name || brandName) + " Product",
    };

    const productInstruction = selectedImage?.base64
      ? `The user has uploaded their product image. It is attached to this message.

You MUST include this product image in the HTML output using this exact img tag:
<img src="data:${selectedImage.mimeType || "image/jpeg"};base64,${selectedImage.base64}" style="position:absolute;width:140px;height:auto;object-fit:contain;top:50%;left:50%;transform:translate(-50%,-60%);z-index:10;filter:drop-shadow(0 8px 24px rgba(0,0,0,0.2));" />

Place the img tag inside the main container div at the position that makes most sense for this template's design direction. The product MUST be visible. Do not replace it with a div placeholder.`
      : `Represent the product as a div: width:130px height:190px background:white border-radius:4px display:flex align-items:center justify-content:center font-size:10px text-align:center padding:8px color matching brand primary — containing the product name text.`;

    return `You are an expert creative director and senior frontend developer specialising in premium brand marketing visuals.

Generate a self-contained HTML marketing visual for ${brandDNA.name}.

BRAND CONTEXT:
Brand name: ${brandDNA.name}
Industry: ${brandDNA.industry}
Primary color: ${brandDNA.primaryColor}
Secondary color: ${brandDNA.secondaryColor}
Brand voice: ${brandDNA.voice}
Core promise: ${brandDNA.corePromise}
Product: ${brandDNA.productName}

PRODUCT IMAGE INSTRUCTION:
${productInstruction}

TEMPLATE DESIGN DIRECTION:
${templatePrompt}

STYLE INTENSITY: ${intensityInstructions[styleIntensity]}

TECHNICAL REQUIREMENTS:
- Output ONLY a self-contained div — no html, head, body tags, no markdown, no backticks
- Exactly 600px × 600px — use style="width:600px;height:600px;position:relative;overflow:hidden;"
- All CSS inline or in a single style tag inside the div
- If using the product image tag set it to position:absolute with appropriate top left width height to place it naturally in the scene
- The brand primary color must appear meaningfully in the design
- Load Google Fonts via @import if needed — choose a font that fits the brand voice and design direction
- CSS backgrounds textures and gradients only for scene elements — no other external images
- The composition must feel like a real premium marketing asset
- Be creative with typography treatment layout and visual hierarchy — avoid centering everything

Output only the HTML div. Nothing else.`;
  };

  const handleRun = async () => {
    if (!isPhysical) {
      // Digital templates keep the old behavior
      setIsGenerating(true);
      setGenerated(false);
      setTimeout(() => {
        setIsGenerating(false);
        setGenerated(true);
        setActiveVariation(0);
      }, 1500);
      return;
    }

    console.log('[handleRun] Starting generation with selectedImage:', {
      hasSelectedImage: !!selectedImage,
      hasBase64: !!selectedImage?.base64,
      hasMimeType: !!selectedImage?.mimeType,
      hasUrl: !!selectedImage?.url,
      imageName: selectedImage?.name
    });

    setIsGenerating(true);
    setGenerated(false);
    setVariations([null, null, null]);

    const basePrompt = buildBasePrompt();

    const suffixes = [
      "\n\nGenerate the primary variation — execute the design direction fully and precisely.",
      "\n\nGenerate an alternative layout variation — same mood and colors but shift the composition. Move the product to a different position. Try a different typographic treatment or layout structure.",
      "\n\nGenerate a bold variation — push the design direction further. More contrast, stronger visual statement, more expressive typography. Same brand colors but more impact.",
    ];

    try {
      const results = await Promise.all(
        suffixes.map(suffix =>
          callAI(
            [{ role: "user", content: basePrompt + suffix }],
            3000,
            selectedImage?.base64 || undefined,
            selectedImage?.mimeType || "image/jpeg"
          )
        )
      );
      console.log('[handleRun] AI generation complete, processing results');
      const cleanedResults = results.map(cleanAIHtml);
      console.log('[handleRun] Cleaned results, applying safety check');
      const safeResults = cleanedResults.map((html, idx) => {
        console.log(`[handleRun] Processing variation ${idx}`);
        return ensureProductImage(html, selectedImage?.base64, selectedImage?.mimeType || "image/jpeg");
      });
      console.log('[handleRun] All variations processed, setting state');
      setVariations(safeResults);
      setGenerated(true);
      setActiveVariation(0);
    } catch (e) {
      console.error("Generation failed:", e);
    } finally {
      setIsGenerating(false);
    }
  };

  const regenerateSingle = async (variationIndex: number) => {
    const suffixes = [
      "Generate a completely fresh primary variation.",
      "Generate a completely fresh alternative layout.",
      "Generate a completely fresh bold variation.",
    ];
    setRegeneratingIdx(variationIndex);
    const basePrompt = buildBasePrompt();
    const result = await callAI(
      [{ role: "user", content: basePrompt + "\n\n" + suffixes[variationIndex] }],
      3000,
      selectedImage?.base64 || undefined,
      selectedImage?.mimeType || "image/jpeg"
    );
    const cleaned = cleanAIHtml(result);
    const safe = ensureProductImage(cleaned, selectedImage?.base64, selectedImage?.mimeType || "image/jpeg");
    setVariations(prev => prev.map((v, i) => (i === variationIndex ? safe : v)));
    setRegeneratingIdx(null);
  };

  const regenerateWithEdits = async (editInstructions: string) => {
    const suffixes = [
      "Generate a refined primary variation.",
      "Generate a refined alternative layout.",
      "Generate a refined bold variation.",
    ];
    setRegeneratingIdx(activeVariation);
    const basePrompt = buildBasePrompt();
    const editSuffix = `\n\n${suffixes[activeVariation]}\n\nAPPLY THESE EDITS:\n${editInstructions}`;
    const result = await callAI(
      [{ role: "user", content: basePrompt + editSuffix }],
      3000,
      selectedImage?.base64 || undefined,
      selectedImage?.mimeType || "image/jpeg"
    );
    const cleaned = cleanAIHtml(result);
    const safe = ensureProductImage(cleaned, selectedImage?.base64, selectedImage?.mimeType || "image/jpeg");
    setVariations(prev => prev.map((v, i) => (i === activeVariation ? safe : v)));
    // Reset edit state for this variation after regen
    setEditStates(prev => {
      const next = { ...prev };
      delete next[activeVariation];
      return next;
    });
    setRegeneratingIdx(null);
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

  const downloadVariation = async (variationIndex: number) => {
    const el = document.getElementById(`variation-${variationIndex}`);
    if (!el) return;

    try {
      // Dynamically load html2canvas
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
      await new Promise<void>((resolve, reject) => {
        script.onload = () => resolve();
        script.onerror = reject;
        document.head.appendChild(script);
      });

      const canvas = await (window as any).html2canvas(el, { width: 600, height: 600, scale: 2 });
      const link = document.createElement("a");
      link.download = `${brandName.toLowerCase().replace(/\s/g, "-")}-${template.id}-v${variationIndex + 1}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e) {
      console.error("Download failed:", e);
    }
  };

  const previewScale = Math.min((panelWidth - 48) / 600, 1);

  const isTestimonial = template.name.toLowerCase().includes("testimonial") || template.name.toLowerCase().includes("social proof");
  const isPricing = template.name.toLowerCase().includes("pricing");

  const variationTints = [template.color, `${template.color}dd`, `${template.color}bb`, `${template.color}99`];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[96vw] w-[96vw] h-[90vh] md:h-[94vh] max-h-[90vh] md:max-h-[94vh] p-0 overflow-y-auto md:overflow-hidden rounded-2xl border-border gap-0" aria-describedby={undefined}>
        <DialogTitle className="sr-only">{template?.name ?? "Template"}</DialogTitle>
        <button
          onClick={onClose}
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
                    try {
                      for (const file of fileArray) {
                        const result = await uploadProjectFile(user.id, activeBrand.id, file);
                        if (!result.success) {
                          toast({ title: "Upload failed", description: result.error, variant: "destructive" });
                        }
                      }
                      await loadProjectAssets();
                      toast({ title: "Image uploaded" });
                    } catch (err: any) {
                      toast({ title: "Upload failed", description: err?.message, variant: "destructive" });
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
                    /* Empty state */
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-lg border-[1.5px] border-dashed border-primary/40 p-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-all"
                    >
                      <ImageIcon size={28} className="text-primary/70" />
                      <span className="text-[13px] font-ui font-medium text-foreground">
                        {uploadingFile ? "Uploading..." : "Upload a product photo"}
                      </span>
                      <span className="text-[11px] font-ui text-muted-foreground text-center">
                        Upload a product photo for best results
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
                  
                  {/* Status indicator */}
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      selectedImage?.url ? "bg-green-500" : "bg-amber-500"
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
                      <button
                        key={a}
                        onClick={() => setSelectedAspect(a)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-[12px] font-ui transition-colors",
                          selectedAspect === a
                            ? "bg-primary text-primary-foreground"
                            : "border border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {a}
                      </button>
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
                      <button
                        key={opt.value}
                        onClick={() => setStyleIntensity(opt.value)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-[12px] font-ui transition-colors",
                          styleIntensity === opt.value
                            ? "bg-primary text-primary-foreground"
                            : "border border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
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
                      <Input defaultValue={`${brandName} — New Release`} className="h-10" />
                    </div>
                    <div>
                      <label className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider mb-1 block">Description</label>
                      <Textarea defaultValue="Describe what makes this special..." rows={3} />
                    </div>
                    <div>
                      <label className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider mb-1 block">CTA</label>
                      <Input defaultValue="Learn more" className="h-10" />
                    </div>
                  </>
                )}
              </div>
            )}
            
            <div className="sticky md:static bottom-0 left-0 right-0 bg-card md:bg-transparent pt-3 pb-3 md:pb-0 -mx-4 md:mx-0 px-4 md:px-0 z-5 border-t md:border-t-0 border-border md:border-none">
              {(() => {
                const needsImage = isPhysical && !selectedImage;
                const insufficient = userCredits !== null && userCredits < cost.credits;
                const disabled = isGenerating || needsImage || insufficient;
                const label = isGenerating
                  ? "Generating..."
                  : insufficient
                  ? "Not enough credits — upgrade your plan"
                  : needsImage
                  ? "Select a product image to continue"
                  : `Generate — uses ${cost.credits} credit${cost.credits === 1 ? "" : "s"}`;
                return (
                  <TooltipProvider delayDuration={150}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="block">
                          <Button
                            onClick={handleRun}
                            disabled={disabled}
                            className="w-full h-12 rounded-lg text-[14px] font-ui font-medium"
                            style={{ backgroundColor: template.color }}
                          >
                            {label}
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[260px]">
                        <div className="text-[11px] font-ui">
                          {cost.breakdown.map((b, i) => (
                            <div key={i}>{b}</div>
                          ))}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })()}
              <div className="flex items-center justify-between gap-2 mt-2">
                <p className="text-[11px] font-ui text-muted-foreground">
                  {cost.breakdown.length > 1
                    ? cost.breakdown
                        .map(b => b.replace("Base template: ", "").replace(": ", " "))
                        .join(" + ")
                    : `Uses ${cost.credits} credit${cost.credits === 1 ? "" : "s"}`}
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
            {isPhysical ? (
              // AI-powered generation view
              isGenerating ? (
                <div className="flex flex-col items-center gap-4 w-full">
                  <div className="grid grid-cols-3 gap-3 w-full max-w-[480px]">
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        className="aspect-square rounded-lg bg-muted/40"
                        style={{
                          animation: "pulse-amber 1.5s ease-in-out infinite",
                          animationDelay: `${i * 200}ms`,
                        }}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full bg-primary"
                      style={{ animation: "spin 1s linear infinite" }}
                    />
                    <span className="text-[13px] font-ui text-muted-foreground">Generating 3 variations with AI...</span>
                  </div>
                  <style>{`
                    @keyframes pulse-amber {
                      0%, 100% { opacity: 0.4; }
                      50% { opacity: 0.8; }
                    }
                  `}</style>
                </div>
              ) : generated ? (
                <div className="flex flex-col items-center gap-4 w-full">
                  {/* Active variation preview */}
                  <div className="w-full flex items-center justify-center flex-1 min-h-0" style={{ maxHeight: editorOpen ? '340px' : '500px', transition: 'max-height 200ms ease', overflow: 'hidden' }}>
                    <TemplatePreview
                      html={getEditedHtml(variations[activeVariation], activeVariation)}
                      scale={editorOpen ? 0.55 : Math.min(previewScale, 0.85)}
                      id={`variation-${activeVariation}`}
                    />
                  </div>

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
                            {regeneratingIdx === i ? (
                              <div
                                className="w-full h-full bg-muted/40"
                                style={{ animation: "pulse-amber 1.5s ease-in-out infinite" }}
                              />
                            ) : html ? (
                              <div style={{ transform: "scale(0.15)", transformOrigin: "top left", width: 600, height: 600 }}>
                                <div dangerouslySetInnerHTML={{ __html: getEditedHtml(html, i) || '' }} />
                              </div>
                            ) : (
                              <div className="w-full h-full bg-muted/30 flex items-center justify-center">
                                <span className="text-[10px] font-ui text-muted-foreground">Failed</span>
                              </div>
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

                  {/* Quick edits toggle */}
                  <button
                    onClick={() => setEditorOpen(p => !p)}
                    className="h-9 rounded-lg border px-4 text-[12px] font-ui font-medium flex items-center gap-1.5 transition-colors"
                    style={{
                      borderColor: 'hsl(var(--primary))',
                      color: 'hsl(var(--primary))',
                      background: editorOpen ? 'hsl(var(--primary) / 0.08)' : 'transparent',
                    }}
                  >
                    <SlidersHorizontal size={14} />
                    {editorOpen ? 'Close editor' : 'Quick edits'}
                  </button>

                  {/* Quick edit panel */}
                  {editorOpen && (
                    <div className="w-full">
                      <QuickEditPanel
                        variationIndex={activeVariation}
                        variationHtml={variations[activeVariation]}
                        editStates={editStates}
                        onEditStatesChange={setEditStates}
                        onApplyAndRegenerate={regenerateWithEdits}
                        isRegenerating={regeneratingIdx !== null}
                      />
                    </div>
                  )}

                  <div className="flex gap-3 w-full max-w-[320px]">
                    <Button
                      variant="outline"
                      className="flex-1 h-10 text-[13px] gap-1.5"
                      onClick={() => downloadVariation(activeVariation)}
                    >
                      <Download size={14} /> Download
                    </Button>
                    <Button className="flex-1 h-10 text-[13px]">Save to Library</Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div
                    className="w-full max-w-[300px] aspect-square rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: template.color }}
                  >
                    <span className="text-[13px] font-ui text-white/30">{template.name}</span>
                  </div>
                  <span className="text-[11px] font-ui text-muted-foreground text-center">
                    Example output — upload your product to generate
                  </span>
                </div>
              )
            ) : (
              // Digital templates - original behavior
              isGenerating ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                  <span className="text-[13px] font-ui text-muted-foreground">Generating...</span>
                </div>
              ) : generated ? (
                <div className="flex flex-col items-center gap-4 w-full max-w-[380px]">
                  <div
                    className="w-full aspect-square rounded-lg flex items-center justify-center relative"
                    style={{ backgroundColor: variationTints[activeVariation] }}
                  >
                    <div className="p-6 text-center">
                      {isTestimonial ? (
                        <div className="space-y-2">
                          <span className="font-display text-[24px] text-white/20">"</span>
                          <p className="font-display text-[14px] text-white/80 leading-relaxed">{customerQuote}</p>
                          <p className="text-[12px] font-ui text-white/60 mt-2">{customerName}</p>
                          <p className="text-[10px] font-ui text-white/40">{customerRole}</p>
                        </div>
                      ) : isPricing ? (
                        <div className="space-y-2">
                          <p className="text-[16px] font-ui font-medium text-white/80">{planName}</p>
                          <p className="font-display text-[28px] text-white/90">{price}</p>
                          <p className="text-[11px] font-ui text-white/50 whitespace-pre-line">{features}</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                            <span className="text-[10px] font-ui font-bold text-white/60">{brandInitials}</span>
                          </div>
                          <span className="text-[13px] font-ui text-white/60">{template.name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setActiveVariation((p) => Math.max(0, p - 1))}
                      className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
                    >
                      <ChevronLeft size={14} className="text-foreground" />
                    </button>
                    <span className="text-[13px] font-ui text-muted-foreground">{activeVariation + 1} / 4</span>
                    <button
                      onClick={() => setActiveVariation((p) => Math.min(3, p + 1))}
                      className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
                    >
                      <ChevronRight size={14} className="text-foreground" />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    {[0, 1, 2, 3].map((i) => (
                      <button
                        key={i}
                        onClick={() => setActiveVariation(i)}
                        className={cn(
                          "w-16 h-16 rounded-md overflow-hidden border-2 transition-colors",
                          activeVariation === i ? "border-primary" : "border-transparent"
                        )}
                        style={{ backgroundColor: variationTints[i] }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-3 w-full">
                    <Button variant="outline" className="flex-1 h-10 text-[13px] gap-1.5">
                      <Download size={14} /> Download
                    </Button>
                    <Button className="flex-1 h-10 text-[13px]">Save to Library</Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div
                    className="w-full max-w-[300px] aspect-[4/3] rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: template.color }}
                  >
                    <span className="text-[13px] font-ui text-white/30">{template.name}</span>
                  </div>
                  <span className="text-[11px] font-ui text-muted-foreground text-center">
                    Example output — upload your product to generate
                  </span>
                </div>
              )
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
