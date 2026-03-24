import { Context, Next } from "hono";

export const bodySizeLimit = (maxBytes: number) => {
  return async (c: Context, next: Next) => {
    const contentLength = c.req.header("Content-Length");
    if (contentLength && parseInt(contentLength, 10) > maxBytes) {
      return c.json(
        {
          ok: false,
          error: { code: "PAYLOAD_TOO_LARGE", message: "Payload too large" },
          request_id: c.get("requestId"),
        },
        413,
      );
    }

    // We also need to clone the request or wrap it to check actual body size,
    // but Content-Length is a good first line of defense.
    // For cloudflare workers we can also read the ArrayBuffer but that consumes it.

    await next();
  };
};

export const jsonBodyLimit = bodySizeLimit(256 * 1024); // 256KB
export const textWriteBodyLimit = bodySizeLimit(128 * 1024); // 128KB
