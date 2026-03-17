import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CATEGORIES = [
  "Brand Discovery",
  "Campaign Strategy",
  "Customer Insight",
  "Product Positioning",
  "Growth Brainstorm",
  "Pitch Preparation",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recentMessages, existingMilestones } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const existingNames = (existingMilestones || []).map((m: { name: string }) => m.name).join(", ");

    const systemPrompt = `You are analyzing a mentor-founder conversation to detect if the topic has meaningfully shifted to a new area. You must be selective — only flag a milestone when the conversation has clearly moved to a distinct new topic that deserves its own section marker.

Existing milestones already recorded: ${existingNames || "None"}

Do NOT create a milestone if:
- The conversation is continuing on the same topic as the last few messages
- The shift is minor (e.g. a follow-up question on the same theme)
- A milestone with a very similar name already exists

DO create a milestone if:
- The founder or mentor has clearly pivoted to a new strategic area (e.g. from brand identity to audience targeting, or from positioning to campaign strategy)
- There is a natural break point that would help someone scanning the conversation later

Categories to choose from: ${CATEGORIES.join(", ")}`;

    const conversationText = recentMessages
      .map((m: { role: string; content: string }) => `${m.role === "founder" ? "Founder" : "Mentor"}: ${m.content}`)
      .join("\n\n");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Here is the recent conversation:\n\n${conversationText}\n\nHas the conversation shifted to a new topic that deserves a milestone marker?` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_milestone",
              description: "Create a milestone marker if the conversation has shifted to a clearly new topic. Only call this if a genuine topic shift has occurred.",
              parameters: {
                type: "object",
                properties: {
                  should_create: {
                    type: "boolean",
                    description: "Whether a milestone should be created. Set false if no clear topic shift.",
                  },
                  category: {
                    type: "string",
                    enum: CATEGORIES,
                    description: "The category of the new topic.",
                  },
                  name: {
                    type: "string",
                    description: "A short descriptive name for the milestone, 3-6 words. e.g. 'Target audience definition' or 'Launch channel strategy'",
                  },
                },
                required: ["should_create"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_milestone" } },
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("Milestone detection error:", response.status, t);
      return new Response(JSON.stringify({ milestone: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      return new Response(JSON.stringify({ milestone: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      const args = JSON.parse(toolCall.function.arguments);
      if (args.should_create && args.category && args.name) {
        return new Response(
          JSON.stringify({ milestone: { category: args.category, name: args.name } }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } catch {
      console.error("Failed to parse tool call arguments");
    }

    return new Response(JSON.stringify({ milestone: null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("detect-milestone error:", e);
    return new Response(JSON.stringify({ milestone: null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
