import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  getErrorStats, 
  getErrors, 
  resolveError, 
  resolveAllErrors, 
  deleteResolvedErrors,
  type ErrorModule,
  type ErrorType
} from "@/services/errorService";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Bug, CheckCircle, AlertTriangle, Search, RefreshCw } from "lucide-react";

const MODULE_OPTIONS: { value: ErrorModule | 'all'; label: string }[] = [
  { value: 'all', label: 'All modules' },
  { value: 'mentor', label: 'Mentor' },
  { value: 'prostudio', label: 'ProStudio' },
  { value: 'campaignkit', label: 'CampaignKit' },
  { value: 'contentcalendar', label: 'ContentCalendar' },
  { value: 'docstudio', label: 'DocStudio' },
  { value: 'reelbuilder', label: 'ReelBuilder' },
  { value: 'auth', label: 'Auth' },
  { value: 'admin', label: 'Admin' },
  { value: 'other', label: 'Other' }
];

const ERROR_TYPE_OPTIONS: { value: ErrorType | 'all'; label: string }[] = [
  { value: 'all', label: 'All types' },
  { value: 'ai_call', label: 'AI call' },
  { value: 'database', label: 'Database' },
  { value: 'storage', label: 'Storage' },
  { value: 'auth', label: 'Auth' },
  { value: 'api', label: 'API' },
  { value: 'unknown', label: 'Unknown' }
];

const MODULE_COLORS: Record<ErrorModule, string> = {
  mentor: '#D4A017',
  prostudio: '#14B8A6',
  campaignkit: '#3B82F6',
  contentcalendar: '#8B5CF6',
  docstudio: '#A855F7',
  reelbuilder: '#EC4899',
  library: '#6B7280',
  brand_dna: '#F59E0B',
  auth: '#10B981',
  admin: '#EF4444',
  other: '#6B7280'
};

const ERROR_TYPE_COLORS: Record<ErrorType, string> = {
  ai_call: '#EF4444',
  database: '#F97316',
  storage: '#EAB308',
  auth: '#3B82F6',
  api: '#8B5CF6',
  unknown: '#6B7280'
};

interface ErrorRecord {
  id: string;
  user_id: string;
  error_type: ErrorType;
  module: ErrorModule;
  error_message: string;
  error_code: string | null;
  error_stack: string | null;
  context: Record<string, any>;
  task_type: string | null;
  model_id: string | null;
  provider_slug: string | null;
  is_resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
  created_at: string;
  call_location: string | null;
  user_action: string | null;
  pipeline_step: string | null;
  breadcrumbs: any[] | null;
  url_path: string | null;
  component_name: string | null;
}

