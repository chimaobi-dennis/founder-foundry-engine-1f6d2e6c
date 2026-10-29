import { describe, expect, it } from "vitest";
import { branchWords, coerceBranches, coerceOnFailure, pickBranch, plainFailure } from "@shared/branching";
import { planSingleAgentRun } from "@shared/runner";

const agent = { id: "a1", slug: "copywriter", name: "Copywriter", role: "writer", system_prompt: "", model_tier: "fast", action_type: "caption", unit_label: "reply", per_run_credit_ceiling: 100, cost_indicator: 1 } as never;

describe("branches", () => {
  it("keeps two to four options and drops junk", () => {
    const b = coerceBranches({ question: "Is it a complaint?", options: [{ label: "it is a complaint", action: "run", brief: "apologise" }, { label: "otherwise", action: "ask" }, { label: "" }] });
    expect(b?.options).toHaveLength(2); expect(b?.options[1].action).toBe("ask");
    expect(coerceBranches({ question: "x", options: [{ label: "one" }] })).toBeNull();
    expect(coerceOnFailure("nope")).toBe("ask"); expect(coerceOnFailure("stop")).toBe("stop");
  });
  it("picks by label, loosely, and falls back to the otherwise", () => {
    const b = coerceBranches({ question: "q", options: [{ label: "a complaint", action: "run" }, { label: "a question", action: "run" }, { label: "otherwise", action: "ask" }] })!;
    expect(pickBranch(b, { choice: "A Complaint" }).label).toBe("a complaint");
    expect(pickBranch(b, { choice: "this is a question about pricing" }).label).toBe("a question");
    expect(pickBranch(b, { choice: "spam" }).label).toBe("otherwise");
  });
  it("reads as a sentence", () => {
    const b = coerceBranches({ question: "q", options: [{ label: "it is a complaint", action: "run" }, { label: "otherwise", action: "ask" }] })!;
    expect(branchWords(b, "Copywriter")).toBe("Kinika decides: if it is a complaint, the Copywriter does it; otherwise, asks you");
  });
  it("plans a decide step first, and a decision step only when an option asks", () => {
    const asks = planSingleAgentRun(agent, { brief: "x" }, { approval: "review_first", branches: coerceBranches({ question: "q", options: [{ label: "a", action: "run" }, { label: "b", action: "ask" }] }) });
    expect(asks.map((s) => s.type)).toEqual(["branch", "approval", "agent_task", "approval"]);
    expect(asks[1].input.kind).toBe("decision");
    const plain = planSingleAgentRun(agent, { brief: "x" }, { approval: "review_first", branches: coerceBranches({ question: "q", options: [{ label: "a", action: "run" }, { label: "b", action: "skip" }] }) });
    expect(plain.map((s) => s.type)).toEqual(["branch", "agent_task", "approval"]);
    expect(planSingleAgentRun(agent, { brief: "x" }).map((s) => s.type)).toEqual(["agent_task", "approval"]);
  });
});

describe("plainFailure", () => {
  it("turns raw errors into what happened and what to do", () => {
    expect(plainFailure("INSUFFICIENT_BALANCE").what).toMatch(/credits/);
    expect(plainFailure("Shopify: 401 Unauthorized").next).toMatch(/Reconnect/);
    expect(plainFailure("AI gateway returned 504").what).toMatch(/too long/);
    expect(plainFailure("Copywriter did not return structured output (bad json).").next).toMatch(/Try again/);
    expect(plainFailure("").what).toBe("Something went wrong.");
  });
});
