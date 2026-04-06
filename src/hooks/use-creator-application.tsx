import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface CreatorApplication {
  id: string;
  user_id: string;
  why_apply: string;
  portfolio_url: string | null;
  prompt_engineering_experience: string;
  sample_prompt: string;
  motivation: string | null;
  status: string;
  reviewed_at: string | null;
  reviewer_notes: string | null;
  created_at: string;
}

export function useCreatorApplication() {
  const { user } = useAuth();
  const [application, setApplication] = useState<CreatorApplication | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchApplication = async () => {
    if (!user) {
      setApplication(null);
      setLoading(false);
      return;
    }
    const { data } = await (supabase as any)
      .from("creator_applications")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    setApplication(data as CreatorApplication | null);
    setLoading(false);
  };

  useEffect(() => {
    fetchApplication();
  }, [user]);

  const submitApplication = async (formData: {
    whyApply: string;
    portfolio_url: string;
    promptEngineeringExperience: string;
    samplePrompt: string;
    motivation?: string;
  }) => {
    if (!user) throw new Error("Not authenticated");
    const { data, error } = await (supabase as any)
      .from("creator_applications")
      .insert({
        user_id: user.id,
        why_apply: formData.whyApply,
        portfolio_url: formData.portfolio_url || null,
        prompt_engineering_experience: formData.promptEngineeringExperience,
        sample_prompt: formData.samplePrompt,
        motivation: formData.motivation || null,
        status: 'pending'
      })
      .select()
      .single();
    if (error) throw error;
    setApplication(data as CreatorApplication);
    return data;
  };

  return { application, loading, submitApplication, refetch: fetchApplication };
}
