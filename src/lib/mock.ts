import type {
  AnalyzeActivityMeta,
  AnalyzeActivityOutput,
  RecapOutput,
} from "./types.js";

const MOCK_ACTIVITIES = [
  {
    id: "act_8821",
    date: "2026-05-04T06:12:00Z",
    name: "Monday shakeout",
    distance: 6420,
    movingTime: 2010,
    avgPace: 313,
    elevationGain: 38,
    tag: "easy" as const,
  },
  {
    id: "act_8807",
    date: "2026-05-02T07:48:00Z",
    name: "Saturday long run",
    distance: 21300,
    movingTime: 6480,
    avgPace: 304,
    elevationGain: 142,
    tag: "long" as const,
  },
  {
    id: "act_8794",
    date: "2026-04-30T16:40:00Z",
    name: "Track session — 6×800",
    distance: 9100,
    movingTime: 2520,
    avgPace: 277,
    elevationGain: 12,
    tag: "interval" as const,
  },
  {
    id: "act_8780",
    date: "2026-04-28T06:50:00Z",
    name: "Tempo loop",
    distance: 12100,
    movingTime: 3120,
    avgPace: 258,
    elevationGain: 84,
    tag: "tempo" as const,
  },
];

export function getMockRecap(): RecapOutput {
  const totals = MOCK_ACTIVITIES.reduce(
    (acc, a) => ({
      runs: acc.runs + 1,
      distance: acc.distance + a.distance,
      movingTime: acc.movingTime + a.movingTime,
      elevationGain: acc.elevationGain + a.elevationGain,
    }),
    { runs: 0, distance: 0, movingTime: 0, elevationGain: 0 },
  );

  return {
    athlete: { units: "metric" },
    period: {
      label: "Last 7 days",
      start: "2026-04-28T00:00:00Z",
      end: "2026-05-04T23:59:59Z",
    },
    totals,
    comparison: {
      previous: { distance: 36800, movingTime: 11520, elevationGain: 210 },
      delta: {
        distance: totals.distance - 36800,
        movingTime: totals.movingTime - 11520,
      },
    },
    activities: MOCK_ACTIVITIES,
    hrZones: [
      { zone: 1, seconds: 1820, percent: 12.7 },
      { zone: 2, seconds: 7220, percent: 50.5 },
      { zone: 3, seconds: 3960, percent: 27.7 },
      { zone: 4, seconds: 980, percent: 6.9 },
      { zone: 5, seconds: 320, percent: 2.2 },
    ],
    highlight: "Saturday long run was your longest since February.",
  };
}

const MOCK_DETAIL: Record<
  string,
  { output: AnalyzeActivityOutput; meta: AnalyzeActivityMeta }
> = {
  act_8780: {
    output: {
      athlete: { units: "metric" },
      activity: {
        id: "act_8780",
        name: "Tempo loop",
        date: "2026-04-28T06:50:00Z",
        type: "Run",
        distance: 12100,
        movingTime: 3120,
        elapsedTime: 3240,
        avgPace: 258,
        avgHr: 168,
        maxHr: 182,
        elevationGain: 84,
        calories: 812,
        startLatLng: [48.8566, 2.3522],
      },
      splits: [
        { km: 1, pace: 282, hr: 152, elevationDelta: 6 },
        { km: 2, pace: 263, hr: 161, elevationDelta: 4 },
        { km: 3, pace: 254, hr: 167, elevationDelta: -2 },
        { km: 4, pace: 251, hr: 170, elevationDelta: 12 },
        { km: 5, pace: 247, hr: 174, elevationDelta: 18 },
        { km: 6, pace: 256, hr: 175, elevationDelta: 8 },
        { km: 7, pace: 261, hr: 172, elevationDelta: -10 },
        { km: 8, pace: 255, hr: 170, elevationDelta: -6 },
        { km: 9, pace: 252, hr: 171, elevationDelta: 4 },
        { km: 10, pace: 249, hr: 174, elevationDelta: 14 },
        { km: 11, pace: 254, hr: 176, elevationDelta: 22 },
        { km: 12, pace: 268, hr: 178, elevationDelta: 4 },
      ],
      hrZones: [
        { zone: 1, seconds: 120, percent: 3.8 },
        { zone: 2, seconds: 540, percent: 17.3 },
        { zone: 3, seconds: 1620, percent: 51.9 },
        { zone: 4, seconds: 720, percent: 23.1 },
        { zone: 5, seconds: 120, percent: 3.9 },
      ],
      notableMoments: [
        { kind: "fastest_km", distance: 5000, label: "Fastest km — 4:07 at km 5" },
        { kind: "biggest_climb", distance: 10500, label: "Biggest climb — +22 m at km 11" },
        { kind: "hr_spike", distance: 11800, label: "HR peaked at 182 in final kick" },
      ],
      tag: "tempo",
    },
    meta: {
      polyline: "u{~vFvyys@fS]",
      elevationProfile: buildElevation(
        [40, 46, 50, 48, 60, 78, 86, 76, 70, 74, 88, 110, 114],
        12100,
      ),
    },
  },
};

function buildElevation(samples: number[], totalDistance: number) {
  const step = totalDistance / (samples.length - 1);
  return samples.map((elevation, i) => ({
    distance: Math.round(i * step),
    elevation,
  }));
}

export function getMockActivity(activityId?: string, latest?: boolean) {
  const id = latest
    ? MOCK_ACTIVITIES[0].id
    : activityId ?? MOCK_ACTIVITIES[0].id;

  const fallbackSummary = MOCK_ACTIVITIES.find((a) => a.id === id) ?? MOCK_ACTIVITIES[0];
  const detail = MOCK_DETAIL[id] ?? MOCK_DETAIL.act_8780;

  return {
    output: {
      ...detail.output,
      activity: { ...detail.output.activity, id: fallbackSummary.id, name: fallbackSummary.name, date: fallbackSummary.date },
    },
    meta: detail.meta,
  };
}
