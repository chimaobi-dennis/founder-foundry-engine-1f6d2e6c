// Parses SAVE_PROMPT: blocks emitted by the mentor AI at the end of a message.
//
// Expected format (one or more, anywhere after the main body, usually last):
//   SAVE_PROMPT: {"field_key":"problem_statement","label":"Problem statement","value":"..."}
//
// Optional fields supported in the JSON:
//   - stage_key   (defaults to the active stage at save time)
//   - dna_field   (legacy, ignored here)
//
// The parser is permissive: it tolerates whitespace, surrounding code fences,
// and stray text on the SAVE_PROMPT line. It strips ALL such lines from the
// rendered text, even if JSON parsing fails — the founder must never see the
// raw block.

export interface ParsedSavePrompt {
  fieldKey: string;
  label: string;
  value: string;
  stageKey?: string;
}

export interface ParsedAIMessage {
  cleanText: string;
  savePrompts: ParsedSavePrompt[];
}

// Match a line that starts with optional whitespace then SAVE_PROMPT:
// followed by a JSON object on the same line. We greedily capture to end of
// line; the JSON itself should not contain raw newlines.
const SAVE_PROMPT_LINE_RE = /^[ \t]*SAVE_PROMPT:\s*(\{.*\})\s*$/gim;

// Fallback: strip any stray "SAVE_PROMPT:" line even without valid JSON,
// so the user never sees the raw token.
const SAVE_PROMPT_STRIP_RE = /^[ \t]*SAVE_PROMPT:.*$/gim;

export function parseAIMessage(rawText: string): ParsedAIMessage {
  if (!rawText) return { cleanText: rawText ?? '', savePrompts: [] };

  const savePrompts: ParsedSavePrompt[] = [];

  // First, extract well-formed SAVE_PROMPT blocks.
  let match: RegExpExecArray | null;
  SAVE_PROMPT_LINE_RE.lastIndex = 0;
  while ((match = SAVE_PROMPT_LINE_RE.exec(rawText)) !== null) {
    const jsonStr = match[1];
    try {
      const parsed = JSON.parse(jsonStr);
      const fieldKey = String(parsed.field_key ?? parsed.fieldKey ?? '').trim();
      const value = String(parsed.value ?? '').trim();
      if (fieldKey && value) {
        savePrompts.push({
          fieldKey,
          label: String(parsed.label ?? fieldKey).trim(),
          value,
          stageKey: parsed.stage_key ?? parsed.stageKey ?? undefined,
        });
      }
    } catch {
      // Ignore — line is still stripped below.
    }
  }

  // Always strip any SAVE_PROMPT line from the visible text.
  let cleanText = rawText.replace(SAVE_PROMPT_STRIP_RE, '').trimEnd();

  // Collapse trailing blank lines that may remain.
  cleanText = cleanText.replace(/\n{3,}$/g, '\n\n');

  return { cleanText, savePrompts };
}
