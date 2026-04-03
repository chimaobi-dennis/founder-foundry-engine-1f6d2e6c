import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Profile {
  id: string;
  full_name: string | null;
  profession: string | null;
  brand_status: string | null;
  team_size: string | null;
  onboarding_completed: boolean;
  role: string | null;
}

interface ProfileContextType {
  profile: Profile | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType>({
  profile: null,
  loading: true,
  refetch: async () => {},
});

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    // Try with role column first, fall back without it
    let result = await (supabase as any)
      .from("profiles")
      .select("id, full_name, profession, brand_status, team_size, onboarding_completed, role")
      .eq("id", user.id)
      .single();
    
    if (result.error) {
      // role column may not exist yet — retry without it
      result = await supabase
        .from("profiles")
        .select("id, full_name, profession, brand_status, team_size, onboarding_completed")
        .eq("id", user.id)
        .single();
    }
    
    const data = result.data as any;
    setProfile(data ? { ...data, role: data.role || "founder" } as Profile : null);
    setLoading(false);
  };

  useEffect(() => {
    fetchProfile();
  }, [user]);

  return (
    <ProfileContext.Provider value={{ profile, loading, refetch: fetchProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export const useProfile = () => useContext(ProfileContext);
