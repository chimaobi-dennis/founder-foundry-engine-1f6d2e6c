import { useState, useRef, useEffect } from "react";
import { ArrowRight, Flag, MoreHorizontal, Pencil, Trash2, Check, X } from "lucide-react";
import { Link } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { BrandDNAField } from "./types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface BrandDNAPanelProps {
  fields: BrandDNAField[];
  highlightField: string | null;
  onEditField?: (fieldKey: string, newValue: string) => void;
  onClearField?: (fieldKey: string) => void;
}

const nextSteps = [
  { label: "Generate a campaign brief from this session", to: "/campaign-kit" },
  { label: "Create brand visuals in ProStudio", to: "/pro-studio" },
  { label: "Build your launch campaign in CampaignKit", to: "/campaign-kit" },
];

export function BrandDNAPanel({ fields, highlightField, onEditField, onClearField }: BrandDNAPanelProps) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deleteConfirmKey, setDeleteConfirmKey] = useState<string | null>(null);
  const editInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editingKey && editInputRef.current) {
      editInputRef.current.focus();
      const len = editInputRef.current.value.length;
      editInputRef.current.setSelectionRange(len, len);
    }
  }, [editingKey]);

  const startEdit = (field: BrandDNAField) => {
    setEditingKey(field.key);
    setEditValue(field.value || "");
  };

  const confirmEdit = () => {
    if (editingKey && editValue.trim() && onEditField) {
      onEditField(editingKey, editValue.trim());
    }
    setEditingKey(null);
    setEditValue("");
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditValue("");
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-base text-foreground">Brand DNA</h2>
          <span className="text-[10px] font-ui font-semibold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
            Active
          </span>
        </div>
        <p className="text-[12px] font-ui text-muted-foreground mt-0.5">Updated from this conversation</p>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="px-4 pb-4 space-y-2.5">
          <TooltipProvider delayDuration={300}>
            {fields.map((field) => {
              const isEditing = editingKey === field.key;

              return (
                <div
                  key={field.key}
                  className={cn(
                    "group rounded-lg bg-muted/30 border border-border p-3 transition-all duration-700 relative",
                    highlightField === field.key && "ring-1 ring-primary/50 bg-primary/5"
                  )}
                >
                  <div className="flex items-center gap-1 mb-1">
                    <p className="text-[10px] font-ui uppercase tracking-[0.1em] text-muted-foreground">
                      {field.label}
                    </p>
                    {field.value && field.savedFrom && !isEditing && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Flag size={9} className="text-primary cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-[11px]">
                          Saved from {field.savedFrom} · {field.savedTimeAgo}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="space-y-2">
                      <textarea
                        ref={editInputRef}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); confirmEdit(); }
                          if (e.key === "Escape") cancelEdit();
                        }}
                        rows={2}
                        className="w-full text-[13px] font-ui text-foreground bg-background/50 border border-primary/50 rounded-md px-2 py-1.5 outline-none resize-none leading-relaxed"
                      />
                      <div className="flex items-center gap-1.5 justify-end">
                        <button onClick={cancelEdit} className="px-2 py-1 text-[11px] font-ui text-muted-foreground hover:text-foreground transition-colors">
                          Cancel
                        </button>
                        <button onClick={confirmEdit} className="px-2.5 py-1 text-[11px] font-ui text-primary bg-primary/10 rounded-md hover:bg-primary/20 transition-colors flex items-center gap-1">
                          <Check size={10} />
                          Save
                        </button>
                      </div>
                    </div>
                  ) : field.value ? (
                    <p className="text-[13px] font-ui text-foreground leading-relaxed pr-6" style={{ wordBreak: "break-word" }}>{field.value}</p>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-ui text-muted-foreground/50">—</span>
                      <span className="text-[10px] font-ui text-muted-foreground">Not yet defined</span>
                    </div>
                  )}

                  {/* Actions menu — show on hover for fields with values, or allow adding for empty */}
                  {!isEditing && (
                    <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1 rounded hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors">
                            <MoreHorizontal size={13} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[130px]">
                          <DropdownMenuItem onClick={() => startEdit(field)} className="text-[12px] gap-2">
                            <Pencil size={12} />
                            {field.value ? "Edit" : "Add value"}
                          </DropdownMenuItem>
                          {field.value && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setDeleteConfirmKey(field.key)}
                                className="text-[12px] gap-2 text-destructive focus:text-destructive"
                              >
                                <Trash2 size={12} />
                                Clear value
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>
              );
            })}
          </TooltipProvider>

          {/* Suggested next steps */}
          <div className="pt-3">
            <p className="text-[11px] font-ui uppercase tracking-[0.1em] text-muted-foreground mb-2.5">
              Suggested next steps
            </p>
            <div className="space-y-1">
              {nextSteps.map((step) => (
                <Link
                  key={step.label}
                  to={step.to}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-[12px] font-ui text-primary/80 hover:text-primary hover:bg-primary/5 transition-colors group"
                >
                  <span className="flex-1">{step.label}</span>
                  <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>

      <AlertDialog open={!!deleteConfirmKey} onOpenChange={(open) => !open && setDeleteConfirmKey(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-ui text-[15px]">Clear this field?</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px]">
              This will remove the saved value for "{fields.find(f => f.key === deleteConfirmKey)?.label}". You can always re-add it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-[13px]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-[13px]"
              onClick={() => {
                if (deleteConfirmKey) onClearField?.(deleteConfirmKey);
                setDeleteConfirmKey(null);
              }}
            >
              Clear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
