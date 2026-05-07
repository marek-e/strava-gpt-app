/**
 * Subset of Strava API response shapes — only the fields we actually consume.
 * See https://developers.strava.com/docs/reference/.
 */

export interface StravaAthlete {
  id: number;
  firstname: string;
  lastname: string;
  /** "meters" → metric, "feet" → imperial. */
  measurement_preference: "meters" | "feet";
}

export interface StravaSummaryActivity {
  id: number;
  name: string;
  type: string;
  /** ISO 8601 in athlete's local TZ awareness varies — use `start_date` (UTC). */
  start_date: string;
  /** Meters. */
  distance: number;
  /** Seconds. */
  moving_time: number;
  elapsed_time: number;
  /** Meters. */
  total_elevation_gain: number;
  /** m/s. */
  average_speed: number;
  average_heartrate?: number;
  max_heartrate?: number;
  /**
   * Strava classifies non-default workouts. For runs:
   * 0 = default, 1 = race, 2 = long_run, 3 = workout.
   */
  workout_type?: number | null;
  /** [lat, lng] of start, may be null for treadmill / GPS-off. */
  start_latlng?: [number, number] | null;
  map?: {
    id: string;
    /** Encoded polyline. May be empty when GPS unavailable. */
    summary_polyline?: string | null;
    polyline?: string | null;
  };
}

export interface StravaDetailedActivity extends StravaSummaryActivity {
  calories?: number;
  /** Per-km splits (only present for runs). */
  splits_metric?: StravaSplit[];
  /** Strava's "best efforts" — fastest 1k/5k/etc. Not used in v1. */
  best_efforts?: unknown[];
  description?: string | null;
}

export interface StravaSplit {
  /** 1-indexed split number. */
  split: number;
  /** Meters in this split (≈1000 for metric splits, last may be shorter). */
  distance: number;
  elapsed_time: number;
  moving_time: number;
  /** Meters of net elevation change in the split. */
  elevation_difference: number;
  average_speed: number;
  average_heartrate?: number;
  pace_zone?: number;
}

/**
 * Streams come back keyed by type when `key_by_type=true`. Each stream has a
 * `data` array and optional `original_size`. We only request what we need.
 */
export interface StravaStreamSet {
  time?: { data: number[]; original_size: number };
  distance?: { data: number[]; original_size: number };
  altitude?: { data: number[]; original_size: number };
  heartrate?: { data: number[]; original_size: number };
}

/**
 * `/activities/{id}/zones` returns an array; one entry per zone type
 * ("heartrate" or "power"). Each has distribution buckets.
 */
export interface StravaZoneSet {
  type: "heartrate" | "power";
  /** True when bucket boundaries come from athlete's HR zones. */
  custom_zones?: boolean;
  distribution_buckets: Array<{ min: number; max: number; time: number }>;
}
