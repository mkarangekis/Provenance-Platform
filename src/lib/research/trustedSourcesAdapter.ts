type SourceCitation = {
  url: string;
  retrieved_at: string;
  snippet: string;
};

type SourceResult = {
  source: string;
  verified: boolean;
  citations: SourceCitation[];
  note?: string;
};

function envTruthy(value: unknown): boolean {
  if (value == null) return false;
  const v = String(value).trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function parseAllowlist(): string[] {
  return String(process.env.TRUSTED_SOURCES_ALLOWLIST || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function hostAllowed(url: string, allowlist: string[]): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return allowlist.some((entry) => host === entry || host.endsWith(`.${entry}`));
  } catch {
    return false;
  }
}

async function fetchJson(url: string, timeoutMs = 8000): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchTrustedSources(query: string): Promise<SourceResult[]> {
  const enabled = envTruthy(process.env.TRUSTED_SOURCES_ENABLED);
  if (!enabled) {
    return [
      {
        source: "trusted_sources_adapter",
        verified: false,
        citations: [],
        note: "Unverified: trusted external sources are disabled.",
      },
    ];
  }

  const allowlist = parseAllowlist();
  const citations: SourceResult[] = [];
  const retrievedAt = new Date().toISOString();

  const metSearchUrl = `https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=${encodeURIComponent(
    query
  )}`;
  if (hostAllowed(metSearchUrl, allowlist)) {
    const metSearch = (await fetchJson(metSearchUrl)) as { objectIDs?: number[] } | null;
    const objectId = metSearch?.objectIDs?.[0];
    if (objectId) {
      const objectUrl = `https://collectionapi.metmuseum.org/public/collection/v1/objects/${objectId}`;
      const object = (await fetchJson(objectUrl)) as { title?: string; artistDisplayName?: string } | null;
      citations.push({
        source: "metmuseum.org",
        verified: true,
        citations: [
          {
            url: objectUrl,
            retrieved_at: retrievedAt,
            snippet: object
              ? `${object.artistDisplayName || "Unknown artist"} - ${object.title || "Untitled"}`
              : "Met Museum object metadata",
          },
        ],
      });
    }
  }

  const articUrl = `https://api.artic.edu/api/v1/artworks/search?q=${encodeURIComponent(
    query
  )}&fields=id,title,artist_title,api_link&limit=1`;
  if (hostAllowed(articUrl, allowlist)) {
    const artic = (await fetchJson(articUrl)) as {
      data?: Array<{ title?: string; artist_title?: string; api_link?: string }>;
    } | null;
    const top = artic?.data?.[0];
    if (top?.api_link) {
      citations.push({
        source: "artic.edu",
        verified: true,
        citations: [
          {
            url: top.api_link,
            retrieved_at: retrievedAt,
            snippet: `${top.artist_title || "Unknown artist"} - ${top.title || "Untitled"}`,
          },
        ],
      });
    }
  }

  if (!citations.length) {
    return [
      {
        source: "trusted_sources_adapter",
        verified: false,
        citations: [],
        note: "Unverified: no allowlisted citations returned.",
      },
    ];
  }

  return citations;
}

export type { SourceCitation, SourceResult };
