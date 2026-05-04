import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type Step = {
  question: string;
  subtext?: string;
  options: { emoji: string; label: string; desc?: string; value: string }[];
};

const steps: Step[] = [
  {
    question: "What best describes you?",
    subtext: "This helps your mentor speak your language.",
    options: [
      { emoji: "🚀", label: "Founder or co-founder", desc: "Building a startup or new venture", value: "founder" },
      { emoji: "🏪", label: "Small business owner", desc: "Running an established business", value: "small_business" },
      { emoji: "💼", label: "Freelancer or consultant", desc: "Working independently with clients", value: "freelancer" },
      { emoji: "🎨", label: "Creative professional", desc: "Designer, photographer, writer, or similar", value: "creative" },
      { emoji: "✦", label: "Something else", desc: "I will tell my mentor", value: "other" },
    ],
  },
  {
    question: "Where are you with your brand?",
    subtext: "Your mentor will start from the right place.",
    options: [
      { emoji: "💡", label: "Just an idea right now", desc: "Still in the thinking and planning phase", value: "just_an_idea" },
      { emoji: "🌱", label: "Early stage brand", desc: "Launched but still finding my footing", value: "early_stage" },
      { emoji: "📈", label: "Established brand", desc: "Up and running, looking to grow", value: "established" },
      { emoji: "🗂", label: "I manage multiple brands", desc: "Agency or portfolio work", value: "multiple_brands" },
    ],
  },
  {
    question: "Are you building alone or with a team?",
    options: [
      { emoji: "🧍", label: "Solo — just me", value: "solo" },
      { emoji: "👥", label: "Small team — 2 to 5 people", value: "small_team" },
      { emoji: "🏢", label: "Growing team — 6 or more", value: "growing_team" },
      { emoji: "🤝", label: "I work with clients", desc: "Freelancer or agency", value: "with_clients" },
    ],
  },
];

function getCompletionMessage(profession: string, brandStatus: string): string {
  if ((profession === "founder") && brandStatus === "just_an_idea") return "Your mentor is ready to help you build from scratch.";
  if ((profession === "founder") && brandStatus === "established") return "Your mentor is ready to help you scale what you have built.";
  if (profession === "freelancer") return "Your mentor is ready to help you build a brand that wins clients.";
  return "Your mentor is ready. Let us build something worth building.";
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>(["", "", ""]);
  const [completed, setCompleted] = useState(false);
  const [slideDir, setSlideDir] = useState<"right" | "left">("right");
  const [animating, setAnimating] = useState(false);

  const finishFlow = async (finalAnswers: string[]) => {
    if (user) {
      await supabase
        .from("profiles")
        .update({
          profession: finalAnswers[0],
          brand_status: finalAnswers[1],
          team_size: finalAnswers[2],
          onboarding_completed: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);
    }
    setCompleted(true);
    setTimeout(() => {
      const bs = finalAnswers[1];
      if (bs === "just_an_idea" || bs === "early_stage") {
        navigate("/mentor?mode=idea");
      } else {
        navigate("/mentor?mode=brand");
      }
    }, 1500);
  };

  const selectOption = (value: string) => {
    if (animating) return;
    const next = [...answers];
    next[currentStep] = value;
    setAnswers(next);

    // Brief delay so user sees selection register, then advance
    setTimeout(() => {
      if (currentStep < 2) {
        setSlideDir("right");
        setAnimating(true);
        setTimeout(() => {
          setCurrentStep((s) => s + 1);
          setAnimating(false);
        }, 250);
      } else {
        finishFlow(next);
      }
    }, 150);
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setSlideDir("left");
      setAnimating(true);
      setTimeout(() => {
        setCurrentStep(currentStep - 1);
        setAnimating(false);
      }, 250);
    }
  };

  const handleSkip = async () => {
    if (user) {
      await supabase
        .from("profiles")
        .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
        .eq("id", user.id);
    }
    navigate("/");
  };

  const step = steps[currentStep];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      {/* Progress dots */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 flex gap-2 z-50">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`w-[10px] h-[10px] rounded-full transition-all duration-200 ${
              i <= currentStep
                ? "bg-primary"
                : "border-[1.5px] border-[#2A3A4A] bg-transparent"
            }`}
          />
        ))}
      </div>

      {/* Skip */}
      <button
        onClick={handleSkip}
        className="fixed top-6 right-6 text-[12px] font-ui text-muted-foreground hover:text-foreground transition-colors z-50"
      >
        Skip for now
      </button>


      {/* Card */}
      <div
        className={`w-[90%] max-w-[520px] rounded-2xl border-[0.5px] border-[#2A3A4A] dark:bg-[#1A2A3A] bg-white p-12 transition-all duration-250 ${
          animating
            ? slideDir === "right"
              ? "opacity-0 translate-x-8"
              : "opacity-0 -translate-x-8"
            : "opacity-100 translate-x-0"
        }`}
      >
        {completed ? (
          <div className="flex flex-col items-center text-center gap-3 animate-in fade-in duration-300">
            <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
              <Check size={32} className="text-primary-foreground" />
            </div>
            <h2 className="font-display text-[24px] text-foreground mt-2">You are all set</h2>
            <p className="font-ui text-[14px] text-muted-foreground max-w-[400px]">
              {getCompletionMessage(answers[0], answers[1])}
            </p>
            <p className="font-ui text-[12px] text-muted-foreground mt-1">
              You can update these preferences anytime in your profile settings.
            </p>
          </div>
        ) : (
          <>
            <p className="text-[11px] font-ui uppercase tracking-[0.08em] text-muted-foreground mb-4">
              Step {currentStep + 1} of 3
            </p>
            <h2 className="font-display text-[26px] leading-[1.3] text-foreground mb-2">
              {step.question}
            </h2>
            {step.subtext && (
              <p className="font-ui text-[14px] text-muted-foreground mb-8">
                {step.subtext}
              </p>
            )}
            {!step.subtext && <div className="mb-8" />}

            <div className="flex flex-col gap-2.5">
              {step.options.map((opt) => {
                const selected = answers[currentStep] === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => selectOption(opt.value)}
                    className={`w-full flex items-center gap-3.5 px-5 py-4 rounded-[10px] border transition-all duration-150 text-left ${
                      selected
                        ? "border-2 border-primary bg-primary/10"
                        : "border-[0.5px] border-[#2A3A4A] dark:bg-[#0D1B2A] bg-[#F9F6F1] hover:border-primary/50"
                    }`}
                  >
                    <div className="w-9 h-9 rounded-lg dark:bg-[#1A2A3A] bg-[#F0EDE8] flex items-center justify-center text-[18px] flex-shrink-0">
                      {opt.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-ui text-[14px] font-medium text-foreground">{opt.label}</p>
                      {opt.desc && (
                        <p className="font-ui text-[12px] text-muted-foreground mt-0.5">{opt.desc}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleContinue}
              disabled={!answers[currentStep]}
              className="w-full h-12 rounded-lg bg-primary text-primary-foreground font-ui text-[14px] font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed mt-6 transition-colors"
            >
              Continue →
            </button>
          </>
        )}
      </div>
    </div>
  );
}
