/**
 * Context pack — the brand brief every agent step is given.
 *
 * Compiled from brands, brand_dna, brand_stage_data and the summaries of
 * recent agent runs (the memory write-back). The text is byte-stable for a
 * given state so the gateway's prompt cache hits across steps in a run; the
 * hash is stored on the run so the founder can see what the agent knew.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface ContextPack {
  text: string;
  hash: string;
  brandName: string;
  journeyStage: string | null;
}

export async function buildContextPack(admin: SupabaseClient, brandId: string): Promise<ContextPack> {
  const [{ data: brand }, { data: dna }, { data: stageData }, { data: runs }] = await Promise.all([
    admin.from("brands").select("id, name, tagline, industry, product_type, location, journey_stage, primary_color, secondary_color").eq("id", brandId).maybeSingle(),
    admin.from("brand_dna").select("brand_voice, tone_descriptors, brand_feel, core_promise, positioning_statement, product_positioning, target_audience, customer_profile, customer_insight, pain_points, why_choose_us, campaign_strategy").eq("brand_id", brandId).maybeSingle(),
    admin.from("brand_stage_data").select("stage_key, field_key, value").eq("brand_id", brandId).order("stage_key").order("field_key"),
    admin.from("automation_runs").select("name, output, finished_at").eq("brand_id", brandId).eq("status", "completed").order("finished_at", { ascending: false }).limit(5),
  ]);

  const grouped: Record<string, Record<string, string>> = {};
  for (const row of stageData ?? []) {
    if (!row.value) continue;
    (grouped[row.stage_key] ??= {})[row.field_key] = String(row.value).slice(0, 600);
  }

  const memory = (runs ?? [])
    .map((r: any) => {
      const s = r.output?.summary;
      return typeof s === "string" && s.trim() ? `- ${r.name}: ${s.trim()}` : null;
    })
    .filter(Boolean)
    .join("\n");

  const line = (label: string, v: unknown) => {
    if (v == null) return null;
    const s = Array.isArray(v) ? v.filter(Boolean).join(", ") : String(v).trim();
    return s ? `${label}: ${s}` : null;
  };

  const sections: string[] = [];
  sections.push("# BRAND");
  sections.push(
    [
      line("Name", brand?.name),
      line("Tagline", brand?.tagline),
      line("Industry", brand?.industry),
      line("Product type", brand?.product_type),
      line("Location", brand?.location),
      line("Journey stage", brand?.journey_stage),
      line("Primary color", brand?.primary_color),
      line("Secondary color", brand?.secondary_color),
    ].filter(Boolean).join("\n"),
  );

  sections.push("# BRAND DNA");
  sections.push(
    [
      line("Voice", dna?.brand_voice),
      line("Tone", dna?.tone_descriptors),
      line("Feel", dna?.brand_feel),
      line("Core promise", dna?.core_promise),
      line("Positioning", dna?.positioning_statement),
      line("Product positioning", dna?.product_positioning),
      line("Target audience", dna?.target_audience),
      line("Customer profile", dna?.customer_profile),
      line("Customer insight", dna?.customer_insight),
      line("Pain points", dna?.pain_points),
      line("Why choose us", dna?.why_choose_us),
      line("Campaign strategy", dna?.campaign_strategy),
    ].filter(Boolean).join("\n") || "(not yet defined)",
  );

  if (Object.keys(grouped).length) {
    sections.push("# FOUNDER MEMORY (by journey stage)");
    sections.push(JSON.stringify(grouped, null, 1));
  }

  if (memory) {
    sections.push("# RECENT AGENT WORK");
    sections.push(memory);
  }

  sections.push("# RULES");
  sections.push("Stay inside this brand's voice and facts. Do not invent products, prices, dates or claims that are not in the context. When unsure, keep it general and note the assumption.");

  const text = sections.join("\n\n");
  const hash = await sha256(text);
  return { text, hash, brandName: brand?.name ?? "Brand", journeyStage: brand?.journey_stage ?? null };
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}
