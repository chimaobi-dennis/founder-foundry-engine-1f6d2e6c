import { createContext, useCallback, useContext, useMemo, useReducer, useRef, ReactNode } from "react";
import type { SceneDocument, SceneNode } from "@/types/scene";

// ─── State ────────────────────────────────────────────────────

export interface SceneState {
  document: SceneDocument;
  selectedIds: string[];
  hoveredId: string | null;
  zoom: number;
  pan: { x: number; y: number };
  // scaffolds
  history: SceneDocument[];
  future: SceneDocument[];
  clipboard: SceneNode[];
  // per-node ui state (not persisted)
  ui: Record<string, { hidden?: boolean; locked?: boolean }>;
}

type Action =
  | { type: "set_document"; document: SceneDocument }
  | { type: "update_node"; id: string; patch: Partial<SceneNode> }
  | { type: "update_nodes"; updates: { id: string; patch: Partial<SceneNode> }[] }
  | { type: "add_node"; node: SceneNode }
  | { type: "delete_nodes"; ids: string[] }
  | { type: "duplicate_nodes"; ids: string[]; newNodes: SceneNode[] }
  | { type: "reorder"; id: string; direction: "up" | "down" | "top" | "bottom" }
  | { type: "set_selection"; ids: string[] }
  | { type: "set_hover"; id: string | null }
  | { type: "set_zoom"; zoom: number }
  | { type: "set_pan"; pan: { x: number; y: number } }
  | { type: "toggle_ui"; id: string; key: "hidden" | "locked" }
  | { type: "rename"; id: string; name: string }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "snapshot" };

function patchNode(nodes: SceneNode[], id: string, patch: Partial<SceneNode>): SceneNode[] {
  return nodes.map((n) => {
    if (n.id === id) return { ...n, ...patch } as SceneNode;
    if (n.type === "group") {
      return { ...n, children: patchNode(n.children, id, patch) };
    }
    return n;
  });
}

function removeNodes(nodes: SceneNode[], ids: Set<string>): SceneNode[] {
  return nodes
    .filter((n) => !ids.has(n.id))
    .map((n) => (n.type === "group" ? { ...n, children: removeNodes(n.children, ids) } : n));
}

function reorderNodes(
  nodes: SceneNode[],
  id: string,
  direction: "up" | "down" | "top" | "bottom"
): SceneNode[] {
  const idx = nodes.findIndex((n) => n.id === id);
  if (idx === -1) return nodes;
  const next = [...nodes];
  const [node] = next.splice(idx, 1);
  if (direction === "top") next.push(node);
  else if (direction === "bottom") next.unshift(node);
  else if (direction === "up") next.splice(Math.min(idx + 1, next.length), 0, node);
  else next.splice(Math.max(idx - 1, 0), 0, node);
  return next.map((n, i) => ({ ...n, zIndex: i }));
}

const HISTORY_LIMIT = 50;

