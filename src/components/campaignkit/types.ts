export interface AssetCard {
  id: string;
  name: string;
  color: string;
  platform: string;
  platformColor: string;
}

export interface BriefData {
  productName: string;
  targetAudience: string;
  campaignGoal: string;
  keyBenefit: string;
  callToAction: string;
  // AI Workspace Configuration
  visualDirection?: string;
  visualAssets?: string[];
  layoutComplexity?: string;
  creativeMode?: string;
  aiFreedom?: number;
  imageDensity?: number;
}

export type PlatformTab =
  | "Headlines"
  | "Instagram"
  | "Facebook Ad"
  | "Google Ad"
  | "Email"
  | "WhatsApp"
  | "Twitter/X"
  | "SMS";

export const platformTabs: PlatformTab[] = [
  "Headlines",
  "Instagram",
  "Facebook Ad",
  "Google Ad",
  "Email",
  "WhatsApp",
  "Twitter/X",
  "SMS",
];

export const campaignGoals = [
  "Drive first purchase",
  "Build awareness",
  "Grow following",
  "Promote offer",
  "Launch product",
];

export const toneOptions = [
  "Confident and warm",
  "Bold and direct",
  "Playful",
  "Professional",
  "Urgent",
];

export function getRoastAssets(): AssetCard[] {
  return [
    { id: "a1", name: "Daily Stack on counter", color: "#2D4A3E", platform: "Instagram", platformColor: "#E1306C" },
    { id: "a2", name: "Testimonial card", color: "#1A2A3A", platform: "Facebook", platformColor: "#4267B2" },
    { id: "a3", name: "Feature card", color: "#1A3A38", platform: "General", platformColor: "#6B7280" },
    { id: "a4", name: "Announcement visual", color: "#1E2E1E", platform: "Instagram", platformColor: "#E1306C" },
    { id: "a5", name: "Lifestyle scene", color: "#3A4A3E", platform: "Facebook", platformColor: "#4267B2" },
    { id: "a6", name: "Pricing card", color: "#F5F0E8", platform: "General", platformColor: "#6B7280" },
  ];
}

export function getLagosAssets(): AssetCard[] {
  return [
    { id: "a1", name: "Studio dashboard preview", color: "#1A3A5C", platform: "Instagram", platformColor: "#E1306C" },
    { id: "a2", name: "Feature card", color: "#1B3352", platform: "Facebook", platformColor: "#4267B2" },
    { id: "a3", name: "Promo banner", color: "#2A4A6C", platform: "General", platformColor: "#6B7280" },
    { id: "a4", name: "Launch teaser", color: "#1E1E2E", platform: "Instagram", platformColor: "#E1306C" },
    { id: "a5", name: "Workflow scene", color: "#D0D8E4", platform: "Facebook", platformColor: "#4267B2" },
    { id: "a6", name: "Feature list", color: "#F0F4F8", platform: "General", platformColor: "#6B7280" },
  ];
}

export function getRoastBrief(): BriefData {
  return {
    productName: "Nordform Daily Stack",
    targetAudience: "Stockholm professionals 28–42",
    campaignGoal: "Drive first purchase",
    keyBenefit: "Science-based supplements with honest claims — no fluff",
    callToAction: "Start your daily ritual",
    visualDirection: "minimal",
    visualAssets: ["product_photos", "brand_images"],
    layoutComplexity: "balanced",
    creativeMode: "on_brand",
    aiFreedom: 50,
    imageDensity: 50,
  };
}

export function getLagosBrief(): BriefData {
  return {
    productName: "Sthlm Studio",
    targetAudience: "Swedish creative freelancers and small studios",
    campaignGoal: "Build awareness",
    keyBenefit: "All-in-one studio management built for how Stockholm works",
    callToAction: "Start your free trial",
    visualDirection: "editorial",
    visualAssets: ["product_photos", "svg_graphics"],
    layoutComplexity: "advanced",
    creativeMode: "explore",
    aiFreedom: 60,
    imageDensity: 40,
  };
}

