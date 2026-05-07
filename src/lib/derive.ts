import type {
  AnalyzeActivityMeta,
  AnalyzeActivityOutput,
  HrZone,
  NotableMoment,
  RecapActivity,
  RecapOutput,
  Split,
  Tag,
  Units,
} from "./types.js";
import type {
  StravaAthlete,
  StravaDetailedActivity,
  StravaSplit,
  StravaStreamSet,
  StravaSummaryActivity,
  StravaZoneSet,
} from "./strava-types.js";

const SECONDS_PER_DAY = 86_400;

// ─── Period resolution ───────────────────────────────────────────────────────

export type PeriodInput =
  | "last_7_days"
  | "last_30_days"
  | "this_week"
  | "this_month"
  | "last_n_runs";

export interface ResolvedTimeWindow {
  kind: "window";
  label: string;
  /** Unix seconds (inclusive). */
  after: number;
  /** Unix seconds (exclusive end / "now"). */
  before: number;
  prevAfter: number;
  prevBefore: number;
}

export interface ResolvedRunCount {
  kind: "count";
  label: string;
  count: number;
}

export type ResolvedPeriod = ResolvedTimeWindow | ResolvedRunCount;

export function resolvePeriod(
  period: PeriodInput | undefined,
  count: number | undefined,
  before: string | undefined,
  after: string | undefined,
): ResolvedPeriod {
  if (before || after) {
    const a = after ? Math.floor(new Date(after).getTime() / 1000) : 0;
    const b = before
      ? Math.floor(new Date(before).getTime() / 1000)
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

  switch (period ?? "last_7_days") {
    case "last_7_days": {
      const span = 7 * SECONDS_PER_DAY;
      return {
        kind: "window",
        label: "Last 7 days",
        after: now - span,
        before: now,
        prevAfter: now - 2 * span,
        prevBefore: now - span,
      };
    }
    case "last_30_days": {
      const span = 30 * SECONDS_PER_DAY;
      return {
        kind: "window",
        label: "Last 30 days",
        after: now - span,
        before: now,
        prevAfter: now - 2 * span,
        prevBefore: now - span,
      };
    }
    case "this_week": {
      const start = startOfWeekUtc(new Date(now * 1000));
      const startSec = Math.floor(start.getTime() / 1000);
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
      const prevStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1);
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
      const n = Math.max(1, Math.min(50, count ?? 10));
      return { kind: "count", label: `Last ${n} runs`, count: n };
    }
  }
}

function startOfWeekUtc(date: Date): Date {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  // ISO week: Monday = 1, Sunday = 0 → roll back to Monday.
  const day = d.getUTCDay();
  const offset = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - offset);
  return d;
}

// ─── Recap building ──────────────────────────────────────────────────────────

export function unitsFromAthlete(a: StravaAthlete): Units {
  return a.measurement_preference === "feet" ? "imperial" : "metric";
}

export function paceFromAvgSpeed(metersPerSecond: number): number {
  if (!metersPerSecond || metersPerSecond <= 0) return 0;
  return 1000 / metersPerSecond;
}

export function isRun(a: StravaSummaryActivity): boolean {
  return a.type === "Run";
}

interface BuildRecapArgs {
  athlete: StravaAthlete;
  label: string;
  start: Date;
  end: Date;
  current: StravaSummaryActivity[];
  previous: StravaSummaryActivity[];
}

