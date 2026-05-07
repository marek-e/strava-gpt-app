import { existsSync } from "node:fs";

import { McpServer } from "skybridge/server";
import { z } from "zod";

import { analyzeActivity } from "./lib/analyze.js";
import { getRecap } from "./lib/recap.js";

if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

const server = new McpServer(
  {
    name: "strava-gpt-app",
    version: "0.0.1",
  },
  { capabilities: {} },
)
  .registerTool(
    {
      name: "get-recap",
      description:
        "Recap the user's recent runs over a period (defaults to last 7 days). Returns totals, per-run summaries, period-over-period comparison and a notable highlight.",
      inputSchema: {
        period: z
          .enum([
            "last_7_days",
            "last_30_days",
            "this_week",
            "this_month",
            "last_n_runs",
          ])
          .optional()
          .describe("Time window or count-based selection. Defaults to last_7_days."),
        count: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe("Number of runs when period === 'last_n_runs'."),
        before: z.string().optional().describe("ISO date — only include runs before this."),
        after: z.string().optional().describe("ISO date — only include runs after this."),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
      view: {
        component: "get-recap",
        description: "Strava recap card",
      },
    },
    async (input) => {
      const recap = await getRecap(input);
      return { content: [], structuredContent: recap };
    },
  )
  .registerTool(
    {
      name: "analyze-activity",
      description:
        "Analyze a single Strava run. Returns activity stats, per-km splits, HR zone distribution, notable moments and a tag (tempo/easy/long/etc.). Use after get-recap to deep-dive on a specific run.",
      inputSchema: {
        activityId: z
          .string()
          .optional()
          .describe("Strava activity id (preferred when known, e.g. from get-recap output)."),
        latest: z
          .boolean()
          .optional()
          .describe("Convenience: set true to analyze the user's most recent run."),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
      view: {
        component: "analyze-activity",
        description: "Strava activity deep-dive",
        csp: {
          // CARTO Basemaps raster tiles (a/b/c/d subdomains) for the route map.
          resourceDomains: [
            "https://a.basemaps.cartocdn.com",
            "https://b.basemaps.cartocdn.com",
            "https://c.basemaps.cartocdn.com",
            "https://d.basemaps.cartocdn.com",
          ],
        },
      },
    },
    async (input) => {
      const { output, meta } = await analyzeActivity(input);
      return { content: [], structuredContent: output, _meta: meta };
    },
  );

server.run();

export type AppType = typeof server;
