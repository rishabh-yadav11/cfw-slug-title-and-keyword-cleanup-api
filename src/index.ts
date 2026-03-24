import { Hono } from "hono";
import { requestIdMiddleware } from "./middlewares/requestId";
import { corsMiddleware } from "./middlewares/cors";
import { authMiddleware } from "./middlewares/auth";
import { rateLimitMiddleware } from "./middlewares/rateLimit";
import { metadataRouter, faviconRouter, schemaRouter } from "./routes/metadata";
import { textRouter } from "./routes/text";
import { Env, ApiKeyData } from "./types";
import { signatureMiddleware } from "./middlewares/signature";

const app = new Hono<{
  Bindings: Env;
  Variables: { apiKeyData: ApiKeyData; requestId: string };
}>();

// Global Middlewares
app.use("*", requestIdMiddleware);
app.use("*", corsMiddleware);

// Auth and Rate limit before routing
app.use("/v1/metadata*", authMiddleware("metadata:read"), rateLimitMiddleware);
app.use("/v1/favicon*", authMiddleware("metadata:read"), rateLimitMiddleware);
app.use("/v1/schema*", authMiddleware("metadata:read"), rateLimitMiddleware);

// Text API (Write routes) requires Auth, RateLimit, AND Signature Middleware
app.use(
  "/v1/text*",
  authMiddleware("text:write"),
  rateLimitMiddleware,
  signatureMiddleware,
);

// Mount routers with specific scopes
app.route("/v1/metadata", metadataRouter);
app.route("/v1/favicon", faviconRouter);
app.route("/v1/schema", schemaRouter);

app.route("/v1/text", textRouter);

// OpenAPI doc (dummy output as requested)
app.get("/openapi.json", (c) => {
  return c.json({
    openapi: "3.0.0",
    info: { title: "Slug, Title, and Keyword Cleanup API", version: "1.0.0" },
    paths: {
      "/v1/metadata": { get: { description: "Get metadata" } },
      "/v1/text/slug": { post: { description: "Create slug" } },
    },
  });
});

app.onError((err, c) => {
  console.error(`[Error] ${err.message}`, err.stack);
  return c.json(
    {
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Internal Server Error" },
      request_id: c.get("requestId") || "unknown",
    },
    500,
  );
});

app.notFound((c) => {
  return c.json(
    {
      ok: false,
      error: { code: "NOT_FOUND", message: "Route not found" },
      request_id: c.get("requestId") || "unknown",
    },
    404,
  );
});

export default app;
