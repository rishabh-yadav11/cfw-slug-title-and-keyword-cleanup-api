import { describe, expect, it, vi } from "vitest";
import app from "../src/index";

// Minimal mock for KV
const mockKV = {
  get: vi.fn(),
  put: vi.fn(),
};

const MOCK_ENV = {
  KV: mockKV as any,
};

describe("API Routes", () => {
  it("long_body: oversized payload returns 413 for text routes", async () => {
    const largeBody = { text: "a".repeat(150 * 1024) }; // ~150KB
    const req = new Request("http://localhost/v1/text/slug", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
        "Idempotency-Key": "key1",
        "Content-Length": (150 * 1024).toString(),
      },
      body: JSON.stringify(largeBody),
    });

    const res = await app.fetch(req, MOCK_ENV, { waitUntil: () => {} } as any);
    expect(res.status).toBe(413);
  });

  it("fails with validation error if no body", async () => {
    const req = new Request("http://localhost/v1/text/slug", {
      method: "POST",
      headers: {
        "Idempotency-Key": "key-2",
      },
    });
    const res = await app.fetch(req, MOCK_ENV, { waitUntil: () => {} } as any);
    expect(res.status).toBe(400);
  });
});
