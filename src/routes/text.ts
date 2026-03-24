import { Hono } from "hono";
import { z } from "zod";
import {
  generateSlug,
  normalizeTitle,
  clusterKeywords,
  extractEntitiesLite,
} from "../services/textCleanup";
import { textWriteBodyLimit } from "../middlewares/bodyLimit";
import { requireIdempotency } from "../middlewares/idempotency";
import { handleZodError } from "../middlewares/validation";
import { Env, ApiKeyData } from "../types";

export const textRouter = new Hono<{
  Bindings: Env;
  Variables: {
    apiKeyData: ApiKeyData;
    requestId: string;
    parsedJsonBody?: any;
    validBody?: any;
  };
}>();

// Apply limits and idempotency check to all text routes
textRouter.use("*", textWriteBodyLimit);
textRouter.use("*", requireIdempotency);

const textSchema = z.object({
  text: z.string().min(1),
});

const keywordsSchema = z.object({
  keywords: z.array(z.string()).min(1).max(1000), // Setting sensible max for clustering limit
});

const validateBody = (schema: z.ZodSchema) => {
  return async (c: any, next: any) => {
    const body = c.get("parsedJsonBody");
    if (!body) {
      return c.json(
        {
          ok: false,
          error: { code: "BAD_REQUEST", message: "Invalid JSON body" },
          request_id: c.get("requestId"),
        },
        400,
      );
    }
    const result = schema.safeParse(body);
    if (!result.success) {
      return handleZodError(result, c);
    }
    c.set("validBody", result.data);
    await next();
  };
};

textRouter.post("/slug", validateBody(textSchema), async (c) => {
  const body = c.get("validBody");
  const slug = generateSlug(body.text);
  return c.json({ ok: true, data: { slug }, request_id: c.get("requestId") });
});

textRouter.post("/normalize-title", validateBody(textSchema), async (c) => {
  const body = c.get("validBody");
  const title = normalizeTitle(body.text);
  return c.json({ ok: true, data: { title }, request_id: c.get("requestId") });
});

textRouter.post(
  "/cluster-keywords",
  validateBody(keywordsSchema),
  async (c) => {
    const body = c.get("validBody");
    const clusters = clusterKeywords(body.keywords);
    return c.json({
      ok: true,
      data: { clusters },
      request_id: c.get("requestId"),
    });
  },
);

textRouter.post(
  "/extract-entities-lite",
  validateBody(textSchema),
  async (c) => {
    const body = c.get("validBody");
    const entities = extractEntitiesLite(body.text);
    return c.json({ ok: true, data: entities, request_id: c.get("requestId") });
  },
);
