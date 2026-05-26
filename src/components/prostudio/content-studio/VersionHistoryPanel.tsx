/**
 * VersionHistoryPanel.tsx
 *
 * Full-featured version history drawer for Content Studio.
 * Timeline view, restore functionality, diff preview, named versions.
 */

import { useState, useCallback, useMemo } from "react";
import {
  History,
  RotateCcw,
  Eye,
  ChevronDown,
  ChevronRight,
  Clock,
  User,
  Sparkles,
  Save,
  Trash2,
  Edit3,
  GitBranch,
  Check,
  Loader2,
  MoreVertical,
  Bookmark,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { VersionSummary } from "@/services/versionService";
import type { Database } from "@/integrations/supabase/types";

type VersionType = Database["public"]["Enums"]["creative_version_type"];
type SourceType = Database["public"]["Enums"]["version_source_type"];

interface VersionHistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  versions: VersionSummary[];
  currentVersionId: string | null;
  isLoading: boolean;
  isRestoring: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onRestore: (versionId: string) => Promise<boolean>;
  onRename: (versionId: string, newName: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  onSaveNamedVersion?: (name: string) => Promise<void>;
}

export function VersionHistoryPanel({
  isOpen,
  onClose,
  versions,
  currentVersionId,
  isLoading,
  isRestoring,
  hasMore,
  onLoadMore,
  onRestore,
  onRename,
  onRefresh,
  onSaveNamedVersion,
}: VersionHistoryPanelProps) {
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false);
  const [renamingVersionId, setRenamingVersionId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isRestoringVersion, setIsRestoringVersion] = useState<string | null>(null);
  const [showNamedSave, setShowNamedSave] = useState(false);
  const [namedSaveValue, setNamedSaveValue] = useState("");

  // Group versions by date
  const groupedVersions = useMemo(() => {
    const groups: { label: string; versions: VersionSummary[] }[] = [];
    let currentGroup: { label: string; versions: VersionSummary[] } | null = null;

    versions.forEach((version) => {
      const date = new Date(version.createdAt);
      const label = getDateLabel(date);

      if (!currentGroup || currentGroup.label !== label) {
        if (currentGroup) groups.push(currentGroup);
        currentGroup = { label, versions: [] };
      }
      currentGroup.versions.push(version);
    });

    if (currentGroup) groups.push(currentGroup);
    return groups;
  }, [versions]);

  const handleRestoreClick = useCallback((versionId: string) => {
    setSelectedVersionId(versionId);
    setIsRestoreDialogOpen(true);
  }, []);

  const handleConfirmRestore = useCallback(async () => {
    if (!selectedVersionId) return;

    setIsRestoringVersion(selectedVersionId);
    const success = await onRestore(selectedVersionId);
    setIsRestoringVersion(null);

    if (success) {
      setIsRestoreDialogOpen(false);
      setSelectedVersionId(null);
    }
  }, [selectedVersionId, onRestore]);

  const handleRenameClick = useCallback((version: VersionSummary) => {
    setRenamingVersionId(version.id);
    setRenameValue(version.versionName || `Version ${version.versionNumber}`);
  }, []);

  const handleSaveRename = useCallback(async () => {
    if (!renamingVersionId || !renameValue.trim()) return;

    await onRename(renamingVersionId, renameValue.trim());
    setRenamingVersionId(null);
    setRenameValue("");
  }, [renamingVersionId, renameValue, onRename]);

  const handleSaveNamedVersion = useCallback(async () => {
    if (!namedSaveValue.trim() || !onSaveNamedVersion) return;

    await onSaveNamedVersion(namedSaveValue.trim());
    setShowNamedSave(false);
    setNamedSaveValue("");
  }, [namedSaveValue, onSaveNamedVersion]);

  const selectedVersion = useMemo(
    () => versions.find((v) => v.id === selectedVersionId),
    [versions, selectedVersionId]
  );

  if (!isOpen) return null;

  return (
    <TooltipProvider>
      <div className="fixed inset-y-0 right-0 z-50 w-[400px] bg-card border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Version History</h2>
            <Badge variant="secondary" className="text-[10px]">
              {versions.length}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            {onSaveNamedVersion && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px]"
                onClick={() => setShowNamedSave(true)}
              >
                <Bookmark className="w-3 h-3 mr-1" />
                Save
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Named Save Dialog */}
        {showNamedSave && (
          <div className="p-3 border-b border-border bg-amber-50/50 dark:bg-amber-900/10">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Name this version…"
                value={namedSaveValue}
                onChange={(e) => setNamedSaveValue(e.target.value)}
                className="h-8 text-xs"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveNamedVersion();
                  if (e.key === "Escape") {
                    setShowNamedSave(false);
                    setNamedSaveValue("");
                  }
                }}
              />
              <Button
                size="sm"
                className="h-8 text-[11px]"
                onClick={handleSaveNamedVersion}
                disabled={!namedSaveValue.trim()}
              >
                Save
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-[11px]"
                onClick={() => {
                  setShowNamedSave(false);
                  setNamedSaveValue("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-4">
            {isLoading && versions.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : versions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <History className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No versions yet</p>
                <p className="text-xs mt-1">
                  Versions are created when you save or autosave
                </p>
              </div>
            ) : (
              groupedVersions.map((group) => (
                <div key={group.label}>
                  {/* Date header */}
                  <div className="flex items-center gap-2 mb-2 sticky top-0 bg-card/95 backdrop-blur-sm py-1 z-10">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                      {group.label}
                    </span>
                    <Separator className="flex-1" />
                  </div>

                  {/* Versions in this group */}
                  <div className="space-y-1">
                    {group.versions.map((version) => (
                      <VersionItem
                        key={version.id}
                        version={version}
                        isCurrent={version.id === currentVersionId}
                        isSelected={version.id === selectedVersionId}
                        isRestoring={isRestoringVersion === version.id || (isRestoring && version.id === selectedVersionId)}
                        isRenaming={renamingVersionId === version.id}
                        renameValue={renameValue}
                        onRenameChange={setRenameValue}
                        onSaveRename={handleSaveRename}
                        onCancelRename={() => {
                          setRenamingVersionId(null);
                          setRenameValue("");
                        }}
                        onRestore={() => handleRestoreClick(version.id)}
                        onRename={() => handleRenameClick(version)}
                        onSelect={() => setSelectedVersionId(version.id)}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}

            {/* Load more */}
            {hasMore && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-[11px] h-8"
                onClick={onLoadMore}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                ) : (
                  <ChevronDown className="w-3 h-3 mr-1" />
                )}
                Load older versions
              </Button>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-3 border-t border-border bg-muted/50">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>
              {versions.filter((v) => v.versionType === "named").length} named versions
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px]"
              onClick={onRefresh}
              disabled={isLoading}
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Restore Confirmation Dialog */}
      <Dialog open={isRestoreDialogOpen} onOpenChange={setIsRestoreDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4" />
              Restore Version
            </DialogTitle>
            <DialogDescription>
              This will create a new current version from{" "}
              <strong>Version {selectedVersion?.versionNumber}</strong>.
              Your current state will be saved as a backup.
            </DialogDescription>
          </DialogHeader>

          {selectedVersion && (
            <div className="bg-muted rounded-md p-3 my-4">
              <div className="flex items-center gap-2 text-sm">
                {getSourceIcon(selectedVersion.sourceType)}
                <span className="font-medium">{selectedVersion.changeSummary}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {format(new Date(selectedVersion.createdAt), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRestoreDialogOpen(false)}
              disabled={isRestoring}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmRestore}
              disabled={isRestoring}
            >
              {isRestoring ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Restoring…
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Restore Version
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Backdrop for mobile */}
      <div
        className="fixed inset-0 bg-black/20 z-40 lg:hidden"
        onClick={onClose}
      />
    </TooltipProvider>
  );
}

/**
 * Individual version item in the list
 */
interface VersionItemProps {
  version: VersionSummary;
  isCurrent: boolean;
  isSelected: boolean;
  isRestoring: boolean;
  isRenaming: boolean;
  renameValue: string;
  onRenameChange: (value: string) => void;
  onSaveRename: () => void;
  onCancelRename: () => void;
  onRestore: () => void;
  onRename: () => void;
  onSelect: () => void;
}

function VersionItem({
  version,
  isCurrent,
  isSelected,
  isRestoring,
  isRenaming,
  renameValue,
  onRenameChange,
  onSaveRename,
  onCancelRename,
  onRestore,
  onRename,
  onSelect,
}: VersionItemProps) {
  const hasChanges =
    version.nodesAdded > 0 ||
    version.nodesModified > 0 ||
    version.nodesDeleted > 0;

  return (
    <div
      className={cn(
        "group relative rounded-md p-2.5 transition-colors cursor-pointer",
        isCurrent && "bg-primary/5 border border-primary/20",
        isSelected && !isCurrent && "bg-muted border border-border",
        !isCurrent && !isSelected && "hover:bg-muted/50 border border-transparent"
      )}
      onClick={onSelect}
    >
      <div className="flex items-start gap-2.5">
        {/* Icon */}
        <div className="mt-0.5">
          {getSourceIcon(version.sourceType, isRestoring)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center gap-2">
            {isRenaming ? (
              <div className="flex items-center gap-1 flex-1">
                <Input
                  value={renameValue}
                  onChange={(e) => onRenameChange(e.target.value)}
                  className="h-6 text-xs py-0"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onSaveRename();
                    if (e.key === "Escape") onCancelRename();
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSaveRename();
                  }}
                >
                  <Check className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <>
                <span className="text-xs font-medium truncate">
                  {version.versionName || `Version ${version.versionNumber}`}
                </span>
                {version.versionType === "named" && (
                  <Bookmark className="w-3 h-3 text-amber-500 fill-amber-500" />
                )}
              </>
            )}

            {isCurrent && (
              <Badge variant="default" className="text-[9px] h-4 px-1.5">
                Current
              </Badge>
            )}

            {version.isRestoredVersion && (
              <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                Restored
              </Badge>
            )}
          </div>

          {/* Change summary */}
          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
            {version.changeSummary}
          </p>

          {/* Metrics */}
          {hasChanges && (
            <div className="flex items-center gap-2 mt-1.5">
              {version.nodesAdded > 0 && (
                <span className="text-[10px] text-emerald-600">
                  +{version.nodesAdded}
                </span>
              )}
              {version.nodesModified > 0 && (
                <span className="text-[10px] text-blue-600">
                  ~{version.nodesModified}
                </span>
              )}
              {version.nodesDeleted > 0 && (
                <span className="text-[10px] text-red-600">
                  −{version.nodesDeleted}
                </span>
              )}
            </div>
          )}

          {/* Timestamp */}
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            {version.ageText}
          </p>
        </div>

        {/* Actions */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRestore(); }}>
                <RotateCcw className="w-3 h-3 mr-2" />
                Restore this version
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRename(); }}>
                <Edit3 className="w-3 h-3 mr-2" />
                Rename
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

/**
 * Get icon for source type
 */
function getSourceIcon(sourceType: SourceType, isLoading = false): React.ReactNode {
  const className = "w-3.5 h-3.5 text-muted-foreground";

  if (isLoading) {
    return <Loader2 className={cn(className, "animate-spin")} />;
  }

  switch (sourceType) {
    case "initial_generation":
    case "ai_regenerate":
    case "ai_rewrite":
      return <Sparkles className={cn(className, "text-purple-500")} />;
    case "manual_save":
      return <Save className={cn(className, "text-blue-500")} />;
    case "auto_snapshot":
      return <Clock className={className} />;
    case "restore":
      return <RotateCcw className={cn(className, "text-amber-500")} />;
    case "user_edit":
    case "user_mutation":
      return <Edit3 className={className} />;
    case "pre_delete":
    case "node_delete":
      return <Trash2 className={cn(className, "text-red-400")} />;
    case "node_add":
      return <GitBranch className={cn(className, "text-emerald-500")} />;
    default:
      return <User className={className} />;
  }
}

/**
 * Get human-readable date label
 */
function getDateLabel(date: Date): string {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const isYesterday =
    date.toDateString() ===
    new Date(now.getTime() - 86400000).toDateString();

  if (isToday) return "Today";
  if (isYesterday) return "Yesterday";

  const daysDiff = Math.floor(
    (now.getTime() - date.getTime()) / 86400000
  );
  if (daysDiff < 7) {
    return format(date, "EEEE"); // Day name
  }

  return format(date, "MMMM d"); // Month day
}
