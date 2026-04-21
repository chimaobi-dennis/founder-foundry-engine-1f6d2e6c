import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  getAllSystemPrompts, 
  updateSystemPrompt, 
  getPromptVersionHistory, 
  restorePromptVersion,
  type TaskType 
} from "@/services/aiService";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Book, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";

const TASK_CONFIG: Record<TaskType, {
  name: string;
  description: string;
  color: string;
  variables: string[];
}> = {
  mentor_chat: {
    name: 'Mentor Chat',
    description: 'System prompt for brand mentorship conversations',
    color: '#D4A017',
    variables: ['brand_name', 'industry', 'brand_voice', 'positioning_statement', 'target_audience', 'core_promise', 'brand_references', 'campaign_strategy', 'customer_insight']
  },
  template_generation: {
    name: 'Template Generation',
    description: 'System prompt for ProStudio template generation',
    color: '#14B8A6',
    variables: ['brand_name', 'primary_color', 'brand_voice', 'product_name']
  },
  document_generation: {
    name: 'Document Generation',
    description: 'System prompt for DocStudio document generation',
    color: '#3B82F6',
    variables: ['brand_name', 'industry', 'brand_voice', 'positioning_statement', 'target_audience', 'core_promise']
  },
  campaign_copy: {
    name: 'Campaign Copy',
    description: 'System prompt for CampaignKit copy generation',
    color: '#22C55E',
    variables: ['brand_name', 'brand_voice', 'target_audience', 'core_promise', 'key_benefit', 'call_to_action']
  },
  reel_script: {
    name: 'Reel Script',
    description: 'System prompt for ReelBuilder script generation',
    color: '#A855F7',
    variables: ['brand_name', 'brand_voice', 'target_audience', 'core_promise']
  },
  image_generation: {
    name: 'Image Generation',
    description: 'System prompt for image generation across all modules',
    color: '#F59E0B',
    variables: ['brand_name', 'primary_color', 'brand_voice', 'product_name']
  }
};

interface SystemPrompt {
  id: string;
  task_type: TaskType;
  system_prompt: string;
  version: number;
  is_active: boolean;
  last_edited_by: string;
  updated_at: string;
}

interface PromptVersion {
  id: string;
  version: number;
  system_prompt: string;
  edited_by: string;
  edit_note: string;
  created_at: string;
}

