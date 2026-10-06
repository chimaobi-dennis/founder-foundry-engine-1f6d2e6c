import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// The service-role key bypasses RLS. Any VITE_* variable is inlined into the
// browser bundle, so it must never be referenced from frontend code.
// Admin access goes through is_admin() RLS policies and SECURITY DEFINER RPCs.

const SRC = join(__dirname, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|jsx)$/.test(entry)) out.push(full);
  }
  return out;
}

describe("frontend never embeds the Supabase service-role key", () => {
  it("has no VITE_*SERVICE_ROLE* reference under src/", () => {
    const offenders = walk(SRC)
      .filter((f) => !f.endsWith("noServiceRoleInFrontend.test.ts"))
      .filter((f) => /VITE_[A-Z_]*SERVICE_ROLE/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("does not create a second Supabase client for admin access", () => {
    const offenders = walk(SRC)
      .filter((f) => !f.endsWith("noServiceRoleInFrontend.test.ts"))
      .filter((f) => /adminServiceSupabase|adminSupabase/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
