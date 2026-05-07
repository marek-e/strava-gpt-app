/**
 * One-time helper to obtain a Strava refresh token for v1 single-athlete use.
 *
 * Usage:
 *   1. Create a Strava API app at https://www.strava.com/settings/api
 *      → Set "Authorization Callback Domain" to `localhost`.
 *   2. Add `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET` to `.env`.
 *   3. Run `pnpm bootstrap:strava`. A browser tab opens; sign in.
 *   4. Paste the printed `STRAVA_REFRESH_TOKEN` into `.env`.
 *
 * Strava personal API tokens don't expire as long as the refresh token works.
 * If you ever revoke access at Strava, re-run this script.
 */
import { createServer } from "node:http";
import { exec } from "node:child_process";
import { platform } from "node:os";

process.loadEnvFile(".env");

const PORT = 8420;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const SCOPE = "read,activity:read_all,profile:read_all";

const clientId = process.env.STRAVA_CLIENT_ID;
const clientSecret = process.env.STRAVA_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error(
    "Missing STRAVA_CLIENT_ID or STRAVA_CLIENT_SECRET in .env.\n" +
      "→ Create your app at https://www.strava.com/settings/api, then add credentials to .env.",
  );
  process.exit(1);
}

const authorizeUrl = new URL("https://www.strava.com/oauth/authorize");
authorizeUrl.searchParams.set("client_id", clientId);
authorizeUrl.searchParams.set("response_type", "code");
authorizeUrl.searchParams.set("redirect_uri", REDIRECT_URI);
authorizeUrl.searchParams.set("approval_prompt", "force");
authorizeUrl.searchParams.set("scope", SCOPE);

const server = createServer(async (req, res) => {
  if (!req.url?.startsWith("/callback")) {
    res.writeHead(404).end();
    return;
  }
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error || !code) {
    res
      .writeHead(400, { "Content-Type": "text/html" })
      .end(`<h1>Authorization failed</h1><pre>${error ?? "no code"}</pre>`);
    console.error("Authorization failed:", error ?? "no code returned");
    server.close();
    process.exit(1);
  }

  try {
    const tokenRes = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
      }).toString(),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      throw new Error(`Strava token exchange ${tokenRes.status}: ${body}`);
    }

    const data = (await tokenRes.json()) as {
      refresh_token: string;
      access_token: string;
      expires_at: number;
      athlete: { id: number; firstname: string; lastname: string };
    };

    res.writeHead(200, { "Content-Type": "text/html" }).end(
      `<h1>All set, ${data.athlete.firstname}</h1>
       <p>You can close this tab. The refresh token is in your terminal.</p>`,
    );

    console.log("\n--- Strava bootstrap success ---");
    console.log(`Athlete:        ${data.athlete.firstname} ${data.athlete.lastname} (id ${data.athlete.id})`);
    console.log(`Access token:   ${data.access_token.slice(0, 8)}… (expires_at ${data.expires_at})`);
    console.log("\nAdd this line to .env:\n");
    console.log(`STRAVA_REFRESH_TOKEN=${data.refresh_token}\n`);

    server.close();
    process.exit(0);
  } catch (err) {
    res
      .writeHead(500, { "Content-Type": "text/html" })
      .end(`<h1>Token exchange failed</h1><pre>${(err as Error).message}</pre>`);
    console.error(err);
    server.close();
    process.exit(1);
  }
});

server.listen(PORT, () => {
  console.log(`Listening on ${REDIRECT_URI}`);
  console.log(`Opening browser → ${authorizeUrl.toString()}\n`);
  openBrowser(authorizeUrl.toString());
});

function openBrowser(url: string) {
  const cmd =
    platform() === "darwin"
      ? `open "${url}"`
      : platform() === "win32"
        ? `start "" "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, (err) => {
    if (err) console.log(`(could not auto-open browser; visit the URL above)`);
  });
}
