/**
 * Recap module — single deep entry point for "summarize the athlete's runs
 * over a period." Owns period resolution (window/count), comparison-window
 * math, fetch fan-out, and shaping into RecapOutput.
 */
import {
  isRun,
  paceFromAvgSpeed,
  tagForActivity,
  unitsFromAthlete,
} from "./derive.js";
import {
  getAthlete,
  listActivitiesByWindow,
  listRecentRuns,
} from "./strava-api.js";
import type {
  StravaAthlete,
  StravaSummaryActivity,
} from "./strava-types.js";
import type { RecapActivity, RecapOutput } from "./types.js";

export interface RecapInput {
  period?:
    | "last_7_days"
    | "last_30_days"
    | "this_week"
    | "this_month"
    | "last_n_runs";
  count?: number;
  /** ISO date — overrides `period` when provided. */
  before?: string;
  /** ISO date — overrides `period` when provided. */
  after?: string;
}

export async function getRecap(input: RecapInput): Promise<RecapOutput> {
  const plan = planRecap(input);
  const athlete = await getAthlete();

  if (plan.kind === "window") {
    const [current, previous] = await Promise.all([
      listActivitiesByWindow(plan.after, plan.before),
      listActivitiesByWindow(plan.prevAfter, plan.prevBefore),
    ]);
    return buildRecap({
      athlete,
      label: plan.label,
      start: new Date(plan.after * 1000),
      end: new Date(plan.before * 1000),
      current: current.filter(isRun),
      previous: previous.filter(isRun),
    });
  }

  // Count-based: paginate enough recent runs to cover both halves of the
  // current/previous comparison.
  const runs = await listRecentRuns(plan.count * 2);
  const current = runs.slice(0, plan.count);
  const previous = runs.slice(plan.count, plan.count * 2);

  const start =
    current.length > 0
      ? new Date(current[current.length - 1].start_date)
      : new Date();
  const end =
    current.length > 0 ? new Date(current[0].start_date) : new Date();

  return buildRecap({
    athlete,
    label: plan.label,
    start,
    end,
    current,
    previous,
  });
}

// ─── Planning ────────────────────────────────────────────────────────────────
//
// The plan shape is private — callers don't need to know whether a recap is
// served by a time window or a count-based paginate.

const SECONDS_PER_DAY = 86_400;

interface RecapWindowPlan {
  kind: "window";
  label: string;
  after: number;
  before: number;
  prevAfter: number;
  prevBefore: number;
}

interface RecapCountPlan {
  kind: "count";
  label: string;
  count: number;
}

type RecapPlan = RecapWindowPlan | RecapCountPlan;

function planRecap(input: RecapInput): RecapPlan {
  if (input.before || input.after) {
    const a = input.after
      ? Math.floor(new Date(input.after).getTime() / 1000)
      : 0;
    const b = input.before
      ? Math.floor(new Date(input.before).getTime() / 1000)
      : Math.floor(Date.now() / 1000);
    const span = b - a;
    return {
      kind: "window",
      label: "Custom range",
      after: a,
      before: b,
      prevAfter: a - span,
      prevBefore: a,
    };
  }

  const now = Math.floor(Date.now() / 1000);

  switch (input.period ?? "last_7_days") {
    case "last_7_days":
      return rollingWindow("Last 7 days", now, 7);
    case "last_30_days":
      return rollingWindow("Last 30 days", now, 30);
    case "this_week": {
      const startSec = Math.floor(
        startOfWeekUtc(new Date(now * 1000)).getTime() / 1000,
      );
      const span = 7 * SECONDS_PER_DAY;
      return {
        kind: "window",
        label: "This week",
        after: startSec,
        before: now,
        prevAfter: startSec - span,
        prevBefore: startSec,
      };
    }
    case "this_month": {
      const d = new Date(now * 1000);
      const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
      const prevStart = Date.UTC(
        d.getUTCFullYear(),
        d.getUTCMonth() - 1,
        1,
      );
      return {
        kind: "window",
        label: "This month",
        after: Math.floor(start / 1000),
        before: now,
        prevAfter: Math.floor(prevStart / 1000),
        prevBefore: Math.floor(start / 1000),
      };
    }
    case "last_n_runs": {
      const n = Math.max(1, Math.min(50, input.count ?? 10));
      return { kind: "count", label: `Last ${n} runs`, count: n };
    }
  }
}

function rollingWindow(
  label: string,
  now: number,
  days: number,
): RecapWindowPlan {
  const span = days * SECONDS_PER_DAY;
  return {
    kind: "window",
    label,
    after: now - span,
    before: now,
    prevAfter: now - 2 * span,
    prevBefore: now - span,
  };
}

function startOfWeekUtc(date: Date): Date {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = d.getUTCDay();
  const offset = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - offset);
  return d;
}

// ─── Building ────────────────────────────────────────────────────────────────

interface BuildRecapArgs {
  athlete: StravaAthlete;
  label: string;
  start: Date;
  end: Date;
  current: StravaSummaryActivity[];
  previous: StravaSummaryActivity[];
}

function buildRecap({
  athlete,
  label,
  start,
  end,
  current,
  previous,
}: BuildRecapArgs): RecapOutput {
  const totals = sumTotals(current);
  const prevTotals = sumTotals(previous);

  const activities: RecapActivity[] = current
    .map(toRecapActivity)
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));

  return {
    athlete: { units: unitsFromAthlete(athlete) },
    period: {
      label,
      start: start.toISOString(),
      end: end.toISOString(),
    },
    totals,
    comparison: {
      previous: {
        distance: prevTotals.distance,
        movingTime: prevTotals.movingTime,
        elevationGain: prevTotals.elevationGain,
      },
      delta: {
        distance: totals.distance - prevTotals.distance,
        movingTime: totals.movingTime - prevTotals.movingTime,
      },
    },
    activities,
    // HR-zone aggregation across a period requires N extra `/zones` calls
    // (N = run count). Skipped in v1 to stay under Strava's rate limit; the
    // view degrades gracefully when this is empty.
    hrZones: [],
    highlight: buildHighlight(activities, athlete),
  };
}

function sumTotals(runs: StravaSummaryActivity[]) {
  return runs.reduce(
    (acc, a) => ({
      runs: acc.runs + 1,
      distance: acc.distance + a.distance,
      movingTime: acc.movingTime + a.moving_time,
      elevationGain: acc.elevationGain + a.total_elevation_gain,
    }),
    { runs: 0, distance: 0, movingTime: 0, elevationGain: 0 },
  );
}

function toRecapActivity(a: StravaSummaryActivity): RecapActivity {
  return {
    id: String(a.id),
    date: a.start_date,
    name: a.name,
    distance: a.distance,
    movingTime: a.moving_time,
    avgPace: paceFromAvgSpeed(a.average_speed),
    elevationGain: a.total_elevation_gain,
    tag: tagForActivity(a),
  };
}

function buildHighlight(
  activities: RecapActivity[],
  athlete: StravaAthlete,
): string {
  if (activities.length === 0) return "No runs in this period.";
  const longest = activities.reduce((max, a) =>
    a.distance > max.distance ? a : max,
  );
  if (activities.length === 1) {
    return `Single run: ${longest.name}.`;
  }
  const km =
    athlete.measurement_preference === "feet"
      ? `${(longest.distance / 1609.344).toFixed(1)} mi`
      : `${(longest.distance / 1000).toFixed(1)} km`;
  return `Longest run: ${longest.name} — ${km}.`;
}
