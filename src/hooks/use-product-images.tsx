import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { toast } from "@/hooks/use-toast";

export interface ProductImage {
  id: string;
  name: string;
  color: string;
  url?: string; // blob URL for real uploads
  base64?: string;
  mimeType?: string;
  templateCount: number;
}

interface ProductImagesContextType {
  images: ProductImage[];
  selectedId: string | null;
  selectedImage: ProductImage | null;
  selectImage: (id: string) => void;
  addImage: (img: ProductImage) => void;
  addImages: (imgs: ProductImage[]) => void;
  setImages: (imgs: ProductImage[]) => void;
  removeImage: (id: string) => void;
}

const ProductImagesContext = createContext<ProductImagesContextType | null>(null);

export function ProductImagesProvider({ children }: { children: ReactNode }) {
  const [images, setImagesState] = useState<ProductImage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedImage = images.find((i) => i.id === selectedId) || null;

  const selectImage = useCallback((id: string) => setSelectedId(id), []);

  const addImage = useCallback((img: ProductImage) => {
    setImagesState((prev) => [...prev, img]);
  }, []);

  const addImages = useCallback((imgs: ProductImage[]) => {
    setImagesState((prev) => [...prev, ...imgs]);
  }, []);

  const setImages = useCallback((imgs: ProductImage[]) => {
    setImagesState(imgs);
  }, []);

  const removeImage = useCallback((id: string) => {
    setImagesState((prev) => prev.filter((i) => i.id !== id));
    setSelectedId((prev) => (prev === id ? null : prev));
    toast({ title: "Image removed from your library" });
  }, []);

  return (
    <ProductImagesContext.Provider value={{ images, selectedId, selectedImage, selectImage, addImage, addImages, setImages, removeImage }}>
      {children}
    </ProductImagesContext.Provider>
  );
}

export function useProductImages() {
  const ctx = useContext(ProductImagesContext);
  if (!ctx) throw new Error("useProductImages must be used within ProductImagesProvider");
  return ctx;
}
