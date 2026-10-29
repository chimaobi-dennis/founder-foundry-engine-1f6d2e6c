import { describe, it, expect } from "vitest";
import { boardToolsFrom, boardLines, boardsBlock, parseBoardCalls, coerceHandOff, toolDepth, toolBrief, outputText, MAX_BOARD_CALLS, MAX_TOOL_DEPTH } from "@shared/tools";
import { coercePlanDraft, planSingleAgentRun, planHiveRun, plannerSystemPrompt, type AgentDefinition, type PlannerContext } from "@shared/runner";

const agent: AgentDefinition = { id: "a1", slug: "copywriter", name: "Copywriter", role: "copy", system_prompt: "", model_tier: "standard", action_type: "agent_copy", unit_label: "caption", per_run_credit_ceiling: 50, cost_indicator: 1, output_spec: {} };
const boards = [{ id: "b1", name: "Weekly newsletter", line: "- b1: \"Weekly newsletter\"" }, { id: "b2", name: "Social posts", line: "- b2: \"Social posts\"" }];
const ctx: PlannerContext = { agents: [{ slug: "copywriter", name: "Copywriter", unit_label: "caption" }], connections: [], boards };

describe("boards as tools: the list", () => {
  it("shapes automation rows with their agent and brief", () => {
    const tools = boardToolsFrom([{ id: "b1", name: "Weekly newsletter", trigger_type: "schedule", task_input: { brief: "Draft the week's issue" }, agents: { name: "Copywriter" } }, { id: 7 }]);
    expect(tools).toHaveLength(1);
    expect(tools[0]).toMatchObject({ id: "b1", agent_name: "Copywriter", brief: "Draft the week's issue" });
    expect(boardLines(tools)).toContain('- b1: "Weekly newsletter" (Copywriter) — Draft the week\'s issue');
  });
  it("reads the agent from the browser's shape too", () => {
    expect(boardToolsFrom([{ id: "b1", name: "X", agent: { name: "Researcher" } }])[0].agent_name).toBe("Researcher");
  });
  it("is empty when there is nothing to call", () => {
    expect(boardsBlock([], "BOARDS\n{{boards}}")).toBe("");
    expect(boardsBlock(boardToolsFrom([{ id: "b1", name: "X" }]), "BOARDS\n{{boards}}")).toBe('BOARDS\n- b1: "X"');
  });
});

describe("boards as tools: Kinika's RUN_BOARD block", () => {
  it("pulls the calls out and leaves clean prose", () => {
    const r = parseBoardCalls('Started it.\n\n<RUN_BOARD id="b1" d="D2">Write the issue about the autumn menu.</RUN_BOARD>', [{ id: "d-1" }, { id: "d-2" }]);
    expect(r.text).toBe("Started it.");
    expect(r.calls).toEqual([{ id: "b1", brief: "Write the issue about the autumn menu.", deliverableId: "d-2" }]);
  });
  it("accepts a fenced block, drops empty and repeated calls, caps the count", () => {
    const r = parseBoardCalls('```\n<RUN_BOARD id="b1">one</RUN_BOARD>\n```\n<RUN_BOARD id="b1">again</RUN_BOARD><RUN_BOARD id="b2"></RUN_BOARD><RUN_BOARD id="b3">three</RUN_BOARD><RUN_BOARD id="b4">four</RUN_BOARD>');
    expect(r.calls.map((c) => c.id)).toEqual(["b1", "b3"]);
    expect(r.calls).toHaveLength(MAX_BOARD_CALLS);
    expect(r.text).toBe("");
  });
  it("never lets a stray tag reach the founder", () => {
    expect(parseBoardCalls("Hello <RUN_BOARD id='b1'> world").text).toBe("Hello  world");
  });
});

describe("boards as tools: the hand-off on a draft", () => {
  it("keeps a listed board and drops the rest", () => {
    expect(coerceHandOff({ board_id: "b2" }, boards)).toEqual({ automation_id: "b2", name: "Social posts" });
    expect(coerceHandOff({ board_id: "nope" }, boards)).toBeNull();
    expect(coerceHandOff({ board_id: "b1" }, boards, "b1")).toBeNull();
    expect(coerceHandOff({ board_id: "b1" }, undefined)).toBeNull();
  });
  it("travels from the model's draft to the planned steps, after the approval", () => {
    const draft = coercePlanDraft({ kind: "task", name: "Research", brief: "Find three angles", agents: ["copywriter"], units: 1, schedule: "once", approval: "review_first", then: { board_id: "b1" } }, ctx)!;
    expect(draft.then).toEqual({ automation_id: "b1", name: "Weekly newsletter" });
    const steps = planSingleAgentRun(agent, { brief: draft.brief, units: 1 }, { approval: "review_first", then: draft.then });
    expect(steps.map((s) => s.type)).toEqual(["agent_task", "approval", "tool"]);
    expect(steps[2].input).toMatchObject({ automation_id: "b1", board_name: "Weekly newsletter", action_class: "generate" });
    expect(steps[2].name).toBe("Hand to board: Weekly newsletter");
  });
  it("follows the team's review on a hive, and is absent without a then", () => {
    const hive = planHiveRun([{ agent }, { agent }], { brief: "x", units: 1 }, { approval: "review_first", then: { automation_id: "b2", name: "Social posts" } });
    expect(hive.map((s) => s.type)).toEqual(["agent_task", "agent_task", "approval", "tool"]);
    expect(planSingleAgentRun(agent, { brief: "x", units: 1 }, { approval: "autonomous" }).map((s) => s.type)).toEqual(["agent_task"]);
  });
  it("lists the boards in the planner prompt", () => {
    expect(plannerSystemPrompt(ctx, "B:\n{{boards}}")).toBe('B:\n- b1: "Weekly newsletter"\n- b2: "Social posts"');
    expect(plannerSystemPrompt({ ...ctx, boards: [] }, "B:\n{{boards}}")).toBe("B:\n(none yet)");
  });
});

describe("boards as tools: the run", () => {
  it("counts depth and stops boards calling boards forever", () => {
    expect(toolDepth({})).toBe(0);
    expect(toolDepth({ tool_depth: 1 })).toBe(1);
    expect(toolDepth({ tool_depth: "x" })).toBe(0);
    expect(MAX_TOOL_DEPTH).toBe(2);
  });
  it("writes the brief the called board works on", () => {
    expect(toolBrief("Draft the issue", 'the board "Research"', "Three angles…")).toBe('Draft the issue\n\nHANDED OVER BY THE BOARD "RESEARCH":\nThree angles…');
    expect(toolBrief("Draft the issue", "Kinika", "")).toBe("Draft the issue");
  });
  it("flattens an output for the next brief", () => {
    expect(outputText({ items: [{ platform: "instagram", title: "Monday", body: "Hello", hashtags: ["bread"] }], notes: "short" })).toBe("instagram · Monday\nHello\n#bread\n\nNotes: short");
    expect(outputText({ summary: "Done." })).toBe("Done.");
    expect(outputText(null)).toBe("");
  });
});
