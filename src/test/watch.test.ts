import { describe, expect, it } from "vitest";
import { availableWatchSources, itemForBrief, watchSourceFor, watchSourcesBlock } from "@shared/watch";
import { applyDraftPatch, boardNeeds, scheduleWords } from "@shared/boardDraft";
import { coercePlanDraft } from "@shared/runner";

const ctx = { request: "reply to new orders", agents: [{ slug: "copywriter", name: "Copywriter", unit_label: "caption" }], connections: [{ id: "c1", provider: "shopify", display_name: "My shop" }], sources: [{ key: "shopify_orders", connection_id: "c1", line: "- shopify_orders: when a new order comes in (Shopify: My shop)" }] };

describe("watch sources", () => {
  it("lists only sources the connections allow", () => {
    const a = availableWatchSources([{ id: "c1", provider: "shopify", display_name: "My shop", status: "active" }, { id: "c2", provider: "google", display_name: "Gmail · Ada", status: "error" }]);
    expect(a.map((x) => x.source.key)).toEqual(["shopify_orders"]);
    expect(watchSourcesBlock([])).toBe("(none connected)");
  });
  it("the brief carries the item, bounded", () => {
    const b = itemForBrief({ id: "x", at: "2026-10-29T10:00:00Z", title: "Order #1042", text: "a".repeat(5000), from: "Ada", url: null });
    expect(b.startsWith("WHAT ARRIVED (2026-10-29T10:00:00Z):")).toBe(true);
    expect(b.length).toBeLessThan(3200);
  });
});

describe("planner: watch schedule", () => {
  it("keeps watch when the source is available, with its connection", () => {
    const d = coercePlanDraft({ kind: "task", name: "Thank new customers", brief: "x", agents: ["copywriter"], schedule: "watch", watch: { source: "shopify_orders" } }, ctx);
    expect(d?.schedule).toBe("watch"); expect(d?.watch).toEqual({ source: "shopify_orders", connection_id: "c1", options: {} });
  });
  it("falls back to once with a warning when nothing can be watched", () => {
    const d = coercePlanDraft({ kind: "task", name: "n", brief: "x", agents: ["copywriter"], schedule: "watch", watch: { source: "gmail_inbox" } }, ctx);
    expect(d?.schedule).toBe("once"); expect(d?.warnings.join(" ")).toMatch(/gmail_inbox/);
  });
  it("a chip cannot turn a plain draft into a watch, but can turn a watch into a schedule", () => {
    const base = coercePlanDraft({ kind: "task", name: "n", brief: "x", agents: ["copywriter"], schedule: "watch", watch: { source: "shopify_orders" } }, ctx)!;
    expect(applyDraftPatch(base, { schedule: "weekly" }).watch).toBeUndefined();
    const plain = { ...base, schedule: "once" as const, watch: undefined };
    expect(applyDraftPatch(plain, { schedule: "watch" }).schedule).toBe("once");
  });
  it("needs name the watched connection as required, and words read right", () => {
    const d = coercePlanDraft({ kind: "task", name: "n", brief: "x", agents: ["copywriter"], schedule: "watch", watch: { source: "shopify_orders" } }, ctx)!;
    expect(boardNeeds(d, [], [])).toEqual([{ provider: "shopify", name: "Shopify", why: "the board waits for new orders there", required: true, connected: false }]);
    expect(scheduleWords(d)).toBe("When a new order comes in");
    expect(watchSourceFor("nope")).toBeNull();
  });
});
