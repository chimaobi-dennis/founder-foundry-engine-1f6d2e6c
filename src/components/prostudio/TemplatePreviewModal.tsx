import { useState } from "react";
import { X, ChevronLeft, ChevronRight, Instagram } from "lucide-react";
import { Template } from "./types";
import { TemplateCardPreview } from "./TemplateCardPreview";

interface Props {
  template: Template | null;
  open: boolean;
  onClose: () => void;
  onUseTemplate: (t: Template) => void;
  brandName: string;
}

const templateDescriptions: Record<string, { about: string; bestFor: string[]; creatorNote: string }> = {
  'marble-luxury': {
    about: 'A clean editorial composition inspired by luxury lifestyle photography. Works best with products that have strong silhouettes and premium packaging.',
    bestFor: ['Premium packaging', 'Skincare', 'Wellness', 'Food & beverage'],
    creatorNote: 'Designed for brands that want to feel considered and expensive without being loud. The marble texture is built entirely in CSS — no background images needed, so it renders cleanly every time.',
  },
  'dark-moody-studio': {
    about: 'Dramatic directional lighting creates a high-fashion feel. Ideal for premium products where mystery and exclusivity are part of the brand.',
    bestFor: ['Luxury goods', 'Fragrance', 'Premium spirits', 'Fashion'],
    creatorNote: 'The amber light gradient is calibrated to highlight product edges without overpowering. Works especially well with dark or metallic packaging.',
  },
  'linen-flat-lay': {
    about: 'A warm, organic flat-lay composition suggesting natural materials and considered styling. Perfect for brands rooted in nature and wellness.',
    bestFor: ['Organic products', 'Wellness', 'Handmade goods', 'Tea & herbs'],
    creatorNote: 'The prop elements are deliberately minimal — just enough to suggest a styled surface without competing with your product.',
  },
  'outdoor-lifestyle': {
    about: 'Energetic gradient composition that places your product in an active, natural context. Great for brands with an outdoor or adventure positioning.',
    bestFor: ['Outdoor brands', 'Activewear', 'Supplements', 'Adventure gear'],
    creatorNote: 'The sage-to-forest gradient evokes Nordic landscapes. Try pairing with bold sans-serif typography for maximum impact.',
  },
  'sunrise-window': {
    about: 'Warm amber tones suggest a morning ritual moment. Designed for products that are part of a daily wellness routine.',
    bestFor: ['Morning routines', 'Coffee & tea', 'Vitamins', 'Skincare'],
    creatorNote: 'The window frame lines are subtle but they anchor the composition. This template performs especially well on Instagram stories.',
  },
  'minimal-white': {
    about: 'Ultra-minimal composition with extreme negative space. Lets the product speak entirely for itself with Swiss design restraint.',
    bestFor: ['Tech products', 'Pharmaceutical', 'Premium minimal brands', 'Design objects'],
    creatorNote: 'Restraint is the design. Every pixel of whitespace is intentional. This template works best when your product packaging is already strong.',
  },
  'urban-street': {
    about: 'Cool-toned urban composition with architectural grid lines and ghost typography. Places your product in a contemporary city context.',
    bestFor: ['Streetwear', 'Urban lifestyle', 'Tech accessories', 'Modern food brands'],
    creatorNote: 'The ghost typography uses your brand initials at massive scale — it creates depth without distraction. Works great for social media.',
  },
  'night-neon': {
    about: 'Dramatic dark composition with a soft ambient glow. Creates a premium late-night atmosphere around your product.',
    bestFor: ['Night routines', 'Premium beverages', 'Gaming accessories', 'Fragrance'],
    creatorNote: 'The glow effect is rendered in your brand color, so it automatically feels on-brand. Looks stunning on OLED screens.',
  },
  'raw-concrete': {
    about: 'Industrial brutalist aesthetic with subtle concrete texture. For brands that embrace raw materiality and honest design.',
    bestFor: ['Industrial design', 'Architecture brands', 'Craft products', 'Tools & hardware'],
    creatorNote: 'The repeating gradient pattern mimics concrete grain at a subtle level. Pairs well with products that have clean geometric packaging.',
  },
  'forest-floor': {
    about: 'Deep forest green composition with organic shapes suggesting a natural woodland setting. Grounded and earthy.',
    bestFor: ['Herbal supplements', 'Eco products', 'Outdoor wellness', 'Natural cosmetics'],
    creatorNote: 'The ellipse shapes suggest dappled light through a forest canopy. This is our most popular template for Scandinavian wellness brands.',
  },
  'rooftop-golden-hour': {
    about: 'Warm amber gradient with a skyline silhouette. Captures the optimism and energy of a Stockholm summer evening.',
    bestFor: ['Lifestyle brands', 'Premium beverages', 'Event marketing', 'Summer collections'],
    creatorNote: 'The skyline bars at the bottom are abstract enough to suggest any city. The warm gradient is universally flattering for product photography.',
  },
  'cafe-counter': {
    about: 'Rich brown tones suggesting a premium wooden counter surface. Perfect for products experienced in café and ritual contexts.',
    bestFor: ['Coffee brands', 'Artisan food', 'Premium tea', 'Bakery products'],
    creatorNote: 'The warm radial glow simulates ambient café lighting — cozy and inviting. Works beautifully for food and beverage brands.',
  },
};

