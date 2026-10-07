#!/usr/bin/env node
/**
 * Runs the SQL billing tests against the linked Supabase project.
 * The test file aborts its own transaction, so nothing is ever committed.
 * Exit code 0 on pass, 1 on failure.
 */
import { spawnSync } from "node:child_process";

const file = process.argv[2] ?? "supabase/tests/billing.sql";
const r = spawnSync("supabase", ["db", "query", "--linked", "-f", file], { encoding: "utf8" });
const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
const passed = out.match(/BILLING_TESTS_PASSED: (\d+) checks/);
const failed = out.match(/TEST FAILED: [^\n"]+/);
if (passed) {
  console.log(`PASS  ${file}: ${passed[1]} checks`);
  process.exit(0);
}
console.error(failed ? `FAIL  ${file}: ${failed[0]}` : `ERROR ${file}:\n${out.slice(0, 1500)}`);
process.exit(1);