export interface PlatformContent {
  copy: string;
  headline?: string;
  subject?: string;
  charCount?: string;
}

export function getRoastContent(): Record<PlatformTab, PlatformContent> {
  return {
    Headlines: {
      copy: "",
    },
    Instagram: {
      copy: "Most supplement brands overclaim. We do not. Nordform Daily Stack — Lion's Mane, Ashwagandha, Reishi. Evidence-based. Honestly communicated. Built for Stockholm. ✦ Link in bio.",
    },
    "Facebook Ad": {
      copy: "You are skeptical of wellness culture. So are we. Nordform is built for people who want the science without the noise. Three supplements. One daily ritual. Honest results.",
    },
    "Google Ad": {
      headline: "Nordform | Science-Based Supplements",
      copy: "Premium adaptogens for Stockholm professionals. No overclaiming. No fluff. Evidence-based formulas delivered to your door.",
    },
    Email: {
      subject: "Supplements for people who hate supplements",
      copy: "If you have ever rolled your eyes at a wellness brand, we built Nordform for you.\n\nOur Daily Stack is three adaptogens — Lion's Mane for focus, Ashwagandha for stress, Reishi for sleep. Evidence-based. Honestly communicated. No miracle claims.\n\nStart your daily ritual today.",
    },
    WhatsApp: {
      copy: "Hi — we are Nordform, Stockholm's science-first supplement brand. Three adaptogens, one daily ritual, honest claims. Want to try the Daily Stack? Reply YES.",
    },
    "Twitter/X": {
      copy: "Most supplement brands overclaim. We do not.\n\nNordform Daily Stack — science-based adaptogens for Stockholm professionals. No fluff.\n\n✦ nordform.se/start",
    },
    SMS: {
      copy: "Nordform: Science-based adaptogens for Stockholm. No fluff, honest results. First order 20% off → nordform.se/start",
      charCount: "118 / 160",
    },
  };
}

export function getLagosContent(): Record<PlatformTab, PlatformContent> {
  return {
    Headlines: { copy: "" },
    Instagram: {
      copy: "Built for how Stockholm works. Sthlm Studio — proposals, time tracking, invoicing. One tool. Zero bloat. ✦ Link in bio.",
    },
    "Facebook Ad": {
      copy: "Swedish freelancers deserve better than enterprise tools. Sthlm Studio is project management built for creative studios — clean, fast, respectful of your time.",
    },
    "Google Ad": {
      headline: "Sthlm Studio | Creative Studio Management",
      copy: "Project management for Swedish freelancers and small studios. Proposals, time tracking, invoicing. Start free.",
    },
    Email: {
      subject: "Your studio deserves better tools",
      copy: "We built Sthlm Studio for one reason — creative freelancers in Stockholm deserve tools that respect how they actually work.\n\nProposals, time tracking, invoicing — all in one place, without the enterprise bloat.\n\nStart your free trial today.",
    },
    WhatsApp: {
      copy: "Hi — Sthlm Studio here. We built project management for Swedish creative freelancers. Want to try it? Reply YES!",
    },
    "Twitter/X": {
      copy: "Enterprise tools were not built for you. Sthlm Studio was.\n\nProject management for Swedish creative freelancers.\n\n✦ sthlmstudio.se",
    },
    SMS: {
      copy: "Sthlm Studio: Project management for creative freelancers. Start free → sthlmstudio.se/start",
      charCount: "92 / 160",
    },
  };
}

export const roastHeadlines = [
  "The supplement brand for people who hate supplements",
  "Science-based. Honestly communicated.",
  "Your morning ritual, evidence-backed",
  "Built for Stockholm. Built for skeptics.",
  "Three supplements. One daily ritual.",
  "Clarity from the north",
];

export const lagosHeadlines = [
  "Built for how Stockholm works",
  "Creative studio management, simplified",
  "Your projects deserve better tools",
  "Zero bloat. Full control.",
  "Proposals to invoices in one place",
  "Made for Swedish freelancers",
];
