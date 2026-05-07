/**
 * Shared mappers from Strava API shapes → our domain types. Pure, no I/O.
 *
 * Lives outside the recap / analyze modules because both depend on it. Resist
 * adding feature-specific helpers here — those belong inside the owning module.
 */
import type { StravaAthlete, StravaSummaryActivity } from "./strava-types.js";
import type { Tag, Units } from "./types.js";

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
