import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/redis", () => ({ getRedisClient: vi.fn() }));

import { getClientIp } from "./rate-limit";

const req = (h: Record<string, string>) => ({ headers: new Headers(h) });

describe("getClientIp", () => {
  it("prefers cf-connecting-ip", () => {
    expect(
      getClientIp(req({ "cf-connecting-ip": "1.2.3.4", "x-forwarded-for": "9.9.9.9, 5.6.7.8" })),
    ).toBe("1.2.3.4");
  });

  it("falls back to the last x-forwarded-for entry (the first is client-controlled)", () => {
    expect(getClientIp(req({ "x-forwarded-for": "6.6.6.6, 7.7.7.7, 5.6.7.8" }))).toBe("5.6.7.8");
    expect(getClientIp(req({ "x-forwarded-for": "5.6.7.8" }))).toBe("5.6.7.8");
  });

  it("returns unknown when no header is present", () => {
    expect(getClientIp(req({}))).toBe("unknown");
    expect(getClientIp(req({ "x-forwarded-for": "" }))).toBe("unknown");
  });
});
