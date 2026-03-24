export function generateSlug(text: string): string {
  return text
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, "-");
}

export function normalizeTitle(text: string): string {
  const words = text.trim().replace(/\s+/g, " ").split(" ");

  const lowerCaseWords = new Set([
    "a",
    "an",
    "the",
    "and",
    "but",
    "or",
    "for",
    "nor",
    "on",
    "at",
    "to",
    "from",
    "by",
    "with",
    "in",
    "of",
  ]);

  return words
    .map((word, index) => {
      if (index > 0 && lowerCaseWords.has(word.toLowerCase())) {
        return word.toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

// Levenshtein distance for fuzzy clustering
function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1,
          ),
        ); // deletion
      }
    }
  }

  return matrix[b.length][a.length];
}

export function clusterKeywords(keywords: string[]): Record<string, string[]> {
  const clusters: Record<string, string[]> = {};

  // Sort by length to use the shortest as the primary key if multiple match
  const sortedKeywords = [...keywords].sort((a, b) => a.length - b.length);
  const processed = new Set<string>();

  for (const k1 of sortedKeywords) {
    if (processed.has(k1)) continue;

    const clusterGroup = [k1];
    processed.add(k1);

    for (const k2 of sortedKeywords) {
      if (processed.has(k2)) continue;

      const dist = levenshtein(k1.toLowerCase(), k2.toLowerCase());
      // Cluster if they are very similar (e.g., typos, plurals)
      if (
        dist <= 2 ||
        k1.toLowerCase() === k2.toLowerCase() ||
        k2.toLowerCase().includes(k1.toLowerCase())
      ) {
        clusterGroup.push(k2);
        processed.add(k2);
      }
    }

    clusters[k1] = clusterGroup;
  }

  return clusters;
}

export function extractEntitiesLite(text: string) {
  // Extract emails
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = text.match(emailRegex) || [];

  // Extract simple capitalized phrases (2 or more capitalized words)
  const capRegex = /\b[A-Z][a-z]+\s[A-Z][a-z]+\b/g;
  const phrases = text.match(capRegex) || [];

  return {
    emails: Array.from(new Set(emails)),
    capitalized_phrases: Array.from(new Set(phrases)),
  };
}
