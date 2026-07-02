import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  select: vi.fn(), insert: vi.fn(), update: vi.fn(),
}));

// Chainable drizzle query-builder stub
function chain(result: any) {
  const c: any = {};
  for (const m of ["from", "where", "limit", "set", "values", "returning"]) c[m] = vi.fn(() => c);
  c.then = (res: any) => Promise.resolve(result).then(res); // awaitable
  return c;
}

vi.mock("@/lib/db", () => ({
  db: {
    select: (...a: any[]) => h.select(...a),
    insert: (...a: any[]) => h.insert(...a),
    update: (...a: any[]) => h.update(...a),
  },
}));

import { getOrCreateConversation } from "@/lib/db-actions";

beforeEach(() => {
  h.select.mockReset(); h.insert.mockReset(); h.update.mockReset();
});

describe("getOrCreateConversation", () => {
  it("returns the existing conversation when found", async () => {
    const existing = { id: "c1", phoneNumber: "+1", state: "awaiting_prompt", collected: { name: "Ada" } };
    h.select.mockReturnValue(chain([existing]));
    const r = await getOrCreateConversation("+1");
    expect(r).toEqual(existing);
    expect(h.insert).not.toHaveBeenCalled();
  });

  it("inserts a default conversation when none exists", async () => {
    const created = { id: "c2", phoneNumber: "+2", state: "awaiting_name", collected: {} };
    h.select.mockReturnValue(chain([]));       // none found
    h.insert.mockReturnValue(chain([created])); // returning() -> [created]
    const r = await getOrCreateConversation("+2");
    expect(r).toEqual(created);
    expect(h.insert).toHaveBeenCalledOnce();
  });
});
