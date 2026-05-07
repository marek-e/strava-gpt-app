import { env } from "./env.js";

const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";

/**
 * Strava token-refresh response shape (subset). `expires_at` is Unix seconds.
 * Strava also returns a fresh `refresh_token` on each refresh — current
 * tokens don't rotate in practice, but the API reserves the right to.
 */
interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in: number;
  token_type: string;
}

interface CachedToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix seconds.
}

let cached: CachedToken | null = null;
let inFlight: Promise<CachedToken> | null = null;

/** Refresh ~60s early to avoid handing out tokens that expire mid-request. */
const REFRESH_LEEWAY_S = 60;

function isFresh(token: CachedToken | null): token is CachedToken {
  if (!token) return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return token.expiresAt - REFRESH_LEEWAY_S > nowSeconds;
}

async function refresh(): Promise<CachedToken> {
  const refreshToken = cached?.refreshToken ?? env.stravaRefreshToken;

  const params = new URLSearchParams({
    client_id: env.stravaClientId,
    client_secret: env.stravaClientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const res = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Strava token refresh failed: ${res.status} ${res.statusText} — ${body}`,
    );
  }

  const data = (await res.json()) as StravaTokenResponse;
  cached = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
  };
  return cached;
}

/**
 * Returns a valid Strava access token. Concurrent callers share the same
 * in-flight refresh promise so we don't burn rate-limit on parallel refreshes.
 */
export async function getStravaAccessToken(force = false): Promise<string> {
  if (!force && isFresh(cached)) return cached.accessToken;

  if (!inFlight) {
    inFlight = refresh().finally(() => {
      inFlight = null;
    });
  }

  const fresh = await inFlight;
  return fresh.accessToken;
}

/** Test hook — clear cache so next call re-reads env / hits Strava. */
export function __resetStravaAuthForTests() {
  cached = null;
  inFlight = null;
}
