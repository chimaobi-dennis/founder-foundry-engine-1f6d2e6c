import { describe, it, expect } from "vitest";
import { parseTaskReply, visibleWhileStreaming } from "@shared/taskChat";

const ds = [{ id: "d-1" }, { id: "d-2" }, { id: "d-3" }];

describe("task reply: nothing of the machinery reaches the founder", () => {
  it("reads a bare STATE line without its tags", () => {
    const r = parseTaskReply('Facebook it is.\nSTATE {"closed":[{"d":"D1","outcome":"Facebook, because of the 400 followers"}],"suggestions":["Review the report"],"options":[],"needs":{}}', ds);
    expect(r.text).toBe("Facebook it is.");
    expect(r.done).toEqual([{ id: "d-1", result: "Facebook, because of the 400 followers" }]);
    expect(r.suggestions).toEqual(["Review the report"]);
    expect(r.needs).toBeNull();
  });
  it("reads an unclosed <STATE> and a STATE: line", () => {
    expect(parseTaskReply('Done.\n<STATE>{"closed":[],"suggestions":["a"]}', ds).suggestions).toEqual(["a"]);
    expect(parseTaskReply('Done.\nSTATE: {"closed":[{"d":"D3"}]}', ds).done).toEqual([{ id: "d-3", result: null }]);
    expect(parseTaskReply("Done.\nSTATE", ds).text).toBe("Done.");
  });
  it("keeps braces inside strings balanced", () => {
    const r = parseTaskReply('Ok.\nSTATE {"closed":[],"suggestions":["Use {brackets} wisely"]}', ds);
    expect(r.suggestions).toEqual(["Use {brackets} wisely"]);
    expect(r.text).toBe("Ok.");
  });
  it("turns two document blocks into one document with a section each", () => {
    const r = parseTaskReply('First.\n<DOCUMENT title="Audit Report">Two accounts.</DOCUMENT>\nNext, the list.\n<DOCUMENT title="Comparison List">1. Facebook\n2. Twitter</DOCUMENT>\nSTATE {"closed":[]}', ds);
    expect(r.document).toEqual({ title: "Audit Report", body: "Two accounts.\n\n## Comparison List\n\n1. Facebook\n2. Twitter" });
    expect(r.text).toBe("First.\n\n*Written: Audit Report and Comparison List. It is open beside this conversation; edit any line.*\nNext, the list.");
    expect(r.text).not.toContain("<");
  });
  it("takes an unclosed document to the end of the reply", () => {
    const r = parseTaskReply('Here.\n<DOCUMENT title="Brief">The brief body', ds);
    expect(r.document).toEqual({ title: "Brief", body: "The brief body" });
    expect(r.text).toContain("*Written: Brief.");
  });
  it("hides a bare STATE line while streaming", () => {
    expect(visibleWhileStreaming('Hello there.\nSTATE {"closed":[]}').text).toBe("Hello there.");
    expect(visibleWhileStreaming("Hello there.\n<STATE>{").text).toBe("Hello there.");
  });
});
