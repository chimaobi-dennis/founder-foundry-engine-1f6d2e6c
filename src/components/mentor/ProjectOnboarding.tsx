import { useState, useEffect, useRef } from "react";
import { X, Upload, FileText, Globe, Sparkles } from "lucide-react";
import { useBrand } from "@/contexts/BrandContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  extractProjectContext,
  saveExtractedContext,
  markFreshStart,
  fetchWebsiteContent,
  type ExtractedProjectData,
  type OnboardingContext
} from "@/services/projectOnboardingService";
import { getAllStageFields, type StageField } from "@/services/journeyDataService";
import { uploadProjectFile } from "@/services/projectAssetsService";
import { logError } from "@/services/errorService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProjectOnboardingProps {
  brandId: string;
  onComplete: () => void;
}

type Step = "stage" | "context" | "processing" | "results";
type Tab = "paste" | "upload" | "url";

const PROCESSING_MESSAGES = [
  "Reading your content...",
  "Extracting project details...",
  "Mapping to your journey stages...",
  "Preparing your mentor context...",
];

export function ProjectOnboarding({ brandId, onComplete }: ProjectOnboardingProps) {
  const { journeyStages } = useBrand();
  const { user } = useAuth();

  const [step, setStep] = useState<Step>("stage");
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("paste");

  const [pastedText, setPastedText] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const [processingStep, setProcessingStep] = useState(0);
  const [extracted, setExtracted] = useState<ExtractedProjectData | null>(null);
  const [stageFieldsMap, setStageFieldsMap] = useState<Record<string, StageField[]>>({});
  const [saving, setSaving] = useState(false);
  const [fetchedUrlContent, setFetchedUrlContent] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load field labels for the results preview
  useEffect(() => {
    getAllStageFields().then(setStageFieldsMap);
  }, []);

  // Cycle processing messages while AI is working
  useEffect(() => {
    if (step !== "processing") return;
    const interval = setInterval(() => {
      setProcessingStep(s => Math.min(s + 1, PROCESSING_MESSAGES.length - 1));
    }, 1500);
    return () => clearInterval(interval);
  }, [step]);

  const getFieldLabel = (stageKey: string, fieldKey: string): string => {
    const fields = stageFieldsMap[stageKey] ?? [];
    const f = fields.find(x => x.field_key === fieldKey);
    return f?.field_label ?? fieldKey.replace(/_/g, " ");
  };

  const handleSkipFresh = async () => {
    await markFreshStart(brandId);
    onComplete();
  };

  const handleSelectStage = async (stageKey: string) => {
    if (stageKey === "spark_fresh") {
      // "Starting fresh with a new idea" path
      await markFreshStart(brandId);
      toast("Starting fresh — your mentor is ready");
      onComplete();
      return;
    }
    setSelectedStage(stageKey);
    setStep("context");
  };

  const handleAnalyse = async () => {
    if (!user || !selectedStage) return;
    const hasContent = pastedText.trim() || websiteUrl.trim() || uploadedFile;
    if (!hasContent) {
      toast.error("Add some content first or skip to start fresh");
      return;
    }

    setStep("processing");
    setProcessingStep(0);

    const ctx: OnboardingContext = {
      text: pastedText.trim() || undefined,
      websiteUrl: websiteUrl.trim() || undefined,
      file: uploadedFile ?? undefined,
      declaredStage: selectedStage,
    };

    const result = await extractProjectContext(user.id, ctx);

    if (!result) {
      toast.error("Could not extract context — try adding more detail or start fresh");
      setStep("context");
      return;
    }

    setExtracted(result);
    setStep("results");
  };

  const handleConfirmSave = async () => {
    if (!user || !extracted) return;
    setSaving(true);
    const { fieldsCount } = await saveExtractedContext(
      user.id,
      brandId,
      extracted,
      uploadedFile ?? undefined
    );
    toast.success(`Loaded ${fieldsCount} data points — your mentor is ready`);
    setSaving(false);
    onComplete();
  };

  const handleEditBeforeSave = () => {
    setStep("context");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setUploadedFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) setUploadedFile(f);
  };

  const formatBytes = (n: number) => {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  };

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 overflow-y-auto py-8"
      style={{
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
    >
      <div
        className="w-[90%] max-w-[560px] rounded-2xl bg-card border-[0.5px] border-border"
        style={{ padding: "32px" }}
      >
        {step === "stage" && (
          <StagePicker
            stages={journeyStages}
            onSelect={handleSelectStage}
            onSkip={handleSkipFresh}
          />
        )}

        {step === "context" && (
          <ContextStep
            selectedStage={selectedStage}
            stages={journeyStages}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            pastedText={pastedText}
            setPastedText={setPastedText}
            websiteUrl={websiteUrl}
            setWebsiteUrl={setWebsiteUrl}
            uploadedFile={uploadedFile}
            setUploadedFile={setUploadedFile}
            onAnalyse={handleAnalyse}
            onSkip={handleSkipFresh}
            onBack={() => setStep("stage")}
            fileInputRef={fileInputRef}
            onFileChange={handleFileChange}
            onDrop={handleDrop}
            formatBytes={formatBytes}
          />
        )}

        {step === "processing" && (
          <ProcessingStep currentStep={processingStep} />
        )}

        {step === "results" && extracted && (
          <ResultsStep
            extracted={extracted}
            stages={journeyStages}
            getFieldLabel={getFieldLabel}
            onConfirm={handleConfirmSave}
            onEdit={handleEditBeforeSave}
            onSkip={handleSkipFresh}
            saving={saving}
          />
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────

function StagePicker({
  stages,
  onSelect,
  onSkip,
}: {
  stages: any[];
  onSelect: (stageKey: string) => void;
  onSkip: () => void;
}) {
  return (
    <>
      <h2 className="font-display text-foreground" style={{ fontSize: 24, lineHeight: 1.3, marginBottom: 8 }}>
        Where are you with this project?
      </h2>
      <p className="text-muted-foreground" style={{ fontSize: 13, marginBottom: 20 }}>
        This helps your mentor understand your context and start from the right place.
      </p>

      {/* Fresh start option (top, distinct) */}
      <button
        onClick={() => onSelect("spark_fresh")}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border-[0.5px] border-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors text-left mb-4"
      >
        <Sparkles size={18} className="text-primary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-ui text-[14px] font-medium text-foreground">
            Starting fresh with a new idea
          </div>
          <div className="font-ui text-[12px] text-muted-foreground">
            Skip context — go straight to mentoring
          </div>
        </div>
      </button>

      <div className="flex flex-col gap-2">
        {stages.map(stage => (
          <button
            key={stage.stage_key}
            onClick={() => onSelect(stage.stage_key)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border-[0.5px] border-border bg-background hover:border-primary/50 hover:bg-primary/5 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center text-[18px] flex-shrink-0">
              {stage.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-ui text-[14px] font-medium text-foreground">
                {stage.name}
              </div>
              <div className="font-ui text-[12px] text-muted-foreground line-clamp-1">
                {stage.description}
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="flex justify-center mt-6">
        <button
          onClick={onSkip}
          className="text-[12px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip — start fresh
        </button>
      </div>
    </>
  );
}

function ContextStep({
  selectedStage,
  stages,
  activeTab,
  setActiveTab,
  pastedText,
  setPastedText,
  websiteUrl,
  setWebsiteUrl,
  uploadedFile,
  setUploadedFile,
  onAnalyse,
  onSkip,
  onBack,
  fileInputRef,
  onFileChange,
  onDrop,
  formatBytes,
}: any) {
  const stage = stages.find((s: any) => s.stage_key === selectedStage);

  return (
    <>
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={onBack}
          className="text-[12px] text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back
        </button>
        {stage && (
          <span className="text-[12px] text-muted-foreground ml-auto">
            {stage.emoji} {stage.name}
          </span>
        )}
      </div>

      <h2 className="font-display text-foreground" style={{ fontSize: 22, lineHeight: 1.3, marginBottom: 8 }}>
        Share what you have built so far
      </h2>
      <p className="text-muted-foreground" style={{ fontSize: 13, marginBottom: 20 }}>
        Your mentor will read through everything and get up to speed before your first conversation.
      </p>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-lg bg-muted/40 mb-4">
        {[
          { key: "paste", label: "Paste text", icon: FileText },
          { key: "upload", label: "Upload document", icon: Upload },
          { key: "url", label: "Website URL", icon: Globe },
        ].map(t => {
          const Icon = t.icon;
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[12px] font-ui transition-colors ${
                isActive
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={13} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "paste" && (
        <div>
          <textarea
            value={pastedText}
            onChange={(e: any) => setPastedText(e.target.value)}
            placeholder="Paste anything — a previous AI conversation, your notes, a business plan, a brand brief, research findings..."
            className="w-full rounded-lg border-[0.5px] border-border bg-background p-3 text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/40 resize-y"
            style={{ minHeight: 200, fontSize: 13, lineHeight: 1.6 }}
          />
          <p className="text-muted-foreground mt-2" style={{ fontSize: 11 }}>
            Works great with ChatGPT or Claude exports, Notion pages, Google Docs content.
          </p>
        </div>
      )}

      {activeTab === "upload" && (
        <UploadZone
          uploadedFile={uploadedFile}
          setUploadedFile={setUploadedFile}
          fileInputRef={fileInputRef}
          onFileChange={onFileChange}
          onDrop={onDrop}
          formatBytes={formatBytes}
        />
      )}

      {activeTab === "url" && (
        <div>
          <input
            type="url"
            value={websiteUrl}
            onChange={(e: any) => setWebsiteUrl(e.target.value)}
            placeholder="https://yourproduct.com"
            className="w-full rounded-lg border-[0.5px] border-border bg-background px-3 outline-none focus:ring-1 focus:ring-primary/40"
            style={{ height: 44, fontSize: 14 }}
          />
          <p className="text-muted-foreground mt-2" style={{ fontSize: 11 }}>
            We will read your homepage and about page to understand your product.
          </p>
        </div>
      )}

      {/* Combined sources */}
      <CombinedSources
        activeTab={activeTab}
        pastedText={pastedText}
        setPastedText={setPastedText}
        websiteUrl={websiteUrl}
        setWebsiteUrl={setWebsiteUrl}
        uploadedFile={uploadedFile}
        setUploadedFile={setUploadedFile}
        fileInputRef={fileInputRef}
        onFileChange={onFileChange}
        onDrop={onDrop}
        formatBytes={formatBytes}
      />

      {/* Continue button */}
      <button
        onClick={onAnalyse}
        className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-ui font-medium hover:bg-primary/90 transition-colors mt-6"
        style={{ fontSize: 14 }}
      >
        Analyse and continue →
      </button>

      <div className="flex justify-center mt-4">
        <button
          onClick={onSkip}
          className="text-[12px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip — start fresh
        </button>
      </div>
    </>
  );
}

function UploadZone({
  uploadedFile,
  setUploadedFile,
  fileInputRef,
  onFileChange,
  onDrop,
  formatBytes,
}: any) {
  if (uploadedFile) {
    return (
      <div className="rounded-lg border-[0.5px] border-border bg-background p-3 flex items-center gap-3">
        <FileText size={18} className="text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-ui text-[13px] text-foreground truncate">{uploadedFile.name}</div>
          <div className="font-ui text-[11px] text-muted-foreground">{formatBytes(uploadedFile.size)}</div>
        </div>
        <button
          onClick={() => setUploadedFile(null)}
          className="text-muted-foreground hover:text-foreground transition-colors p-1"
          aria-label="Remove file"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={() => fileInputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className="rounded-lg border border-dashed border-border bg-background hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer text-center"
      style={{ padding: "28px 16px" }}
    >
      <Upload size={20} className="text-muted-foreground mx-auto mb-2" />
      <p className="text-foreground" style={{ fontSize: 13 }}>
        Drop your document here or click to browse
      </p>
      <p className="text-muted-foreground mt-1" style={{ fontSize: 11 }}>
        Supports Markdown, text files, PDFs, and Word documents
      </p>
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.txt,.pdf,.doc,.docx"
        onChange={onFileChange}
        className="hidden"
      />
    </div>
  );
}

function CombinedSources({
  activeTab,
  websiteUrl,
  setWebsiteUrl,
  uploadedFile,
  setUploadedFile,
  fileInputRef,
  onFileChange,
  onDrop,
  formatBytes,
}: any) {
  // On paste tab, show secondary file + URL inputs
  if (activeTab !== "paste") return null;

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <p className="font-ui text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
        Also add (optional):
      </p>

      {/* Compact upload zone */}
      {uploadedFile ? (
        <div className="rounded-lg border-[0.5px] border-border bg-background p-2 flex items-center gap-2 mb-2">
          <FileText size={14} className="text-muted-foreground flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-ui text-[12px] text-foreground truncate">{uploadedFile.name}</div>
            <div className="font-ui text-[10px] text-muted-foreground">{formatBytes(uploadedFile.size)}</div>
          </div>
          <button
            onClick={() => setUploadedFile(null)}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
            aria-label="Remove file"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          className="rounded-lg border border-dashed border-border bg-background hover:border-primary/40 transition-colors cursor-pointer text-center mb-2"
          style={{ padding: "10px 12px" }}
        >
          <p className="text-muted-foreground" style={{ fontSize: 11 }}>
            <Upload size={12} className="inline mr-1" />
            Attach a document
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.txt,.pdf,.doc,.docx"
            onChange={onFileChange}
            className="hidden"
          />
        </div>
      )}

      <input
        type="url"
        value={websiteUrl}
        onChange={(e: any) => setWebsiteUrl(e.target.value)}
        placeholder="https://yourproduct.com (optional)"
        className="w-full rounded-lg border-[0.5px] border-border bg-background px-3 outline-none focus:ring-1 focus:ring-primary/40"
        style={{ height: 36, fontSize: 12 }}
      />
    </div>
  );
}

function ProcessingStep({ currentStep }: { currentStep: number }) {
  return (
    <div style={{ textAlign: "center", padding: "32px 0" }}>
      <h2 className="font-display text-foreground mb-6" style={{ fontSize: 20 }}>
        Reading your context
      </h2>
      <div style={{ marginBottom: 20, display: "inline-block", textAlign: "left" }}>
        {PROCESSING_MESSAGES.map((msg, i) => (
          <div
            key={i}
            style={{
              fontSize: 13,
              color: i === currentStep ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
              fontWeight: i === currentStep ? 500 : 400,
              marginBottom: 8,
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "all 300ms",
            }}
          >
            <span
              style={{
                color:
                  i < currentStep
                    ? "#4CAF50"
                    : i === currentStep
                    ? "#D4A017"
                    : "transparent",
                width: 16,
                display: "inline-block",
              }}
            >
              {i < currentStep ? "✓" : i === currentStep ? "●" : "○"}
            </span>
            {msg}
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultsStep({
  extracted,
  stages,
  getFieldLabel,
  onConfirm,
  onEdit,
  onSkip,
  saving,
}: {
  extracted: ExtractedProjectData;
  stages: any[];
  getFieldLabel: (stageKey: string, fieldKey: string) => string;
  onConfirm: () => void;
  onEdit: () => void;
  onSkip: () => void;
  saving: boolean;
}) {
  const fieldsCount = Object.values(extracted.fields).reduce(
    (sum, fields) => sum + Object.keys(fields).length,
    0
  );
  const stagesFound = Object.keys(extracted.fields).length;

  return (
    <>
      <div
        className="flex items-center gap-2 mb-4 p-3 rounded-lg"
        style={{ background: "rgba(76, 175, 80, 0.08)", border: "0.5px solid rgba(76, 175, 80, 0.3)" }}
      >
        <span style={{ color: "#4CAF50", fontSize: 16 }}>✓</span>
        <span className="font-ui text-foreground" style={{ fontSize: 13 }}>
          Found {fieldsCount} data point{fieldsCount === 1 ? "" : "s"} across {stagesFound} stage{stagesFound === 1 ? "" : "s"}
        </span>
      </div>

      {extracted.summary && (
        <p className="text-muted-foreground mb-4" style={{ fontSize: 12, lineHeight: 1.6 }}>
          {extracted.summary}
        </p>
      )}

      <div style={{ maxHeight: 320, overflowY: "auto", marginBottom: 16 }}>
        {Object.entries(extracted.fields).map(([stageKey, fields]) => {
          const stageInfo = stages.find(s => s.stage_key === stageKey);
          return (
            <div key={stageKey} style={{ marginBottom: 12 }}>
              <div
                className="font-ui font-medium text-foreground mb-1.5 flex items-center gap-1.5"
                style={{ fontSize: 12 }}
              >
                <span>{stageInfo?.emoji ?? "•"}</span>
                <span>{stageInfo?.name ?? stageKey}</span>
              </div>
              {Object.entries(fields).map(([fieldKey, value]) => (
                <DataPointCard
                  key={fieldKey}
                  label={getFieldLabel(stageKey, fieldKey)}
                  value={value as string}
                />
              ))}
            </div>
          );
        })}
      </div>

      {extracted.suggestedName && (
        <div
          className="rounded-lg p-3 mb-4 border-[0.5px] border-primary/30"
          style={{ background: "rgba(212, 160, 23, 0.06)", fontSize: 13 }}
        >
          <span className="text-muted-foreground">Suggested project name: </span>
          <strong className="text-foreground">{extracted.suggestedName}</strong>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          disabled={saving}
          className="flex-1 h-11 rounded-lg bg-primary text-primary-foreground font-ui font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
          style={{ fontSize: 14 }}
        >
          {saving ? "Saving..." : "Looks good — start mentoring →"}
        </button>
        <button
          onClick={onEdit}
          disabled={saving}
          className="px-4 h-11 rounded-lg border-[0.5px] border-border bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors disabled:opacity-60"
          style={{ fontSize: 13 }}
        >
          Edit before saving
        </button>
      </div>

      <div className="flex justify-center mt-4">
        <button
          onClick={onSkip}
          disabled={saving}
          className="text-[12px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-60"
        >
          Skip — start fresh
        </button>
      </div>
    </>
  );
}

function DataPointCard({ label, value }: { label: string; value: string }) {
  const TRUNCATE_AT = 80;
  const isLong = value.length > TRUNCATE_AT;
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-md bg-muted/30 px-2.5 py-1.5 mb-1"
      style={{ fontSize: 12, lineHeight: 1.5, wordBreak: "break-word", whiteSpace: "normal" }}
    >
      <span className="text-muted-foreground">{label}: </span>
      <span className="text-foreground">
        {isLong && !expanded ? `${value.slice(0, TRUNCATE_AT)}… ` : `${value} `}
      </span>
      {isLong && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-primary hover:underline font-ui"
          style={{ fontSize: 11 }}
        >
          {expanded ? "See less" : "See more"}
        </button>
      )}
    </div>
  );
}
