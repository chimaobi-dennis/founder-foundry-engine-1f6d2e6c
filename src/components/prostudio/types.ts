export interface Template {
  id: string;
  name: string;
  color: string;
  aspect: "square" | "portrait" | "landscape";
  uses: string;
  creator: string;
  category: string;
  description?: string;
  generation_prompt?: string;
  cover_image_url?: string;
  creator_id?: string;
  status?: string;
  best_for?: string[];
  template_preview_images?: Array<{
    id: string;
    image_url: string;
    is_cover: boolean;
    sort_order: number;
    caption?: string;
  }>;
}

export interface TemplateModalProps {
  template: Template | null;
  open: boolean;
  onClose: () => void;
  type: "physical" | "digital";
  brandName: string;
  brandInitials: string;
}
