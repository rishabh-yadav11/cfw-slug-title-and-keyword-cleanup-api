import { checkSSRF } from "../utils/ssrf";

export interface Metadata {
  title?: string;
  description?: string;
  og?: Record<string, string>;
  canonical?: string;
  lang?: string;
  favicon?: string;
  robots?: string;
  schemaSummary?: any[];
}

export const fetchPage = async (urlStr: string) => {
  // Check SSRF
  const isSafe = await checkSSRF(urlStr);
  if (!isSafe) {
    throw new Error(
      "SSRF_GUARD_BLOCK: Invalid or blocked URL scheme/destination",
    );
  }

  // AbortController for 8s timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(urlStr, {
      redirect: "manual", // handle up to 5 manual redirects
      headers: {
        "User-Agent": "MetadataBot/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Limit body size fetching up to 2MB (we use a custom transform stream or slice the buffer)
    // Cloudflare HTMLRewriter stream processing works nicely for parsing without loading all in memory
    return response;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error("FETCH_TIMEOUT: Request exceeded 8s timeout");
    }
    throw err;
  }
};

export const fetchMetadataWithRedirects = async (
  urlStr: string,
  redirects: number = 0,
): Promise<Metadata> => {
  if (redirects > 5) {
    throw new Error("TOO_MANY_REDIRECTS");
  }

  const response = await fetchPage(urlStr);

  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get("location");
    if (location) {
      const nextUrl = new URL(location, urlStr).toString();
      return fetchMetadataWithRedirects(nextUrl, redirects + 1);
    }
  }

  if (!response.ok) {
    throw new Error(`FETCH_FAILED: Status ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (
    !contentType.includes("text/html") &&
    !contentType.includes("application/xhtml+xml")
  ) {
    throw new Error("INVALID_CONTENT_TYPE: Not an HTML document");
  }

  const metadata: Metadata = { og: {}, schemaSummary: [] };
  let jsonLdContent = "";

  const rewriter = new HTMLRewriter()
    .on("html", {
      element(e) {
        metadata.lang = e.getAttribute("lang") || undefined;
      },
    })
    .on("title", {
      text(text) {
        metadata.title = (metadata.title || "") + text.text;
      },
    })
    .on('meta[name="description"]', {
      element(e) {
        metadata.description = e.getAttribute("content") || undefined;
      },
    })
    .on('meta[property^="og:"]', {
      element(e) {
        const prop = e.getAttribute("property");
        const content = e.getAttribute("content");
        if (prop && content && metadata.og) {
          metadata.og[prop.substring(3)] = content;
        }
      },
    })
    .on('link[rel="canonical"]', {
      element(e) {
        metadata.canonical = e.getAttribute("href") || undefined;
      },
    })
    .on('link[rel~="icon"]', {
      element(e) {
        const href = e.getAttribute("href");
        if (href) {
          metadata.favicon = new URL(href, urlStr).toString();
        }
      },
    })
    .on('meta[name="robots"]', {
      element(e) {
        metadata.robots = e.getAttribute("content") || undefined;
      },
    })
    .on('script[type="application/ld+json"]', {
      text(text) {
        jsonLdContent += text.text;
      },
    });

  // Limit response body stream to 2MB to prevent large memory consumption
  let totalBytes = 0;
  const MAX_BYTES = 2 * 1024 * 1024;

  const { readable, writable } = new TransformStream();
  response.body?.pipeTo(writable);

  const limitedReader = readable.getReader();
  const limitedStream = new ReadableStream({
    async pull(controller) {
      const { done, value } = await limitedReader.read();
      if (done) {
        controller.close();
        return;
      }
      totalBytes += value.byteLength;
      if (totalBytes > MAX_BYTES) {
        controller.close();
        limitedReader.cancel();
      } else {
        controller.enqueue(value);
      }
    },
  });

  const parsedResponse = new Response(limitedStream, response);
  const rewritten = rewriter.transform(parsedResponse);

  // Actually consume the stream to apply rewriter
  await rewritten.text();

  if (jsonLdContent) {
    try {
      const parsed = JSON.parse(jsonLdContent);
      metadata.schemaSummary = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      // Ignored malformed JSON-LD
    }
  }

  // Default fallback for favicon
  if (!metadata.favicon) {
    metadata.favicon = new URL("/favicon.ico", urlStr).toString();
  }

  return metadata;
};
