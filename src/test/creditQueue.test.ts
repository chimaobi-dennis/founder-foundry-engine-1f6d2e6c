import { describe, it, expect } from "vitest";
import { fundInOrder, resumeStatusFor, waitingWords, queueFullWords, MAX_WAITING_PER_BOARD, WAITING_CREDITS } from "@shared/creditQueue";
import { boardLines } from "@shared/tools";

describe("queue when out of credits", () => {
  it("says what the run needs and what the founder has", () => {
    expect(waitingWords(120, 40)).toBe("Waiting for credits: this run needs about 120, you have 40 available. Add credits and it continues on its own, or stop it.");
    expect(waitingWords(0.2, -3)).toContain("needs about 1, you have 0");
    expect(queueFullWords("Inbox triage")).toBe(`Skipped: ${MAX_WAITING_PER_BOARD} runs of "Inbox triage" are already waiting for credits. Add credits and the waiting ones run first.`);
    expect(WAITING_CREDITS).toBe("waiting_credits");
  });
  it("sends a never-reserved run back to queued and a mid-run one on", () => {
    expect(resumeStatusFor({ generation_id: null })).toBe("queued");
    expect(resumeStatusFor({ generation_id: "g1" })).toBe("running");
  });
  it("funds the oldest first, each taking its share, per founder", () => {
    const runs = [
      { id: "a", user_id: "u1", credits_needed: 60 },
      { id: "b", user_id: "u1", credits_needed: 60 },
      { id: "c", user_id: "u1", credits_needed: 10 },
      { id: "d", user_id: "u2", credits_needed: 5 },
      { id: "e", user_id: "u3", credits_needed: 5 },
    ];
    const wallets = [{ user_id: "u1", balance: 100, reserved_balance: 20 }, { user_id: "u2", balance: 5, reserved_balance: 0 }];
    // u1 has 80: a (60) fits, b (60) does not, c (10) still fits from the remaining 20; u2 exactly covers d; u3 has no wallet.
    expect(fundInOrder(runs, wallets)).toEqual(["a", "c", "d"]);
    expect(fundInOrder([{ id: "x", user_id: "u1", credits_needed: null }], [{ user_id: "u1", balance: 1, reserved_balance: 0 }])).toEqual(["x"]);
  });
  it("tells Kinika how many runs of a board are waiting", () => {
    expect(boardLines([{ id: "b1", name: "Inbox triage", agent_name: null, trigger_type: "watch", brief: "", waiting: 2 }])).toBe('- b1: "Inbox triage" [2 runs waiting for credits]');
    expect(boardLines([{ id: "b1", name: "Inbox triage", agent_name: null, trigger_type: "watch", brief: "", waiting: 0 }])).toBe('- b1: "Inbox triage"');
  });
});
