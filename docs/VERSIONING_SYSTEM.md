# Content Studio Versioning System

Production-grade version history for scenes, nodes, layouts, and content.

---

## Overview

This versioning system provides Figma/Notion-style version history for Content Studio,
enabling users to track changes, restore previous versions, and recover from mistakes.

### Key Features

- **Automatic Snapshots**: Versions created on meaningful changes (not every keystroke)
- **Pre-Mutation Safety**: Snapshots before AI operations and destructive edits
- **Patch-Based Storage**: Efficient diffs rather than full copies
- **Restore Safety**: Always creates new version, never permanently overwrites
- **Named Versions**: Users can bookmark important states
- **Visual Timeline**: Date-grouped history with change summaries

---

## Architecture

### Database Schema

```sql
creative_versions          -- Main version table
├── creative_id            -- FK to content_studio_creatives
├── version_number         -- Sequential number (1, 2, 3...)
├── version_type           -- manual | auto | named | system | restore
├── source_type            -- What triggered this version
├── scene_json             -- Full scene (for full snapshots)
├── scene_patch            -- Diff from parent (for patch snapshots)
└── parent_version_id      -- For lineage tracking

version_snapshots          -- Compressed periodic snapshots
└── For efficient reconstruction of old versions

version_annotations        -- User notes/bookmarks
└── User comments on specific versions
```

### Snapshot Strategy

**Full Snapshot**: Complete scene document stored
- Initial generation
- Manual saves
- Every N versions (configurable)
- Before restore operations

**Patch Snapshot**: Only changes stored
- Auto-saves between full snapshots
- AI operations
- Node-level modifications

**Reference Snapshot**: Points to compressed table
- Large scenes older than retention period

---

## Usage

### 1. Basic Integration in Editor

```tsx
import { useVersionHistory } from "@/hooks/useVersionHistory";
import { SaveStatusIndicator } from "@/components/prostudio/content-studio/SaveStatusIndicator";
import { VersionHistoryPanel } from "@/components/prostudio/content-studio/VersionHistoryPanel";

function MyEditor() {
  const {
    versions,
    currentVersion,
    autosave,
    saveVersion,
    restore,
    createPreMutationVersion,
  } = useVersionHistory({
    creativeId: creative.id,
    briefId: brief.id,
    sceneJson: currentScene,
    visualHtml: html,
    copyText: copy,
    enableAutosave: true,
    autosaveIntervalMs: 120_000, // 2 minutes
  });

  return (
    <>
      {/* Save status in toolbar */}
      <SaveStatusIndicator
        status={autosave.status}
        lastSavedAt={autosave.lastSavedAt}
      />

      {/* Version history panel */}
      <VersionHistoryPanel
        isOpen={showHistory}
        versions={versions}
        currentVersionId={currentVersion?.id}
        onRestore={restore}
        onSaveNamedVersion={saveVersion}
      />
    </>
  );
}
```

### 2. Pre-Mutation Snapshots (AI Operations)

```tsx
// Before AI generation/regeneration
const snapshotId = await createPreMutationVersion("AI Regenerate");

try {
  const result = await aiRegenerate(scene);
  // Auto-creates post-mutation version
} catch (error) {
  // User can restore from snapshotId if needed
}
```

### 3. Manual Save Points

```tsx
// User presses Cmd+S or clicks "Save"
await saveVersion("Before headline change");
```

---

## Configuration

### Auto-Save Behavior

```typescript
// Minimum time between auto-versions
minVersionIntervalMs: 120_000 // 2 minutes

// Maximum versions per creative
maxVersions: 50

// Pruning behavior
keepNamedVersions: true
keepRestoredVersions: true
```

### Source Types

Versions are created with source tracking:

- `initial_generation` - First AI generation
- `ai_regenerate` - Visual regeneration
- `ai_rewrite` - Copy rewrite
- `user_edit` - Manual node edit
- `manual_save` - User-initiated save
- `auto_snapshot` - Background auto-save
- `restore` - Restored from previous version
- `pre_delete` - Pre-mutation safety snapshot
- `node_add` / `node_delete` / `node_modify` - Specific changes

---

## Restore Flow

### Safety-First Approach

1. **Create Restore Point**: Current state saved as backup
2. **Restore Target**: Selected version becomes current
3. **New Version Created**: Restoration is tracked as new version
4. **Never Overwrites**: Original history preserved