const fallbackDesc = {
  about: 'A carefully crafted template composition designed for modern product photography. Optimised for social media and marketing materials.',
  bestFor: ['Product photography', 'Social media', 'Marketing', 'Brand content'],
  creatorNote: 'This template has been tested across hundreds of product types and consistently delivers professional results.',
};

const exampleVariations = [
  { topOffset: '42%', leftOffset: '50%', overlayOpacity: 0.0, height: 240 },
  { topOffset: '48%', leftOffset: '48%', overlayOpacity: 0.05, height: 200 },
  { topOffset: '44%', leftOffset: '52%', overlayOpacity: 0.02, height: 260 },
  { topOffset: '46%', leftOffset: '50%', overlayOpacity: 0.08, height: 180 },
  { topOffset: '43%', leftOffset: '49%', overlayOpacity: 0.04, height: 220 },
  { topOffset: '47%', leftOffset: '51%', overlayOpacity: 0.06, height: 200 },
];

export function TemplatePreviewModal({ template, open, onClose, onUseTemplate, brandName }: Props) {
  const [activeTab, setActiveTab] = useState<'examples' | 'details'>('examples');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (!open || !template) return null;

  // Use template description from database, fallback to hardcoded for backward compatibility
  const desc = template.description ? {
    about: template.description,
    bestFor: template.best_for || [], // Use best_for field from database if available
    creatorNote: 'This template has been carefully crafted and tested for professional results.'
  } : (templateDescriptions[template.id] || fallbackDesc);
  const platforms = ['Instagram', 'Facebook', 'General'];

  const handleUse = () => {
    onClose();
    onUseTemplate(template);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80" />

      {/* Modal */}
      <div
        className="relative z-10 bg-background border border-border flex flex-col"
        style={{ maxWidth: 900, width: '92vw', maxHeight: '88vh', borderRadius: 16, overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-muted/50 hover:bg-muted flex items-center justify-center transition-colors"
        >
          <X size={16} className="text-muted-foreground" />
        </button>

        {/* Header */}
        <div className="px-7 pt-6 pb-0 flex items-start justify-between gap-4 flex-shrink-0">
          <div>
            <h2 className="font-display text-[22px] text-foreground">{template.name}</h2>
            <div className="flex items-center gap-2 mt-2">
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-[10px] font-ui font-bold text-primary-foreground">P</div>
              <span className="text-[13px] font-ui text-muted-foreground">ProStudio Team</span>
              <span className="text-[11px] font-ui rounded-[10px] px-2.5 py-0.5" style={{ background: 'hsl(var(--primary) / 0.12)', color: 'hsl(var(--primary))' }}>
                {template.uses} uses
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-[11px] font-ui text-muted-foreground rounded-[10px] border border-border px-3 py-1">
              {template.category}
            </span>
            <button
              onClick={handleUse}
              className="h-10 rounded-lg px-5 text-[13px] font-ui font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Use this template →
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-7 pt-3 flex-shrink-0">
          <div className="flex gap-6">
            {(['examples', 'details'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="text-[13px] font-ui pb-2 border-b-2 transition-colors"
                style={{
                  borderColor: activeTab === tab ? 'hsl(var(--primary))' : 'transparent',
                  color: activeTab === tab ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                }}
              >
                {tab === 'examples' ? 'Example outputs' : 'Template details'}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'examples' ? (
            <div className="px-7 py-5">
              <div className="columns-2 md:columns-3 gap-3">
                {exampleVariations.map((v, i) => (
                  <div
                    key={i}
                    className="break-inside-avoid mb-3 rounded-[10px] overflow-hidden cursor-pointer relative group"
                    style={{ height: v.height }}
                    onClick={() => setLightboxIndex(i)}
                  >
                    <div className="w-full h-full relative" style={{ transform: 'scale(1)', transformOrigin: 'top left' }}>
                      <TemplateCardPreview
                        template={{ id: template.id, name: template.name, color: '', aspect: 'square', uses: '0', creator: '', category: template.category || '' } as Template}
                        brandName={brandName}
                      />
                      {/* Variation overlay for visual diversity */}
                      <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${v.overlayOpacity})` }} />
                    </div>
                    {/* Override height */}
                    <style>{`
                      .break-inside-avoid > div:first-child > div:first-child { height: 100% !important; }
                    `}</style>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors cursor-zoom-in" />
                  </div>
                ))}
              </div>
              <p className="text-[12px] font-ui text-muted-foreground text-center mt-5 pb-2">
                Examples generated with sample products. Your brand colors and product image will be applied when you use this template.
              </p>
            </div>
          ) : (
            <div className="px-7 py-5">
              {/* About */}
              <div>
                <p className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider mb-2">About this template</p>
                <p className="text-[13px] font-ui text-muted-foreground leading-relaxed">{desc.about}</p>
              </div>

              {/* Best for */}
              <div className="mt-5">
                <p className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider mb-2">Best for</p>
                <div className="flex flex-wrap gap-2">
                  {desc.bestFor.map((b) => (
                    <span key={b} className="text-[12px] font-ui rounded-lg border border-border bg-muted/50 px-3 py-1 text-muted-foreground">{b}</span>
                  ))}
                </div>
              </div>

              {/* Platform outputs */}
              <div className="mt-5">
                <p className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider mb-2">Platform outputs</p>
                <div className="flex flex-wrap gap-2">
                  {platforms.map((p) => (
                    <span key={p} className="text-[12px] font-ui rounded-lg border border-border bg-muted/50 px-3 py-1 text-muted-foreground flex items-center gap-1.5">
                      {p === 'Instagram' && <Instagram size={12} />}
                      {p}
                    </span>
                  ))}
                </div>
              </div>

              {/* Creator notes */}
              <div className="mt-5">
                <p className="text-[11px] font-ui text-muted-foreground uppercase tracking-wider mb-2">Creator notes</p>
                <div className="rounded-lg bg-muted/50 border border-border p-4 flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-[10px] font-ui font-bold text-primary-foreground flex-shrink-0">P</div>
                  <p className="text-[12px] font-ui text-muted-foreground leading-relaxed">{desc.creatorNote}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-7 py-4 border-t border-border flex items-center justify-between flex-shrink-0">
          <span className="text-[12px] font-ui text-muted-foreground">{template.uses} founders have used this template</span>
          <button
            onClick={handleUse}
            className="h-10 rounded-lg px-5 text-[13px] font-ui font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Use this template →
          </button>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.85)' }}
          onClick={() => setLightboxIndex(null)}
        >
          <button
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <X size={16} className="text-white" />
          </button>

          {lightboxIndex > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <ChevronLeft size={20} className="text-white" />
            </button>
          )}

          {lightboxIndex < exampleVariations.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <ChevronRight size={20} className="text-white" />
            </button>
          )}

          <div
            className="rounded-xl overflow-hidden"
            style={{ maxWidth: 600, maxHeight: 600, width: '90vw', aspectRatio: '1' }}
            onClick={(e) => e.stopPropagation()}
          >
            <TemplateCardPreview
              template={{ id: template.id, name: template.name }}
              brandName={brandName}
            />
            <style>{`
              /* Force lightbox preview to fill */
              .rounded-xl > div:first-child { height: 100% !important; }
            `}</style>
          </div>
        </div>
      )}
    </div>
  );
}
