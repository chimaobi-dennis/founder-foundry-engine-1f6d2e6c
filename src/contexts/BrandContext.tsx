import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { 
  Brand, BrandDNA,
  getUserBrands, getActiveBrand, 
  setActiveBrand, getBrandDNA,
  createBrand
} from '@/services/brandService';

interface BrandContextType {
  brands: Brand[];
  activeBrand: Brand | null;
  activeBrandDNA: BrandDNA | null;
  isLoading: boolean;
  switchBrand: (brandId: string) => Promise<void>;
  refreshBrands: () => Promise<void>;
  createNewBrand: (name: string) => Promise<Brand | null>;
}

const BrandContext = createContext<BrandContextType>({
  brands: [],
  activeBrand: null,
  activeBrandDNA: null,
  isLoading: true,
  switchBrand: async () => {},
  refreshBrands: async () => {},
  createNewBrand: async () => null
});

export const BrandProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [activeBrand, setActiveBrandState] = useState<Brand | null>(null);
  const [activeBrandDNA, setActiveBrandDNA] = useState<BrandDNA | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  const createNewBrand = async (name: string): Promise<Brand | null> => {
    if (!user) return null;
    const { success, brand } = await createBrand(user.id, name);
    if (success && brand) {
      await loadBrands();
      return brand;
    }
    return null;
  };

  return (
    <BrandContext.Provider value={{
      brands,
      activeBrand,
      activeBrandDNA,
      isLoading,
      switchBrand,
      refreshBrands: loadBrands,
      createNewBrand
    }}>
      {children}
    </BrandContext.Provider>
  );
};

export const useBrand = () => useContext(BrandContext);