### Code Example

```typescript
const result = await restoreVersion(
  creativeId,
  briefId,
  targetVersionId,
  userId,
  { createRestorePoint: true }
);

if (result.success) {
  // result.newVersionId - the restoration version
  // result.restoredScene - the scene data
}
```

---

## API Reference

### Service Functions

| Function | Purpose |
|----------|---------|
| `createVersion()` | Core version creation |
| `createManualSaveVersion()` | User-initiated save |
| `createPreMutationSnapshot()` | Pre-operation safety |
| `getVersionHistory()` | Paginated version list |
| `getVersionById()` | Full version details |
| `getVersionScene()` | Reconstruct scene at version |
| `restoreVersion()` | Safe restore with backup |
| `compareVersions()` | Diff between versions |
| `renameVersion()` | Name a version |
| `pruneVersions()` | Clean old versions |

### React Hook

```typescript
const {
  // State
  versions,           // VersionSummary[]
  currentVersion,     // FullVersion | null
  isLoading,
  isRestoring,
  error,
  hasMore,

  // Actions
  saveVersion,        // (name?) => Promise<void>
  createPreMutationVersion, // (mutationName) => Promise<string|null>
  autoSaveVersion,    // (sourceType) => Promise<void>
  restore,            // (versionId) => Promise<boolean>
  compare,            // (fromId, toId) => Promise<DiffResult|null>
  rename,             // (versionId, name) => Promise<void>
  refresh,            // () => Promise<void>
  loadMore,           // () => Promise<void>

  // Autosave state
  autosave: {
    status,           // SaveStatus
    lastSavedAt,      // Date | null
    pendingChanges,   // boolean
    flushPending,     // () => Promise<void>
  },
} = useVersionHistory(options);
```

---

## Migration

Apply the database migration:

```bash
supabase db push
# or
psql -f supabase/migrations/20260526020000_scene_versioning_system.sql
```

Regenerate TypeScript types:

```bash
npx supabase gen types typescript --project-id <project-id> --schema public > src/integrations/supabase/types.ts
```

---

## Performance

### Optimizations

1. **Patch Storage**: Only changes stored between full snapshots
2. **Compressed Snapshots**: ZSTD compression for large scenes
3. **Lazy Loading**: Version list paginated (20/page)
4. **Smart Pruning**: Keeps named + recent versions, removes auto-snapshots
5. **Background Cleanup**: Pruning runs async, doesn't block UI

### Benchmarks

- Version creation: ~50-100ms
- Restore operation: ~100-200ms
- History load (20 items): ~50ms
- Scene reconstruction: ~20-50ms

---

## Future Enhancements

### Planned

- [ ] Visual diff overlay (green=added, red=removed)
- [ ] Version branching for experiments
- [ ] Multi-select restore (restore specific nodes only)
- [ ] Cross-platform version sync
- [ ] Version search/filter

### Collaborative Editing Ready

The architecture supports future CRDT/Operational Transform integration:

- `parent_version_id` supports DAG (directed acyclic graph) structure
- `content_hash` enables conflict detection
- `scene_patch` format is compatible with OT patches
- `user_id` tracking for multi-user attribution

---

## Troubleshooting

### Versions Not Creating

1. Check `enableAutosave: true` in hook options
2. Verify `userId` is available from auth context
3. Ensure migration was applied: `select * from creative_versions limit 1;`

### Restore Fails

1. Check RLS policies: User must own creative or have access via brief
2. Verify `scene_json` isn't null for target version
3. Check browser console for service errors

### Performance Issues

1. Reduce `autosaveIntervalMs` to create fewer versions
2. Enable `maxVersions` pruning
3. Use `loadMore()` pagination instead of loading all history

---

## Related Files

| File | Purpose |
|------|---------|
| `supabase/migrations/20260526020000_scene_versioning_system.sql` | Database schema |
| `src/services/versionService.ts` | Core service layer |
| `src/hooks/useVersionHistory.ts` | React integration |
| `src/lib/scene/sceneVersionIntegration.ts` | Autosave integration |
| `src/components/prostudio/content-studio/VersionHistoryPanel.tsx` | UI panel |
| `src/components/prostudio/content-studio/SaveStatusIndicator.tsx` | Status indicator |
