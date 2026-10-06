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
  // Which user the current `profile` belongs to. Until it matches `user`, the
  // profile is stale or missing and consumers must treat it as loading. This
  // is derived, not set in an effect, so a hard load of an admin URL never
  // sees "not loading, no profile" for a render and redirects away.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const fetchProfile = async () => {
    if (!user) {
      setProfile(null);
      setLoadedFor(null);
      setLoading(false);
      return;
    }
    setLoading(true);
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
    setLoadedFor(user.id);
    setLoading(false);
  };

  const effectiveLoading = loading || (!!user && loadedFor !== user.id);

  useEffect(() => {
    fetchProfile();
  }, [user]);

  return (
    <ProfileContext.Provider value={{ profile, loading: effectiveLoading, refetch: fetchProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export const useProfile = () => useContext(ProfileContext);
