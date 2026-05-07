import { getStravaAccessToken } from "./strava-auth.js";

const STRAVA_API_BASE = "https://www.strava.com/api/v3";

export class StravaApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly body: string,
    public readonly url: string,
  ) {
    super(`Strava API ${status} ${statusText} on ${url}: ${body}`);
    this.name = "StravaApiError";
  }
}

export class StravaRateLimitError extends StravaApiError {
  constructor(
    status: number,
    statusText: string,
    body: string,
    url: string,
    public readonly limit15Min?: number,
    public readonly limitDaily?: number,
    public readonly usage15Min?: number,
    public readonly usageDaily?: number,
  ) {
    super(status, statusText, body, url);
    this.name = "StravaRateLimitError";
  }
}

interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined>;
  /** Internal — set on the auto-retry to avoid infinite loops on a stuck token. */
  _isRetry?: boolean;
}

/**
 * Authenticated GET to Strava's REST API.
 *
 * - Auto-injects the refreshed access token.
 * - On 401 once, force-refreshes and retries (covers tokens revoked mid-cache).
 * - Throws `StravaRateLimitError` on 429 with parsed usage headers so callers
 *   can surface a friendly state in the view.
 */
export async function stravaGet<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const url = new URL(STRAVA_API_BASE + path);
  if (options.query) {
    for (const [k, v] of Object.entries(options.query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  const accessToken = await getStravaAccessToken(options._isRetry === true);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.ok) {
    return (await res.json()) as T;
  }

  const body = await res.text().catch(() => "");

  if (res.status === 401 && !options._isRetry) {
    return stravaGet<T>(path, { ...options, _isRetry: true });
  }

  if (res.status === 429) {
    const limit = parseUsageHeader(res.headers.get("x-ratelimit-limit"));
    const usage = parseUsageHeader(res.headers.get("x-ratelimit-usage"));
    throw new StravaRateLimitError(
      res.status,
      res.statusText,
      body,
      url.toString(),
      limit?.[0],
      limit?.[1],
      usage?.[0],
      usage?.[1],
    );
  }

  throw new StravaApiError(res.status, res.statusText, body, url.toString());
}

/** Strava sends usage / limit headers as "short,daily", e.g. "100,1000". */
function parseUsageHeader(value: string | null): [number, number] | undefined {
  if (!value) return undefined;
  const [a, b] = value.split(",").map((n) => Number.parseInt(n.trim(), 10));
  if (Number.isNaN(a) || Number.isNaN(b)) return undefined;
  return [a, b];
}
