import { useState, useEffect } from "react";
import { Template } from "./types";
import { TemplateGrid } from "./TemplateGrid";
import { TemplateModal } from "./TemplateModal";
import { CreatorBanner } from "./CreatorBanner";
import { getPublishedTemplates, getTemplateCategories, incrementTemplateUsage } from "@/services/templateService";

interface Props {
  brandId: string;
  brandName: string;
  brandColor: string;
}

export function DigitalProductTab({ brandName }: Props) {
  const [selected, setSelected] = useState<Template | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [categories, setCategories] = useState<string[]>(["All"]);
  const [loading, setLoading] = useState(true);
  const initials = brandName.split(" ").map((w) => w[0]).join("").slice(0, 3);

  // Fetch templates and categories from database
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch templates
        const { data: templatesData, error: templatesError } = await getPublishedTemplates('digital');
        if (templatesError) {
          console.error('Error fetching digital templates:', templatesError);
        } else {
          // Transform database data to match Template interface
          const transformedTemplates: Template[] = (templatesData || []).map((template: any) => ({
            id: template.id,
            name: template.name,
            color: template.preview_background || '#1A2A3A',
            aspect: 'square', // Default for digital templates
            uses: template.uses_count ? `${(template.uses_count / 1000).toFixed(1)}k` : '0',
            creator: template.creator_profiles?.display_name || 'Unknown Creator',
            category: template.category,
            description: template.description,
            generation_prompt: template.generation_prompt,
            template_preview_images: template.template_preview_images || [],
            cover_image_url: template.cover_image_url,
            creator_id: template.creator_id,
            status: template.status,
            best_for: template.best_for || []
          }));
          setTemplates(transformedTemplates);
        }

        // Fetch categories
        const categoriesData = await getTemplateCategories('digital');
        setCategories(categoriesData);
        
      } catch (error) {
        console.error('Error fetching digital template data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Handle template selection with usage tracking
  const handleTemplateSelect = async (template: Template) => {
    setSelected(template);
    
    // Increment template usage count
    try {
      await incrementTemplateUsage(template.id);
      // Update local usage count
      setTemplates(prev => prev.map(t => 
        t.id === template.id 
          ? { ...t, uses: t.uses === '0' ? '0.1k' : t.uses }
          : t
      ));
    } catch (error) {
      console.error('Error incrementing template usage:', error);
    }
  };

  return (
    <>
      <TemplateGrid 
        templates={templates} 
        categories={categories} 
        onSelect={handleTemplateSelect} 
        brandName={brandName} 
        templateType="digital" 
        loading={loading}
      />
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