export default function AdminKnowledgeBase() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [prompts, setPrompts] = useState<SystemPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

  const setActionLoading = (key: string, value: boolean) => {
    setLoadingStates(prev => ({ ...prev, [key]: value }));
  };

  const isActionLoading = (key: string) => loadingStates[key] === true;
  
  // Edit mode state
  const [editingTask, setEditingTask] = useState<TaskType | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [editNote, setEditNote] = useState("");
  
  // History modal state
  const [historyTask, setHistoryTask] = useState<TaskType | null>(null);
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [restoringVersion, setRestoringVersion] = useState<string | null>(null);
  
  // Expanded state
  const [expandedPrompts, setExpandedPrompts] = useState<Set<TaskType>>(new Set());
  
  // Variables panel state
  const [showVariables, setShowVariables] = useState<Set<TaskType>>(new Set());
  const [copiedVariable, setCopiedVariable] = useState<string | null>(null);

  useEffect(() => {
    loadPrompts();
  }, []);

  const loadPrompts = async () => {
    setLoading(true);
    const { data, error } = await getAllSystemPrompts();
    if (error) {
      toast.error('Failed to load prompts');
    } else {
      setPrompts(data || []);
    }
    setLoading(false);
  };

  const handleEdit = (taskType: TaskType, currentPrompt: string) => {
    setEditingTask(taskType);
    setEditPrompt(currentPrompt);
    setEditNote("");
  };

  const handleCancelEdit = () => {
    setEditingTask(null);
    setEditPrompt("");
    setEditNote("");
  };

  const handleSave = async () => {
    if (!editingTask || !user?.id) return;
    
    const loadingKey = `save-prompt-${editingTask}`;
    setActionLoading(loadingKey, true);
    
    const result = await updateSystemPrompt(editingTask, editPrompt, editNote, user.id);
    if (result.success) {
      toast.success('Saved');
      setEditingTask(null);
      setEditPrompt("");
      setEditNote("");
      loadPrompts();
    } else {
      toast.error(result.error || 'Failed to save prompt');
    }
    setActionLoading(loadingKey, false);
  };

  const handleHistory = async (taskType: TaskType) => {
    setHistoryTask(taskType);
    const { data, error } = await getPromptVersionHistory(taskType);
    if (error) {
      toast.error('Failed to load version history');
    } else {
      setVersions(data || []);
    }
  };

  const handleRestore = async (versionId: string) => {
    if (!user?.id) return;
    
    const loadingKey = `restore-version-${versionId}`;
    setActionLoading(loadingKey, true);
    
    const result = await restorePromptVersion(versionId, user.id);
    if (result.success) {
      toast.success('Restored');
      setHistoryTask(null);
      setVersions([]);
      loadPrompts();
    } else {
      toast.error(result.error || 'Failed to restore version');
    }
    setActionLoading(loadingKey, false);
  };

  const toggleExpand = (taskType: TaskType) => {
    setExpandedPrompts(prev => {
      const next = new Set(prev);
      if (next.has(taskType)) {
        next.delete(taskType);
      } else {
        next.add(taskType);
      }
      return next;
    });
  };

  const toggleVariables = (taskType: TaskType) => {
    setShowVariables(prev => {
      const next = new Set(prev);
      if (next.has(taskType)) {
        next.delete(taskType);
      } else {
        next.add(taskType);
      }
      return next;
    });
  };

  const copyVariable = (variable: string) => {
    const placeholder = `{{${variable}}}`;
    navigator.clipboard.writeText(placeholder);
    setCopiedVariable(variable);
    setTimeout(() => setCopiedVariable(null), 2000);
  };

  const getPreviewLines = (text: string, lineCount: number = 3) => {
    return text.split('\n').slice(0, lineCount).join('\n');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-4 h-4 rounded-full bg-[#D4A017] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="font-display text-[26px] font-semibold text-foreground mb-2">
          Knowledge Base
        </h1>
        <p className="text-[13px] text-muted-foreground">
          Manage the AI system prompts that power every feature. Changes take effect immediately for all users.
        </p>
      </div>

      <div 
        className="rounded-lg p-4 mb-6"
        style={{ 
          background: '#3A2A00', 
          border: '0.5px solid #7A5A00',
          fontSize: '12px',
          color: '#F0C060'
        }}
      >
        ⚠ Changes to system prompts affect all users immediately. Test carefully before saving. Use version history to roll back if needed.
      </div>

      <div className="space-y-4">
        {prompts.map((prompt) => {
          const config = TASK_CONFIG[prompt.task_type];
          const isEditing = editingTask === prompt.task_type;
          const isExpanded = expandedPrompts.has(prompt.task_type);
          const showVars = showVariables.has(prompt.task_type);
          
          return (
            <div 
              key={prompt.id}
              className="rounded-lg p-6"
              style={{ border: '0.5px solid #2A3A4A' }}
            >
              {/* Card header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span
                    className="px-2.5 py-1 rounded-full text-[11px] font-medium text-white"
                    style={{ background: config.color }}
                  >
                    {config.name}
                  </span>
                  <div>
                    <h3 className="text-[15px] font-medium text-foreground" style={{ fontFamily: 'DM Sans' }}>
                      {config.name} Prompt
                    </h3>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[11px] text-muted-foreground">v{prompt.version}</span>
                      <span className="text-[11px] text-muted-foreground">
                        Edited {formatDate(prompt.updated_at)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!isEditing && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[#D4A017] hover:text-[#D4A017]/80"
                        onClick={() => handleEdit(prompt.task_type, prompt.system_prompt)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => handleHistory(prompt.task_type)}
                      >
                        History
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <p className="text-[13px] text-muted-foreground mb-4">
                {config.description}
              </p>

              {isEditing ? (
                /* Edit mode */
                <div className="space-y-4">
                  <Textarea
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    className="min-h-[400px] font-mono text-[12px] leading-relaxed w-full rounded-lg p-4"
                    style={{
                      background: '#0D1520',
                      border: '0.5px solid #D4A017',
                      color: '#F5F0E8'
                    }}
                  />
                  
                  {/* Variables reference panel */}
                  <div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[11px] text-muted-foreground hover:text-foreground p-0 h-auto"
                      onClick={() => toggleVariables(prompt.task_type)}
                    >
                      {showVars ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
                      Available variables
                    </Button>
                    {showVars && (
                      <div className="mt-2 p-3 rounded-lg" style={{ background: '#0D1520' }}>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {config.variables.map((variable) => (
                            <button
                              key={variable}
                              onClick={() => copyVariable(variable)}
                              className="flex items-center gap-2 px-2 py-1.5 rounded text-[11px] font-mono text-left hover:bg-muted/50 transition-colors"
                              style={{ color: '#8A96A3' }}
                            >
                              <span style={{ color: '#D4A017' }}>{'{{'}</span>
                              {variable}
                              <span style={{ color: '#D4A017' }}>{'}}'}</span>
                              {copiedVariable === variable && <Check className="w-3 h-3 ml-auto text-green-500" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <Input
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    placeholder="Describe what you changed..."
                    className="h-9 rounded-lg text-[13px]"
                  />

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={handleCancelEdit}
                      className="h-10 rounded-lg"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSave}
                      disabled={isActionLoading(`save-prompt-${editingTask}`)}
                      className="h-10 rounded-lg bg-[#D4A017] text-white hover:bg-[#D4A017]/90"
                      style={{
                        opacity: isActionLoading(`save-prompt-${editingTask}`) ? 0.7 : 1,
                        cursor: isActionLoading(`save-prompt-${editingTask}`) ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      {isActionLoading(`save-prompt-${editingTask}`) && (
                        <span style={{
                          width: '12px',
                          height: '12px',
                          border: '2px solid currentColor',
                          borderTopColor: 'transparent',
                          borderRadius: '50%',
                          display: 'inline-block',
                          animation: 'spin 0.6s linear infinite',
                          flexShrink: 0
                        }} />
                      )}
                      {isActionLoading(`save-prompt-${editingTask}`) ? 'Saving...' : 'Save changes'}
                    </Button>
                  </div>
                </div>
              ) : (
                /* View mode */
                <div>
                  <div
                    className="rounded-lg p-3 font-mono text-[12px] leading-relaxed mb-2 overflow-hidden"
                    style={{
                      background: '#0D1520',
                      color: '#8A96A3'
                    }}
                  >
                    {isExpanded ? prompt.system_prompt : getPreviewLines(prompt.system_prompt, 3)}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[#D4A017] hover:text-[#D4A017]/80 p-0 h-auto text-[13px]"
                    onClick={() => toggleExpand(prompt.task_type)}
                  >
                    {isExpanded ? 'Show less' : 'Show full prompt'}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* History modal */}
      <Dialog open={!!historyTask} onOpenChange={() => setHistoryTask(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {historyTask && TASK_CONFIG[historyTask].name} Version History
            </DialogTitle>
            <DialogDescription>
              View and restore previous versions of this prompt
            </DialogDescription>
          </DialogHeader>
          
          <div className="max-h-[60vh] overflow-y-auto space-y-3">
            {versions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No version history available
              </p>
            ) : (
              versions.map((version) => (
                <div
                  key={version.id}
                  className="p-4 rounded-lg border border-border"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">v{version.version}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {formatDate(version.created_at)}
                        </span>
                      </div>
                      {version.edit_note && (
                        <p className="text-[12px] text-muted-foreground mt-1">
                          {version.edit_note}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[#D4A017] border-[#D4A017] hover:bg-[#D4A017]/10"
                      onClick={() => setRestoringVersion(version.id)}
                      disabled={isActionLoading(`restore-version-${version.id}`)}
                      style={{
                        opacity: isActionLoading(`restore-version-${version.id}`) ? 0.7 : 1,
                        cursor: isActionLoading(`restore-version-${version.id}`) ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      {isActionLoading(`restore-version-${version.id}`) && (
                        <span style={{
                          width: '12px',
                          height: '12px',
                          border: '2px solid currentColor',
                          borderTopColor: 'transparent',
                          borderRadius: '50%',
                          display: 'inline-block',
                          animation: 'spin 0.6s linear infinite',
                          flexShrink: 0
                        }} />
                      )}
                      {isActionLoading(`restore-version-${version.id}`) ? 'Restoring...' : 'Restore this version'}
                    </Button>
                  </div>
                  <div
                    className="rounded p-2 font-mono text-[11px] overflow-hidden max-h-24"
                    style={{
                      background: '#0D1520',
                      color: '#8A96A3'
                    }}
                  >
                    {getPreviewLines(version.system_prompt, 2)}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Restore confirmation dialog */}
      <Dialog open={!!restoringVersion} onOpenChange={() => setRestoringVersion(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Restore Version?</DialogTitle>
            <DialogDescription>
              This will replace the current prompt with the selected version. Changes will take effect immediately for all users.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRestoringVersion(null)}
            >
              Cancel
            </Button>
            <Button
              className="bg-[#D4A017] text-white hover:bg-[#D4A017]/90"
              onClick={() => restoringVersion && handleRestore(restoringVersion)}
              disabled={isActionLoading(`restore-version-${restoringVersion}`)}
              style={{
                opacity: isActionLoading(`restore-version-${restoringVersion}`) ? 0.7 : 1,
                cursor: isActionLoading(`restore-version-${restoringVersion}`) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {isActionLoading(`restore-version-${restoringVersion}`) && (
                <span style={{
                  width: '12px',
                  height: '12px',
                  border: '2px solid currentColor',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  display: 'inline-block',
                  animation: 'spin 0.6s linear infinite',
                  flexShrink: 0
                }} />
              )}
              {isActionLoading(`restore-version-${restoringVersion}`) ? 'Restoring...' : 'Confirm Restore'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
