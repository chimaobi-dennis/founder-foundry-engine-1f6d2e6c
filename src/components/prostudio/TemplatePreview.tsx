import { cn } from "@/lib/utils";

interface TemplatePreviewProps {
  html: string | null;
  scale?: number;
  id?: string;
}

export function TemplatePreview({ html, scale = 1, id }: TemplatePreviewProps) {
  if (!html) {
    return (
      <div className="w-full aspect-square rounded-lg bg-muted/30 flex items-center justify-center">
        <span className="text-[12px] font-ui text-muted-foreground">
          Generation failed — try again
        </span>
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-lg"
      style={{
        width: 600 * scale,
        height: 600 * scale,
      }}
    >
      <div
        id={id}
        style={{
          width: 600,
          height: 600,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
