import { Context, Next } from "hono";
import { checkRateLimit, incrementRateLimits } from "../utils/rateLimit";
import { Env, ApiKeyData } from "../types";

export const rateLimitMiddleware = async (
  c: Context<{
    Bindings: Env;
    Variables: { apiKeyData: ApiKeyData; requestId: string };
  }>,
  next: Next,
) => {
  const keyData = c.get("apiKeyData");
  const requestId = c.get("requestId");
  const ip = c.req.header("CF-Connecting-IP") || "unknown";

  const kv = c.env.KV;

  // Throttle by key
  const keyRes = await checkRateLimit(
    kv,
    `key:${keyData.key_id}`,
    keyData.plan,
  );
  if (!keyRes.allowed) {
    c.header(
      "Retry-After",
      Math.ceil((keyRes.reset - Date.now()) / 1000).toString(),
    );
    c.header("X-RateLimit-Limit", keyRes.limit.toString());
    c.header("X-RateLimit-Remaining", keyRes.remaining.toString());
    c.header("X-RateLimit-Reset", keyRes.reset.toString());

    return c.json(
      {
        ok: false,
        error: {
          code: "TOO_MANY_REQUESTS",
          message: "API Key Rate limit exceeded",
        },
        request_id: requestId,
      },
      429,
    );
  }

  // Throttle by IP (just using the same plan spec for simplicity)
  const ipRes = await checkRateLimit(kv, `ip:${ip}`, keyData.plan);
  if (!ipRes.allowed) {
    c.header(
      "Retry-After",
      Math.ceil((ipRes.reset - Date.now()) / 1000).toString(),
    );
    c.header("X-RateLimit-Limit", ipRes.limit.toString());
    c.header("X-RateLimit-Remaining", ipRes.remaining.toString());
    c.header("X-RateLimit-Reset", ipRes.reset.toString());

    return c.json(
      {
        ok: false,
        error: { code: "TOO_MANY_REQUESTS", message: "IP Rate limit exceeded" },
        request_id: requestId,
      },
      429,
    );
  }

  c.header("X-RateLimit-Limit", keyRes.limit.toString());
  c.header("X-RateLimit-Remaining", keyRes.remaining.toString());
  c.header("X-RateLimit-Reset", keyRes.reset.toString());

  // Increment counters asynchronously using waitUntil
  c.executionCtx.waitUntil(
    incrementRateLimits(kv, `key:${keyData.key_id}`, keyData.plan),
  );
  c.executionCtx.waitUntil(incrementRateLimits(kv, `ip:${ip}`, keyData.plan));

  await next();
};
