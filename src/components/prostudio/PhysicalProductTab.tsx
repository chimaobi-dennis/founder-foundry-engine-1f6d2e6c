import { useState, useEffect } from "react";
import { Image, ChevronRight, ChevronLeft } from "lucide-react";
import { Template } from "./types";
import { TemplateGrid } from "./TemplateGrid";
import { TemplateModal } from "./TemplateModal";
import { ProductImagesSidebar } from "./ProductImagesSidebar";
import { CreatorBanner } from "./CreatorBanner";

const categories = ["All", "Photoshoot", "Lifestyle", "Flat Lay", "Packshot", "Outdoor", "Moody Studio", "Minimal"];

const templates: Template[] = [
  { id: "marble-luxury", name: "Marble Luxury", color: "#F2EDE6", aspect: "square", uses: "3.2k", creator: "ProStudio Team", category: "Photoshoot" },
  { id: "dark-moody-studio", name: "Dark Moody Studio", color: "#141210", aspect: "square", uses: "2.8k", creator: "ProStudio Team", category: "Moody Studio" },
  { id: "outdoor-lifestyle", name: "Outdoor Lifestyle", color: "#A8C4B0", aspect: "square", uses: "2.1k", creator: "ProStudio Team", category: "Lifestyle" },
  { id: "linen-flat-lay", name: "Linen Flat Lay", color: "#EDE5D5", aspect: "square", uses: "1.9k", creator: "ProStudio Team", category: "Flat Lay" },
  { id: "urban-street", name: "Urban Street", color: "#7A8898", aspect: "square", uses: "1.7k", creator: "ProStudio Team", category: "Lifestyle" },
  { id: "cafe-counter", name: "Café Counter", color: "#6A4A30", aspect: "square", uses: "1.5k", creator: "ProStudio Team", category: "Lifestyle" },
  { id: "sunrise-window", name: "Sunrise Window", color: "#E8C878", aspect: "square", uses: "1.4k", creator: "ProStudio Team", category: "Lifestyle" },
  { id: "minimal-white", name: "Minimal White", color: "#FAFAF8", aspect: "square", uses: "1.3k", creator: "ProStudio Team", category: "Minimal" },
  { id: "forest-floor", name: "Forest Floor", color: "#283828", aspect: "square", uses: "1.2k", creator: "ProStudio Team", category: "Outdoor" },
  { id: "night-neon", name: "Night Neon", color: "#080A14", aspect: "square", uses: "1.1k", creator: "ProStudio Team", category: "Moody Studio" },
  { id: "rooftop-golden-hour", name: "Rooftop Golden Hour", color: "#C87820", aspect: "square", uses: "980", creator: "ProStudio Team", category: "Outdoor" },
  { id: "raw-concrete", name: "Raw Concrete", color: "#909090", aspect: "square", uses: "870", creator: "ProStudio Team", category: "Minimal" },
];

