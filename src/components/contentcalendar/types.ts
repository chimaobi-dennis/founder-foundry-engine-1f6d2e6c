export interface CalendarAsset {
  id: string;
  name: string;
  color: string;
  platform: string;
  platformColor: string;
}

// "platform" is the canonical platform slug from content_platforms (e.g. "instagram",
// "facebook_ad", "twitter_x", "linkedin", "tiktok", "whatsapp", "email"). Older code
// also used display names like "Instagram"; we accept both via platformStyles below.
export interface CalendarSlot {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  platform: string;
  title: string;
  copy: string;
  assetId?: string;
  // Optional fields populated when this slot maps to a real calendar_post.
  calendarPostId?: string;
  briefId?: string;
  visualThumbUrl?: string | null;
  visualHtml?: string | null;
  headline?: string | null;
}

export const platformStyles: Record<string, { bg: string; text: string; dot: string }> = {
  // Slug-based (canonical)
  instagram: { bg: "rgba(225,48,108,0.13)", text: "#E1306C", dot: "#E1306C" },
  facebook_ad: { bg: "rgba(24,119,242,0.13)", text: "#1877F2", dot: "#1877F2" },
  facebook: { bg: "rgba(24,119,242,0.13)", text: "#1877F2", dot: "#1877F2" },
  twitter_x: { bg: "rgba(138,150,163,0.18)", text: "#8A96A3", dot: "#8A96A3" },
  linkedin: { bg: "rgba(10,102,194,0.13)", text: "#0A66C2", dot: "#0A66C2" },
  tiktok: { bg: "rgba(255,99,99,0.15)", text: "#FF6363", dot: "#FF6363" },
  whatsapp: { bg: "rgba(37,211,102,0.13)", text: "#25D366", dot: "#25D366" },
  email: { bg: "rgba(212,160,23,0.18)", text: "#D4A017", dot: "#D4A017" },
  // Legacy display-name fallbacks
  Instagram: { bg: "rgba(225,48,108,0.13)", text: "#E1306C", dot: "#E1306C" },
  Facebook: { bg: "rgba(24,119,242,0.13)", text: "#1877F2", dot: "#1877F2" },
  "Twitter/X": { bg: "rgba(138,150,163,0.18)", text: "#8A96A3", dot: "#8A96A3" },
  WhatsApp: { bg: "rgba(37,211,102,0.13)", text: "#25D366", dot: "#25D366" },
};

export function platformLabel(slug: string): string {
  const map: Record<string, string> = {
    instagram: "Instagram",
    facebook: "Facebook",
    facebook_ad: "Facebook",
    twitter_x: "X / Twitter",
    linkedin: "LinkedIn",
    tiktok: "TikTok",
    whatsapp: "WhatsApp",
    email: "Email",
  };
  return map[slug] || slug;
}

// Kept exported for backwards compatibility — no longer rendered anywhere.
export const calendarAssets: CalendarAsset[] = [];
export const defaultSlots: CalendarSlot[] = [];
