import { Context, Next } from "hono";
import { Env, ApiKeyData } from "../types";

export const requireIdempotency = async (
  c: Context<{
    Bindings: Env;
    Variables: {
      apiKeyData: ApiKeyData;
      requestId: string;
      idempotencyKey?: string;
    };
  }>,
  next: Next,
) => {
  if (c.req.method === "POST") {
    const idempotencyKey = c.req.header("Idempotency-Key");
    const requestId = c.get("requestId");
    if (!idempotencyKey) {
      return c.json(
        {
          ok: false,
          error: {
            code: "BAD_REQUEST",
            message: "Idempotency-Key header is required",
          },
          request_id: requestId,
        },
        400,
      );
    }

    // Check if result is already cached
    const keyData = c.get("apiKeyData");
    const cacheKey = keyData
      ? `idemp:${keyData.key_id}:${idempotencyKey}`
      : `idemp:unknown:${idempotencyKey}`;

    const cachedStr = await c.env.KV.get(cacheKey);
    if (cachedStr) {
      // The cached response
      return new Response(cachedStr, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Idempotent-Response": "true",
          "X-Request-Id": requestId,
        },
      });
    }

    c.set("idempotencyKey", cacheKey);
  }

  await next();

  // If we get here, it means the request was processed and a response is ready.
  // We need to capture the response body.
  // Since `await next()` resolves after the downstream route handler returns a response,
  // `c.res` is the final response object.
  // We will clone it and save the response body to KV if it was successful (2xx).

  if (c.req.method === "POST") {
    const cacheKey = c.get("idempotencyKey");
    if (cacheKey && c.res.ok) {
      // Clone the response because reading its text consumes the body
      const clonedRes = c.res.clone();
      const bodyText = await clonedRes.text();

      // Keep it in KV for 24 hours
      c.executionCtx.waitUntil(
        c.env.KV.put(cacheKey, bodyText, { expirationTtl: 86400 }),
      );
    }
  }
};
