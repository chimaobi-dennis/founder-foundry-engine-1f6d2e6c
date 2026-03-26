import { useState, useCallback, useRef, useEffect } from "react";
import { X, Upload, Download, RefreshCw, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { TemplateModalProps } from "./types";
import { TemplatePreview } from "./TemplatePreview";
import { templatePrompts } from "./PhysicalProductTab";
import { callAI } from "@/lib/ai";
import { useBrand } from "@/hooks/use-brand";
import { useProductImages } from "@/hooks/use-product-images";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";
import { QuickEditPanel, type EditState, defaultEditState } from "./QuickEditPanel";

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

export function TemplateModal({ template, open, onClose, type, brandName, brandInitials }: TemplateModalProps) {
  const { activeBrand } = useBrand();
  const { selectedImage } = useProductImages();
  const [selectedAspect, setSelectedAspect] = useState("Auto");
  const [uploadedFile, setUploadedFile] = useState<{ name: string; url: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [styleIntensity, setStyleIntensity] = useState(2);
  const [uploadedImageBase64, setUploadedImageBase64] = useState<string | null>(null);
  const [uploadedImageMimeType, setUploadedImageMimeType] = useState<string>("image/jpeg");

  // AI generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [variations, setVariations] = useState<(string | null)[]>([null, null, null]);
  const [generated, setGenerated] = useState(false);
  const [activeVariation, setActiveVariation] = useState(0);
  const [regeneratingIdx, setRegeneratingIdx] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelWidth, setPanelWidth] = useState(400);

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

  // Reset state when template changes — auto-load selected product image
  useEffect(() => {
    if (template) {
      setGenerated(false);
      setVariations([null, null, null]);
      setActiveVariation(0);
      if (type === "physical" && selectedImage) {
        if (selectedImage.url) {
          setUploadedFile({ name: selectedImage.name, url: selectedImage.url });
        } else {
          setUploadedFile({ name: selectedImage.name, url: "" });
        }
        if (selectedImage.base64) {
          setUploadedImageBase64(selectedImage.base64);
          setUploadedImageMimeType(selectedImage.mimeType || "image/jpeg");
        } else {
          setUploadedImageBase64(null);
        }
      } else {
        setUploadedFile(null);
        setUploadedImageBase64(null);
      }
    }
  }, [template?.id, type, selectedImage]);

  if (!template) return null;

  const isPhysical = type === "physical";
  const promptKey = template.id;
  const templatePrompt = templatePrompts[promptKey] || "";

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

    const productInstruction = uploadedImageBase64
      ? `The actual product image is attached. Study the product carefully — its shape, color, proportions, and character. Position it naturally within the scene as if it were actually photographed there. Represent it as an img tag using this src: "data:${uploadedImageMimeType};base64,${uploadedImageBase64}" with appropriate dimensions that respect the product's natural proportions. The product should feel like it belongs in the scene — not pasted on top of it.`
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
            uploadedImageBase64 || undefined,
            uploadedImageMimeType
          )
        )
      );
      setVariations(results.map(cleanAIHtml));
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
      uploadedImageBase64 || undefined,
      uploadedImageMimeType
    );
    setVariations(prev => prev.map((v, i) => (i === variationIndex ? cleanAIHtml(result) : v)));
    setRegeneratingIdx(null);
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
      <DialogContent className="max-w-[880px] w-[90vw] p-0 overflow-hidden rounded-2xl border-border gap-0" aria-describedby={undefined}>
        <DialogTitle className="sr-only">{template?.name ?? "Template"}</DialogTitle>
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-muted/80 flex items-center justify-center hover:bg-muted transition-colors"
        >
          <X size={16} className="text-foreground" />
        </button>

        <div className="flex flex-col md:flex-row max-h-[85vh]">
          {/* Left panel */}
          <div className="w-full md:w-[45%] p-7 overflow-y-auto bg-card border-r border-border">
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
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const url = URL.createObjectURL(file);
                      setUploadedFile({ name: file.name, url });
                      // Convert to base64
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const result = ev.target?.result as string;
                        const base64 = result.split(",")[1];
                        setUploadedImageBase64(base64);
                        setUploadedImageMimeType(file.type || "image/jpeg");
                      };
                      reader.readAsDataURL(file);
                    }
                    e.target.value = "";
                  }}
                />
                {uploadedFile ? (
                  <div className="relative rounded-lg border border-border p-4 flex flex-col items-center gap-2">
                    {uploadedFile.url ? (
                      <img src={uploadedFile.url} alt="Product" className="w-[120px] h-[80px] rounded-md object-cover" />
                    ) : (
                      <div className="w-[120px] h-[80px] rounded-md flex items-center justify-center" style={{ backgroundColor: "#2D4A3E" }}>
                        <span className="text-[11px] font-ui text-[#F5F0E8] font-medium">{brandName}</span>
                      </div>
                    )}
                    <span className="text-[11px] font-ui text-muted-foreground">{uploadedFile.name}</span>
                    <button
                      onClick={() => { setUploadedFile(null); setUploadedImageBase64(null); }}
                      className="text-[11px] font-ui text-destructive/70 hover:text-destructive"
                    >
                      Remove
                    </button>
                    {/* Image status indicator */}
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      <span className="text-[11px] font-ui text-muted-foreground">Product image will be included in generation</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="h-[160px] rounded-lg border-[1.5px] border-dashed border-primary/40 flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:border-primary/60 transition-colors"
                    >
                      <Upload size={20} className="text-primary" />
                      <span className="text-[13px] font-ui text-primary">Upload your product photo</span>
                      <span className="text-[11px] font-ui text-muted-foreground">JPG, PNG, WebP up to 10MB</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                      <span className="text-[11px] font-ui text-muted-foreground">Upload a product image for best results</span>
                    </div>
                  </div>
                )}

                <div className="mt-4">
                  <label className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider mb-2 block">
                    Aspect ratio
                  </label>
                  <div className="flex gap-1.5">
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
                  <div className="flex gap-1.5">
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

            <Button onClick={handleRun} disabled={isGenerating} className="w-full h-12 rounded-lg text-[14px] font-ui mt-5">
              {isGenerating ? "Generating..." : "Run template"}
            </Button>
            <p className="text-[11px] font-ui text-muted-foreground text-center mt-2">Uses 1 credit</p>
          </div>

          {/* Right panel */}
          <div ref={panelRef} className="w-full md:w-[55%] bg-background flex flex-col items-center justify-center p-6 min-h-[400px] overflow-y-auto">
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
                  <TemplatePreview
                    html={variations[activeVariation]}
                    scale={previewScale}
                    id={`variation-${activeVariation}`}
                  />

                  {/* Variation thumbnails */}
                  <div className="grid grid-cols-3 gap-3 w-full max-w-[480px]">
                    {variations.map((html, i) => (
                      <div key={i} className="relative group">
                        <button
                          onClick={() => setActiveVariation(i)}
                          className={cn(
                            "w-full aspect-square rounded-lg overflow-hidden border-2 transition-colors",
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
                              <div dangerouslySetInnerHTML={{ __html: html }} />
                            </div>
                          ) : (
                            <div className="w-full h-full bg-muted/30 flex items-center justify-center">
                              <span className="text-[10px] font-ui text-muted-foreground">Failed</span>
                            </div>
                          )}
                        </button>
                        {/* Regenerate button */}
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
