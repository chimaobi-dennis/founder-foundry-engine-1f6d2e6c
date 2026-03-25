import { useRef } from "react";
import { X, Upload, Trash2, Check } from "lucide-react";
import { useProductImages, type ProductImage } from "@/hooks/use-product-images";
import { useNavigate } from "react-router-dom";

interface Props {
  onClose: () => void;
}

export function ProductImagesSidebar({ onClose }: Props) {
  const { images, selectedId, selectImage, addImages, removeImage } = useProductImages();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const selectedName = images.find((i) => i.id === selectedId)?.name;

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const newImgs: ProductImage[] = [];
    Array.from(files).forEach((file) => {
      const url = URL.createObjectURL(file);
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        const base64 = result.split(",")[1];
        const img: ProductImage = {
          id: `pi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: file.name.replace(/\.[^.]+$/, ""),
          color: "#2D4A3E",
          url,
          base64,
          mimeType: file.type || "image/jpeg",
          templateCount: 0,
        };
        newImgs.push(img);
        if (newImgs.length === files.length) addImages(newImgs);
      };
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <span className="text-[13px] font-ui font-medium text-foreground">Product images</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Upload zone */}
        <div className="px-3 pt-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
          />
          <div
            onClick={() => fileInputRef.current?.click()}
            className="h-[80px] rounded-[10px] border-[1.5px] border-dashed border-primary/40 flex flex-col items-center justify-center cursor-pointer gap-1 hover:border-primary/60 transition-colors"
          >
            <Upload size={18} className="text-primary" />
            <span className="text-[11px] font-ui text-primary">Upload product images</span>
            <span className="text-[9px] font-ui text-muted-foreground">Multiple files supported</span>
          </div>
        </div>

        {/* Image grid */}
        <div className="px-3 pt-3 pb-3 grid grid-cols-2 gap-2">
          {images.map((img) => {
            const isSelected = img.id === selectedId;
            return (
              <div
                key={img.id}
                onClick={() => selectImage(img.id)}
                className={`rounded-lg overflow-hidden cursor-pointer relative group aspect-[3/4] ${isSelected ? "ring-2 ring-primary" : "border border-border"}`}
              >
                {img.url ? (
                  <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: img.color }}>
                    <span className="text-[9px] font-ui text-white/80 font-medium">{img.name}</span>
                  </div>
                )}

                {/* Hover delete */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-start justify-end p-1.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); removeImage(img.id); }}
                    className="w-6 h-6 rounded-full bg-black/40 flex items-center justify-center text-white hover:bg-destructive transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                {/* Bottom gradient with name */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/65 to-transparent px-1.5 py-1.5">
                  <span className="text-[9px] font-ui text-white">{img.name}</span>
                </div>

                {/* Selected checkmark */}
                {isSelected && (
                  <div className="absolute bottom-1.5 right-1.5 w-[14px] h-[14px] rounded-full bg-primary flex items-center justify-center">
                    <Check size={8} className="text-primary-foreground" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Currently using */}
        {selectedName && (
          <div className="flex items-center justify-center gap-1.5 px-3 py-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span className="text-[11px] font-ui text-muted-foreground">Using: {selectedName}</span>
          </div>
        )}

        {/* Manage link */}
        <div className="px-3 pb-4 text-center">
          <button
            onClick={() => navigate("/library")}
            className="text-[11px] font-ui text-primary hover:underline"
          >
            Manage all in Library →
          </button>
        </div>
      </div>
    </div>
  );
}
