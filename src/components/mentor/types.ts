export interface MentorBrand {
  id: string;
  name: string;
  colorClass: string; // tailwind bg class
  startedDate: string;
}

export type MilestoneCategory =
  | "Brand Discovery"
  | "Campaign Strategy"
  | "Customer Insight"
  | "Product Positioning"
  | "Growth Brainstorm"
  | "Pitch Preparation";

export const categoryColors: Record<MilestoneCategory, string> = {
  "Brand Discovery": "text-primary border-primary",
  "Campaign Strategy": "text-blue-400 border-blue-400",
  "Customer Insight": "text-teal-400 border-teal-400",
  "Product Positioning": "text-purple-400 border-purple-400",
  "Growth Brainstorm": "text-emerald-400 border-emerald-400",
  "Pitch Preparation": "text-orange-400 border-orange-400",
};

export const categoryTextColors: Record<MilestoneCategory, string> = {
  "Brand Discovery": "text-primary",
  "Campaign Strategy": "text-blue-400",
  "Customer Insight": "text-teal-400",
  "Product Positioning": "text-purple-400",
  "Growth Brainstorm": "text-emerald-400",
  "Pitch Preparation": "text-orange-400",
};

export interface Milestone {
  id: string;
  category: MilestoneCategory;
  name: string;
  timeAgo: string;
  stage_key: string | null;
  is_substage_milestone: boolean;
  created_at: string;
}

export interface Message {
  id: string;
  role: "ai" | "founder";
  content: string;
}

export interface InlineSavePrompt {
  afterMessageId: string;
  label: string;
  dnaField: string;
  value: string;
}

export interface MilestoneMarker {
  beforeMessageId: string;
  milestoneId: string;
}

export interface BrandDNAField {
  key: string;
  label: string;
  value: string | null;
  savedFrom?: string;
  savedTimeAgo?: string;
}

export interface BrandData {
  brand: MentorBrand;
  milestones: Milestone[];
  messages: Message[];
  savePrompts: InlineSavePrompt[];
  milestoneMarkers: MilestoneMarker[];
  dnaFields: BrandDNAField[];
}
