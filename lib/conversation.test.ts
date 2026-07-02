import { describe, it, expect } from "vitest";
import { advanceConversation } from "@/lib/conversation";

describe("advanceConversation", () => {
  it("awaiting_name with a name advances to awaiting_prompt and stores name", () => {
    const r = advanceConversation({ state: "awaiting_name", collected: {} }, { body: "Ada", hasImage: false });
    expect(r.nextState).toBe("awaiting_prompt");
    expect(r.collected.name).toBe("Ada");
    expect(r.action).toBe("none");
    expect(r.reply.length).toBeGreaterThan(0);
  });

  it("awaiting_name with empty body re-prompts, stays in awaiting_name", () => {
    const r = advanceConversation({ state: "awaiting_name", collected: {} }, { body: "", hasImage: false });
    expect(r.nextState).toBe("awaiting_name");
    expect(r.action).toBe("none");
  });

  it("awaiting_prompt with a prompt advances to generating and enqueues", () => {
    const r = advanceConversation(
      { state: "awaiting_prompt", collected: { name: "Ada" } },
      { body: "a robot detective in the rain", hasImage: false },
    );
    expect(r.nextState).toBe("generating");
    expect(r.collected.prompt).toBe("a robot detective in the rain");
    expect(r.action).toBe("enqueue_generation");
    expect(r.reply).toContain("Ada");
  });

  it("generating ignores input with a hold message", () => {
    const r = advanceConversation({ state: "generating", collected: { name: "Ada", prompt: "x" } }, { body: "hello?", hasImage: false });
    expect(r.nextState).toBe("generating");
    expect(r.action).toBe("none");
  });

  it("done + any message resets to awaiting_name", () => {
    const r = advanceConversation({ state: "done", collected: { name: "Ada" } }, { body: "hi again", hasImage: false });
    expect(r.nextState).toBe("awaiting_name");
    expect(r.action).toBe("reset");
    expect(r.collected).toEqual({});
  });

  it("'restart' keyword resets from any state", () => {
    const r = advanceConversation({ state: "awaiting_prompt", collected: { name: "Ada" } }, { body: "restart", hasImage: false });
    expect(r.nextState).toBe("awaiting_name");
    expect(r.action).toBe("reset");
    expect(r.collected).toEqual({});
  });

  it("'new' keyword resets from awaiting_name", () => {
    expect(advanceConversation({ state: "awaiting_name", collected: {} }, { body: "new", hasImage: false }).action).toBe("reset");
  });

  it("'reset' keyword resets from generating and returns awaiting_name nextState", () => {
    const r = advanceConversation({ state: "generating", collected: { name: "Ada", prompt: "x" } }, { body: "reset", hasImage: false });
    expect(r.nextState).toBe("awaiting_name");
  });
});
