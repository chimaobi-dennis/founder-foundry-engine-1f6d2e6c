import { useState } from "react";
import { Template } from "./types";
import { TemplateGrid } from "./TemplateGrid";
import { TemplateModal } from "./TemplateModal";
import { CreatorBanner } from "./CreatorBanner";

const categories = ["All", "Testimonial", "Pricing", "Feature Cards", "Announcement", "App Mockup", "Brand Story", "Comparison"];

const templates: Template[] = [
  { id: "d1", name: "Bold Testimonial", color: "#1A2A4A", aspect: "square", uses: "4.1k", creator: "ProStudio Team", category: "Testimonial" },
  { id: "d2", name: "Clean Pricing Card", color: "#F5F2EC", aspect: "portrait", uses: "3.6k", creator: "ProStudio Team", category: "Pricing" },
  { id: "d3", name: "Feature Showcase", color: "#1A3A38", aspect: "landscape", uses: "2.9k", creator: "ProStudio Team", category: "Feature Cards" },
  { id: "d4", name: "Product Announcement", color: "#3A2A10", aspect: "square", uses: "2.4k", creator: "ProStudio Team", category: "Announcement" },
  { id: "d5", name: "App Store Preview", color: "#303848", aspect: "portrait", uses: "2.2k", creator: "ProStudio Team", category: "App Mockup" },
  { id: "d6", name: "Comparison Table", color: "#EEF0F2", aspect: "landscape", uses: "2.0k", creator: "ProStudio Team", category: "Comparison" },
  { id: "d7", name: "Brand Story Card", color: "#EDE5D8", aspect: "square", uses: "1.8k", creator: "ProStudio Team", category: "Brand Story" },
  { id: "d8", name: "Social Proof Wall", color: "#282828", aspect: "landscape", uses: "1.6k", creator: "ProStudio Team", category: "Testimonial" },
  { id: "d9", name: "Launch Countdown", color: "#3A1818", aspect: "square", uses: "1.4k", creator: "ProStudio Team", category: "Announcement" },
  { id: "d10", name: "Stats & Numbers", color: "#1A2030", aspect: "landscape", uses: "1.3k", creator: "ProStudio Team", category: "Feature Cards" },
  { id: "d11", name: "Team Introduction", color: "#D8E0D0", aspect: "portrait", uses: "1.1k", creator: "ProStudio Team", category: "Brand Story" },
  { id: "d12", name: "Partnership Proposal", color: "#182818", aspect: "square", uses: "980", creator: "ProStudio Team", category: "Comparison" },
];

interface Props {
  brandId: string;
  brandName: string;
  brandColor: string;
}

export function DigitalProductTab({ brandName }: Props) {
  const [selected, setSelected] = useState<Template | null>(null);
  const initials = brandName.split(" ").map((w) => w[0]).join("").slice(0, 3);

  return (
    <>
      <TemplateGrid templates={templates} categories={categories} onSelect={setSelected} brandName={brandName} />
      <CreatorBanner />
      <TemplateModal
        template={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        type="digital"
        brandName={brandName}
        brandInitials={initials}
      />
    </>
  );
}
