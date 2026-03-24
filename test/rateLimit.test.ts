import { checkRateLimit, incrementRateLimits } from "../src/utils/rateLimit";
import { describe, expect, it } from "vitest";

describe("Rate Limit Utility", () => {
  it("blocks after limit exceeded", async () => {
    // Fake KV implementation
    const store: Record<string, string> = {};
    const kv = {
      get: async (key: string) => store[key] || null,
      put: async (key: string, val: string) => {
        store[key] = val;
      },
    };

    // Free plan: 60/min limit, 10 burst per 10s
    for (let i = 0; i < 10; i++) {
      const res = await checkRateLimit(kv as any, "test-key", "free");
      expect(res.allowed).toBe(true);
      await incrementRateLimits(kv as any, "test-key", "free");
    }

    // 11th request should be blocked by burst (10 limit)
    const burstRes = await checkRateLimit(kv as any, "test-key", "free");
    expect(burstRes.allowed).toBe(false);
  });
});
