import { existsSync } from "node:fs";

import { McpServer } from "skybridge/server";
import { z } from "zod";

import {
  buildAnalyzeActivity,
  buildRecap,
  isRun,
  resolvePeriod,
} from "./lib/derive.js";
import {
  getActivityDetail,
  getActivityStreams,
  getActivityZones,
  getAthlete,
  listActivitiesByWindow,
  listRecentRuns,
} from "./lib/strava-api.js";

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
    async ({ period, count, before, after }) => {
      const resolved = resolvePeriod(period, count, before, after);
      const athlete = await getAthlete();

      if (resolved.kind === "window") {
        const [current, previous] = await Promise.all([
          listActivitiesByWindow(resolved.after, resolved.before),
          listActivitiesByWindow(resolved.prevAfter, resolved.prevBefore),
        ]);
        const recap = buildRecap({
          athlete,
          label: resolved.label,
          start: new Date(resolved.after * 1000),
          end: new Date(resolved.before * 1000),
          current: current.filter(isRun),
          previous: previous.filter(isRun),
        });
        return { content: [], structuredContent: recap };
      }

      // last_n_runs: paginate enough to cover current + previous N runs.
      const runs = await listRecentRuns(resolved.count * 2);
      const current = runs.slice(0, resolved.count);
      const previous = runs.slice(resolved.count, resolved.count * 2);

      const start =
        current.length > 0
          ? new Date(current[current.length - 1].start_date)
          : new Date();
      const end =
        current.length > 0 ? new Date(current[0].start_date) : new Date();

      const recap = buildRecap({
        athlete,
        label: resolved.label,
        start,
        end,
        current,
        previous,
      });
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
      },
    },
    async ({ activityId, latest }) => {
      let resolvedId = activityId;
      if (!resolvedId) {
        if (!latest) {
          throw new Error(
            "Provide an `activityId` or set `latest: true` to analyze the most recent run.",
          );
        }
        const recent = await listRecentRuns(1);
        if (recent.length === 0) {
          throw new Error("No recent runs found on this Strava account.");
        }
        resolvedId = String(recent[0].id);
      }

      const [athlete, detail] = await Promise.all([
        getAthlete(),
        getActivityDetail(resolvedId),
      ]);

      if (detail.type !== "Run") {
        throw new Error(
          `Activity ${resolvedId} is a ${detail.type}, not a Run. v1 supports runs only.`,
        );
      }

      const [streams, zones] = await Promise.all([
        getActivityStreams(resolvedId),
        getActivityZones(resolvedId),
      ]);

      const { output, meta } = buildAnalyzeActivity({
        athlete,
        detail,
        streams,
        zones,
      });

      return {
        content: [],
        structuredContent: output,
        _meta: meta,
      };
    },
  );

server.run();

export type AppType = typeof server;
