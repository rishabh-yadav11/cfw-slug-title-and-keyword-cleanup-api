import { Context, Next } from "hono";

const ALLOWLIST = [
  "https://dashboard.example.com",
  "https://admin.example.com",
];

export const corsMiddleware = async (c: Context, next: Next) => {
  const origin = c.req.header("Origin");

  if (origin) {
    if (ALLOWLIST.includes(origin)) {
      c.header("Access-Control-Allow-Origin", origin);
    } else {
      // For Server-to-Server, we don't necessarily need CORS headers if the client is not a browser,
      // but if a browser hits it with an unallowed origin, we don't return the header or return 'null'
      c.header("Access-Control-Allow-Origin", "null");
    }
  }

  c.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  c.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Request-Id, Idempotency-Key, X-Timestamp, X-Nonce, X-Signature",
  );

  if (c.req.method === "OPTIONS") {
    return c.body(null, 204);
  }

  await next();
};
