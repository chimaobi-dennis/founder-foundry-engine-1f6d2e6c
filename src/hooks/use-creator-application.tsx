import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface CreatorApplication {
  id: string;
  user_id: string;
  motivation: string;
  portfolio_url: string | null;
  experience: string;
  sample_prompt: string;
  status: string;
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
    const { data } = await supabase
      .from("creator_applications" as any)
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
    motivation: string;
    portfolio_url: string;
    experience: string;
    sample_prompt: string;
  }) => {
    if (!user) throw new Error("Not authenticated");
    const { data, error } = await supabase
      .from("creator_applications" as any)
      .insert({
        user_id: user.id,
        ...formData,
      } as any)
      .select()
      .single();
    if (error) throw error;
    setApplication(data as CreatorApplication);
    return data;
  };

  return { application, loading, submitApplication, refetch: fetchApplication };
}
