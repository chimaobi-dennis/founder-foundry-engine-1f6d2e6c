-- Second sweep: the studio prompts and request lines that were still in code.
insert into ai_system_prompts (task_type, name, description, system_prompt, is_active, version)
select v.task_type, v.name, v.description, v.system_prompt, true, 1
from (values
('campaign_copy_request', 'CampaignKit: request line', 'The user turn that asks for all platforms at once.', 'Generate the campaign creatives now based on the brief in the system prompt. Return only the JSON object.'),
('campaign_copy_platform_request', 'CampaignKit: one platform request line', 'The user turn for one platform.', 'Generate the {{platform}} creative now. Return only the JSON object.'),
('logo_generation', 'LogoStudio: generate', 'A logo concept as a scene.', 'You are an AI logo designer.
Use the brand context, creative brief, and visual style guidance to generate a single valid SceneDocument.
Return only valid JSON in the following form:
{
  "render_engine": "scene",
  "scene_version": "v1",
  "scene_json": { ... }
}
The scene_json must be a valid SceneDocument with width 800, height 800, a background color, and nodes suitable for a logo concept.
Do not include markdown, explanations, or extra text.'),
('logo_mutation', 'LogoStudio: mutate', 'A change to an existing logo scene.', 'You are an AI logo designer.
Use the current logo scene and the requested mutation instructions to produce an updated logo scene.
If possible, return a JSON object with a scene_json field containing a valid SceneDocument.
If you cannot return a full scene, return only a JSON object with a mutations array.
The mutations array should contain objects with id and params.
Do not include markdown, explanations, or extra text.'),
('logo_generation_request', 'LogoStudio: request line', 'The user turn per variant.', 'Generate a single square logo scene for variant {{index}}. Return only the JSON response described in the system prompt.'),
('logo_mutation_request', 'LogoStudio: mutation request line', 'The user turn carrying the requested change.', 'Mutate the current logo scene according to the requested change: {{change}}'),
('scene_json_contract', 'Scene JSON output contract', 'How a design must be returned as a SceneDocument.', '=== SCENE JSON OUTPUT MODE ===
Return a valid JSON SceneDocument object instead of HTML.
The SceneDocument must have this exact structure:
{
  "version": "v1",
  "width": {{width}},
  "height": {{height}},
  "background": "#ffffff",
  "nodes": [
    // Array of SceneNode objects
  ]
}

Each node must have: id, type, x, y, width, height, rotation, opacity, zIndex.
Allowed node types: text, image, shape, button, stack, group.

Text nodes need: text, fontSize, fontFamily, fontWeight, lineHeight, letterSpacing, color, align.
Shape nodes need: fill, stroke, strokeWidth, radius.
Image nodes need: src, objectFit, borderRadius.
Button nodes need: label, fontFamily, fontWeight, fontSize, color, background, borderRadius.

CRITICAL RULES:
- Return ONLY the JSON object. No explanation, no markdown, no code fences.
- Start your response with { and end with }.
- All positions must be within canvas bounds.
- Canvas size: {{width}}×{{height}}px.
- Maximum {{max_nodes}} nodes.
- Maximum group nesting depth: {{max_depth}}.
- Typography must be readable (minimum 10px font size).
- Content must visually fill the canvas.
- Do NOT use svg, icon, or frame node types.'),
('template_scene_contract', 'ContentStudio: copy + scene output contract', 'The mandatory JSON structure for copy and scenes per platform.', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MANDATORY JSON FORMAT - SCENE MODE STRUCTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return ONLY a valid JSON object. No explanation, no markdown, no code fences.

EXACT STRUCTURE REQUIRED (copy this template and fill in values):

{{template}}


CRITICAL RULES:
1. Each platform MUST have: render_engine, scene_version, copy{}, scene{}
2. copy{} MUST contain: headline, caption (not copy_text), hashtags[], cta
3. DO NOT use legacy keys like "headline" or "copy_text" at the top level
4. ALL copy fields must be inside the nested "copy" object
5. Write ORIGINAL marketing copy - DO NOT repeat the user''s brief text
6. caption should be 2-3 compelling sentences, not the full brief

Start your response with { and end with }'),
('brand_continuity_rules', 'Brand continuity rules', 'Appended to studio generations: continue the brand system, avoid repetition.', 'You are not generating isolated outputs.
You are continuing an evolving brand system.

Avoid repeating:
- identical layouts
- repeated visual structures
- repeated messaging
- repeated typography compositions

Maintain:
- brand continuity
- strategic consistency
- emotional consistency
- visual coherence

Generate the NEXT evolution of the brand.'),
('project_title_request', 'Project title: request line', 'The user turn with the first exchange.', 'Founder''s first message: "{{first}}"

Mentor''s response: "{{reply}}"

Generate a 3-word project title:'),
('lovable_prompt_request', 'Lovable prompt: request line', 'The user turn with the conversation context.', 'Brand: {{brand}}. Context from our conversation: {{context}}. Generate a Lovable prompt to build what we discussed.'),
('template_content_rule', 'ProStudio: use the given content', 'Tells the designer to use the founder''s exact content.', '

CONTENT TO USE IN THIS DESIGN:
{{content}}

Use this exact content in the design — do not invent placeholder text.')
) as v(task_type, name, description, system_prompt)
on conflict (task_type) do update
  set name = excluded.name, description = excluded.description,
      system_prompt = coalesce(nullif(ai_system_prompts.system_prompt, ''), excluded.system_prompt),
      is_active = true;
