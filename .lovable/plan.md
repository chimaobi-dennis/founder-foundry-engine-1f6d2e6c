# Scene Editor Architecture — Frontend Scaffold

Build a Canva/Figma-style structured editor that runs alongside the existing HTML editor. Backend contract (`render_engine`, `scene_json`, `SceneDocument`) is already in place; this is pure frontend.

## Scope of this implementation

This is a large architectural addition (~15 new files). I'll deliver a working MVP scaffold across all 12 phases — stable enough to render, edit, and persist scenes — but some advanced features land as scaffolds (history, clipboard, virtualization, multi-select, deterministic export).

## What gets built

### 1. New module: `src/components/studio/scene/`
- **SceneCanvas.tsx** — fixed artboard, zoom/pan wrapper, pointer event capture
- **SceneRenderer.tsx** — pure renderer (no interactions) for previews
- **SceneNodeRenderer.tsx** — dispatches to type-specific components
- **SceneTextNode / SceneImageNode / SceneShapeNode / SceneGroupNode** — leaf renderers, absolute positioning, transforms
- **SceneSelectionOverlay.tsx** — selection ring + bbox
- **SceneResizeHandles.tsx** — 8 handles + rotate handle
- **SceneToolbar.tsx** — zoom controls, add-node buttons, delete/duplicate
- **SceneLayersPanel.tsx** — node tree, reorder (dnd-kit already in repo), rename, visibility/lock toggles
- **ScenePropertiesPanel.tsx** — context-aware controls per node type

### 2. State: `src/components/studio/scene/sceneStore.ts`
Zustand store (already a dep) holding:
- `document: SceneDocument`
- `selectedIds: string[]`, `hoveredId`
- `zoom`, `pan`
- `history` (undo/redo scaffold — capped ring buffer)
- `clipboard` (scaffold)
- Actions: `updateNode`, `addNode`, `deleteNodes`, `duplicateNodes`, `reorder`, `setSelection`, `setZoom`, `setPan`

### 3. Render-engine switching
Add a small `<EngineSwitch>` helper used by:
- `StudioEditor.tsx`
- `pages/ContentStudioEditor.tsx`
- `ProStudioEditor.tsx`
- `ExportCanvas.tsx` flow

Logic: `render_engine === 'scene' ? <SceneCanvas/> : <existing HTML editor/>`. HTML editor is untouched.

### 4. Persistence
- Autosave hook `useSceneAutosave(documentId)` — 600ms debounce, writes `scene_json` via existing service layer (no direct supabase calls). I'll add a thin `updateSceneJson` method to `contentStudioService` and `templateService` if not present, calling existing update endpoints.

### 5. Interactions (MVP)
- Single select on pointerdown, click empty = clear
- Drag to move (delta applied to x/y)
- 8-handle resize (no aspect lock for MVP, shift = aspect)
- Rotate handle
- Keyboard: Delete, Cmd/Ctrl+D duplicate, Cmd/Ctrl+Z undo (scaffold), arrows nudge
- Multi-select: shift-click adds to selection; marquee = scaffold (not in MVP)

### 6. Export
- Wire `renderSceneToCanvas` / `renderSceneToBlob` (already scaffolded) into the export modal flow when `render_engine === 'scene'`. No html2canvas path for scene mode.
- Note clearly: existing renderer scaffolds are stubs — export will produce a background-only PNG until the node renderers are filled in. Marked as a known limitation.

## What stays untouched
- HTML editor (`EditableCanvas`, `CreativeRenderer`, current mobile/desktop StudioEditor HTML path)
- All backend services / schema
- `src/types/scene.ts` (consumed as-is)
- `src/lib/renderers/*` (consumed; export wiring only)

## Known limitations after this PR
- `renderSceneToCanvas/SVG` node rendering still TODO in lib scaffolds → scene PNG export = background only
- Undo/redo, clipboard, marquee select, snapping/guides = scaffolds
- AI → scene_json generation prompt migration not included (call out in recommendations)
- Group node editing is read-only render; nested editing scaffold only
- No collaborative editing layer

## Tech choices
- Zustand for store (already in deps)
- `@dnd-kit/sortable` for layers reorder (already in deps)
- Pointer events, no react-dnd for canvas drag (lighter)
- All semantic tokens, dark workspace, follows existing design system

## Files touched
**Created (~15):** scene module above + `sceneStore.ts` + `useSceneAutosave.ts`
**Edited (light):** `StudioEditor.tsx`, `ContentStudioEditor.tsx`, `ProStudioEditor.tsx`, `ExportCanvas.tsx`, possibly `contentStudioService.ts`/`templateService.ts` for a single persistence method

## After approval
I'll implement in this order: types/store → node renderers → SceneCanvas + interactions → panels → engine switch wiring → autosave → export hook → QA. Estimated ~15 new files, ~5 edits.

## Recommendations before AI prompt migration
1. Lock the SceneDocument schema (versioning + migrations strategy)
2. Define a JSON schema / Zod validator for AI output sanity-checking
3. Decide font loading strategy (web fonts vs. embedded) before export work
4. Fill in `renderSceneToCanvas` node implementations before shipping export
