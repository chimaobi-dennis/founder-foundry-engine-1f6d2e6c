import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Download, Sparkles, Save, Wand2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand } from '@/hooks/use-brand';
import { useToast } from '@/hooks/use-toast';
import { renderSceneToCanvas } from '@/lib/renderers/renderSceneToCanvas';
import {
  generateLogoVariants,
  getLogoSessionByVersion,
  getLogoSessionById,
  mutateLogoScene,
  saveLogoToLibrary,
  type LogoSession,
} from '@/services/logoService';
import type { SceneDocument } from '@/types/scene';

type StudioStage = 'prompt' | 'variants' | 'editor';

function SceneCanvasPreview({ scene }: { scene: SceneDocument | null }) {
  const canvasContainer = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const render = async () => {
      if (!scene || !canvasContainer.current) return;
      setIsLoading(true);
      try {
        const canvas = await renderSceneToCanvas(scene, { pixelRatio: 2 });
        if (cancelled || !canvasContainer.current) return;
        canvas.style.width = '100%';
        canvas.style.height = 'auto';
        canvasContainer.current.innerHTML = '';
        canvasContainer.current.appendChild(canvas);
      } catch (error) {
        console.warn('[SceneCanvasPreview] render failed', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    render();
    return () => {
      cancelled = true;
      if (canvasContainer.current) {
        canvasContainer.current.innerHTML = '';
      }
    };
  }, [scene]);

  return (
    <div className="relative overflow-hidden rounded-3xl bg-slate-950 border border-slate-800 min-h-[320px]">
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/80 text-sm text-slate-300">
          Rendering preview…
        </div>
      )}
      <div ref={canvasContainer} className="h-full w-full p-4" />
      {!scene && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-sm text-slate-500">
          <Wand2 size={28} className="mb-3" />
          <p>No scene preview available.</p>
        </div>
      )}
    </div>
  );
}

function LogoVariantCard({
  session,
  isSelected,
  onSelect,
}: {
  session: LogoSession;
  isSelected?: boolean;
  onSelect: () => void;
}) {
  const label = session.generation_params?.variant_label || 'Logo concept';

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative overflow-hidden rounded-3xl border p-4 text-left transition-all ${
        isSelected ? 'border-indigo-500 bg-slate-900 shadow-lg shadow-indigo-500/20' : 'border-slate-800 bg-slate-950 hover:border-slate-600'
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-100">{label}</p>
          <p className="text-xs text-slate-500">Version {session.version || 1}</p>
        </div>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-slate-800 text-slate-300">
          {session.version}
        </span>
      </div>
      <SceneCanvasPreview scene={session.scene_json} />
      <div className="mt-4 text-xs text-slate-400">
        Click to refine this concept.
      </div>
    </button>
  );
}

