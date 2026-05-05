export type Units = "metric" | "imperial";

export type Tag =
  | "easy"
  | "tempo"
  | "long"
  | "interval"
  | "race"
  | "recovery"
  | "progression";

export interface Athlete {
  units: Units;
}

export interface RecapActivity {
  id: string;
  date: string; // ISO
  name: string;
  distance: number; // meters
  movingTime: number; // seconds
  avgPace: number; // seconds per km
  elevationGain: number; // meters
  tag: Tag;
}

export interface RecapTotals {
  runs: number;
  distance: number;
  movingTime: number;
  elevationGain: number;
}

export interface RecapComparison {
  previous: { distance: number; movingTime: number; elevationGain: number };
  delta: { distance: number; movingTime: number };
}

export interface HrZone {
  zone: 1 | 2 | 3 | 4 | 5;
  seconds: number;
  percent: number;
}

export interface RecapOutput {
  athlete: Athlete;
  period: { label: string; start: string; end: string };
  totals: RecapTotals;
  comparison: RecapComparison;
  activities: RecapActivity[];
  hrZones: HrZone[];
  highlight: string;
}

export interface ActivitySummary {
  id: string;
  name: string;
  date: string;
  type: "Run";
  distance: number;
  movingTime: number;
  elapsedTime: number;
  avgPace: number;
  avgHr: number | null;
  maxHr: number | null;
  elevationGain: number;
  calories: number | null;
  startLatLng: [number, number];
}

export interface Split {
  km: number;
  pace: number; // s/km
  hr: number | null;
  elevationDelta: number;
}

export interface NotableMoment {
  kind: "fastest_km" | "hr_spike" | "biggest_climb";
  distance: number; // meters from start
  label: string;
}

export interface AnalyzeActivityOutput {
  athlete: Athlete;
  activity: ActivitySummary;
  splits: Split[];
  hrZones: HrZone[];
  notableMoments: NotableMoment[];
  tag: Tag;
}

export interface AnalyzeActivityMeta {
  polyline: string; // encoded polyline
  elevationProfile: Array<{ distance: number; elevation: number }>;
}
