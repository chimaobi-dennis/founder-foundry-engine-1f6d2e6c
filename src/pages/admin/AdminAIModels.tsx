import { useState, useEffect } from "react";
import { 
  getAllProviders, 
  getAllModels, 
  createProvider, 
  updateProvider, 
  createModel, 
  updateModel, 
  setTaskDefault,
  getAllEnabledModels,
  type AIProvider,
  type AIModel,
  type TaskType
} from "@/services/aiService";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Edit, Save, X } from "lucide-react";

const TASK_TYPES: { type: TaskType; name: string; description: string }[] = [
  { type: 'mentor_chat', name: 'Mentor chat', description: 'Powers your brand conversations' },
  { type: 'template_generation', name: 'Template generation', description: 'Used when generating ProStudio templates' },
  { type: 'document_generation', name: 'Document generation', description: 'Used in DocStudio' },
  { type: 'campaign_copy', name: 'Campaign copy', description: 'Used in CampaignKit' },
  { type: 'reel_script', name: 'Reel scripts', description: 'Used in ReelBuilder' },
  { type: 'image_generation', name: 'Image generation', description: 'Used across all modules' },
];

export default function AdminAIModels() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("providers");
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

  const setActionLoading = (key: string, value: boolean) => {
    setLoadingStates(prev => ({ ...prev, [key]: value }));
  };

  const isActionLoading = (key: string) => loadingStates[key] === true;
  
  // Providers state
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [providerDialogOpen, setProviderDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<AIProvider | null>(null);
  const [providerForm, setProviderForm] = useState({
    name: "",
    slug: "",
    base_url: "",
    auth_header_name: "",
    auth_header_prefix: "",
    api_key: "",
    supports_text: true,
    supports_images: false,
    is_enabled: true,
  });

  // Models state
  const [models, setModels] = useState<AIModel[]>([]);
  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<AIModel | null>(null);
  const [modelForm, setModelForm] = useState({
    name: "",
    model_id: "",
    provider_id: "",
    description: "",
    context_window: 4096,
    best_for: [] as string[],
    supports_vision: false,
    supports_images_out: false,
    cost_per_1k_input: 0,
    cost_per_1k_output: 0,
    sort_order: 0,
    is_enabled: true,
    is_default: false,
  });

  // Task defaults state
  const [taskDefaults, setTaskDefaults] = useState<Record<TaskType, AIModel | null>>({} as Record<TaskType, AIModel | null>);
  const [enabledModels, setEnabledModels] = useState<AIModel[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [providersData, modelsData, enabledModelsData] = await Promise.all([
      getAllProviders(),
      getAllModels(),
      getAllEnabledModels(),
    ]);
    setProviders(providersData);
    setModels(modelsData);
    setEnabledModels(enabledModelsData);
  };

  // Provider handlers
  const handleAddProvider = () => {
    setEditingProvider(null);
    setProviderForm({
      name: "",
      slug: "",
      base_url: "",
      auth_header_name: "",
      auth_header_prefix: "",
      api_key: "",
      supports_text: true,
      supports_images: false,
      is_enabled: true,
    });
    setProviderDialogOpen(true);
  };

  const handleEditProvider = (provider: AIProvider) => {
    setEditingProvider(provider);
    setProviderForm({
      name: provider.name,
      slug: provider.slug,
      base_url: provider.base_url,
      auth_header_name: provider.auth_header_name,
      auth_header_prefix: provider.auth_header_prefix,
      api_key: "", // Don't pre-fill API key for security
      supports_text: provider.supports_text,
      supports_images: provider.supports_images,
      is_enabled: provider.is_enabled,
    });
    setProviderDialogOpen(true);
  };

  const handleSaveProvider = async () => {
    const loadingKey = editingProvider ? `save-provider-${editingProvider.id}` : 'add-provider';
    setActionLoading(loadingKey, true);
    
    const result = editingProvider
      ? await updateProvider(editingProvider.id, providerForm)
      : await createProvider(providerForm);

    if (result.success) {
      toast(editingProvider ? "Provider updated" : "Provider created");
      setProviderDialogOpen(false);
      loadData();
    } else {
      toast.error(result.error || "Failed to save provider");
    }
    setActionLoading(loadingKey, false);
  };

  // Model handlers
  const handleAddModel = () => {
    setEditingModel(null);
    setModelForm({
      name: "",
      model_id: "",
      provider_id: "",
      description: "",
      context_window: 4096,
      best_for: [],
      supports_vision: false,
      supports_images_out: false,
      cost_per_1k_input: 0,
      cost_per_1k_output: 0,
      sort_order: 0,
      is_enabled: true,
      is_default: false,
    });
    setModelDialogOpen(true);
  };

  const handleEditModel = (model: AIModel) => {
    setEditingModel(model);
    setModelForm({
      name: model.name,
      model_id: model.model_id,
      provider_id: model.provider_id,
      description: model.description,
      context_window: 4096,
      best_for: model.best_for,
      supports_vision: model.supports_vision,
      supports_images_out: model.supports_images_out,
      cost_per_1k_input: model.cost_per_1k_input || 0,
      cost_per_1k_output: model.cost_per_1k_output || 0,
      sort_order: 0,
      is_enabled: model.is_enabled,
      is_default: model.is_default,
    });
    setModelDialogOpen(true);
  };

  const handleSaveModel = async () => {
    const loadingKey = editingModel ? `save-model-${editingModel.id}` : 'add-model';
    setActionLoading(loadingKey, true);
    
    const result = editingModel
      ? await updateModel(editingModel.id, modelForm)
      : await createModel(modelForm);

    if (result.success) {
      toast(editingModel ? "Model updated" : "Model created");
      setModelDialogOpen(false);
      loadData();
    } else {
      toast.error(result.error || "Failed to save model");
    }
    setActionLoading(loadingKey, false);
  };

  // Task defaults handlers
  const handleTaskDefaultChange = async (taskType: TaskType, modelId: string) => {
    const loadingKey = `save-default-${taskType}`;
    setActionLoading(loadingKey, true);
    
    const result = await setTaskDefault(taskType, modelId);
    if (result.success) {
      toast("Default updated");
      // Reload task defaults
      // Note: We'd need a function to get task defaults, but for now this is sufficient
    } else {
      toast.error(result.error || "Failed to update default");
    }
    setActionLoading(loadingKey, false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-semibold text-foreground">AI Models</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage AI providers, models, and system-wide defaults
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="providers">Providers</TabsTrigger>
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="task-defaults">Task Defaults</TabsTrigger>
        </TabsList>

        {/* Providers Tab */}
        <TabsContent value="providers" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={handleAddProvider} className="bg-primary text-primary-foreground">
              <Plus className="w-4 h-4 mr-2" />
              Add Provider
            </Button>
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-ui uppercase tracking-wider text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-ui uppercase tracking-wider text-muted-foreground">Slug</th>
                  <th className="text-left px-4 py-3 text-xs font-ui uppercase tracking-wider text-muted-foreground">Base URL</th>
                  <th className="text-left px-4 py-3 text-xs font-ui uppercase tracking-wider text-muted-foreground">Text</th>
                  <th className="text-left px-4 py-3 text-xs font-ui uppercase tracking-wider text-muted-foreground">Images</th>
                  <th className="text-left px-4 py-3 text-xs font-ui uppercase tracking-wider text-muted-foreground">Enabled</th>
                  <th className="text-left px-4 py-3 text-xs font-ui uppercase tracking-wider text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {providers.map((provider) => (
                  <tr key={provider.id} className="border-t border-border">
                    <td className="px-4 py-3 text-sm font-ui text-foreground">{provider.name}</td>
                    <td className="px-4 py-3 text-sm font-ui text-muted-foreground">{provider.slug}</td>
                    <td className="px-4 py-3 text-sm font-ui text-muted-foreground">{provider.base_url}</td>
                    <td className="px-4 py-3">
                      {provider.supports_text && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                          Yes
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {provider.supports_images && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                          Yes
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={provider.is_enabled}
                          onCheckedChange={async (checked) => {
                            const loadingKey = `toggle-provider-${provider.id}`;
                            setActionLoading(loadingKey, true);
                            const result = await updateProvider(provider.id, { is_enabled: checked });
                            if (result.success) loadData();
                            setActionLoading(loadingKey, false);
                          }}
                          disabled={isActionLoading(`toggle-provider-${provider.id}`)}
                        />
                        {isActionLoading(`toggle-provider-${provider.id}`) && (
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
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditProvider(provider)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Models Tab */}
        <TabsContent value="models" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={handleAddModel} className="bg-primary text-primary-foreground">
              <Plus className="w-4 h-4 mr-2" />
              Add Model
            </Button>
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-ui uppercase tracking-wider text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-ui uppercase tracking-wider text-muted-foreground">Model ID</th>
                  <th className="text-left px-4 py-3 text-xs font-ui uppercase tracking-wider text-muted-foreground">Provider</th>
                  <th className="text-left px-4 py-3 text-xs font-ui uppercase tracking-wider text-muted-foreground">Vision</th>
                  <th className="text-left px-4 py-3 text-xs font-ui uppercase tracking-wider text-muted-foreground">Images</th>
                  <th className="text-left px-4 py-3 text-xs font-ui uppercase tracking-wider text-muted-foreground">Enabled</th>
                  <th className="text-left px-4 py-3 text-xs font-ui uppercase tracking-wider text-muted-foreground">Default</th>
                  <th className="text-left px-4 py-3 text-xs font-ui uppercase tracking-wider text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {models.map((model) => (
                  <tr key={model.id} className="border-t border-border">
                    <td className="px-4 py-3 text-sm font-ui text-foreground">{model.name}</td>
                    <td className="px-4 py-3 text-sm font-ui text-muted-foreground">{model.model_id}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                        {model.provider?.name || model.provider_id}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {model.supports_vision && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                          Yes
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {model.supports_images_out && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                          Yes
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={model.is_enabled}
                          onCheckedChange={async (checked) => {
                            const loadingKey = `toggle-model-enabled-${model.id}`;
                            setActionLoading(loadingKey, true);
                            const result = await updateModel(model.id, { is_enabled: checked });
                            if (result.success) loadData();
                            setActionLoading(loadingKey, false);
                          }}
                          disabled={isActionLoading(`toggle-model-enabled-${model.id}`) || isActionLoading(`toggle-model-default-${model.id}`)}
                        />
                        {isActionLoading(`toggle-model-enabled-${model.id}`) && (
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
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={model.is_default}
                          onCheckedChange={async (checked) => {
                            const loadingKey = `toggle-model-default-${model.id}`;
                            setActionLoading(loadingKey, true);
                            const result = await updateModel(model.id, { is_default: checked });
                            if (result.success) loadData();
                            setActionLoading(loadingKey, false);
                          }}
                          disabled={isActionLoading(`toggle-model-enabled-${model.id}`) || isActionLoading(`toggle-model-default-${model.id}`)}
                        />
                        {isActionLoading(`toggle-model-default-${model.id}`) && (
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
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditModel(model)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Task Defaults Tab */}
        <TabsContent value="task-defaults" className="space-y-4">
          <div className="p-4 bg-muted/50 rounded-lg border border-border">
            <p className="text-sm text-muted-foreground">
              These are the system-wide defaults. Individual users can override these in their settings.
            </p>
          </div>

          <div className="space-y-3">
            {TASK_TYPES.map((task) => (
              <div key={task.type} className="flex items-center justify-between p-4 border border-border rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-ui font-medium text-foreground">{task.name}</p>
                  <p className="text-xs text-muted-foreground">{task.description}</p>
                </div>
                <div className="w-64">
                  <div className="flex items-center gap-2">
                    <Select
                      onValueChange={(value) => handleTaskDefaultChange(task.type, value)}
                      disabled={isActionLoading(`save-default-${task.type}`)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select default model" />
                      </SelectTrigger>
                      <SelectContent>
                        {enabledModels.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.name} ({model.provider?.name})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isActionLoading(`save-default-${task.type}`) && (
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
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Provider Dialog */}
      <Dialog open={providerDialogOpen} onOpenChange={setProviderDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingProvider ? "Edit Provider" : "Add Provider"}</DialogTitle>
            <DialogDescription>
              Configure AI provider settings
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="provider-name">Name</Label>
              <Input
                id="provider-name"
                value={providerForm.name}
                onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="provider-slug">Slug</Label>
              <Input
                id="provider-slug"
                value={providerForm.slug}
                onChange={(e) => setProviderForm({ ...providerForm, slug: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="provider-url">Base URL</Label>
              <Input
                id="provider-url"
                value={providerForm.base_url}
                onChange={(e) => setProviderForm({ ...providerForm, base_url: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="provider-auth-name">Auth Header Name</Label>
              <Input
                id="provider-auth-name"
                value={providerForm.auth_header_name}
                onChange={(e) => setProviderForm({ ...providerForm, auth_header_name: e.target.value })}
                placeholder="e.g., Authorization"
              />
            </div>
            <div>
              <Label htmlFor="provider-auth-prefix">Auth Header Prefix</Label>
              <Input
                id="provider-auth-prefix"
                value={providerForm.auth_header_prefix}
                onChange={(e) => setProviderForm({ ...providerForm, auth_header_prefix: e.target.value })}
                placeholder="e.g., Bearer"
              />
            </div>
            <div>
              <Label htmlFor="provider-api-key">API Key</Label>
              <Input
                id="provider-api-key"
                type="password"
                value={providerForm.api_key}
                onChange={(e) => setProviderForm({ ...providerForm, api_key: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={providerForm.supports_text}
                  onCheckedChange={(checked) => setProviderForm({ ...providerForm, supports_text: checked })}
                />
                <Label>Supports Text</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={providerForm.supports_images}
                  onCheckedChange={(checked) => setProviderForm({ ...providerForm, supports_images: checked })}
                />
                <Label>Supports Images</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={providerForm.is_enabled}
                  onCheckedChange={(checked) => setProviderForm({ ...providerForm, is_enabled: checked })}
                />
                <Label>Enabled</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProviderDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveProvider}
              disabled={isActionLoading(editingProvider ? `save-provider-${editingProvider.id}` : 'add-provider')}
              style={{
                opacity: isActionLoading(editingProvider ? `save-provider-${editingProvider.id}` : 'add-provider') ? 0.7 : 1,
                cursor: isActionLoading(editingProvider ? `save-provider-${editingProvider.id}` : 'add-provider') ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {isActionLoading(editingProvider ? `save-provider-${editingProvider.id}` : 'add-provider') && (
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
              {isActionLoading(editingProvider ? `save-provider-${editingProvider.id}` : 'add-provider') ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Model Dialog */}
      <Dialog open={modelDialogOpen} onOpenChange={setModelDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingModel ? "Edit Model" : "Add Model"}</DialogTitle>
            <DialogDescription>
              Configure AI model settings
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div>
              <Label htmlFor="model-name">Name</Label>
              <Input
                id="model-name"
                value={modelForm.name}
                onChange={(e) => setModelForm({ ...modelForm, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="model-id">Model ID</Label>
              <Input
                id="model-id"
                value={modelForm.model_id}
                onChange={(e) => setModelForm({ ...modelForm, model_id: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="model-provider">Provider</Label>
              <Select
                value={modelForm.provider_id}
                onValueChange={(value) => setModelForm({ ...modelForm, provider_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="model-description">Description</Label>
              <Textarea
                id="model-description"
                value={modelForm.description}
                onChange={(e) => setModelForm({ ...modelForm, description: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="model-best-for">Best For (comma-separated)</Label>
              <Input
                id="model-best-for"
                value={modelForm.best_for.join(", ")}
                onChange={(e) => setModelForm({ ...modelForm, best_for: e.target.value.split(", ").filter(Boolean) })}
                placeholder="mentor_chat, template_generation"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="model-cost-input">Cost per 1k input</Label>
                <Input
                  id="model-cost-input"
                  type="number"
                  value={modelForm.cost_per_1k_input}
                  onChange={(e) => setModelForm({ ...modelForm, cost_per_1k_input: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="model-cost-output">Cost per 1k output</Label>
                <Input
                  id="model-cost-output"
                  type="number"
                  value={modelForm.cost_per_1k_output}
                  onChange={(e) => setModelForm({ ...modelForm, cost_per_1k_output: Number(e.target.value) })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="model-sort-order">Sort Order</Label>
              <Input
                id="model-sort-order"
                type="number"
                value={modelForm.sort_order}
                onChange={(e) => setModelForm({ ...modelForm, sort_order: Number(e.target.value) })}
              />
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Switch
                  checked={modelForm.supports_vision}
                  onCheckedChange={(checked) => setModelForm({ ...modelForm, supports_vision: checked })}
                />
                <Label>Vision Support</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={modelForm.supports_images_out}
                  onCheckedChange={(checked) => setModelForm({ ...modelForm, supports_images_out: checked })}
                />
                <Label>Image Output</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={modelForm.is_enabled}
                  onCheckedChange={(checked) => setModelForm({ ...modelForm, is_enabled: checked })}
                />
                <Label>Enabled</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={modelForm.is_default}
                  onCheckedChange={(checked) => setModelForm({ ...modelForm, is_default: checked })}
                />
                <Label>Default</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModelDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveModel}
              disabled={isActionLoading(editingModel ? `save-model-${editingModel.id}` : 'add-model')}
              style={{
                opacity: isActionLoading(editingModel ? `save-model-${editingModel.id}` : 'add-model') ? 0.7 : 1,
                cursor: isActionLoading(editingModel ? `save-model-${editingModel.id}` : 'add-model') ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {isActionLoading(editingModel ? `save-model-${editingModel.id}` : 'add-model') && (
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
              {isActionLoading(editingModel ? `save-model-${editingModel.id}` : 'add-model') ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