export default function LogoStudio() {
  const { user } = useAuth();
  const { activeBrand, activeBrandDNA } = useBrand();
  const { toast } = useToast();

  const [stage, setStage] = useState<StudioStage>('prompt');
  const [prompt, setPrompt] = useState('');
  const [styleNotes, setStyleNotes] = useState('Minimal, modern, and bold');
  const [variants, setVariants] = useState<LogoSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<LogoSession | null>(null);
  const [mutationRequest, setMutationRequest] = useState('Make the logo cleaner and more polished.');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingVersion, setIsLoadingVersion] = useState(false);

  const brandContext = useMemo(() => {
    const lines = [];
    if (activeBrand) lines.push(`Brand: ${activeBrand.name}`);
    if (activeBrandDNA?.positioning_statement) lines.push(`Positioning: ${activeBrandDNA.positioning_statement}`);
    if (activeBrandDNA?.brand_voice) lines.push(`Voice: ${activeBrandDNA.brand_voice}`);
    if (activeBrandDNA?.customer_profile) lines.push(`Audience: ${activeBrandDNA.customer_profile}`);
    return lines.join(' | ');
  }, [activeBrand, activeBrandDNA]);

  useEffect(() => {
    if (activeBrand && !prompt) {
      setPrompt(`Create a polished logo for ${activeBrand.name}. Focus on brand clarity, modern typography, and a strong visual mark.`);
    }
  }, [activeBrand, prompt]);

  const handleGenerate = async () => {
    if (!user) {
      toast({ title: 'Sign in to generate logos', variant: 'destructive' });
      return;
    }
    if (!activeBrand) {
      toast({ title: 'Select a brand first', variant: 'destructive' });
      return;
    }
    setIsGenerating(true);

    const result = await generateLogoVariants({
      brandId: activeBrand.id,
      userId: user.id,
      name: activeBrand.name,
      prompt,
      style: styleNotes,
      additionalContext: brandContext,
      brandVoice: activeBrandDNA?.brand_voice ?? undefined,
    });

    setIsGenerating(false);

    if (!result.success) {
      toast({ title: 'Logo generation failed', description: result.error ?? 'Please try again.', variant: 'destructive' });
      return;
    }

    if (!result.sessions || result.sessions.length === 0) {
      toast({ title: 'No variants returned', description: 'AI did not return any logo concepts.', variant: 'destructive' });
      return;
    }

    setVariants(result.sessions);
    setStage('variants');
  };

  const handleSelectVariant = (session: LogoSession) => {
    setSelectedSession(session);
    setStage('editor');
  };

  const handleMutate = async () => {
    if (!user || !selectedSession) return;
    if (!mutationRequest.trim()) {
      toast({ title: 'Enter a refinement request', variant: 'destructive' });
      return;
    }

    setIsMutating(true);

    const result = await mutateLogoScene({
      sessionId: selectedSession.id,
      userId: user.id,
      mutationDescription: mutationRequest,
      currentSceneJson: selectedSession.scene_json ?? undefined,
      additionalContext: brandContext,
    });

    setIsMutating(false);

    if (!result.success) {
      toast({ title: 'Mutation failed', description: result.error ?? 'Unable to refine the logo.', variant: 'destructive' });
      return;
    }

    if (result.session) {
      setSelectedSession(result.session);
      toast({ title: 'Logo refined', description: 'Your new version is ready.' });
    }
  };

  const handleDownloadPng = async () => {
    if (!selectedSession?.scene_json) {
      toast({ title: 'No scene to download', variant: 'destructive' });
      return;
    }

    try {
      const canvas = await renderSceneToCanvas(selectedSession.scene_json, { pixelRatio: 2 });
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((next) => resolve(next), 'image/png');
      });

      if (!blob) {
        throw new Error('Failed to export PNG');
      }

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${activeBrand?.name || 'logo'}-${selectedSession.id.slice(0, 8)}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('[LogoStudio] download failed', error);
      toast({ title: 'Download failed', description: 'Could not export the scene as PNG.', variant: 'destructive' });
    }
  };

  const handleSaveLibrary = async () => {
    if (!user || !activeBrand || !selectedSession) return;
    setIsSaving(true);
    const result = await saveLogoToLibrary({
      brandId: activeBrand.id,
      userId: user.id,
      sessionId: selectedSession.id,
      name: `${activeBrand.name} logo ${selectedSession.generation_params?.variant_label ?? ''}`.trim(),
    });
    setIsSaving(false);

    if (!result.success) {
      toast({ title: 'Save failed', description: result.error ?? 'Could not save to library.', variant: 'destructive' });
      return;
    }

    toast({ title: 'Saved to Library' });
  };

  const handleLoadPreviousVersion = async () => {
    if (!selectedSession) return;
    const rootId = selectedSession.generation_params?.root_session_id || selectedSession.id;
    const previousVersion = Math.max(1, (selectedSession.version || 1) - 1);
    setIsLoadingVersion(true);
    const previousSession = await getLogoSessionByVersion(rootId, previousVersion);
    setIsLoadingVersion(false);

    if (!previousSession) {
      toast({ title: 'Previous version not found', variant: 'destructive' });
      return;
    }

    setSelectedSession(previousSession);
    toast({ title: `Loaded version ${previousVersion}` });
  };

  if (!user) {
    return (
      <div className="min-h-full flex items-center justify-center px-6 py-20">
        <div className="rounded-3xl border border-slate-800 bg-slate-950 p-10 text-center text-slate-200">
          <h1 className="text-2xl font-semibold">Logo Studio</h1>
          <p className="mt-4 text-slate-400">Sign in to generate and refine logo concepts.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-950 text-slate-100 px-6 py-12">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <header className="rounded-[32px] border border-slate-800 bg-slate-900 px-8 py-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Logo Studio</p>
              <h1 className="mt-2 text-3xl font-semibold text-white">Generate and refine logo concepts</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Turn your brand context into polished logo concepts, then refine a chosen direction with AI-driven scene mutations.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950 px-4 py-2 text-sm text-slate-300">
                <Sparkles size={16} /> {activeBrand?.name || 'No active brand'}
              </span>
            </div>
          </div>
        </header>

        {stage === 'prompt' && (
          <section className="grid gap-8 rounded-[32px] border border-slate-800 bg-slate-900 p-8">
            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-3">
                <label className="text-sm text-slate-400">Creative brief</label>
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  rows={6}
                  className="w-full rounded-3xl border border-slate-800 bg-slate-950 px-4 py-4 text-sm text-slate-100 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="Describe the logo concept, audience, positioning, or visual style."
                />
              </div>
              <div className="space-y-4 rounded-3xl border border-slate-800 bg-slate-950 p-6">
                <div>
                  <p className="text-sm font-semibold text-slate-100">Brand context</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {brandContext || 'No brand context available yet. Use the brand DNA or add a short brief.'}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-slate-400">Style direction</label>
                  <input
                    value={styleNotes}
                    onChange={(event) => setStyleNotes(event.target.value)}
                    className="mt-2 w-full rounded-3xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="Minimal, geometric, luxury, bold..."
                  />
                </div>
                <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
                  Use your active brand and style notes to generate 4 logo concepts. Each concept is saved as a logo session.
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-slate-500">
                {variants.length > 0 ? `${variants.length} concepts ready to refine.` : 'Start with a strong brief to seed the AI.'}
              </div>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="inline-flex items-center justify-center gap-2 rounded-3xl bg-indigo-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGenerating ? 'Generating...' : 'Generate 4 concepts'}
              </button>
            </div>
          </section>
        )}

        {stage === 'variants' && (
          <section className="grid gap-6">
            <div className="flex flex-col gap-6 rounded-[32px] border border-slate-800 bg-slate-900 p-8">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Concepts</p>
                  <h2 className="text-2xl font-semibold text-white">Choose a direction to refine</h2>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setStage('prompt')}
                    className="rounded-3xl border border-slate-800 bg-slate-950 px-5 py-3 text-sm text-slate-200 transition hover:border-slate-600"
                  >
                    <ArrowLeft size={16} /> Back to prompt
                  </button>
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {variants.map((session) => (
                  <LogoVariantCard
                    key={session.id}
                    session={session}
                    onSelect={() => handleSelectVariant(session)}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        {stage === 'editor' && selectedSession && (
          <section className="grid gap-8 lg:grid-cols-[1.3fr_0.9fr]">
            <div className="rounded-[32px] border border-slate-800 bg-slate-900 p-8">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Refine logo</p>
                  <h2 className="text-2xl font-semibold text-white">Editor</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setStage('variants')}
                  className="rounded-3xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-200 transition hover:border-slate-600"
                >
                  Choose another concept
                </button>
              </div>

              <div className="mb-8">
                <SceneCanvasPreview scene={selectedSession.scene_json} />
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-400">Current version</p>
                    <p className="text-lg font-semibold text-white">v{selectedSession.version || 1}</p>
                  </div>
                  {selectedSession.version && selectedSession.version > 1 && (
                    <button
                      type="button"
                      onClick={handleLoadPreviousVersion}
                      disabled={isLoadingVersion}
                      className="rounded-3xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-200 transition hover:border-slate-600 disabled:opacity-60"
                    >
                      {isLoadingVersion ? 'Loading…' : 'Load previous version'}
                    </button>
                  )}
                </div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Refinement request</label>
                <textarea
                  value={mutationRequest}
                  onChange={(event) => setMutationRequest(event.target.value)}
                  rows={4}
                  className="w-full rounded-3xl border border-slate-800 bg-slate-900 px-4 py-4 text-sm text-slate-100 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
                <button
                  type="button"
                  onClick={handleMutate}
                  disabled={isMutating}
                  className="mt-4 inline-flex items-center justify-center gap-2 rounded-3xl bg-indigo-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isMutating ? 'Refining…' : 'Refine design'}
                </button>
              </div>
            </div>

            <aside className="space-y-6 rounded-[32px] border border-slate-800 bg-slate-900 p-8">
              <div className="space-y-3 rounded-3xl border border-slate-800 bg-slate-950 p-6">
                <p className="text-sm text-slate-400">Actions</p>
                <button
                  type="button"
                  onClick={handleSaveLibrary}
                  disabled={isSaving}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-3xl bg-slate-800 px-4 py-3 text-sm text-slate-100 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save size={16} />
                  {isSaving ? 'Saving…' : 'Save to Library'}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPng}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-3xl bg-slate-800 px-4 py-3 text-sm text-slate-100 transition hover:bg-slate-700"
                >
                  <Download size={16} />
                  Download PNG
                </button>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6 text-sm leading-6 text-slate-400">
                AI-generated logos are stored as editable scene documents. Use "Refine design" to apply scene mutations and preserve a versioned snapshot for each refinement.
              </div>
            </aside>
          </section>
        )}
      </div>
    </div>
  );
}
