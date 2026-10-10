import { useEffect, useState } from 'react';
import { getLibraryAssets, type Asset } from '@/services/assetService';
import { supabase } from '@/integrations/supabase/client';

/**
 * Which modules a brand has actually used. The sidebar starts with five
 * items; Studio, Calendar, Documents, Reels and Library appear once the
 * brand has something in them. One fetch per brand, remembered for the
 * session so navigation never refetches.
 */
export interface ModuleUse {
  studio: boolean;
  calendar: boolean;
  documents: boolean;
  reels: boolean;
  library: boolean;
}

const NONE: ModuleUse = { studio: false, calendar: false, documents: false, reels: false, library: false };
const cache = new Map<string, ModuleUse>();

export function useModuleUse(brandId: string | null | undefined): ModuleUse {
  const [use, setUse] = useState<ModuleUse>(() => (brandId && cache.get(brandId)) || NONE);

  useEffect(() => {
    if (!brandId) { setUse(NONE); return; }
    const cached = cache.get(brandId);
    if (cached) { setUse(cached); return; }
    let active = true;
    (async () => {
      const [assets, posts] = await Promise.all([
        getLibraryAssets(brandId, 'all').catch((): Asset[] => []),
        supabase.from('calendar_posts').select('id', { count: 'exact', head: true }).eq('brand_id', brandId).then((r) => r.count ?? 0, () => 0),
      ]);
      const types = new Set(assets.map((a) => a.type));
      const next: ModuleUse = {
        studio: types.has('template_output') || types.has('generated_visual'),
        calendar: posts > 0,
        documents: types.has('document'),
        reels: types.has('script'),
        library: assets.length > 0,
      };
      cache.set(brandId, next);
      if (active) setUse(next);
    })();
    return () => { active = false; };
  }, [brandId]);

  return use;
}

/** Call after something is made in a module so the sidebar shows it at once. */
export function markModuleUsed(brandId: string, key: keyof ModuleUse) {
  const cur = cache.get(brandId) ?? NONE;
  cache.set(brandId, { ...cur, [key]: true, library: true });
}
