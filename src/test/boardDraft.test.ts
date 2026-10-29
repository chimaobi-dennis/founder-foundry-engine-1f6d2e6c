import { describe, expect, it } from "vitest";
import { applyDraftPatch, boardNeeds, coerceBoardQuestion, scheduleWords } from "@shared/boardDraft";
import type { PlanDraft } from "@shared/runner";

const base: PlanDraft = { kind: "task", name: "Three posts", brief: "Write three posts", agents: ["copywriter"], units: 3, platforms: ["instagram"], schedule: "once", conditions: [], approval: "review_first", on_failure: "ask", action_class: "generate", explanation: "", warnings: [] };

describe("coerceBoardQuestion", () => {
  it("keeps a question with two usable chips", () => {
    const q = coerceBoardQuestion({ text: "Once, or every week?", options: [{ label: "Once", patch: { schedule: "once" } }, { label: "Every week", patch: { schedule: "weekly" } }] });
    expect(q?.options.map((o) => o.label)).toEqual(["Once", "Every week"]);
  });
  it("drops a question with one answer or junk patches", () => {
    expect(coerceBoardQuestion({ text: "Sure?", options: [{ label: "Yes", patch: { schedule: "once" } }] })).toBeNull();
    expect(coerceBoardQuestion({ text: "Sure?", options: [{ label: "A", patch: { colour: "red" } }, { label: "B", patch: {} }] })).toBeNull();
    expect(coerceBoardQuestion(null)).toBeNull();
  });
  it("reads an event option and flat patches", () => {
    const q = coerceBoardQuestion({ text: "When?", options: [{ label: "Now", schedule: "once" }, { label: "On a milestone", schedule: "event", event: "milestone_reached" }, { label: "Bad", schedule: "event", event: "nope" }] });
    expect(q?.options).toHaveLength(2);
    expect(q?.options[1].patch).toEqual({ schedule: "event", event: "milestone_reached" });
  });
});

describe("applyDraftPatch", () => {
  it("changes the schedule and clears conditions when leaving an event", () => {
    const d = applyDraftPatch({ ...base, schedule: "event", event: "campaign_created", conditions: [{ field: "name", op: "eq", value: "x" }] }, { schedule: "weekly" });
    expect(d.schedule).toBe("weekly"); expect(d.event).toBeUndefined(); expect(d.conditions).toEqual([]);
  });
  it("never lets a chip remove review from publishing", () => {
    expect(applyDraftPatch({ ...base, action_class: "publish" }, { approval: "autonomous" }).approval).toBe("review_first");
    expect(applyDraftPatch(base, { approval: "autonomous" }).approval).toBe("autonomous");
  });
  it("bounds units", () => { expect(applyDraftPatch(base, { units: 500 }).units).toBe(20); });
});

describe("boardNeeds", () => {
  it("marks the recipe's provider required and the rest helpful, with connected state", () => {
    const needs = boardNeeds({ ...base, kind: "recipe", recipe: "seo_refresh" }, [{ provider: "ayrshare", why: "to post" }, "nonsense", { provider: "shopify" }], [{ provider: "ayrshare", status: "active" }]);
    expect(needs.map((n) => [n.provider, n.required, n.connected])).toEqual([["shopify", true, false], ["ayrshare", false, true]]);
  });
});

describe("scheduleWords", () => {
  it("reads as a founder would say it", () => {
    expect(scheduleWords({ schedule: "once" })).toBe("Once, now");
    expect(scheduleWords({ schedule: "biweekly" })).toBe("Every two weeks");
    expect(scheduleWords({ schedule: "event", event: "milestone_reached" })).toBe("When a milestone is reached");
  });
});
