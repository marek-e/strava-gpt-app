/**
 * Strava credentials are required at runtime — fail loudly if missing so we
 * don't get cryptic 401s from the Strava API later.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.length === 0) {
    throw new Error(
      `Missing required env var ${name}. See README "Strava setup" — run \`pnpm bootstrap:strava\` to obtain a refresh token.`,
    );
  }
  return value;
}

export const env = {
  get stravaClientId() {
    return required("STRAVA_CLIENT_ID");
  },
  get stravaClientSecret() {
    return required("STRAVA_CLIENT_SECRET");
  },
  get stravaRefreshToken() {
    return required("STRAVA_REFRESH_TOKEN");
  },
};
