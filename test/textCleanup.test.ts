import { describe, expect, it } from "vitest";
import {
  generateSlug,
  normalizeTitle,
  clusterKeywords,
  extractEntitiesLite,
} from "../src/services/textCleanup";

describe("Text Cleanup Services", () => {
  it("slug_case: title returns stable slug", () => {
    expect(generateSlug("Hello World! 2024")).toBe("hello-world-2024");
    expect(generateSlug("Café au Lait...")).toBe("cafe-au-lait");
    expect(generateSlug("  Trailing   Spaces  ")).toBe("trailing-spaces");
  });

  it("keyword_case: near-duplicate keywords group under one cluster", () => {
    const keywords = [
      "marketing",
      "Marketing",
      "marketng",
      "sales",
      "Sales!",
      "sale",
    ];
    const clusters = clusterKeywords(keywords);

    // Check marketing variations
    const mktingCluster =
      clusters["marketing"] || clusters["marketng"] || clusters["Marketing"];
    expect(mktingCluster.length).toBeGreaterThanOrEqual(3);

    // Check sales variations
    const salesCluster = clusters["sale"] || clusters["sales"];
    expect(salesCluster.length).toBeGreaterThanOrEqual(2);
  });

  it("normalize title correctly", () => {
    expect(normalizeTitle("the lord of the rings")).toBe(
      "The Lord of the Rings",
    );
    expect(normalizeTitle("a tale of two cities")).toBe("A Tale of Two Cities");
  });

  it("extract entities lite", () => {
    const text =
      "Contact us at info@example.com or support@company.org. Welcome to New York City.";
    const result = extractEntitiesLite(text);

    expect(result.emails).toContain("info@example.com");
    expect(result.emails).toContain("support@company.org");

    expect(result.capitalized_phrases).toContain("New York");
  });
});
