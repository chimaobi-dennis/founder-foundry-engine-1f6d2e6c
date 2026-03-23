export interface LibraryAsset {
  id: string;
  name: string;
  type: "image" | "template" | "document" | "script";
  source: string;
  platform?: string;
  platformColor?: string;
  color: string;
  height: number; // masonry height
  daysAgo: number;
  dateLabel: string;
  // document specific
  docType?: string;
  // script specific
  sceneCount?: number;
  duration?: string;
  // detail panel
  format?: string;
  dimensions?: string;
  fileSize?: string;
  templateName?: string;
}

export function getNordformAssets(): LibraryAsset[] {
  return [
    // Images
    { id: "i1", name: "Marble Luxury — V1", type: "image", source: "ProStudio", platform: "Instagram", platformColor: "#D4A017", color: "#2D4A3E", height: 220, daysAgo: 2, dateLabel: "2 days ago", format: "PNG", dimensions: "600 × 600px", fileSize: "842 KB", templateName: "Marble Luxury" },
    { id: "i2", name: "Marble Luxury — V2", type: "image", source: "ProStudio", platform: "Facebook", platformColor: "#4A90D9", color: "#3A5A4A", height: 180, daysAgo: 2, dateLabel: "2 days ago", format: "PNG", dimensions: "600 × 600px", fileSize: "780 KB", templateName: "Marble Luxury" },
    { id: "i3", name: "Dark Moody Studio — V1", type: "image", source: "ProStudio", platform: "Instagram", platformColor: "#D4A017", color: "#141210", height: 220, daysAgo: 3, dateLabel: "3 days ago", format: "PNG", dimensions: "600 × 600px", fileSize: "920 KB", templateName: "Dark Moody Studio" },
    { id: "i4", name: "Minimal White — V1", type: "image", source: "ProStudio", platform: "General", platformColor: "#8A96A3", color: "#FAFAF8", height: 140, daysAgo: 3, dateLabel: "3 days ago", format: "PNG", dimensions: "600 × 600px", fileSize: "450 KB", templateName: "Minimal White" },
    { id: "i5", name: "Forest Floor — V1", type: "image", source: "ProStudio", platform: "Instagram", platformColor: "#D4A017", color: "#283828", height: 220, daysAgo: 4, dateLabel: "4 days ago", format: "PNG", dimensions: "600 × 600px", fileSize: "890 KB", templateName: "Forest Floor" },
    { id: "i6", name: "Testimonial Card — Nordform", type: "image", source: "ProStudio", platform: "Facebook", platformColor: "#4A90D9", color: "#1A2A4A", height: 180, daysAgo: 5, dateLabel: "5 days ago", format: "PNG", dimensions: "600 × 600px", fileSize: "620 KB", templateName: "Testimonial Card" },
    { id: "i7", name: "Feature Cards — Daily Stack", type: "image", source: "ProStudio", platform: "General", platformColor: "#8A96A3", color: "#1A3A38", height: 140, daysAgo: 5, dateLabel: "5 days ago", format: "PNG", dimensions: "600 × 600px", fileSize: "710 KB", templateName: "Feature Cards" },
    { id: "i8", name: "Rooftop Golden Hour — V1", type: "image", source: "ProStudio", platform: "Instagram", platformColor: "#D4A017", color: "#C87820", height: 220, daysAgo: 7, dateLabel: "1 week ago", format: "PNG", dimensions: "600 × 600px", fileSize: "950 KB", templateName: "Rooftop Golden Hour" },
    { id: "i9", name: "Urban Street — V1", type: "image", source: "ProStudio", platform: "Facebook", platformColor: "#4A90D9", color: "#7A8898", height: 180, daysAgo: 7, dateLabel: "1 week ago", format: "PNG", dimensions: "600 × 600px", fileSize: "830 KB", templateName: "Urban Street" },
    { id: "i10", name: "Announcement — Launch", type: "image", source: "ProStudio", platform: "Instagram", platformColor: "#D4A017", color: "#1A1A2A", height: 220, daysAgo: 7, dateLabel: "1 week ago", format: "PNG", dimensions: "600 × 600px", fileSize: "680 KB", templateName: "Announcement" },
    { id: "i11", name: "Linen Flat Lay — V1", type: "image", source: "ProStudio", platform: "General", platformColor: "#8A96A3", color: "#EDE5D5", height: 220, daysAgo: 14, dateLabel: "2 weeks ago", format: "PNG", dimensions: "600 × 600px", fileSize: "520 KB", templateName: "Linen Flat Lay" },
    { id: "i12", name: "Café Counter — V1", type: "image", source: "ProStudio", platform: "Facebook", platformColor: "#4A90D9", color: "#6A4A30", height: 180, daysAgo: 14, dateLabel: "2 weeks ago", format: "PNG", dimensions: "600 × 600px", fileSize: "760 KB", templateName: "Café Counter" },
    // Documents
    { id: "d1", name: "Nordform Brand Overview", type: "document", source: "DocStudio", docType: "One-Pager", color: "#2D4A3E", height: 100, daysAgo: 3, dateLabel: "3 days ago", format: "PDF", dimensions: "A4", fileSize: "1.2 MB" },
    { id: "d2", name: "Investor Deck — Pre-Seed Round", type: "document", source: "DocStudio", docType: "Pitch Deck", color: "#2D4A3E", height: 100, daysAgo: 7, dateLabel: "1 week ago", format: "PDF", dimensions: "16:9", fileSize: "3.4 MB" },
    { id: "d3", name: "Wholesale Partnership — Apotek Hjärtat", type: "document", source: "DocStudio", docType: "Client Proposal", color: "#2D4A3E", height: 100, daysAgo: 14, dateLabel: "2 weeks ago", format: "PDF", dimensions: "A4", fileSize: "2.1 MB" },
    // Scripts
    { id: "s1", name: "Nordform Origin Story", type: "script", source: "ReelBuilder", platform: "Instagram Reels", platformColor: "#D4A017", color: "#2D4A3E", height: 100, daysAgo: 4, dateLabel: "4 days ago", sceneCount: 5, duration: "60s", format: "Script", dimensions: "9:16", fileSize: "—" },
    { id: "s2", name: "Meet Your Morning — Ep.1", type: "script", source: "ReelBuilder", platform: "TikTok", platformColor: "#E0E0E0", color: "#2D4A3E", height: 100, daysAgo: 7, dateLabel: "1 week ago", sceneCount: 4, duration: "45s", format: "Script", dimensions: "9:16", fileSize: "—" },
  ];
}

export function getSthlmAssets(): LibraryAsset[] {
  return [
    { id: "si1", name: "Dashboard Hero — V1", type: "image", source: "ProStudio", platform: "General", platformColor: "#8A96A3", color: "#1A3A5C", height: 180, daysAgo: 3, dateLabel: "3 days ago", format: "PNG", dimensions: "600 × 600px", fileSize: "720 KB", templateName: "Dashboard Hero" },
    { id: "si2", name: "Feature Announcement", type: "image", source: "ProStudio", platform: "Instagram", platformColor: "#D4A017", color: "#2A4A6C", height: 220, daysAgo: 5, dateLabel: "5 days ago", format: "PNG", dimensions: "600 × 600px", fileSize: "650 KB", templateName: "Feature Announcement" },
    { id: "sd1", name: "Sthlm Studio Pitch Deck", type: "document", source: "DocStudio", docType: "Pitch Deck", color: "#1A3A5C", height: 100, daysAgo: 7, dateLabel: "1 week ago", format: "PDF", dimensions: "16:9", fileSize: "2.8 MB" },
  ];
}
