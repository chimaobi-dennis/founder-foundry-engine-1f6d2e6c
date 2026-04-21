import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import {
  Brand, BrandDNA, JourneyStage, JourneyStageData,
  getUserBrands, getActiveBrand,
  setActiveBrand, getBrandDNA,
  createBrand, updateJourneyStage, getJourneyStages
} from '@/services/brandService';

interface BrandContextType {
  brands: Brand[];
  activeBrand: Brand | null;
  activeBrandDNA: BrandDNA | null;
  journeyStages: JourneyStageData[];
  currentStageData: JourneyStageData | null;
  isLoading: boolean;
  switchBrand: (brandId: string) => Promise<void>;
  refreshBrands: () => Promise<void>;
  refreshBrandDNA: () => Promise<void>;
  updateStage: (stage: JourneyStage, trigger: 'mentor_suggestion' | 'user_selected' | 'auto_detected') => Promise<void>;
  createNewBrand: (name: string) => Promise<Brand | null>;
}

const BrandContext = createContext<BrandContextType>({
  brands: [],
  activeBrand: null,
  activeBrandDNA: null,
  journeyStages: [],
  currentStageData: null,
  isLoading: true,
  switchBrand: async () => {},
  refreshBrands: async () => {},
  refreshBrandDNA: async () => {},
  updateStage: async () => {},
  createNewBrand: async () => null
});

export const BrandProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [activeBrand, setActiveBrandState] = useState<Brand | null>(null);
  const [activeBrandDNA, setActiveBrandDNA] = useState<BrandDNA | null>(null);
  const [journeyStages, setJourneyStages] = useState<JourneyStageData[]>([]);
  const [currentStageData, setCurrentStageData] = useState<JourneyStageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch stages once on mount
  useEffect(() => {
    getJourneyStages().then(stages => {
      setJourneyStages(stages);
    });
  }, []);

  // Update currentStageData when activeBrand or stages change
  useEffect(() => {
    if (activeBrand && journeyStages.length > 0) {
      const stageKey = activeBrand.journey_stage ?? 'spark';
      const stage = journeyStages.find(s => s.stage_key === stageKey) ?? null;
      setCurrentStageData(stage);
    }
  }, [activeBrand, journeyStages]);

  const loadBrands = async () => {
    if (!user) return;
    setIsLoading(true);

    const [allBrands, active] = await Promise.all([
      getUserBrands(user.id),
      getActiveBrand(user.id)
    ]);

    setBrands(allBrands);
    setActiveBrandState(active);

    if (active) {
      const dna = await getBrandDNA(active.id);
      setActiveBrandDNA(dna);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    if (user) loadBrands();
  }, [user]);

  const switchBrand = async (brandId: string) => {
    if (!user) return;
    await setActiveBrand(user.id, brandId);
    const brand = brands.find(b => b.id === brandId) ?? null;
    setActiveBrandState(brand);
    if (brand) {
      const dna = await getBrandDNA(brand.id);
      setActiveBrandDNA(dna);
    }
  };

  const createNewBrand = async (name: string = 'Untitled Project'): Promise<Brand | null> => {
    if (!user) return null;
    const { success, brand } = await createBrand(user.id, name);
    if (success && brand) {
      await loadBrands();
      return brand;
    }
    return null;
  };

  const refreshBrandDNA = async () => {
    if (!activeBrand) return;
    const dna = await getBrandDNA(activeBrand.id);
    setActiveBrandDNA(dna);
  };

  const updateStage = async (
    stage: JourneyStage,
    trigger: 'mentor_suggestion' | 'user_selected' | 'auto_detected'
  ) => {
    if (!activeBrand) return;
    await updateJourneyStage(activeBrand.id, stage, trigger);
    await loadBrands(); // Refresh to get updated stage
  };

  return (
    <BrandContext.Provider value={{
      brands,
      activeBrand,
      activeBrandDNA,
      journeyStages,
      currentStageData,
      isLoading,
      switchBrand,
      refreshBrands: loadBrands,
      refreshBrandDNA,
      updateStage,
      createNewBrand
    }}>
      {children}
    </BrandContext.Provider>
  );
};

export const useBrand = () => useContext(BrandContext);
