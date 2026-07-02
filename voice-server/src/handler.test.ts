import { describe, it, expect, vi, beforeEach } from "vitest";
import { dispatch, type Session } from "./handler.ts";

const deps = {
  publish: vi.fn(),
  getRemaining: vi.fn(),
};

beforeEach(() => {
  deps.publish.mockReset();
  deps.getRemaining.mockReset();
  deps.getRemaining.mockResolvedValue({ remaining: 3 });
  deps.publish.mockResolvedValue(undefined);
});

describe("dispatch", () => {
  it("setup stores from/callSid and emits nothing (welcomeGreeting speaks)", async () => {
    const { session, out } = await dispatch({ step: "awaiting_name" }, { type: "setup", from: "+15551112222", callSid: "CA1" }, deps);
    expect(session.from).toBe("+15551112222");
    expect(session.callSid).toBe("CA1");
    expect(out).toEqual([]);
  });

  it("ignores non-final prompt (last:false)", async () => {
    const { out } = await dispatch({ step: "awaiting_name", from: "+1" }, { type: "prompt", voicePrompt: "Ad", last: false }, deps);
    expect(out).toEqual([]);
  });

  it("first final prompt (name) asks for the idea, no publish", async () => {
    const { session, out } = await dispatch({ step: "awaiting_name", from: "+1" }, { type: "prompt", voicePrompt: "Ada", last: true }, deps);
    expect(session.step).toBe("awaiting_prompt");
    expect(out[0]).toMatchObject({ type: "text", last: true });
    expect(out.some((m) => m.type === "end")).toBe(false);
    expect(deps.publish).not.toHaveBeenCalled();
  });

  it("second final prompt (idea) publishes and ends the call", async () => {
    const { session, out } = await dispatch(
      { step: "awaiting_prompt", from: "+15551112222", name: "Ada" },
      { type: "prompt", voicePrompt: "a robot detective", last: true },
      deps,
    );
    expect(deps.publish).toHaveBeenCalledWith({ phoneNumber: "+15551112222", prompt: "a robot detective", style: "noir" });
    expect(out.some((m) => m.type === "text")).toBe(true);
    expect(out.some((m) => m.type === "end")).toBe(true);
    expect(session.step).toBe("done");
  });

  it("over rate limit → speaks limit message, ends, does NOT publish", async () => {
    deps.getRemaining.mockResolvedValue({ remaining: 0 });
    const { out } = await dispatch(
      { step: "awaiting_prompt", from: "+15551112222", name: "Ada" },
      { type: "prompt", voicePrompt: "a robot detective", last: true },
      deps,
    );
    expect(deps.publish).not.toHaveBeenCalled();
    expect(out.some((m) => m.type === "end")).toBe(true);
    expect(out.find((m) => m.type === "text")?.token || "").toMatch(/limit/i);
  });
});
