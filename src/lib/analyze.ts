/**
 * Activity-analysis module — single deep entry point for "deep-dive into a
 * single run." Owns id resolution (explicit id vs. `latest`), fetch fan-out,
 * the runs-only guard, and shaping into AnalyzeActivityOutput + meta.
 */
import {
  paceFromAvgSpeed,
  tagForActivity,
  unitsFromAthlete,
} from "./derive.js";
import {
  getActivityDetail,
  getActivityStreams,
  getActivityZones,
  getAthlete,
  listRecentRuns,
} from "./strava-api.js";
import type {
  StravaDetailedActivity,
  StravaSplit,
  StravaStreamSet,
  StravaZoneSet,
} from "./strava-types.js";
import type {
  AnalyzeActivityMeta,
  AnalyzeActivityOutput,
  HrZone,
  NotableMoment,
  Split,
} from "./types.js";

export interface AnalyzeActivityInput {
  /** Strava activity id. Preferred when known. */
  activityId?: string;
  /** When true and no `activityId` given, use the athlete's most recent run. */
  latest?: boolean;
}

export interface AnalyzeActivityResult {
  output: AnalyzeActivityOutput;
  meta: AnalyzeActivityMeta;
}

export async function analyzeActivity(
  input: AnalyzeActivityInput,
): Promise<AnalyzeActivityResult> {
  const id = await resolveActivityId(input);

  const [athlete, detail] = await Promise.all([
    getAthlete(),
    getActivityDetail(id),
  ]);

  if (detail.type !== "Run") {
    throw new Error(
      `Activity ${id} is a ${detail.type}, not a Run. v1 supports runs only.`,
    );
  }

  const [streams, zones] = await Promise.all([
    getActivityStreams(id),
    getActivityZones(id),
  ]);

  return buildAnalyzeActivity({ athlete, detail, streams, zones });
}

async function resolveActivityId(
  input: AnalyzeActivityInput,
): Promise<string> {
  if (input.activityId) return input.activityId;
  if (!input.latest) {
    throw new Error(
      "Provide an `activityId` or set `latest: true` to analyze the most recent run.",
    );
  }
  const recent = await listRecentRuns(1);
  if (recent.length === 0) {
    throw new Error("No recent runs found on this Strava account.");
  }
  return String(recent[0].id);
}

// ─── Building ────────────────────────────────────────────────────────────────

interface BuildArgs {
  athlete: Awaited<ReturnType<typeof getAthlete>>;
  detail: StravaDetailedActivity;
  streams: StravaStreamSet;
  zones: StravaZoneSet[];
}

function buildAnalyzeActivity({
  athlete,
  detail,
  streams,
  zones,
}: BuildArgs): AnalyzeActivityResult {
  const splits = buildSplits(detail.splits_metric ?? []);
  const hrZones = buildHrZones(zones);
  const elevationProfile = buildElevationProfile(streams);
  const polyline =
    detail.map?.polyline ?? detail.map?.summary_polyline ?? "";
  const notableMoments = buildNotableMoments(
    detail.splits_metric ?? [],
    streams,
  );

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

  return { output, meta: { polyline, elevationProfile } };
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
        (s.elevation_difference ?? 0) >
        (max.elevation_difference ?? -Infinity)
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
