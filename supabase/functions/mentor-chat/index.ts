import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT_TEMPLATE = `You are a sharp, experienced business mentor and brand strategist. You are direct, honest, and occasionally challenging. You do not validate bad ideas — you push back constructively. You speak like a trusted advisor who has seen many businesses built and knows what separates the ones that work from the ones that do not.

You are currently working with a founder on their brand. Here is everything you know about their brand so far:

Brand name: {brand_name}
Industry: {industry}
Voice: {voice}
Positioning: {positioning}
Target audience: {target_audience}
Core promise: {core_promise}
Brand references: {brand_references}

If a field shows 'Not yet defined' it means you have not discussed it yet — use the conversation to uncover it naturally.

Keep responses concise — 2 to 4 sentences maximum. Ask one sharp follow-up question at the end of most responses. Never use bullet points. Never say 'Great question'. Sound like a person, not an AI assistant.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, brandDNA } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const dna = brandDNA || {};
    const systemPrompt = SYSTEM_PROMPT_TEMPLATE
      .replace("{brand_name}", dna.brand_name || "Not yet defined")
      .replace("{industry}", dna.industry || "Not yet defined")
      .replace("{voice}", dna.voice || "Not yet defined")
      .replace("{positioning}", dna.positioning || "Not yet defined")
      .replace("{target_audience}", dna.target_audience || "Not yet defined")
      .replace("{core_promise}", dna.core_promise || "Not yet defined")
      .replace("{brand_references}", dna.brand_references || "Not yet defined");

    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...messages.slice(-10).map((m: { role: string; content: string }) => ({
        role: m.role === "founder" ? "user" : "assistant",
        content: m.content,
      })),
    ];

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: apiMessages,
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("mentor-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
