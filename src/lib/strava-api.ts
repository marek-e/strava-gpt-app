import { TtlCache } from "./cache.js";
import { stravaGet, StravaApiError } from "./strava-client.js";
import type {
  StravaAthlete,
  StravaDetailedActivity,
  StravaStreamSet,
  StravaSummaryActivity,
  StravaZoneSet,
} from "./strava-types.js";

const ONE_MINUTE = 60_000;
const FIVE_MINUTES = 5 * ONE_MINUTE;
const ONE_DAY = 24 * 60 * ONE_MINUTE;

const athleteCache = new TtlCache<StravaAthlete>();
const activityListCache = new TtlCache<StravaSummaryActivity[]>();
const activityDetailCache = new TtlCache<StravaDetailedActivity>();
const streamCache = new TtlCache<StravaStreamSet>();
const zoneCache = new TtlCache<StravaZoneSet[]>();

export async function getAthlete(): Promise<StravaAthlete> {
  return athleteCache.getOrLoad("self", ONE_DAY, () =>
    stravaGet<StravaAthlete>("/athlete"),
  );
}

/**
 * List activities in a time window. `after` / `before` are Unix seconds.
 * Strava caps `per_page` at 200; we fetch a single page (sufficient for any
 * realistic 7–30 day window). Cache 5 min — recap re-runs hit RAM.
 */
export async function listActivitiesByWindow(
  after: number,
  before: number,
): Promise<StravaSummaryActivity[]> {
  const key = `window:${after}:${before}`;
  return activityListCache.getOrLoad(key, FIVE_MINUTES, () =>
    stravaGet<StravaSummaryActivity[]>("/athlete/activities", {
      query: { after, before, per_page: 200 },
    }),
  );
}

/**
 * Paginate activities backwards from `before` (or now) until at least
 * `minRuns` Run-type activities have been collected, or Strava runs out.
 * Used by `last_n_runs` and the matching previous-N-runs comparison.
 */
export async function listRecentRuns(
  minRuns: number,
  before?: number,
): Promise<StravaSummaryActivity[]> {
  const runs: StravaSummaryActivity[] = [];
  let cursorBefore = before ?? Math.floor(Date.now() / 1000);
  const PER_PAGE = 100;
  const HARD_PAGE_CAP = 5; // = 500 activities; way past any v1 use case.

  for (let page = 0; page < HARD_PAGE_CAP; page++) {
    const key = `recent:${cursorBefore}:p${PER_PAGE}`;
    const batch = await activityListCache.getOrLoad(key, FIVE_MINUTES, () =>
      stravaGet<StravaSummaryActivity[]>("/athlete/activities", {
        query: { before: cursorBefore, per_page: PER_PAGE },
      }),
    );
    if (batch.length === 0) break;

    for (const a of batch) if (a.type === "Run") runs.push(a);
    if (runs.length >= minRuns) break;

    const oldest = batch[batch.length - 1];
    const next = Math.floor(new Date(oldest.start_date).getTime() / 1000) - 1;
    if (next >= cursorBefore) break; // safety: timestamps not advancing.
    cursorBefore = next;
  }

  return runs;
}

export async function getActivityDetail(
  activityId: string,
): Promise<StravaDetailedActivity> {
  return activityDetailCache.getOrLoad(activityId, Infinity, () =>
    stravaGet<StravaDetailedActivity>(`/activities/${activityId}`),
  );
}

export async function getActivityStreams(
  activityId: string,
): Promise<StravaStreamSet> {
  return streamCache.getOrLoad(activityId, Infinity, async () => {
    try {
      return await stravaGet<StravaStreamSet>(
        `/activities/${activityId}/streams`,
        { query: { keys: "distance,altitude,heartrate", key_by_type: true } },
      );
    } catch (err) {
      // Treadmill / GPS-off / pre-stream activities → no stream data.
      if (err instanceof StravaApiError && err.status === 404) return {};
      throw err;
    }
  });
}

/**
 * Activity HR zones. Returns `[]` (not an error) if Strava can't compute them
 * (no HR data, free account limitation, etc.) so callers can degrade silently.
 */
export async function getActivityZones(
  activityId: string,
): Promise<StravaZoneSet[]> {
  return zoneCache.getOrLoad(activityId, Infinity, async () => {
    try {
      return await stravaGet<StravaZoneSet[]>(
        `/activities/${activityId}/zones`,
      );
    } catch (err) {
      if (
        err instanceof StravaApiError &&
        (err.status === 404 || err.status === 401)
      ) {
        return [];
      }
      throw err;
    }
  });
}