export default function AdminErrorLogs() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState({ total: 0, unresolved: 0, aiErrors: 0, last24h: 0 });
  const [errors, setErrors] = useState<ErrorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

  const setActionLoading = (key: string, value: boolean) => {
    setLoadingStates(prev => ({ ...prev, [key]: value }));
  };

  const isActionLoading = (key: string) => loadingStates[key] === true;
  
  // Filter state
  const [moduleFilter, setModuleFilter] = useState<ErrorModule | 'all'>('all');
  const [errorTypeFilter, setErrorTypeFilter] = useState<ErrorType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unresolved' | 'resolved'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Expanded rows
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);
  
  // Resolution notes
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});
  
  // Dialogs
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [markAllDialogOpen, setMarkAllDialogOpen] = useState(false);

  useEffect(() => {
    loadData();
    
    // Auto-refresh every 60 seconds
    const interval = setInterval(() => {
      loadData();
      setLastUpdated(new Date());
    }, 60000);
    
    return () => clearInterval(interval);
  }, [moduleFilter, errorTypeFilter, statusFilter, searchQuery]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData, errorsData] = await Promise.all([
        getErrorStats(),
        getErrors({
          module: moduleFilter === 'all' ? undefined : moduleFilter,
          errorType: errorTypeFilter === 'all' ? undefined : errorTypeFilter,
          isResolved: statusFilter === 'all' ? undefined : statusFilter === 'resolved',
          limit: 100,
          search: searchQuery || undefined
        })
      ]);
      
      setStats(statsData);
      setErrors(errorsData.data || []);
    } catch (error) {
      console.error('Failed to load error logs:', error);
      toast.error('Failed to load error logs');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (errorId: string) => {
    if (!user?.id) return;
    const loadingKey = `resolve-error-${errorId}`;
    setActionLoading(loadingKey, true);
    
    const note = resolutionNotes[errorId] || '';
    const result = await resolveError(errorId, user.id, note);
    
    if (result.success) {
      toast.success('Resolved');
      setExpandedErrorId(null);
      setResolutionNotes(prev => {
        const next = { ...prev };
        delete next[errorId];
        return next;
      });
      loadData();
    } else {
      toast.error(result.error || 'Failed to resolve error');
    }
    setActionLoading(loadingKey, false);
  };

  const handleMarkAllResolved = async () => {
    if (!user?.id) return;
    setActionLoading('resolve-all', true);
    
    const result = await resolveAllErrors(user.id);
    if (result.success) {
      toast.success('All resolved');
      setMarkAllDialogOpen(false);
      loadData();
    } else {
      toast.error(result.error || 'Failed to resolve errors');
    }
    setActionLoading('resolve-all', false);
  };

  const handleDeleteResolved = async () => {
    setActionLoading('delete-resolved', true);
    const result = await deleteResolvedErrors();
    if (result.success) {
      toast.success('Deleted');
      setDeleteDialogOpen(false);
      loadData();
    } else {
      toast.error(result.error || 'Failed to delete errors');
    }
    setActionLoading('delete-resolved', false);
  };

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const getUserInitials = (error: ErrorRecord) => {
    return error.user_id?.slice(0, 2).toUpperCase() || 'AN';
  };

  const getUserName = (error: ErrorRecord) => {
    return error.user_id || 'Anonymous';
  };

  if (loading && errors.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-4 h-4 rounded-full bg-[#D4A017] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl">
      <div className="mb-6">
        <h1 className="font-display text-[26px] font-semibold text-foreground mb-2">
          Error Logs
        </h1>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-lg border border-border bg-card">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Total errors</p>
          <p className="text-2xl font-semibold text-foreground">{stats.total}</p>
        </div>
        <div 
          className="p-4 rounded-lg border bg-card"
          style={{ 
            borderColor: stats.unresolved > 0 ? '#D4A017' : 'transparent',
            borderWidth: stats.unresolved > 0 ? '0.5px' : '0px'
          }}
        >
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Unresolved</p>
          <p 
            className="text-2xl font-semibold"
            style={{ color: stats.unresolved > 0 ? '#D4A017' : 'inherit' }}
          >
            {stats.unresolved}
          </p>
        </div>
        <div className="p-4 rounded-lg border border-border bg-card">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">AI errors</p>
          <p className="text-2xl font-semibold" style={{ color: '#3B82F6' }}>{stats.aiErrors}</p>
        </div>
        <div className="p-4 rounded-lg border border-border bg-card">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Last 24 hours</p>
          <p className="text-2xl font-semibold text-foreground">{stats.last24h}</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <Select value={moduleFilter} onValueChange={(v: any) => setModuleFilter(v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODULE_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={errorTypeFilter} onValueChange={(v: any) => setErrorTypeFilter(v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ERROR_TYPE_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1">
          <Button
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('all')}
          >
            All
          </Button>
          <Button
            variant={statusFilter === 'unresolved' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('unresolved')}
          >
            Unresolved
          </Button>
          <Button
            variant={statusFilter === 'resolved' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('resolved')}
          >
            Resolved
          </Button>
        </div>

        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search message, page, location, action..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Button
          variant="outline"
          className="text-[#D4A017] border-[#D4A017] hover:bg-[#D4A017]/10"
          onClick={() => setMarkAllDialogOpen(true)}
          disabled={isActionLoading('resolve-all')}
          style={{
            opacity: isActionLoading('resolve-all') ? 0.7 : 1,
            cursor: isActionLoading('resolve-all') ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          {isActionLoading('resolve-all') && (
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
          {isActionLoading('resolve-all') ? 'Resolving all...' : 'Mark all resolved'}
        </Button>
        <Button
          variant="ghost"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => setDeleteDialogOpen(true)}
          disabled={isActionLoading('delete-resolved')}
          style={{
            opacity: isActionLoading('delete-resolved') ? 0.7 : 1,
            cursor: isActionLoading('delete-resolved') ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          {isActionLoading('delete-resolved') && (
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
          {isActionLoading('delete-resolved') ? 'Deleting...' : 'Delete resolved'}
        </Button>
      </div>

      {/* Auto-refresh indicator */}
      <div className="flex items-center justify-end mb-4">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <RefreshCw className="w-3 h-3" />
          Updated just now
        </div>
      </div>

      {/* Errors table */}
      {errors.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <CheckCircle className="w-12 h-12 text-green-500 mb-4" />
          <h3 className="font-display text-[20px] text-foreground mb-2">No errors found</h3>
          <p className="text-sm text-muted-foreground">
            {statusFilter === 'unresolved' 
              ? 'No unresolved errors — everything is running smoothly.' 
              : 'No errors match your current filters.'}
          </p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-ui uppercase tracking-wider text-muted-foreground w-[120px]">Time</th>
                <th className="text-left px-4 py-3 text-xs font-ui uppercase tracking-wider text-muted-foreground w-[160px]">User</th>
                <th className="text-left px-4 py-3 text-xs font-ui uppercase tracking-wider text-muted-foreground w-[100px]">Module</th>
                <th className="text-left px-4 py-3 text-xs font-ui uppercase tracking-wider text-muted-foreground w-[100px]">Type</th>
                <th className="text-left px-4 py-3 text-xs font-ui uppercase tracking-wider text-muted-foreground">Error message</th>
                <th className="text-left px-4 py-3 text-xs font-ui uppercase tracking-wider text-muted-foreground w-[100px]">Page</th>
                <th className="text-left px-4 py-3 text-xs font-ui uppercase tracking-wider text-muted-foreground w-[120px]">Pipeline step</th>
                <th className="text-left px-4 py-3 text-xs font-ui uppercase tracking-wider text-muted-foreground w-[80px]">Status</th>
                <th className="text-left px-4 py-3 text-xs font-ui uppercase tracking-wider text-muted-foreground w-[80px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {errors.map((error) => (
                <>
                  <tr 
                    key={error.id}
                    className="border-t border-border cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedErrorId(expandedErrorId === error.id ? null : error.id)}
                  >
                    <td className="px-4 py-3 text-xs font-ui text-muted-foreground" title={error.created_at}>
                      {getRelativeTime(error.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white"
                          style={{ background: '#D4A017' }}
                        >
                          {getUserInitials(error)}
                        </div>
                        <span className="text-[12px] text-foreground">{getUserName(error)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium text-white"
                        style={{ background: MODULE_COLORS[error.module] }}
                      >
                        {error.module}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium text-white"
                        style={{ background: ERROR_TYPE_COLORS[error.error_type] }}
                      >
                        {error.error_type === 'ai_call' ? 'AI' : error.error_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-ui text-foreground truncate max-w-xs">
                      {error.error_message}
                    </td>
                    <td className="px-4 py-3 text-[11px] font-ui text-muted-foreground truncate">
                      {error.url_path || '—'}
                    </td>
                    <td className="px-4 py-3 text-[11px] font-ui text-muted-foreground truncate">
                      {error.pipeline_step || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium"
                        style={{ 
                          background: error.is_resolved ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          color: error.is_resolved ? '#22C55E' : '#F87171'
                        }}
                      >
                        {error.is_resolved ? 'Resolved' : 'Open'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {!error.is_resolved && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-[#D4A017] hover:text-[#D4A017]/80 p-0 h-auto text-[12px]"
                          disabled={isActionLoading(`resolve-error-${error.id}`)}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResolve(error.id);
                          }}
                          style={{
                            opacity: isActionLoading(`resolve-error-${error.id}`) ? 0.7 : 1,
                            cursor: isActionLoading(`resolve-error-${error.id}`) ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          {isActionLoading(`resolve-error-${error.id}`) && (
                            <span style={{
                              width: '10px',
                              height: '10px',
                              border: '2px solid currentColor',
                              borderTopColor: 'transparent',
                              borderRadius: '50%',
                              display: 'inline-block',
                              animation: 'spin 0.6s linear infinite',
                              flexShrink: 0
                            }} />
                          )}
                          {isActionLoading(`resolve-error-${error.id}`) ? 'Resolving...' : 'Resolve'}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-foreground p-0 h-auto text-[12px]"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedErrorId(expandedErrorId === error.id ? null : error.id);
                        }}
                      >
                        Details
                      </Button>
                    </td>
                  </tr>
                  {expandedErrorId === error.id && (
                    <tr>
                      <td colSpan={9} className="p-0">
                        <div
                          className="p-4 font-mono text-[12px]"
                          style={{ 
                            background: '#080F18',
                            borderRadius: '8px',
                            margin: '4px 16px 4px 16px'
                          }}
                        >
                          <div className="space-y-4">
                            <div>
                              <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#D4A017' }}>MESSAGE</p>
                              <p className="text-foreground whitespace-pre-wrap">{error.error_message}</p>
                            </div>
                            
                            <div>
                              <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: '#D4A017' }}>WHERE IT HAPPENED</p>
                              <div className="space-y-1" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                                <div><span className="inline-block w-24">Page:</span> {error.url_path || '—'}</div>
                                <div><span className="inline-block w-24">Component:</span> {error.component_name || '—'}</div>
                                <div><span className="inline-block w-24">Function:</span> {error.call_location || '—'}</div>
                              </div>
                            </div>
                            
                            {error.user_action && (
                              <div>
                                <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#D4A017' }}>WHAT THE USER WAS DOING</p>
                                <p style={{ color: 'rgba(255, 255, 255, 0.6)' }}>{error.user_action}</p>
                              </div>
                            )}
                            
                            {error.pipeline_step && (
                              <div>
                                <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#D4A017' }}>PIPELINE STEP THAT FAILED</p>
                                <p style={{ color: 'rgba(255, 255, 255, 0.6)' }}>{error.pipeline_step}</p>
                              </div>
                            )}
                            
                            {error.breadcrumbs && error.breadcrumbs.length > 0 && (
                              <div>
                                <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: '#D4A017' }}>BREADCRUMBS (recent actions before this error)</p>
                                <div className="space-y-1">
                                  {error.breadcrumbs.map((crumb: any, idx: number) => (
                                    <div key={idx} className="flex items-center gap-4 text-[11px]" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                                      <span className="w-24 shrink-0">{crumb.timestamp?.split('T')[1]?.slice(0, 8) || '—'}</span>
                                      <span className="w-32 shrink-0">{crumb.action}</span>
                                      <span className="w-20 shrink-0">{crumb.module}</span>
                                      {crumb.data && (
                                        <span className="text-[10px] opacity-70">
                                          {Object.entries(crumb.data).map(([k, v]: [string, any]) => `${k}:${typeof v === 'string' ? v?.slice(0, 20) : v}`).join(' ')}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {(error.task_type || error.model_id || error.provider_slug) && (
                              <div>
                                <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: '#D4A017' }}>AI CONTEXT</p>
                                <div className="space-y-1" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                                  {error.task_type && <div><span className="inline-block w-24">Task type:</span> {error.task_type}</div>}
                                  {error.model_id && <div><span className="inline-block w-24">Model:</span> {error.model_id}</div>}
                                  {error.provider_slug && <div><span className="inline-block w-24">Provider:</span> {error.provider_slug}</div>}
                                </div>
                              </div>
                            )}
                            
                            {error.context && Object.keys(error.context).length > 0 && (
                              <div>
                                <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#D4A017' }}>ADDITIONAL CONTEXT</p>
                                <pre className="text-foreground overflow-x-auto text-[11px]" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>{JSON.stringify(error.context, null, 2)}</pre>
                              </div>
                            )}
                            
                            {error.error_stack && (
                              <div>
                                <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#D4A017' }}>STACK TRACE (if available)</p>
                                <pre className="text-foreground overflow-x-auto text-[10px]" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>{error.error_stack}</pre>
                              </div>
                            )}
                            
                            {!error.is_resolved && (
                              <div className="flex items-center gap-3 pt-3 border-t border-border">
                                <Input
                                  placeholder="Add resolution note..."
                                  value={resolutionNotes[error.id] || ''}
                                  onChange={(e) => setResolutionNotes(prev => ({ ...prev, [error.id]: e.target.value }))}
                                  className="flex-1 h-9"
                                />
                                <Button
                                  className="bg-[#D4A017] text-white hover:bg-[#D4A017]/90"
                                  onClick={() => handleResolve(error.id)}
                                  disabled={isActionLoading(`resolve-error-${error.id}`)}
                                  style={{
                                    opacity: isActionLoading(`resolve-error-${error.id}`) ? 0.7 : 1,
                                    cursor: isActionLoading(`resolve-error-${error.id}`) ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                  }}
                                >
                                  {isActionLoading(`resolve-error-${error.id}`) && (
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
                                  {isActionLoading(`resolve-error-${error.id}`) ? 'Resolving...' : 'Resolve'}
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete resolved dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Resolved Errors?</DialogTitle>
            <DialogDescription>
              This will permanently delete all resolved errors. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={handleDeleteResolved}
              disabled={isActionLoading('delete-resolved')}
              style={{
                opacity: isActionLoading('delete-resolved') ? 0.7 : 1,
                cursor: isActionLoading('delete-resolved') ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {isActionLoading('delete-resolved') && (
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
              {isActionLoading('delete-resolved') ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark all resolved dialog */}
      <Dialog open={markAllDialogOpen} onOpenChange={setMarkAllDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mark All as Resolved?</DialogTitle>
            <DialogDescription>
              This will mark all unresolved errors as resolved. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkAllDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[#D4A017] text-white hover:bg-[#D4A017]/90"
              onClick={handleMarkAllResolved}
              disabled={isActionLoading('resolve-all')}
              style={{
                opacity: isActionLoading('resolve-all') ? 0.7 : 1,
                cursor: isActionLoading('resolve-all') ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {isActionLoading('resolve-all') && (
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
              {isActionLoading('resolve-all') ? 'Resolving...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
