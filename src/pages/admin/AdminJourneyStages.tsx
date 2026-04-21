import { useState, useEffect, useCallback } from "react";
import { GripVertical, Plus, Edit, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  getAllJourneyStages,
  updateJourneyStageConfig,
  createJourneyStage,
  type JourneyStageData
} from "@/services/brandService";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const MODULE_OPTIONS = [
  { value: "Mentor", label: "Mentor" },
  { value: "ProStudio", label: "ProStudio" },
  { value: "CampaignKit", label: "CampaignKit" },
  { value: "ContentCalendar", label: "ContentCalendar" },
  { value: "DocStudio", label: "DocStudio" },
  { value: "ReelBuilder", label: "ReelBuilder" },
];

export default function AdminJourneyStages() {
  const [stages, setStages] = useState<JourneyStageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<JourneyStageData | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const [isReordering, setIsReordering] = useState(false);

  const setActionLoading = (key: string, value: boolean) => {
    setLoadingStates(prev => ({ ...prev, [key]: value }));
  };

  const isActionLoading = (key: string) => loadingStates[key] === true;

  // Form state
  const [formData, setFormData] = useState({
    emoji: "",
    stage_key: "",
    name: "",
    sort_order: 0,
    is_active: true,
    description: "",
    mentor_focus: "",
    relevant_modules: [] as string[],
    suggested_next_steps: [] as { label: string; route: string; icon: string }[],
    substages: [] as string[],
  });

  const fetchStages = async () => {
    setLoading(true);
    const data = await getAllJourneyStages();
    setStages(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchStages();
  }, []);

  const handleEdit = (stage: JourneyStageData) => {
    setEditingStage(stage);
    setIsNew(false);
    setFormData({
      emoji: stage.emoji,
      stage_key: stage.stage_key,
      name: stage.name,
      sort_order: stage.sort_order,
      is_active: stage.is_active,
      description: stage.description,
      mentor_focus: stage.mentor_focus ?? "",
      relevant_modules: stage.relevant_modules ?? [],
      suggested_next_steps: stage.suggested_next_steps ?? [],
      substages: stage.substages ?? [],
    });
    setDrawerOpen(true);
  };

  const handleAddNew = () => {
    setEditingStage(null);
    setIsNew(true);
    setFormData({
      emoji: "",
      stage_key: "",
      name: "",
      sort_order: stages.length,
      is_active: true,
      description: "",
      mentor_focus: "",
      relevant_modules: [],
      suggested_next_steps: [],
      substages: [],
    });
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    const loadingKey = isNew ? 'add-stage' : `save-stage-${editingStage?.id}`;
    setActionLoading(loadingKey, true);
    try {
      if (isNew) {
        const result = await createJourneyStage(formData);
        if (result.success) {
          toast.success("Stage created");
          setDrawerOpen(false);
          fetchStages();
        } else {
          toast.error(result.error);
        }
      } else if (editingStage) {
        const result = await updateJourneyStageConfig(editingStage.id, formData);
        if (result.success) {
          toast.success("Stage updated");
          setDrawerOpen(false);
          fetchStages();
        } else {
          toast.error(result.error);
        }
      }
    } catch (error) {
      toast.error("Failed to save stage");
    }
    setActionLoading(loadingKey, false);
  };

  const handleReorder = useCallback((dragIndex: number, dropIndex: number) => {
    const newStages = [...stages];
    const [draggedStage] = newStages.splice(dragIndex, 1);
    newStages.splice(dropIndex, 0, draggedStage);

    // Update sort_order values
    newStages.forEach((stage, index) => {
      stage.sort_order = index;
    });

    setStages(newStages);
    setIsReordering(true);

    // Debounced save
    setTimeout(async () => {
      for (const stage of newStages) {
        await updateJourneyStageConfig(stage.id, { sort_order: stage.sort_order });
      }
      setIsReordering(false);
    }, 500);
  }, [stages]);

  const addNextStep = () => {
    if (formData.suggested_next_steps.length < 4) {
      setFormData({
        ...formData,
        suggested_next_steps: [...formData.suggested_next_steps, { label: "", route: "", icon: "" }],
      });
    }
  };

  const removeNextStep = (index: number) => {
    setFormData({
      ...formData,
      suggested_next_steps: formData.suggested_next_steps.filter((_, i) => i !== index),
    });
  };

  const updateNextStep = (index: number, field: "label" | "route" | "icon", value: string) => {
    const newSteps = [...formData.suggested_next_steps];
    newSteps[index][field] = value;
    setFormData({ ...formData, suggested_next_steps: newSteps });
  };

  const addSubstage = () => {
    if (formData.substages.length < 8) {
      setFormData({
        ...formData,
        substages: [...formData.substages, ""],
      });
    }
  };

  const removeSubstage = (index: number) => {
    setFormData({
      ...formData,
      substages: formData.substages.filter((_, i) => i !== index),
    });
  };

  const updateSubstage = (index: number, value: string) => {
    const newSubstages = [...formData.substages];
    newSubstages[index] = value;
    setFormData({ ...formData, substages: newSubstages });
  };

  const toggleModule = (module: string) => {
    setFormData({
      ...formData,
      relevant_modules: formData.relevant_modules.includes(module)
        ? formData.relevant_modules.filter(m => m !== module)
        : [...formData.relevant_modules, module],
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-[26px] font-semibold text-foreground mb-2">
              Journey Stages
            </h1>
            <p className="text-[13px] text-muted-foreground">
              Define the stages of a founder's journey. The mentor uses these to guide conversations and suggest next steps.
            </p>
          </div>
          <Button
            onClick={handleAddNew}
            style={{ background: "#D4A017", color: "#0D1B2A" }}
          >
            <Plus size={16} className="mr-2" />
            Add stage
          </Button>
        </div>
      </div>

      {/* Warning card */}
      <div
        className="rounded-lg p-4 mb-6 flex items-start gap-3"
        style={{ background: "rgba(220, 38, 38, 0.1)", border: "0.5px solid rgba(220, 38, 38, 0.3)" }}
      >
        <AlertTriangle size={18} style={{ color: "#F87171" }} />
        <p className="text-sm" style={{ color: "#FCA5A5" }}>
          Changes take effect immediately for all users and all mentor conversations.
        </p>
      </div>

      {/* Stages list */}
      <div className="space-y-3">
        {stages.map((stage, index) => (
          <div
            key={stage.id}
            draggable
            onDragStart={(e) => e.dataTransfer.setData("dragIndex", index.toString())}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const dragIndex = parseInt(e.dataTransfer.getData("dragIndex"));
              handleReorder(dragIndex, index);
            }}
            className="flex gap-4 items-center cursor-move"
            style={{
              borderRadius: "12px",
              border: "0.5px solid #2A3A4A",
              padding: "20px",
              background: "#0D1520",
            }}
          >
            {/* Left: drag handle + emoji + sort order */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <GripVertical size={18} style={{ color: "#4A5568" }} />
              <span className="text-2xl">{stage.emoji}</span>
              <span className="text-[11px]" style={{ color: "#6B7280" }}>
                #{stage.sort_order}
              </span>
            </div>

            {/* Centre: stage info */}
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-[0.08em] mb-1" style={{ color: "#D4A017" }}>
                {stage.stage_key}
              </p>
              <p className="text-[15px] font-medium text-foreground mb-1">{stage.name}</p>
              <p className="text-[12px] text-muted-foreground mb-2">{stage.description}</p>
              <div className="flex items-center gap-2 flex-wrap">
                {stage.relevant_modules?.map((module) => (
                  <span
                    key={module}
                    className="text-[10px] px-2 py-1 rounded-full"
                    style={{
                      background: "rgba(212, 160, 23, 0.1)",
                      color: "#D4A017",
                      border: "0.5px solid rgba(212, 160, 23, 0.2)",
                    }}
                  >
                    {module}
                  </span>
                ))}
              </div>
              <p className="text-[11px] mt-2" style={{ color: "#6B7280" }}>
                {stage.substages?.length || 0} substages
              </p>
            </div>

            {/* Right: toggle + edit */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <Switch
                checked={stage.is_active}
                onCheckedChange={async (checked) => {
                  const loadingKey = `toggle-stage-${stage.id}`;
                  setActionLoading(loadingKey, true);
                  const result = await updateJourneyStageConfig(stage.id, { is_active: checked });
                  if (result.success) {
                    fetchStages();
                  }
                  setActionLoading(loadingKey, false);
                }}
                disabled={isActionLoading(`toggle-stage-${stage.id}`)}
              />
              {isActionLoading(`toggle-stage-${stage.id}`) && (
                <span style={{
                  width: '10px',
                  height: '10px',
                  border: '2px solid #D4A017',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  display: 'inline-block',
                  animation: 'spin 0.6s linear infinite'
                }} />
              )}
              <button
                onClick={() => handleEdit(stage)}
                className="text-[13px] font-medium"
                style={{ color: "#D4A017" }}
              >
                Edit
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Reorder indicator */}
      {isReordering && (
        <p className="text-[11px] text-center" style={{ color: "#6B7280" }}>
          Saving order...
        </p>
      )}

      {/* Edit/Create Drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent style={{ width: "480px", marginLeft: "auto" }}>
          <DrawerHeader>
            <DrawerTitle>
              {isNew ? "New Stage" : editingStage?.name}
              <p className="text-sm text-muted-foreground font-normal">
                {isNew ? "Create a new journey stage" : "Edit stage"}
              </p>
            </DrawerTitle>
          </DrawerHeader>

          <div className="px-6 pb-6 space-y-4 overflow-y-auto max-h-[calc(100vh-200px)]">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Emoji</Label>
                <Input
                  value={formData.emoji}
                  onChange={(e) => setFormData({ ...formData, emoji: e.target.value })}
                  placeholder="🔥"
                  style={{ width: "60px" }}
                />
              </div>
              <div>
                <Label>Stage key</Label>
                <Input
                  value={formData.stage_key}
                  onChange={(e) => setFormData({ ...formData, stage_key: e.target.value })}
                  disabled={!isNew}
                  placeholder="spark"
                />
              </div>
            </div>

            <div>
              <Label>Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Spark"
              />
            </div>

            <div>
              <Label>Sort order</Label>
              <Input
                type="number"
                value={formData.sort_order}
                onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label>Is active</Label>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                placeholder="Brief description of this stage"
              />
            </div>

            <div>
              <Label>Mentor focus</Label>
              <p className="text-xs text-muted-foreground mb-2">
                What the mentor should focus on in this stage. This gets injected into the AI system prompt when a founder is in this stage.
              </p>
              <Textarea
                value={formData.mentor_focus}
                onChange={(e) => setFormData({ ...formData, mentor_focus: e.target.value })}
                rows={6}
                placeholder="Focus on helping the founder understand their problem deeply..."
              />
            </div>

            <div>
              <Label>Relevant modules</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {MODULE_OPTIONS.map((module) => (
                  <div key={module.value} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={module.value}
                      checked={formData.relevant_modules.includes(module.value)}
                      onChange={() => toggleModule(module.value)}
                    />
                    <label htmlFor={module.value} className="text-sm">
                      {module.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Suggested next steps</Label>
              <div className="space-y-2 mt-2">
                {formData.suggested_next_steps.map((step, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <Input
                      placeholder="Label"
                      value={step.label}
                      onChange={(e) => updateNextStep(index, "label", e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Route"
                      value={step.route}
                      onChange={(e) => updateNextStep(index, "route", e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Icon"
                      value={step.icon}
                      onChange={(e) => updateNextStep(index, "icon", e.target.value)}
                      className="w-20"
                    />
                    <button
                      onClick={() => removeNextStep(index)}
                      className="p-1"
                      style={{ color: "#F87171" }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
                {formData.suggested_next_steps.length < 4 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addNextStep}
                    className="w-full"
                  >
                    <Plus size={14} className="mr-2" />
                    Add step
                  </Button>
                )}
              </div>
            </div>

            <div>
              <Label>Substages</Label>
              <div className="space-y-2 mt-2">
                {formData.substages.map((substage, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <Input
                      placeholder="Substage description"
                      value={substage}
                      onChange={(e) => updateSubstage(index, e.target.value)}
                      className="flex-1"
                    />
                    <button
                      onClick={() => removeSubstage(index)}
                      className="p-1"
                      style={{ color: "#F87171" }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
                {formData.substages.length < 8 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addSubstage}
                    className="w-full"
                  >
                    <Plus size={14} className="mr-2" />
                    Add substage
                  </Button>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleSave}
                disabled={isActionLoading(isNew ? 'add-stage' : `save-stage-${editingStage?.id}`)}
                style={{
                  background: "#D4A017",
                  color: "#0D1B2A",
                  opacity: isActionLoading(isNew ? 'add-stage' : `save-stage-${editingStage?.id}`) ? 0.7 : 1,
                  cursor: isActionLoading(isNew ? 'add-stage' : `save-stage-${editingStage?.id}`) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                className="flex-1"
              >
                {isActionLoading(isNew ? 'add-stage' : `save-stage-${editingStage?.id}`) && (
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
                {isActionLoading(isNew ? 'add-stage' : `save-stage-${editingStage?.id}`) ? 'Saving...' : 'Save'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setDrawerOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
