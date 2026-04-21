import { BrandData, MentorBrand } from "./types";

export const brands: MentorBrand[] = [
  { id: "nordform", name: "Nordform", colorClass: "bg-[#2D4A3E]", startedDate: "Jan 2026" },
  { id: "sthlm", name: "Sthlm Studio", colorClass: "bg-[#1A3A5C]", startedDate: "Feb 2026" },
];

export const roastData: BrandData = {
  brand: brands[0],
  milestones: [
    { id: "m1", category: "Brand Discovery", name: "Identity and skeptic positioning", timeAgo: "2 days ago", stage_key: null, is_substage_milestone: false, created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
    { id: "m2", category: "Brand Discovery", name: "Packaging direction", timeAgo: "5 days ago", stage_key: null, is_substage_milestone: false, created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
    { id: "m3", category: "Customer Insight", name: "Target audience profile", timeAgo: "1 week ago", stage_key: null, is_substage_milestone: false, created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() },
    { id: "m4", category: "Product Positioning", name: "Ritual and consistency positioning", timeAgo: "2 weeks ago", stage_key: null, is_substage_milestone: false, created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString() },
    { id: "m5", category: "Campaign Strategy", name: "Launch strategy", timeAgo: "3 weeks ago", stage_key: null, is_substage_milestone: false, created_at: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString() },
  ],
  messages: [
    { id: "1", role: "ai", content: "Let us start where it matters. You are building a wellness brand in Sweden — a market that is simultaneously very open to health products and deeply skeptical of wellness marketing. How are you planning to avoid sounding like every other adaptogen brand?" },
    { id: "2", role: "founder", content: "That is exactly the tension I am trying to resolve. We want to be science-first but not clinical. Premium but not pretentious." },
    { id: "3", role: "ai", content: "Science-first but not clinical is a real positioning — Oatly did something similar with food. But adaptogen science is genuinely contested. Lion's Mane has promising research, Ashwagandha has solid studies, but a lot of the category makes claims that outrun the evidence. How honest are you willing to be about what the research actually shows versus what customers want to hear?" },
    { id: "4", role: "founder", content: "Completely honest. I think that is actually the differentiator. Swedish consumers are smart. They will respect honesty more than overclaiming." },
    { id: "5", role: "ai", content: "That is a strong instinct and it is right for this market. Stockholm professionals have seen too many wellness brands overpromise. If Nordform says 'the research on this is promising but not conclusive — here is what we know and what we do not' that builds more trust than ten customer testimonials. It is a hard position to hold commercially though. Have you thought about how you communicate uncertainty without undermining purchase confidence?" },
    { id: "6", role: "founder", content: "We frame it around ritual and consistency rather than miracle results. The product works if you are consistent. We are selling a daily practice not a cure." },
    { id: "7", role: "ai", content: "Ritual and consistency is smart because it shifts the success metric from the product to the behavior — which means you are not responsible for results a customer did not earn by actually taking it daily. That is honest and it protects the brand. What does the physical product look like? Because in Sweden the packaging has to carry a lot of the brand weight." },
    { id: "8", role: "founder", content: "Minimal white packaging. Forest green typography. Very clean. Feels more like a design object than a supplement bottle." },
    { id: "9", role: "ai", content: "That is the right direction for Stockholm. Supplements that look good on a kitchen counter rather than hidden in a cabinet. The packaging signals intelligence before the customer reads a word. Who is your specific customer — not a demographic, a person. Describe them." },
    { id: "10", role: "founder", content: "Someone like me. Mid-thirties, works in tech or design, goes to Lidingöloppet, reads about longevity, slightly embarrassed by the wellness industry but genuinely interested in optimising how they feel." },
    { id: "11", role: "ai", content: "That self-awareness about being embarrassed by the wellness industry is gold. That is your brand voice — it should speak to someone who would normally roll their eyes at this category. Nordform is the supplement brand for people who hate supplement brands. That is a real positioning." },
    { id: "12", role: "founder", content: "That is exactly it." },
    { id: "13", role: "ai", content: "Write that down. That sentence is your brief for everything — packaging copy, social media, investor pitch. Now tell me about the Swedish market specifically. Who are you competing with and what are they getting wrong?" },
  ],
  milestoneMarkers: [
    { beforeMessageId: "1", milestoneId: "m1" },
    { beforeMessageId: "8", milestoneId: "m2" },
  ],
  savePrompts: [
    { afterMessageId: "5", label: "Save brand promise: Supplements that respect your intelligence", dnaField: "Core promise", value: "Supplements that respect your intelligence" },
    { afterMessageId: "6", label: "Save positioning: Ritual and consistency over miracle results", dnaField: "Positioning", value: "Ritual and consistency over miracle results" },
    { afterMessageId: "11", label: "Save brand voice: The supplement brand for people who hate supplement brands", dnaField: "Voice", value: "The supplement brand for people who hate supplement brands" },
  ],
  dnaFields: [
    { key: "Brand name", label: "Brand name", value: "Nordform", savedFrom: "Brand Discovery", savedTimeAgo: "2 days ago" },
    { key: "Industry", label: "Industry", value: "Functional wellness and adaptogens", savedFrom: "Brand Discovery", savedTimeAgo: "2 days ago" },
    { key: "Voice", label: "Voice", value: "The supplement brand for people who hate supplement brands", savedFrom: "Brand Discovery", savedTimeAgo: "2 days ago" },
    { key: "Target audience", label: "Target audience", value: "Stockholm professionals 28–42, skeptical of wellness culture, design-aware", savedFrom: "Customer Insight", savedTimeAgo: "1 week ago" },
    { key: "Positioning", label: "Positioning", value: "Ritual and consistency over miracle results", savedFrom: "Product Positioning", savedTimeAgo: "2 weeks ago" },
    { key: "Brand references", label: "Brand references", value: "Aesop meets Oatly — design-led, scientifically grounded", savedFrom: "Brand Discovery", savedTimeAgo: "2 days ago" },
    { key: "Core promise", label: "Core promise", value: "Supplements that respect your intelligence", savedFrom: "Brand Discovery", savedTimeAgo: "2 days ago" },
    { key: "Campaign strategy", label: "Campaign strategy", value: null },
    { key: "Customer insight", label: "Customer insight", value: null },
    { key: "Product positioning", label: "Product positioning", value: null },
  ],
};

export const lagosData: BrandData = {
  brand: brands[1],
  milestones: [
    { id: "lm1", category: "Brand Discovery", name: "Initial brand exploration", timeAgo: "3 days ago", stage_key: null, is_substage_milestone: false, created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
  ],
  messages: [
    { id: "l1", role: "ai", content: "Welcome. Let us talk about Sthlm Studio. You are building a SaaS tool for creative freelancers in Stockholm — tell me why this one will be different from everything else on the market." },
    { id: "l2", role: "founder", content: "Most project management tools are built for big teams. Swedish freelancers and small studios need something that respects how they actually work — project-based, client-facing, minimal overhead." },
    { id: "l3", role: "ai", content: "That is a meaningful differentiator. You are not building another Asana clone — you are building for the specific workflow of a two-person design studio or a solo architect. The constraint is your advantage. Tell me more about the freelancers you are starting with." },
    { id: "l4", role: "founder", content: "Designers, photographers, architects, copywriters. People who need proposals, time tracking, and invoicing in one place without the enterprise bloat." },
  ],
  milestoneMarkers: [
    { beforeMessageId: "l1", milestoneId: "lm1" },
  ],
  savePrompts: [
    { afterMessageId: "l3", label: "Save positioning: Built for how Stockholm works", dnaField: "Positioning", value: "Built for how Stockholm works" },
  ],
  dnaFields: [
    { key: "Brand name", label: "Brand name", value: "Sthlm Studio", savedFrom: "Brand Discovery", savedTimeAgo: "3 days ago" },
    { key: "Industry", label: "Industry", value: "SaaS — freelance and creative studio management", savedFrom: "Brand Discovery", savedTimeAgo: "3 days ago" },
    { key: "Voice", label: "Voice", value: null },
    { key: "Target audience", label: "Target audience", value: null },
    { key: "Positioning", label: "Positioning", value: null },
    { key: "Brand references", label: "Brand references", value: null },
    { key: "Core promise", label: "Core promise", value: null },
    { key: "Campaign strategy", label: "Campaign strategy", value: null },
    { key: "Customer insight", label: "Customer insight", value: null },
    { key: "Product positioning", label: "Product positioning", value: null },
  ],
};
