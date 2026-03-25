import { useRef } from "react";
import { Upload, Camera, Download, Trash2, Plus } from "lucide-react";
import { useProductImages, type ProductImage } from "@/hooks/use-product-images";
import { useNavigate } from "react-router-dom";

export function LibraryProductImages() {
  const { images, addImages, removeImage } = useProductImages();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

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
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
      />

      {/* Section header */}
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

      {/* Image grid */}
      <div className="px-6 grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {images.map((img) => (
          <div
            key={img.id}
            className="rounded-[10px] overflow-hidden border border-border cursor-pointer relative group aspect-[3/4]"
          >
            {img.url ? (
              <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: img.color }}>
                <span className="text-[11px] font-ui text-white/70 font-medium px-2 text-center">{img.name}</span>
              </div>
            )}

            {/* Template count pill */}
            <span className="absolute top-2 right-2 text-[10px] font-ui px-2 py-0.5 rounded-lg bg-primary/20 text-primary z-[2]">
              {img.templateCount} template{img.templateCount !== 1 ? "s" : ""}
            </span>

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 z-[3]">
              <button
                onClick={() => navigate("/pro-studio")}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              >
                <Camera size={14} />
              </button>
              <button className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
                <Download size={14} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); removeImage(img.id); }}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-destructive/70 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>

            {/* Bottom gradient with name */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/65 to-transparent px-2 py-2">
              <span className="text-[11px] font-ui text-white">{img.name}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Upload zone */}
      <div className="px-6 mt-3">
        <div
          onClick={() => fileInputRef.current?.click()}
          className="h-[72px] rounded-[10px] border-[1.5px] border-dashed border-primary/30 flex items-center justify-center gap-3 cursor-pointer hover:border-primary/50 transition-colors"
        >
          <Upload size={18} className="text-primary" />
          <span className="text-[12px] font-ui text-muted-foreground">Drop product images here or click to upload</span>
          <span className="text-[11px] font-ui text-muted-foreground hidden sm:inline">JPG PNG WebP — multiple files</span>
        </div>
      </div>
    </div>
  );
}
