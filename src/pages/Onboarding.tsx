import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/use-profile";

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
    question: "Are you currently working on a project?",
    subtext: "This helps your mentor know where to start.",
    options: [
      { emoji: "⚡", label: "Yes, I have something in progress", desc: "A project or brand I'm actively building", value: "in_progress" },
      { emoji: "💡", label: "I have an idea I want to explore", desc: "Something I'm thinking about but haven't started", value: "have_idea" },
      { emoji: "🔭", label: "Not yet, just exploring", desc: "Curious about what this can do for me", value: "exploring" },
      { emoji: "🗂", label: "I manage multiple projects", desc: "Agency, portfolio, or client work", value: "multiple_projects" },
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
  if ((profession === "founder") && (brandStatus === "have_idea" || brandStatus === "exploring")) return "Your mentor is ready to help you build from scratch.";
  if ((profession === "founder") && brandStatus === "in_progress") return "Your mentor is ready to help you scale what you have built.";
  if (profession === "freelancer") return "Your mentor is ready to help you build a brand that wins clients.";
  return "Your mentor is ready. Let us build something worth building.";
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, refetch } = useProfile();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>(["", "", ""]);
  const [completed, setCompleted] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (profile?.onboarding_completed) {
      navigate("/home", { replace: true });
    }
  }, [profile?.onboarding_completed, navigate]);

  if (profile?.onboarding_completed) return null;

  const finishFlow = async (finalAnswers: string[]) => {
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({
        profession: finalAnswers[0],
        brand_status: finalAnswers[1],
        team_size: finalAnswers[2],
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      console.error("Failed to save onboarding:", error);
      return;
    }

    await refetch();
    setCompleted(true);
    setTimeout(() => {
      const bs = finalAnswers[1];
      if (bs === "have_idea" || bs === "exploring") {
        navigate("/mentor?mode=idea", { replace: true });
      } else {
        navigate("/mentor?mode=brand", { replace: true });
      }
    }, 1500);
  };

  const selectOption = (value: string) => {
    if (animating) return;
    const next = [...answers];
    next[currentStep] = value;
    setAnswers(next);
    setTimeout(() => {
      if (currentStep < 2) {
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
    navigate("/home");
  };

  const step = steps[currentStep];
  const progressPct = ((currentStep + 1) / 3) * 100;

  return (
    <div
      className="fixed inset-0 flex flex-col items-center"
      style={{
        background: "radial-gradient(ellipse at top, #1A2A3A 0%, #0D1B2A 60%)",
        overflowY: "auto",
        overflowX: "hidden",
        touchAction: "pan-y",
        overscrollBehavior: "none",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {/* Floating amber particles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute rounded-full" style={{ width: 12, height: 12, background: "#D4A017", opacity: 0.15, top: "12%", left: "8%" }} />
        <div className="absolute rounded-full" style={{ width: 8, height: 8, background: "#D4A017", opacity: 0.15, top: "22%", right: "12%" }} />
        <div className="absolute rounded-full" style={{ width: 6, height: 6, background: "#D4A017", opacity: 0.15, bottom: "18%", left: "18%" }} />
        <div className="absolute rounded-full" style={{ width: 10, height: 10, background: "#D4A017", opacity: 0.15, bottom: "10%", right: "10%" }} />
      </div>

      {/* Top bar: dots + progress line */}
      <div className="relative z-10 w-full flex flex-col items-center pt-8 pb-2">
        <div className="flex items-center gap-2">
          {[0, 1, 2].map((i) => {
            const active = i === currentStep;
            return (
              <div
                key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  width: active ? 10 : 8,
                  height: active ? 10 : 8,
                  background: active ? "#D4A017" : "#2A3A4A",
                }}
              />
            );
          })}
        </div>
        <div className="mt-3 rounded-full overflow-hidden" style={{ width: 60, height: 2, background: "#1A2A3A" }}>
          <div
            className="h-full transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%`, background: "#D4A017" }}
          />
        </div>
      </div>

      {/* Skip */}
      <button
        onClick={handleSkip}
        className="absolute top-7 right-5 text-[12px] font-ui text-muted-foreground hover:text-foreground transition-colors z-20"
      >
        Skip for now
      </button>

      {/* Content */}
      <div
        className={`relative z-10 w-full flex-1 flex flex-col px-6 pt-8 pb-10 transition-opacity duration-250 ${
          animating ? "opacity-0" : "opacity-100"
        }`}
        style={{ maxWidth: 420, boxSizing: "border-box" }}
      >
        {completed ? (
          <div className="flex flex-col items-center text-center gap-3 mt-8 animate-in fade-in duration-300">
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "#D4A017" }}>
              <Check size={32} className="text-[#0D1B2A]" />
            </div>
            <h2 className="font-display text-[26px] text-white mt-2">You are all set</h2>
            <p className="font-ui text-[14px] text-[#8A96A3] max-w-[360px]">
              {getCompletionMessage(answers[0], answers[1])}
            </p>
          </div>
        ) : (
          <>
            {currentStep > 0 && (
              <button
                onClick={handleBack}
                className="inline-flex items-center gap-1 text-[12px] font-ui text-[#8A96A3] hover:text-white transition-colors mb-3 self-start"
              >
                <ChevronLeft size={14} />
                Back
              </button>
            )}

            <h2 className="font-display text-white" style={{ fontSize: 36, lineHeight: 1.2 }}>
              {step.question}
            </h2>
            {step.subtext && (
              <p className="font-ui mt-2" style={{ fontSize: 15, color: "#8A96A3" }}>
                {step.subtext}
              </p>
            )}

            {/* Options - scroll container with bottom fade */}
            <div className="relative mt-7 flex-1">
              <div
                className="flex flex-col gap-2.5"
                style={{
                  maxHeight: "55vh",
                  overflowY: "auto",
                  paddingBottom: 16,
                  WebkitOverflowScrolling: "touch",
                }}
              >
                {step.options.map((opt) => {
                  const selected = answers[currentStep] === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => selectOption(opt.value)}
                      className="w-full flex items-center text-left transition-all duration-150"
                      style={{
                        minHeight: 64,
                        padding: "0 16px",
                        gap: 14,
                        borderRadius: 16,
                        background: selected ? "rgba(212,160,23,0.08)" : "rgba(255,255,255,0.05)",
                        border: selected ? "1.5px solid #D4A017" : "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <span style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>{opt.emoji}</span>
                      <div className="flex-1 min-w-0 py-3">
                        <p
                          className="font-ui font-semibold"
                          style={{ fontSize: 15, color: selected ? "#D4A017" : "#FFFFFF" }}
                        >
                          {opt.label}
                        </p>
                        {opt.desc && (
                          <p className="font-ui mt-0.5" style={{ fontSize: 13, color: "#8A96A3" }}>
                            {opt.desc}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              {/* Bottom fade hint */}
              <div
                className="pointer-events-none absolute left-0 right-0 bottom-0"
                style={{
                  height: 32,
                  background: "linear-gradient(to bottom, rgba(13,27,42,0) 0%, #0D1B2A 100%)",
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