export const templatePrompts: Record<string, string> = {
  "marble-luxury": `Design direction: Marble Luxury editorial.
Create a premium marketing visual with these characteristics:
- Warm off-white background (#F2EDE6) with subtle marble texture using overlapping CSS radial gradients in muted warm tones
- Generous negative space — the product should breathe
- A thin inset border frame (1px, very subtle, warm gray)
- Brand name in tracked uppercase 9px serif bottom left
- Overall feeling: expensive, considered, editorial
- Reference: Aesop product photography, Kinfolk magazine
- Product placement: centred, slightly above mathematical centre`,
  "dark-moody-studio": `Design direction: Dark Moody Studio.
Create a dramatic premium marketing visual:
- Near black background (#141210)
- Directional studio light effect using radial gradient warm amber from top right
- Product slightly above centre with deep shadow beneath
- Brand name bottom right in very small tracked white text at low opacity
- Feeling: high-end fashion editorial, mysterious, premium
- Reference: fragrance advertising, luxury fashion product shots`,
  "linen-flat-lay": `Design direction: Linen Flat Lay.
Create a warm, organic flat-lay marketing visual:
- Warm cream background (#EDE5D5) suggesting linen texture via subtle CSS pattern
- Small CSS prop elements arranged naturally around the product: a circle suggesting a stone, a thin rotated rectangle suggesting a twig, small squares suggesting seeds or pebbles
- Product centred as if placed on the surface
- Brand name in italic serif bottom centre at low opacity
- Feeling: organic, considered, wellness lifestyle
- Reference: Scandinavian lifestyle magazines, premium health brands`,
  "outdoor-lifestyle": `Design direction: Outdoor Lifestyle.
Create an energetic lifestyle marketing visual:
- Gradient background from sage green (#A8C4B0) to deeper forest green (#6A9A7C) at 135 degrees
- Product offset slightly left of centre
- Right side: typographic treatment with the brand name split across two lines — small word above, large word below in white
- Feeling: active, natural, outdoor Nordic lifestyle
- Reference: outdoor wellness brands, Nordic activewear`,
  "sunrise-window": `Design direction: Sunrise Window.
Create a warm morning ritual marketing visual:
- Warm amber to cream gradient (#E8C878 to #F5E8C0 to #F0E0A8) suggesting dawn light
- Two subtle vertical bars suggesting a window frame casting light
- Product centred in the warm light zone
- Small italic tagline bottom centre
- Feeling: morning ritual, calm, intentional, Nordic morning
- Reference: lifestyle wellness brands, morning routine content`,
  "minimal-white": `Design direction: Minimal White.
Create an ultra-minimal premium marketing visual:
- Pure off-white background (#FAFAF8)
- Two very subtle horizontal rule lines at 25% and 75% of height
- Product centred between the rules with extreme negative space
- Brand name in tiny tracked uppercase above top rule
- Product name in tiny tracked uppercase below bottom rule
- Zero decoration — restraint is the design
- Feeling: Swiss graphic design, premium pharmaceutical, Braun design language
- Reference: Muji, Aesop, Swiss poster design`,
  "urban-street": `Design direction: Urban Street.
Create an urban premium marketing visual:
- Cool gray background (#7A8898)
- Subtle vertical grid lines at low opacity suggesting urban architecture
- Large ghost typography behind the product using first two letters of brand name at very large size and very low opacity
- Product offset to bottom right third of composition
- Brand name top left in small tracked text
- Feeling: urban, architectural, contemporary Stockholm
- Reference: contemporary Scandinavian design, urban lifestyle brands`,
  "night-neon": `Design direction: Night Neon.
Create a dramatic night marketing visual:
- Very dark background (#080A14)
- A soft radial glow in the brand primary color behind the product position
- Product centred with a very subtle glow effect
- Brand name bottom centre in small tracked text matching the glow color at medium opacity
- Feeling: late night, premium, slightly mysterious
- Reference: luxury fragrance night campaigns, premium spirits advertising`,
  "raw-concrete": `Design direction: Raw Concrete.
Create an industrial minimal marketing visual:
- Medium gray background (#909090) with subtle texture using repeating CSS gradients suggesting concrete grain
- Product centred with a clean white space halo behind it
- Stencil-style brand name top left in bold tracked uppercase white at medium opacity
- Bottom right: small product name in white
- Feeling: industrial, architectural, brutalist design aesthetic
- Reference: Japanese industrial design, contemporary architecture brands`,
  "forest-floor": `Design direction: Forest Floor.
Create an organic deep forest marketing visual:
- Deep forest green background (#283828)
- Organic CSS ellipse shapes at low opacity suggesting leaves or forest floor elements
- Product centred appearing to rest naturally in the scene
- Brand name in italic serif at bottom centre in soft sage green color
- Feeling: organic, deep nature, Nordic forest, grounded
- Reference: Nordic outdoor brands, forest bathing wellness`,
  "rooftop-golden-hour": `Design direction: Rooftop Golden Hour.
Create a warm golden hour urban marketing visual:
- Warm amber to orange gradient (#C87820 to #E8A030 to #F0C060) suggesting late afternoon sun
- CSS rectangle shapes at bottom suggesting a Stockholm rooftop skyline silhouette
- Product positioned above the skyline line centred
- Brand name top centre in small tracked white text
- Feeling: optimistic, Stockholm summer, golden hour lifestyle
- Reference: premium beverage brands, urban lifestyle rooftop content`,
  "cafe-counter": `Design direction: Café Counter.
Create a warm premium café counter marketing visual:
- Rich warm brown gradient (#6A4A30 to #4A3020) suggesting a wooden counter surface
- A subtle horizontal line suggesting the counter edge at 60% height
- Product sitting on the counter naturally centred
- Warm radial glow behind the product suggesting ambient café lighting
- Brand name bottom right in small italic warm cream text
- Feeling: warm, premium café, ritual, considered
- Reference: specialty coffee brands, premium tea brands, artisan food brands`,
};

const SIDEBAR_KEY = "prostudio-product-sidebar";

interface Props {
  brandId: string;
  brandName: string;
  brandColor: string;
}

export function PhysicalProductTab({ brandName }: Props) {
  const [selected, setSelected] = useState<Template | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === "true"; } catch { return false; }
  });
  const initials = brandName.split(" ").map((w) => w[0]).join("").slice(0, 3);

  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_KEY, String(sidebarOpen)); } catch {}
  }, [sidebarOpen]);

  return (
    <>
      {/* Toggle button */}
      <div className="flex justify-end mb-3">
        <button
          onClick={() => setSidebarOpen((p) => !p)}
          className="h-8 rounded-lg border border-border px-3 flex items-center gap-1.5 text-[12px] font-ui hover:bg-muted/50 transition-colors"
        >
          <Image size={14} className="text-primary" />
          <span className="text-muted-foreground">Product images</span>
          {sidebarOpen ? <ChevronLeft size={12} className="text-muted-foreground" /> : <ChevronRight size={12} className="text-muted-foreground" />}
        </button>
      </div>

      <div className="flex gap-0 overflow-hidden" style={{ minHeight: 0 }}>
        {/* Main content */}
        <div className="flex-1 min-w-0">
          <TemplateGrid templates={templates} categories={categories} onSelect={setSelected} brandName={brandName} templateType="physical" />
        </div>

        {/* Right sidebar */}
        <div
          className="flex-shrink-0 overflow-hidden transition-all duration-200 ease-in-out"
          style={{ width: sidebarOpen ? 240 : 0, borderLeft: sidebarOpen ? "0.5px solid hsl(var(--border))" : "none" }}
        >
          <div className="w-[240px] h-full">
            <ProductImagesSidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      </div>

      <CreatorBanner />

      <TemplateModal
        template={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        type="physical"
        brandName={brandName}
        brandInitials={initials}
      />
    </>
  );
}
