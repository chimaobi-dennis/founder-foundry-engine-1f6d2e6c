import { useEffect, useRef, useState, useCallback } from "react";
import { Upload, Plus, Trash2 } from "lucide-react";
import { useBrand } from "@/hooks/use-brand";
import {
  getBrandProductImages,
  uploadBrandProductImage,
  deleteProductImage,
} from "@/services/projectAssetsService";
import { toast } from "sonner";

interface ProductImageRow {
  id: string;
  name: string;
  file_url: string | null;
}

export function LibraryRealProductImages({ onChange }: { onChange?: () => void }) {
  const { activeBrand } = useBrand();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<ProductImageRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!activeBrand?.id) return;
    setLoading(true);
    const data = await getBrandProductImages(activeBrand.id);
    setImages(data || []);
    setLoading(false);
  }, [activeBrand?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || !activeBrand?.id) return;
    let any = false;
    for (const file of Array.from(files)) {
      const res = await uploadBrandProductImage(activeBrand.id, file);
      if (res.success) any = true;
      else toast.error(res.error || "Upload failed");
    }
    if (any) {
      toast.success("Product image uploaded");
      await refresh();
      onChange?.();
    }
  };

  const handleDelete = async (id: string) => {
    if (!activeBrand?.id) return;
    const res = await deleteProductImage(activeBrand.id, id);
    if (res.success) {
      setImages((prev) => prev.filter((i) => i.id !== id));
      onChange?.();
    } else {
      toast.error(res.error || "Could not delete");
    }
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div className="flex items-center justify-between px-6 mt-7 mb-3.5">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-ui">
          Product images <span className="ml-1">({images.length})</span>
        </p>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 text-[12px] font-ui text-primary hover:underline"
        >
          <Plus size={12} /> Upload images
        </button>
      </div>

      {loading ? (
        <div className="px-6 flex gap-3 overflow-x-auto pb-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="w-[110px] h-[140px] rounded-lg bg-muted animate-pulse flex-shrink-0" />
          ))}
        </div>
      ) : images.length === 0 ? (
        <div className="px-6">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="h-[110px] rounded-[10px] border-[1.5px] border-dashed border-primary/30 flex items-center justify-center gap-3 cursor-pointer hover:border-primary/50 transition-colors"
          >
            <Upload size={18} className="text-primary" />
            <span className="text-[12px] font-ui text-muted-foreground">
              Upload your first product image
            </span>
          </div>
        </div>
      ) : (
        <div className="px-6 flex gap-3 overflow-x-auto pb-2">
          {images.map((img) => (
            <div
              key={img.id}
              className="relative group w-[110px] h-[140px] flex-shrink-0 rounded-[10px] overflow-hidden border border-border bg-muted/30"
            >
              {img.file_url ? (
                <img src={img.file_url} alt={img.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">
                  No preview
                </div>
              )}
              <button
                onClick={() => handleDelete(img.id)}
                className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-destructive"
                aria-label="Delete"
              >
                <Trash2 size={12} />
              </button>
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/65 to-transparent px-2 py-1.5">
                <span className="text-[10px] font-ui text-white truncate block">{img.name}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