function reducer(state: SceneState, action: Action): SceneState {
  const snapshot = (next: Partial<SceneState>): SceneState => ({
    ...state,
    ...next,
    history: [...state.history, state.document].slice(-HISTORY_LIMIT),
    future: [],
  });

  switch (action.type) {
    case "set_document":
      return { ...state, document: action.document, history: [], future: [] };
    case "update_node":
      return snapshot({
        document: { ...state.document, nodes: patchNode(state.document.nodes, action.id, action.patch) },
      });
    case "update_nodes": {
      let nodes = state.document.nodes;
      for (const u of action.updates) nodes = patchNode(nodes, u.id, u.patch);
      return snapshot({ document: { ...state.document, nodes } });
    }
    case "add_node":
      return snapshot({
        document: {
          ...state.document,
          nodes: [...state.document.nodes, { ...action.node, zIndex: state.document.nodes.length }],
        },
        selectedIds: [action.node.id],
      });
    case "delete_nodes": {
      const set = new Set(action.ids);
      return snapshot({
        document: { ...state.document, nodes: removeNodes(state.document.nodes, set) },
        selectedIds: [],
      });
    }
    case "duplicate_nodes":
      return snapshot({
        document: { ...state.document, nodes: [...state.document.nodes, ...action.newNodes] },
        selectedIds: action.newNodes.map((n) => n.id),
      });
    case "reorder":
      return snapshot({
        document: { ...state.document, nodes: reorderNodes(state.document.nodes, action.id, action.direction) },
      });
    case "rename":
      return snapshot({
        document: {
          ...state.document,
          nodes: patchNode(state.document.nodes, action.id, { name: action.name } as Partial<SceneNode>),
        },
      });
    case "set_selection":
      return { ...state, selectedIds: action.ids };
    case "set_hover":
      return { ...state, hoveredId: action.id };
    case "set_zoom":
      return { ...state, zoom: Math.max(0.1, Math.min(4, action.zoom)) };
    case "set_pan":
      return { ...state, pan: action.pan };
    case "toggle_ui":
      return {
        ...state,
        ui: {
          ...state.ui,
          [action.id]: { ...state.ui[action.id], [action.key]: !state.ui[action.id]?.[action.key] },
        },
      };
    case "undo": {
      if (state.history.length === 0) return state;
      const prev = state.history[state.history.length - 1];
      return {
        ...state,
        document: prev,
        history: state.history.slice(0, -1),
        future: [state.document, ...state.future].slice(0, HISTORY_LIMIT),
      };
    }
    case "redo": {
      if (state.future.length === 0) return state;
      const [next, ...rest] = state.future;
      return {
        ...state,
        document: next,
        history: [...state.history, state.document].slice(-HISTORY_LIMIT),
        future: rest,
      };
    }
    case "snapshot":
      return { ...state, history: [...state.history, state.document].slice(-HISTORY_LIMIT), future: [] };
    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────

interface SceneCtx extends SceneState {
  dispatch: React.Dispatch<Action>;
  // helpers
  selectedNode: SceneNode | null;
  setSelection: (ids: string[]) => void;
  updateNode: (id: string, patch: Partial<SceneNode>) => void;
  addNode: (node: SceneNode) => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  reorder: (id: string, direction: "up" | "down" | "top" | "bottom") => void;
  setZoom: (z: number) => void;
  setPan: (p: { x: number; y: number }) => void;
  undo: () => void;
  redo: () => void;
}

const Ctx = createContext<SceneCtx | null>(null);

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

function findNode(nodes: SceneNode[], id: string): SceneNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.type === "group") {
      const f = findNode(n.children, id);
      if (f) return f;
    }
  }
  return null;
}

export function SceneStoreProvider({
  initialDocument,
  onChange,
  children,
}: {
  initialDocument: SceneDocument;
  onChange?: (doc: SceneDocument) => void;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, {
    document: initialDocument,
    selectedIds: [],
    hoveredId: null,
    zoom: 1,
    pan: { x: 0, y: 0 },
    history: [],
    future: [],
    clipboard: [],
    ui: {},
  });

  const lastDocRef = useRef<SceneDocument>(initialDocument);
  if (lastDocRef.current !== state.document) {
    lastDocRef.current = state.document;
    onChange?.(state.document);
  }

  const selectedNode = useMemo(
    () => (state.selectedIds[0] ? findNode(state.document.nodes, state.selectedIds[0]) : null),
    [state.selectedIds, state.document.nodes]
  );

  const value: SceneCtx = {
    ...state,
    dispatch,
    selectedNode,
    setSelection: useCallback((ids) => dispatch({ type: "set_selection", ids }), []),
    updateNode: useCallback((id, patch) => dispatch({ type: "update_node", id, patch }), []),
    addNode: useCallback((node) => dispatch({ type: "add_node", node }), []),
    deleteSelected: useCallback(() => {
      if (state.selectedIds.length) dispatch({ type: "delete_nodes", ids: state.selectedIds });
    }, [state.selectedIds]),
    duplicateSelected: useCallback(() => {
      const newNodes = state.selectedIds
        .map((id) => findNode(state.document.nodes, id))
        .filter(Boolean)
        .map((n) => ({
          ...(n as SceneNode),
          id: makeId((n as SceneNode).type),
          x: (n as SceneNode).x + 20,
          y: (n as SceneNode).y + 20,
          zIndex: state.document.nodes.length,
        })) as SceneNode[];
      if (newNodes.length) dispatch({ type: "duplicate_nodes", ids: state.selectedIds, newNodes });
    }, [state.selectedIds, state.document.nodes]),
    reorder: useCallback((id, direction) => dispatch({ type: "reorder", id, direction }), []),
    setZoom: useCallback((z) => dispatch({ type: "set_zoom", zoom: z }), []),
    setPan: useCallback((p) => dispatch({ type: "set_pan", pan: p }), []),
    undo: useCallback(() => dispatch({ type: "undo" }), []),
    redo: useCallback(() => dispatch({ type: "redo" }), []),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSceneStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSceneStore must be used inside SceneStoreProvider");
  return c;
}

export const sceneHelpers = { makeId, findNode };
