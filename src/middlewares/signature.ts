import { Context, Next } from "hono";

export const signatureMiddleware = async (c: Context, next: Next) => {
  if (c.req.method !== "POST") {
    return await next();
  }

  const timestampStr = c.req.header("X-Timestamp");
  const nonce = c.req.header("X-Nonce");
  const signature = c.req.header("X-Signature");
  const requestId = c.get("requestId");

  if (!timestampStr || !nonce || !signature) {
    return c.json(
      {
        ok: false,
        error: { code: "UNAUTHORIZED", message: "Missing signing headers" },
        request_id: requestId,
      },
      401,
    );
  }

  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) {
    return c.json(
      {
        ok: false,
        error: { code: "BAD_REQUEST", message: "Invalid timestamp" },
        request_id: requestId,
      },
      400,
    );
  }

  // Reject replay when timestamp age exceeds 5 minutes
  if (Math.abs(Date.now() - timestamp) > 5 * 60 * 1000) {
    return c.json(
      {
        ok: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Request expired or timestamp invalid",
        },
        request_id: requestId,
      },
      401,
    );
  }

  // Nonce reuse check
  const nonceKey = `nonce:${nonce}`;
  const nonceExists = await c.env.KV.get(nonceKey);
  if (nonceExists) {
    return c.json(
      {
        ok: false,
        error: { code: "UNAUTHORIZED", message: "Nonce already used" },
        request_id: requestId,
      },
      401,
    );
  }
  c.executionCtx.waitUntil(c.env.KV.put(nonceKey, "1", { expirationTtl: 300 }));

  // Read raw body
  const rawBody = await c.req.text();

  // Verify HMAC-SHA256 signature
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json(
      {
        ok: false,
        error: { code: "UNAUTHORIZED", message: "Missing Auth header" },
        request_id: requestId,
      },
      401,
    );
  }

  const apiKey = authHeader.substring(7);

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(apiKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify", "sign"],
  );

  const dataToSign = `${timestampStr}${nonce}${rawBody}`;
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    keyMaterial,
    encoder.encode(dataToSign),
  );

  const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (signature !== expectedSignature) {
    return c.json(
      {
        ok: false,
        error: { code: "UNAUTHORIZED", message: "Invalid signature" },
        request_id: requestId,
      },
      401,
    );
  }

  // Inject the rawBody back into hono context as parsed json to avoid body already consumed errors
  try {
    const jsonBody = JSON.parse(rawBody);
    c.set("parsedJsonBody", jsonBody);
  } catch (e) {
    // Let downstream zod validator fail if it's not JSON
  }

  await next();
};
