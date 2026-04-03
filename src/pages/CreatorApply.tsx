import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Grid3X3, Star, BarChart3, Info, Check, Loader2, Sparkles } from "lucide-react";
import { useCreatorApplication } from "@/hooks/use-creator-application";
import { cn } from "@/lib/utils";

const experienceOptions = [
  "Just getting started",
  "Some experience (under 1 year)",
  "Experienced (1-3 years)",
  "Very experienced (3+ years)",
  "Professional prompt engineer",
];

const benefits = [
  { icon: Grid3X3, title: "Publish templates", desc: "Create physical and digital product templates for the marketplace" },
  { icon: Star, title: "Build reputation", desc: "Get credit for every template you publish with your name and profile" },
  { icon: BarChart3, title: "Grow your reach", desc: "Thousands of founders browse ProStudio templates every month" },
];

export default function CreatorApply() {
  const navigate = useNavigate();
  const { application, submitApplication } = useCreatorApplication();
  const [motivation, setMotivation] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [experience, setExperience] = useState("");
  const [samplePrompt, setSamplePrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Already applied
  if (application || submitted) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-5">
            <Check size={32} className="text-primary" />
          </div>
          <h2 className="font-display text-2xl text-foreground mb-2">Application submitted</h2>
          <p className="text-sm font-ui text-muted-foreground mb-6">
            We will review your application and get back to you within 3 to 5 days.
          </p>
          <button
            onClick={() => navigate("/pro-studio")}
            className="text-sm font-ui text-primary hover:underline"
          >
            ← Back to ProStudio
          </button>
        </div>
      </div>
    );
  }

  const canSubmit = motivation.trim() && experience && samplePrompt.trim();

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      await submitApplication({
        motivation: motivation.trim(),
        portfolio_url: portfolioUrl.trim() || "",
        experience,
        sample_prompt: samplePrompt.trim(),
      });
      setSubmitted(true);
    } catch (e) {
      console.error("Failed to submit:", e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-8">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm font-ui text-primary hover:underline mb-8"
      >
        <ArrowLeft size={16} /> Back
      </button>

      {/* Heading */}
      <div className="flex items-center gap-3 mb-2">
        <Sparkles size={24} className="text-primary" />
        <h1 className="font-display text-[28px] text-foreground">Become a ProStudio Creator</h1>
      </div>
      <p className="text-sm font-ui text-muted-foreground mb-8 max-w-xl">
        Share your prompt engineering skills with founders worldwide. Publish templates, build your reputation, and grow your reach.
      </p>

      {/* Benefits */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
        {benefits.map((b) => (
          <div
            key={b.title}
            className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <b.icon size={20} className="text-primary" />
            </div>
            <h3 className="text-sm font-ui font-medium text-foreground">{b.title}</h3>
            <p className="text-xs font-ui text-muted-foreground leading-relaxed">{b.desc}</p>
          </div>
        ))}
      </div>

      {/* Form */}
      <div className="rounded-xl border border-border bg-card p-7 space-y-5">
        {/* Motivation */}
        <div>
          <label className="block text-[13px] font-ui font-medium text-foreground mb-1.5">
            Why do you want to create templates?
          </label>
          <textarea
            rows={4}
            value={motivation}
            onChange={(e) => setMotivation(e.target.value)}
            placeholder="Tell us about your background with prompt engineering and what kinds of templates you want to build..."
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-ui text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          />
        </div>

        {/* Portfolio */}
        <div>
          <label className="block text-[13px] font-ui font-medium text-foreground mb-1.5">
            Portfolio or work samples URL
          </label>
          <input
            type="url"
            value={portfolioUrl}
            onChange={(e) => setPortfolioUrl(e.target.value)}
            placeholder="https://your-portfolio.com (optional)"
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-ui text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Experience */}
        <div>
          <label className="block text-[13px] font-ui font-medium text-foreground mb-1.5">
            Prompt engineering experience
          </label>
          <select
            value={experience}
            onChange={(e) => setExperience(e.target.value)}
            className={cn(
              "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-ui focus:outline-none focus:ring-2 focus:ring-primary/30",
              experience ? "text-foreground" : "text-muted-foreground"
            )}
          >
            <option value="" disabled>Select your experience level</option>
            {experienceOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        {/* Sample prompt */}
        <div>
          <label className="block text-[13px] font-ui font-medium text-foreground mb-1.5">
            Share a sample template prompt
          </label>
          <textarea
            rows={5}
            value={samplePrompt}
            onChange={(e) => setSamplePrompt(e.target.value)}
            placeholder="Write a prompt you would use to generate a premium product marketing visual. Show us how you think about template design..."
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-ui text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          />
        </div>
      </div>

      {/* Info note */}
      <div className="mt-4 rounded-lg bg-muted/30 border border-border p-3 px-4 flex items-start gap-2.5">
        <Info size={14} className="text-muted-foreground mt-0.5 flex-shrink-0" />
        <p className="text-xs font-ui text-muted-foreground leading-relaxed">
          Applications are reviewed within 3 to 5 business days. You will receive an email when your application is reviewed.
        </p>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit || submitting}
        className={cn(
          "w-full h-12 rounded-lg text-sm font-ui font-medium mt-5 transition-all duration-200 flex items-center justify-center gap-2",
          canSubmit && !submitting
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "bg-muted text-muted-foreground cursor-not-allowed"
        )}
      >
        {submitting ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Submitting...
          </>
        ) : (
          "Submit application"
        )}
      </button>
    </div>
  );
}
