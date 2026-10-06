import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, AlertTriangle, CheckCircle, ChevronDown, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { saveTemplateVariant } from "@/services/templateService";
import { validateSceneDocument, normalizeSceneDocument } from "@/lib/scene/validateSceneDocument";
import { renderSceneToCanvas } from "@/lib/renderers/renderSceneToCanvas";
import type { SceneDocument, SceneNode } from "@/types/scene";

// ─── Constants ────────────────────────────────────────────────────────────────

const PLACEHOLDER_SRC =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const SLOT_TYPES = [
  "headline",
  "subheadline",
  "body_copy",
  "cta_text",
  "cta_button",
  "product_image",
  "logo_placement",
  "decoration",
  "background",
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Platform {
  id: string;
  name: string;
  slug: string;
  image_width: number | null;
  image_height: number | null;
}

interface ValidationError {
  type: "json" | "schema" | "dimension" | "slot_type";
  message: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildGuide(platform: Platform): string {
  const w = platform.image_width ?? 1080;
  const h = platform.image_height ?? 1080;
  return `Convert my design into a Kinika Scene JSON document for a ${platform.name} format (${w}×${h}px).

Requirements:
- Root: { "version": "1", "width": ${w}, "height": ${h}, "background": "#FFFFFF", "nodes": [...] }
- Every text node must include slot_type (one of: headline, subheadline, body_copy, cta_text, cta_button) and "editable": true
- Every image node must include slot_type (one of: product_image, logo_placement) and "editable": true
- Decorative shapes/backgrounds must include slot_type: "decoration" or "background" and "editable": false
- All nodes need: id (unique string), type, x, y, width, height, rotation: 0, opacity: 1, zIndex
- Text nodes also need: content, fontFamily, fontSize, fontWeight, color, textAlign, lineHeight, letterSpacing
- Image nodes also need: src (use placeholder string "placeholder"), objectFit: "cover", borderRadius: 0

Return only valid JSON, no explanation, no markdown code blocks.`;
}

function preprocessScene(scene: SceneDocument): SceneDocument {
  const processNodes = (nodes: SceneNode[]): SceneNode[] =>
    nodes.map((n) => {
      if (n.type === "image" && (n as any).src === "placeholder") {
        return { ...n, src: PLACEHOLDER_SRC } as SceneNode;
      }
      if ("children" in n && Array.isArray((n as any).children)) {
        return { ...n, children: processNodes((n as any).children) } as SceneNode;
      }
      return n;
    });
  return { ...scene, nodes: processNodes(scene.nodes) };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VariantStudio() {
  const { templateId, variantId } = useParams<{ templateId: string; variantId: string }>();
  const isNew = variantId === "new";
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { profile } = useProfile();
  const rightPaneRef = useRef<HTMLDivElement>(null);

  // ── Data state ──
  const [templateName, setTemplateName] = useState("");
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [takenPlatformIds, setTakenPlatformIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [variantStatus, setVariantStatus] = useState<string | null>(null);
  const [generationPrompt, setGenerationPrompt] = useState<string>("");
  const [promptLoading, setPromptLoading] = useState(true);

  // ── Form state ──
  const [selectedPlatformId, setSelectedPlatformId] = useState("");
  const [jsonInput, setJsonInput] = useState("");
  const [guideOpen, setGuideOpen] = useState(true);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [fitnessPassed, setFitnessPassed] = useState(false);
  const [scene, setScene] = useState<SceneDocument | null>(null);
  const [selectedNode, setSelectedNode] = useState<SceneNode | null>(null);
  const [saving, setSaving] = useState(false);

  // ── Canvas state ──
  const [canvasDataUrl, setCanvasDataUrl] = useState<string | null>(null);
  const [canvasNativeW, setCanvasNativeW] = useState(0);
  const [canvasNativeH, setCanvasNativeH] = useState(0);
  const [rightPaneWidth, setRightPaneWidth] = useState(800);

  const selectedPlatform = platforms.find((p) => p.id === selectedPlatformId) ?? null;

  // ── Load data ──

  useEffect(() => {
    if (!templateId || !user) return;
    load();
  }, [templateId, variantId, user]);

  const load = async () => {
    setLoading(true);
    try {
      const [templateRes, platformsRes, takenRes, promptRes] = await Promise.all([
        (supabase as any)
          .from("prostudio_templates")
          .select("id, name, status, creator_id")
          .eq("id", templateId)
          .single(),
        (supabase as any)
          .from("content_platforms")
          .select("id, name, slug, image_width, image_height")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
        (supabase as any)
          .from("template_variants")
          .select("platform_id, id")
          .eq("template_id", templateId),
        (supabase as any)
          .from("ai_system_prompts")
          .select("system_prompt")
          .eq("task_type", "variant_scene_generation")
          .single(),
      ]);

      const template = templateRes.data;
      if (!template) {
        toast({ title: "Template not found", variant: "destructive" });
        navigate("/creator");
        return;
      }

      const isOwner = template.creator_id === user?.id;
      const isAdmin = profile?.role === "admin";
      if (!isOwner && !isAdmin) {
        toast({ title: "Access denied", variant: "destructive" });
        navigate("/creator");
        return;
      }

      setTemplateName(template.name || "");
      setPlatforms((platformsRes.data as Platform[]) ?? []);
      setGenerationPrompt(promptRes.data?.system_prompt ?? "");
      setPromptLoading(false);

      const taken = new Set<string>(
        ((takenRes.data ?? []) as { platform_id: string; id: string }[])
          .filter((r) => isNew || r.id !== variantId)
          .map((r) => r.platform_id)
      );
      setTakenPlatformIds(taken);

      // Load existing variant if editing
      if (!isNew && variantId) {
        const { data: variant } = await (supabase as any)
          .from("template_variants")
          .select("id, template_id, platform_id, scene_json, fitness_check_passed, is_primary, status")
          .eq("id", variantId)
          .single();

        if (variant) {
          setSelectedPlatformId(variant.platform_id);
          setVariantStatus(variant.status);
          setFitnessPassed(variant.fitness_check_passed ?? false);
          if (variant.scene_json) {
            setScene(variant.scene_json as SceneDocument);
            setJsonInput(JSON.stringify(variant.scene_json, null, 2));
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Observe right pane width ──

  useEffect(() => {
    const el = rightPaneRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setRightPaneWidth(el.clientWidth));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // ── Render canvas whenever scene changes ──

  useEffect(() => {
    if (!scene) {
      setCanvasDataUrl(null);
      return;
    }
    const processed = preprocessScene(scene);
    renderSceneToCanvas(processed, { pixelRatio: 1, skipFontLoad: true })
      .then((canvas) => {
        setCanvasNativeW(canvas.width);
        setCanvasNativeH(canvas.height);
        setCanvasDataUrl(canvas.toDataURL("image/png"));
      })
      .catch((err) => console.error("renderSceneToCanvas failed:", err));
  }, [scene]);

  // ── Validation ──

  const handleValidate = () => {
    const errors: ValidationError[] = [];
    setValidationErrors([]);
    setFitnessPassed(false);
    setSelectedNode(null);

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonInput);
    } catch (e: any) {
      setValidationErrors([{
        type: "json",
        message: `Invalid JSON: ${e.message}. Common causes: unescaped special characters in text content, missing closing brackets, or URL-encoded text inside string values. Copy the guide above and ask your AI tool to regenerate — paste only the raw JSON with no extra text.`,
      }]);
      return;
    }

    const { valid, document: doc, warnings } = validateSceneDocument(parsed);
    if (!valid) warnings.forEach((w) => errors.push({ type: "schema", message: w }));

    const checkNodes = (nodes: SceneNode[]) => {
      nodes.forEach((n) => {
        if (!(n as any).slot_type) {
          errors.push({
            type: "slot_type",
            message: `Node '${n.id}' is missing slot_type — add it to your AI prompt and regenerate`,
          });
        }
        if ("children" in n && Array.isArray((n as any).children)) checkNodes((n as any).children);
      });
    };
    checkNodes(doc.nodes);

    if (selectedPlatform?.image_width && selectedPlatform?.image_height) {
      if (doc.width !== selectedPlatform.image_width || doc.height !== selectedPlatform.image_height) {
        errors.push({
          type: "dimension",
          message: `Dimension mismatch: your JSON is ${doc.width}×${doc.height} but ${selectedPlatform.name} requires ${selectedPlatform.image_width}×${selectedPlatform.image_height}`,
        });
      }
    }

    setValidationErrors(errors);

    const passed = errors.length === 0;
    const normalized = normalizeSceneDocument(parsed);

    if (passed) {
      setScene(normalized);
      setFitnessPassed(true);
    } else if (!errors.some((e) => e.type === "json" || e.type === "dimension")) {
      setScene(normalized);
      setFitnessPassed(false);
    }
  };

  // ── Node click on canvas ──

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLImageElement>) => {
      if (!scene || !canvasNativeW || !canvasNativeH) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const scaleX = canvasNativeW / rect.width;
      const scaleY = canvasNativeH / rect.height;
      const cx = (e.clientX - rect.left) * scaleX;
      const cy = (e.clientY - rect.top) * scaleY;

      const hit = [...scene.nodes]
        .sort((a, b) => b.zIndex - a.zIndex)
        .find((n) => cx >= n.x && cx <= n.x + n.width && cy >= n.y && cy <= n.y + n.height);

      setSelectedNode(hit ?? null);
    },
    [scene, canvasNativeW, canvasNativeH]
  );

  // ── Node property update ──

  const handleNodeUpdate = (updated: SceneNode) => {
    if (!scene) return;
    const updateInTree = (nodes: SceneNode[]): SceneNode[] =>
      nodes.map((n) => {
        if (n.id === updated.id) return updated;
        if ("children" in n && Array.isArray((n as any).children)) {
          return { ...n, children: updateInTree((n as any).children) } as SceneNode;
        }
        return n;
      });
    setScene({ ...scene, nodes: updateInTree(scene.nodes) });
    setSelectedNode(updated);
  };

  // ── Save ──

  const handleSave = async () => {
    if (!scene || !selectedPlatformId || !templateId) return;
    setSaving(true);

    // isPrimary only when creating and no other variants exist
    const isPrimary = isNew && takenPlatformIds.size === 0;

    const result = await saveTemplateVariant(
      templateId,
      selectedPlatformId,
      scene,
      fitnessPassed,
      isPrimary,
      isNew ? undefined : variantId
    );

    setSaving(false);

    if (result.success) {
      toast({ title: "Variant saved" });
      if (isNew && result.variantId) {
        navigate(`/creator/templates/${templateId}/variants/${result.variantId}`, { replace: true });
      }
    } else {
      toast({ title: "Save failed", description: result.error, variant: "destructive" });
    }
  };

  // ── Copy guide ──

  const copyGuide = () => {
    if (!selectedPlatform) return;
    const text = generationPrompt
      .replace(/\{\{width\}\}/g, String(selectedPlatform.image_width ?? 1080))
      .replace(/\{\{height\}\}/g, String(selectedPlatform.image_height ?? 1080));
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  // ── Canvas display dimensions ──

  const platformW = selectedPlatform?.image_width ?? 1080;
  const platformH = selectedPlatform?.image_height ?? 1080;
  const maxCanvasW = Math.min(rightPaneWidth - 64, platformW);
  const displayW = maxCanvasW;
  const displayH = platformH > 0 ? Math.round((displayW / platformW) * platformH) : displayW;

  // ─────────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const pageTitle = selectedPlatform
    ? `${templateName} / ${selectedPlatform.name}`
    : isNew
    ? "New variant"
    : "Edit variant";

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* ── Header bar ── */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-border bg-card flex-shrink-0">
        <button
          onClick={() => navigate(`/creator/templates/${templateId}`)}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>

        <p className="text-[13px] font-ui text-muted-foreground truncate max-w-sm">{pageTitle}</p>

        <div className="flex items-center gap-3">
          {variantStatus && (
            <span
              className={`text-[11px] font-ui font-medium px-2 py-0.5 rounded-sm capitalize ${
                variantStatus === "active"
                  ? "bg-green-500/10 text-green-600 dark:text-green-400"
                  : variantStatus === "archived"
                  ? "bg-muted text-muted-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {variantStatus}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={!fitnessPassed || saving || !selectedPlatformId}
            className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] font-ui font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <span className="h-2 w-2 rounded-full bg-current/40 animate-pulse" />}
            Save variant
          </button>
        </div>
      </div>

      {/* ── Two-pane body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT PANE */}
        <div className="w-[420px] flex-shrink-0 overflow-y-auto border-r border-border bg-card">
          <div className="p-5 space-y-6">

            {/* Section 1 — Platform */}
            <div>
              <p className="text-xs font-ui font-medium uppercase tracking-wider text-muted-foreground mb-2">
                Platform
              </p>
              <div className="relative">
                <select
                  value={selectedPlatformId}
                  onChange={(e) => {
                    setSelectedPlatformId(e.target.value);
                    setScene(null);
                    setValidationErrors([]);
                    setFitnessPassed(false);
                    setSelectedNode(null);
                  }}
                  className="w-full h-9 rounded-lg border border-border bg-background pl-3 pr-8 text-[13px] font-ui text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Select platform…</option>
                  {platforms.map((p) => (
                    <option key={p.id} value={p.id} disabled={takenPlatformIds.has(p.id)}>
                      {p.name}
                      {p.image_width && p.image_height ? ` — ${p.image_width}×${p.image_height}` : ""}
                      {takenPlatformIds.has(p.id) ? " (already added)" : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* Section 2 — Generation guide */}
            {selectedPlatform && (
              <div>
                <div className="rounded-lg border border-border bg-muted/20">
                  <div
                    onClick={() => setGuideOpen((v) => !v)}
                    className="flex items-center justify-between px-3 py-2.5 cursor-pointer select-none"
                  >
                    <span className="text-xs font-ui font-medium uppercase tracking-wider text-muted-foreground">
                      Generation guide
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); copyGuide(); }}
                        className="flex items-center gap-1 text-[11px] font-ui text-muted-foreground hover:text-primary transition-colors"
                      >
                        <Copy size={11} />
                        Copy
                      </button>
                      <ChevronDown
                        size={13}
                        className={`text-muted-foreground transition-transform ${guideOpen ? "rotate-180" : ""}`}
                      />
                    </div>
                  </div>
                  {guideOpen && (
                    <div className="px-3 pb-3">
                      {promptLoading ? (
                        <div className="h-3 w-3/4 rounded bg-muted-foreground/15 animate-pulse" />
                      ) : (
                        <pre className="text-[11px] font-mono leading-relaxed text-muted-foreground whitespace-pre-wrap break-words">
                          {generationPrompt
                            .replace(/\{\{width\}\}/g, String(selectedPlatform.image_width ?? 1080))
                            .replace(/\{\{height\}\}/g, String(selectedPlatform.image_height ?? 1080))}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Section 3 — JSON input */}
            <div>
              <p className="text-xs font-ui font-medium uppercase tracking-wider text-muted-foreground mb-2">
                Paste Scene JSON
              </p>
              <textarea
                rows={16}
                value={jsonInput}
                onChange={(e) => {
                  setJsonInput(e.target.value);
                  setValidationErrors([]);
                }}
                placeholder={
                  selectedPlatform
                    ? `{ "version": "1", "width": ${selectedPlatform.image_width ?? 1080}, "height": ${selectedPlatform.image_height ?? 1080}, "background": "#FFFFFF", "nodes": [...] }`
                    : "Select a platform first…"
                }
                disabled={!selectedPlatformId}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-[12px] font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none disabled:opacity-50"
              />
              {jsonInput.length > 0 && (
                <p className="mt-1.5 text-[11px] font-ui text-muted-foreground/50 text-right">
                  {jsonInput.length.toLocaleString()} characters
                </p>
              )}
              <button
                type="button"
                onClick={handleValidate}
                disabled={!jsonInput.trim() || !selectedPlatformId}
                className="mt-2 w-full h-9 rounded-lg border border-primary text-primary text-[13px] font-ui font-medium hover:bg-primary/8 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Validate &amp; Render
              </button>
            </div>

            {/* Section 4 — Validation results */}
            {validationErrors.length > 0 && (
              <div className="space-y-1.5">
                {validationErrors.map((err, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded-lg bg-destructive/8 border border-destructive/20 px-3 py-2"
                  >
                    <AlertTriangle size={13} className="text-destructive mt-0.5 flex-shrink-0" />
                    <p className="text-[11px] font-ui text-destructive leading-snug">{err.message}</p>
                  </div>
                ))}
              </div>
            )}
            {fitnessPassed && (
              <div className="flex items-center gap-2 rounded-lg bg-green-500/8 border border-green-500/20 px-3 py-2">
                <CheckCircle size={13} className="text-green-500 flex-shrink-0" />
                <p className="text-[11px] font-ui text-green-600 dark:text-green-400">
                  Scene validated — ready to save
                </p>
              </div>
            )}

            {/* Section 5 — Node properties */}
            {selectedNode && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
                <p className="text-[11px] font-ui font-medium uppercase tracking-wider text-muted-foreground">
                  Selected node — {selectedNode.id}
                </p>
                <div>
                  <label className="text-[11px] font-ui text-muted-foreground block mb-1">Slot type</label>
                  <select
                    value={(selectedNode as any).slot_type ?? ""}
                    onChange={(e) => handleNodeUpdate({ ...selectedNode, slot_type: e.target.value } as any)}
                    className="w-full h-8 rounded border border-border bg-background px-2 text-[12px] font-ui text-foreground"
                  >
                    <option value="">— none —</option>
                    {SLOT_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(selectedNode as any).editable !== false}
                    onChange={(e) => handleNodeUpdate({ ...selectedNode, editable: e.target.checked } as any)}
                    className="accent-primary"
                  />
                  <span className="text-[12px] font-ui text-foreground">Editable</span>
                </label>
                {selectedNode.type === "text" && (
                  <>
                    <div>
                      <label className="text-[11px] font-ui text-muted-foreground block mb-1">Content</label>
                      <textarea
                        rows={2}
                        value={(selectedNode as any).text ?? ""}
                        onChange={(e) => handleNodeUpdate({ ...selectedNode, text: e.target.value } as any)}
                        className="w-full rounded border border-border bg-background px-2 py-1.5 text-[12px] font-ui text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary/40"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-ui text-muted-foreground block mb-1">Font size</label>
                      <input
                        type="number"
                        value={(selectedNode as any).fontSize ?? 16}
                        onChange={(e) => handleNodeUpdate({ ...selectedNode, fontSize: Number(e.target.value) } as any)}
                        className="w-24 h-8 rounded border border-border bg-background px-2 text-[12px] font-ui text-foreground"
                      />
                    </div>
                  </>
                )}
              </div>
            )}

          </div>
        </div>

        {/* RIGHT PANE — canvas */}
        <div
          ref={rightPaneRef}
          className="flex-1 overflow-y-auto flex flex-col items-center justify-center bg-muted/30 dark:bg-[#0D1B2A]"
        >
          {!selectedPlatform ? (
            <p className="text-[13px] font-ui text-muted-foreground/60">Select a platform to begin</p>
          ) : !canvasDataUrl ? (
            <div
              className="border-2 border-dashed border-border rounded-lg flex items-center justify-center"
              style={{ width: displayW, height: displayH }}
            >
              <p className="text-[12px] font-ui text-muted-foreground/60 text-center max-w-[200px] leading-relaxed">
                Paste Scene JSON and validate to preview
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="relative">
                <img
                  src={canvasDataUrl}
                  alt="Scene preview"
                  width={displayW}
                  height={displayH}
                  onClick={handleCanvasClick}
                  className="block rounded shadow-lg cursor-crosshair"
                  style={{ width: displayW, height: displayH }}
                />
                {selectedNode && (
                  <div
                    className="absolute pointer-events-none"
                    style={{
                      left: (selectedNode.x / (canvasNativeW || 1)) * displayW,
                      top: (selectedNode.y / (canvasNativeH || 1)) * displayH,
                      width: (selectedNode.width / (canvasNativeW || 1)) * displayW,
                      height: (selectedNode.height / (canvasNativeH || 1)) * displayH,
                      outline: "2px solid hsl(var(--primary))",
                      outlineOffset: -1,
                    }}
                  />
                )}
              </div>
              <p className="text-[11px] font-ui text-muted-foreground/60">
                {platformW} × {platformH}px
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}