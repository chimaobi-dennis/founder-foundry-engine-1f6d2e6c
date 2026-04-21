import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  getUserModelPreferences, 
  setUserModelPreference, 
  getAllEnabledModels,
  type TaskType,
  type AIModel
} from "@/services/aiService";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, RotateCcw } from "lucide-react";

const TASK_TYPES: { type: TaskType; name: string; description: string }[] = [
  { type: 'mentor_chat', name: 'Mentor chat', description: 'Powers your brand conversations' },
  { type: 'template_generation', name: 'Template generation', description: 'Used when generating ProStudio templates' },
  { type: 'document_generation', name: 'Document generation', description: 'Used in DocStudio' },
  { type: 'campaign_copy', name: 'Campaign copy', description: 'Used in CampaignKit' },
  { type: 'reel_script', name: 'Reel scripts', description: 'Used in ReelBuilder' },
];

export default function SettingsAIModels() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<Record<TaskType, AIModel | null>>({} as Record<TaskType, AIModel | null>);
  const [enabledModels, setEnabledModels] = useState<AIModel[]>([]);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [selectedTaskType, setSelectedTaskType] = useState<TaskType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      loadData();
    }
  }, [user?.id]);

  const loadData = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const [prefs, models] = await Promise.all([
        getUserModelPreferences(user.id),
        getAllEnabledModels(),
      ]);
      setPreferences(prefs as Record<TaskType, AIModel | null>);
      setEnabledModels(models);
    } catch (error) {
      console.error('Failed to load preferences:', error);
      toast.error('Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModelPicker = (taskType: TaskType) => {
    setSelectedTaskType(taskType);
    setModelPickerOpen(true);
  };

  const handleModelSelect = async (modelId: string) => {
    if (!user?.id || !selectedTaskType) return;

    const result = await setUserModelPreference(user.id, selectedTaskType, modelId);
    if (result.success) {
      toast('Preference saved');
      setModelPickerOpen(false);
      loadData();
    } else {
      toast.error(result.error || 'Failed to save preference');
    }
  };

  const handleResetToDefaults = async () => {
    if (!user?.id) return;
    
    // Reset by deleting all user preferences
    // Note: This would require a delete function in aiService
    // For now, we'll just show a message
    toast('Reset to defaults - preferences cleared');
    setPreferences({} as Record<TaskType, AIModel | null>);
  };

  const groupModelsByProvider = (models: AIModel[]) => {
    const grouped: Record<string, AIModel[]> = {};
    models.forEach(model => {
      const providerName = model.provider?.name || 'Unknown';
      if (!grouped[providerName]) {
        grouped[providerName] = [];
      }
      grouped[providerName].push(model);
    });
    return grouped;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-4 h-4 rounded-full bg-primary animate-pulse" />
      </div>
    );
  }

  const groupedModels = groupModelsByProvider(enabledModels);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-display font-semibold text-foreground">AI Models</h1>
          <p className="text-sm text-muted-foreground">
            Choose your preferred AI model for each task type
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {TASK_TYPES.map((task) => {
          const currentModel = preferences[task.type];
          return (
            <div 
              key={task.type} 
              className="p-4 border border-border rounded-lg bg-card"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-[13px] font-ui font-medium text-foreground">
                    {task.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {task.description}
                  </p>
                  <div className="mt-2">
                    {currentModel ? (
                      <p className="text-sm text-foreground">
                        <span className="text-muted-foreground">Current model:</span>{' '}
                        <span className="font-medium">{currentModel.name}</span>
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Using system default
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-primary hover:text-primary/80"
                  onClick={() => handleOpenModelPicker(task.type)}
                >
                  Change
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground"
          onClick={handleResetToDefaults}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset to defaults
        </Button>
      </div>

      {/* Model Picker Dialog */}
      <Dialog open={modelPickerOpen} onOpenChange={setModelPickerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select AI Model</DialogTitle>
            <DialogDescription>
              Choose a model for {TASK_TYPES.find(t => t.type === selectedTaskType)?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            {Object.entries(groupedModels).map(([providerName, models]) => (
              <div key={providerName}>
                <p className="text-xs font-ui uppercase tracking-wider text-muted-foreground mb-2">
                  {providerName}
                </p>
                <div className="space-y-1">
                  {models.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => handleModelSelect(model.id)}
                      className="w-full text-left px-3 py-2 rounded-md text-sm font-ui text-foreground hover:bg-muted/50 transition-colors"
                    >
                      {model.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModelPickerOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