export function buildRecap({
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

// ─── Tagging ─────────────────────────────────────────────────────────────────

export function tagForActivity(a: StravaSummaryActivity): Tag {
  if (a.workout_type === 1) return "race";
  if (a.workout_type === 2 || a.distance >= 16_000) return "long";

  const name = a.name.toLowerCase();
  if (/(interval|track|×|x\s*\d|repeats?)/.test(name)) return "interval";
  if (/tempo/.test(name)) return "tempo";
  if (/recovery|shakeout/.test(name)) return "recovery";
  if (/progress/.test(name)) return "progression";

  if (a.workout_type === 3) return "tempo";
  return "easy";
}

// ─── Activity deep-dive ──────────────────────────────────────────────────────

interface BuildActivityArgs {
  athlete: StravaAthlete;
  detail: StravaDetailedActivity;
  streams: StravaStreamSet;
  zones: StravaZoneSet[];
}

export function buildAnalyzeActivity({
  athlete,
  detail,
  streams,
  zones,
}: BuildActivityArgs): {
  output: AnalyzeActivityOutput;
  meta: AnalyzeActivityMeta;
} {
  const splits = buildSplits(detail.splits_metric ?? []);
  const hrZones = buildHrZones(zones);
  const elevationProfile = buildElevationProfile(streams);
  const polyline =
    detail.map?.polyline ?? detail.map?.summary_polyline ?? "";
  const notableMoments = buildNotableMoments(detail.splits_metric ?? [], streams);

  const output: AnalyzeActivityOutput = {
    athlete: { units: unitsFromAthlete(athlete) },
    activity: {
      id: String(detail.id),
      name: detail.name,
      date: detail.start_date,
      type: "Run",
      distance: detail.distance,
      movingTime: detail.moving_time,
      elapsedTime: detail.elapsed_time,
      avgPace: paceFromAvgSpeed(detail.average_speed),
      avgHr: detail.average_heartrate ?? null,
      maxHr: detail.max_heartrate ?? null,
      elevationGain: detail.total_elevation_gain,
      calories: detail.calories ?? null,
      startLatLng: detail.start_latlng ?? [0, 0],
    },
    splits,
    hrZones,
    notableMoments,
    tag: tagForActivity(detail),
  };

  return {
    output,
    meta: { polyline, elevationProfile },
  };
}

function buildSplits(splits: StravaSplit[]): Split[] {
  return splits.map((s) => ({
    km: s.split,
    pace: paceFromAvgSpeed(s.average_speed),
    hr: s.average_heartrate ?? null,
    elevationDelta: Math.round(s.elevation_difference ?? 0),
  }));
}

function buildHrZones(zones: StravaZoneSet[]): HrZone[] {
  const hr = zones.find((z) => z.type === "heartrate");
  if (!hr || !hr.distribution_buckets?.length) return [];
  const buckets = hr.distribution_buckets.slice(0, 5);
  const total = buckets.reduce((sum, b) => sum + b.time, 0);
  if (total === 0) return [];
  return buckets.map((b, i) => ({
    zone: (i + 1) as 1 | 2 | 3 | 4 | 5,
    seconds: b.time,
    percent: +((b.time / total) * 100).toFixed(1),
  }));
}

function buildElevationProfile(streams: StravaStreamSet) {
  const dist = streams.distance?.data;
  const alt = streams.altitude?.data;
  if (!dist || !alt || dist.length !== alt.length || dist.length === 0) {
    return [];
  }

  const TARGET_POINTS = 80;
  const stride = Math.max(1, Math.floor(dist.length / TARGET_POINTS));
  const points: Array<{ distance: number; elevation: number }> = [];
  for (let i = 0; i < dist.length; i += stride) {
    points.push({
      distance: Math.round(dist[i]),
      elevation: Math.round(alt[i]),
    });
  }
  // Always include the final point so the chart doesn't visually truncate.
  const last = dist.length - 1;
  if (points[points.length - 1]?.distance !== Math.round(dist[last])) {
    points.push({
      distance: Math.round(dist[last]),
      elevation: Math.round(alt[last]),
    });
  }
  return points;
}

function buildNotableMoments(
  splits: StravaSplit[],
  streams: StravaStreamSet,
): NotableMoment[] {
  const out: NotableMoment[] = [];

  if (splits.length > 0) {
    const fastest = splits.reduce((min, s) =>
      s.moving_time < min.moving_time ? s : min,
    );
    const fastestPace = paceFromAvgSpeed(fastest.average_speed);
    out.push({
      kind: "fastest_km",
      distance: fastest.split * 1000,
      label: `Fastest km — ${formatPaceTerse(fastestPace)} at km ${fastest.split}`,
    });

    const climber = splits.reduce(
      (max, s) =>
        (s.elevation_difference ?? 0) > (max.elevation_difference ?? -Infinity)
          ? s
          : max,
      splits[0],
    );
    if ((climber.elevation_difference ?? 0) >= 10) {
      out.push({
        kind: "biggest_climb",
        distance: climber.split * 1000,
        label: `Biggest climb — +${Math.round(climber.elevation_difference)} m at km ${climber.split}`,
      });
    }
  }

  const hr = streams.heartrate?.data;
  const dist = streams.distance?.data;
  if (hr && dist && hr.length === dist.length && hr.length > 0) {
    let peakIdx = 0;
    for (let i = 1; i < hr.length; i++) if (hr[i] > hr[peakIdx]) peakIdx = i;
    const peakKm = (dist[peakIdx] / 1000).toFixed(1);
    out.push({
      kind: "hr_spike",
      distance: Math.round(dist[peakIdx]),
      label: `HR peaked at ${hr[peakIdx]} bpm at km ${peakKm}`,
    });
  }

  return out;
}

function formatPaceTerse(secondsPerKm: number): string {
  const m = Math.floor(secondsPerKm / 60);
  const s = Math.round(secondsPerKm % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
