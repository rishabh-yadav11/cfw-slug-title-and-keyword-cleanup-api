import { fetchMetadataWithRedirects } from "../services/metadata";
import { z } from "zod";
import { Hono } from "hono";
import { Env, ApiKeyData } from "../types";

export const metadataRouter = new Hono<{
  Bindings: Env;
  Variables: { apiKeyData: ApiKeyData; requestId: string };
}>();

const urlSchema = z.object({
  url: z.string().url().max(2048),
});

const batchSchema = z.object({
  urls: z.array(z.string().url().max(2048)).max(50),
});

metadataRouter.get("/", async (c) => {
  const result = urlSchema.safeParse({ url: c.req.query("url") });
  if (!result.success) {
    return c.json(
      {
        ok: false,
        error: { code: "BAD_REQUEST", message: "Invalid URL" },
        request_id: c.get("requestId"),
      },
      400,
    );
  }

  try {
    const metadata = await fetchMetadataWithRedirects(result.data.url);
    c.header("Cache-Control", "public, max-age=21600");
    return c.json({ ok: true, data: metadata, request_id: c.get("requestId") });
  } catch (err: any) {
    return c.json(
      {
        ok: false,
        error: { code: "FETCH_ERROR", message: err.message },
        request_id: c.get("requestId"),
      },
      502,
    );
  }
});

metadataRouter.post("/batch", async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      {
        ok: false,
        error: { code: "BAD_REQUEST", message: "Invalid JSON body" },
        request_id: c.get("requestId"),
      },
      400,
    );
  }

  const result = batchSchema.safeParse(body);
  if (!result.success) {
    return c.json(
      {
        ok: false,
        error: { code: "BAD_REQUEST", message: "Invalid batch payload" },
        request_id: c.get("requestId"),
      },
      400,
    );
  }

  const urls = result.data.urls;
  const results = await Promise.allSettled(
    urls.map((url) => fetchMetadataWithRedirects(url)),
  );

  const formattedResults = results.map((res, i) => {
    if (res.status === "fulfilled") {
      return { url: urls[i], ok: true, data: res.value };
    } else {
      return { url: urls[i], ok: false, error: res.reason.message };
    }
  });

  return c.json({
    ok: true,
    data: formattedResults,
    request_id: c.get("requestId"),
  });
});

export const faviconRouter = new Hono<{
  Bindings: Env;
  Variables: { apiKeyData: ApiKeyData; requestId: string };
}>();

faviconRouter.get("/", async (c) => {
  const result = urlSchema.safeParse({ url: c.req.query("url") });
  if (!result.success) {
    return c.json(
      {
        ok: false,
        error: { code: "BAD_REQUEST", message: "Invalid URL" },
        request_id: c.get("requestId"),
      },
      400,
    );
  }

  try {
    const metadata = await fetchMetadataWithRedirects(result.data.url);
    c.header("Cache-Control", "public, max-age=21600");
    return c.json({
      ok: true,
      data: { favicon: metadata.favicon },
      request_id: c.get("requestId"),
    });
  } catch (err: any) {
    return c.json(
      {
        ok: false,
        error: { code: "FETCH_ERROR", message: err.message },
        request_id: c.get("requestId"),
      },
      502,
    );
  }
});

export const schemaRouter = new Hono<{
  Bindings: Env;
  Variables: { apiKeyData: ApiKeyData; requestId: string };
}>();

schemaRouter.get("/", async (c) => {
  const result = urlSchema.safeParse({ url: c.req.query("url") });
  if (!result.success) {
    return c.json(
      {
        ok: false,
        error: { code: "BAD_REQUEST", message: "Invalid URL" },
        request_id: c.get("requestId"),
      },
      400,
    );
  }

  try {
    const metadata = await fetchMetadataWithRedirects(result.data.url);
    c.header("Cache-Control", "public, max-age=21600");
    return c.json({
      ok: true,
      data: { schema: metadata.schemaSummary || [] },
      request_id: c.get("requestId"),
    });
  } catch (err: any) {
    return c.json(
      {
        ok: false,
        error: { code: "FETCH_ERROR", message: err.message },
        request_id: c.get("requestId"),
      },
      502,
    );
  }
});
