# Strava ChatGPT App

A ChatGPT app that turns Strava data into conversational insight. The LLM acts as an experienced running friend — analyzes your runs, calls out what's notable, drops relevant advice when it matters.

## Value Proposition

**Problem:** Strava buries insight behind taps and graphs. "How was my training this week?" or "Why was Tuesday slow?" requires manually scrolling, opening activities, eyeballing charts, and synthesizing yourself.

**User:** Strava athletes who run — casual to serious. v1 is single-athlete (developer's own use); future v2 opens to public.

**Pain solved today:** Strava's mobile/web UI is built for logging and feed-scrolling, not interpretation. Third-party tools (Runalyze, Intervals.icu) exist but are dashboards, not conversations.

**Core actions (v1, runs only):**
1. **Recap** — summarize a period (last week / month / last N runs)
2. **Activity deep-dive** — analyze a single run

Compare/Trend deferred to v2.

## Why LLM?

**Conversational win:** "How was last week?" / "Analyze my Tuesday run" / "How was the long one?" — natural-language queries, fuzzy references resolved by the LLM, beats clicking through Strava's UI.

**LLM contributes:**
- **Intent parsing** — period and activity references ("last week", "my Tuesday run", "the long one")
- **Synthesis/narrative** — turns splits + HR + elevation + conditions into "you went out hot, faded on the climb at km 7" instead of a wall of numbers
- **Persona** — experienced-friend voice with light, earned coaching advice (not prescriptive coaching)

**LLM lacks (= what this app provides):**
- The user's Strava data (OAuth-gated, real numbers)
- Visual grounding — map, splits chart, HR zone bars, elevation profile
- Reliable numbers — without grounded data the LLM hallucinates pace/distance

**Persona:** "the friend who's been running for 10 years." Friendly analyst with earned-coach vibes. Calls out what's notable, gives advice when relevant, never lectures, never prescribes plans.

## UI Overview

Two views. The LLM speaks the narrative in chat; the view shows grounded numbers + visuals. No duplication.

### View 1 — Recap

**Triggered by:** "How was my week?" / "Recap October" / "Summarize my last 10 runs"

**Inline:**
- Header: period label + run count + total distance (e.g. "Last 7 days · 4 runs · 38.2 km")
- 3 hero stats (distance, total time, elevation gain)
- Activity strip: small bars/dots per run, sized by distance, with date
- One-line highlight ("longest run since August")

**Expanded:**
- Per-run list (date, distance, avg pace, one-line tag), tappable → triggers Deep-dive
- Period-vs-previous comparison row ("+12 km vs last week")
- HR zone distribution across the period

**LLM in chat:** narrative recap in the friend persona.

### View 2 — Activity Deep-Dive

**Triggered by:** "Analyze my Tuesday run" / "How was today's run?" / tapping a run in the recap

**Inline:**
- Map preview (route polyline)
- Title + date + 4 key stats (distance, moving time, avg pace, elevation gain)
- One-line tag ("tempo effort" / "easy recovery" / "Z2 long run")

**Expanded:**
- Full map
- Splits chart (per-km splits, color-coded by pace vs activity avg)
- HR zone bar (time in Z1–Z5)
- Elevation profile (shown when gain > ~100 m)
- 2–3 "notable moments" pins (fastest km, HR spike, etc.)

**LLM in chat:** narrated breakdown with one piece of relevant advice.

### Flow

Conversational, no end state. User can tap a run in Recap to trigger Deep-dive, or ask follow-ups in chat.

## Product Context

- **API:** Strava REST API v3 (OAuth 2.0, authorization code + refresh tokens)
  - `GET /athlete/activities` — recap list
  - `GET /activities/{id}` — detail
  - `GET /activities/{id}/streams` — time-series for splits / elevation profile
  - `GET /activities/{id}/zones` — time-in-HR-zones
- **Rate limits:** 100 req / 15 min, 1,000 / day per app; 200 / 15 min, 2,000 / day per athlete. Implication: cache aggressively, only fetch streams on deep-dive.
- **Auth:** Strava OAuth wired through Skybridge's auth flow (see chatgpt-app-builder `oauth.md`). v1 single-athlete (developer); v2 will open to public, which requires Strava app review for >1 athlete.
- **Maps:** MapLibre GL + [CARTO Basemaps](https://carto.com/basemaps) raster tiles (`light_all` / `dark_all`, theme-matched, zero cost, no API key). OSM Foundation's own tile servers are off-limits per their tile-usage policy, so we render OSM-derived data through CARTO's free CDN. CSP whitelists `*.basemaps.cartocdn.com` on the analyze-activity view.
- **Units:** auto from Strava athlete profile (`measurement_preference`).
- **Sport filter:** runs only (`type=Run`); other sports hidden in v1.
- **Hosting:** Alpic (per skill `deploy.md`).
- **Scope explicitly excluded v1:** rides, swims, hikes; social (kudos/comments); activity upload/edit; route planning; segment analysis; training plans; compare/trend view.

## UX Flows

Recap a period:
1. Recap runs over a period (week / month / last N runs)

Analyze a run:
1. Analyze a single run (entry: direct query, or tap a run from a Recap view)

## Tools and Views

Two views, no standalone tools. OAuth is handled by the Skybridge framework, not exposed to the LLM. Streams are downsampled and pre-computed server-side (splits, elevation profile, notable moments) so the LLM never sees raw arrays.

### View: `get_recap`

- **Input:**
  - `period?: "last_7_days" | "last_30_days" | "this_week" | "this_month" | "last_n_runs"` (default `last_7_days`)
  - `count?: number` (used when `period === "last_n_runs"`)
  - `before?: string` (ISO date)
  - `after?: string` (ISO date)
- **Output:**
  - `athlete: { units: "metric" | "imperial" }`
  - `period: { label, start, end }`
  - `totals: { runs, distance, movingTime, elevationGain }`
  - `comparison: { previous: { distance, movingTime, elevationGain }, delta: { distance, movingTime } }`
  - `activities: Array<{ id, date, name, distance, movingTime, avgPace, elevationGain, tag }>`
  - `hrZones: Array<{ zone, seconds, percent }>` — aggregated across the period
  - `highlight: string` (e.g. "longest run since August")
- **Behavior:** renders the recap card. Tapping an activity in the view triggers `analyze_activity` as a new turn (cross-view trigger). No lazy-load — list rows are fully populated from this output.

### View: `analyze_activity`

- **Input:**
  - `activityId?: string` (preferred)
  - `latest?: boolean` (convenience for "analyze my last run")
- **Output:**
  - `athlete: { units }`
  - `activity: { id, name, date, type, distance, movingTime, elapsedTime, avgPace, avgHr, maxHr, elevationGain, calories, polyline, startLatLng }`
  - `splits: Array<{ km, pace, hr, elevationDelta }>`
  - `hrZones: Array<{ zone, seconds, percent }>` (degrades gracefully if Strava `/zones` is unavailable)
  - `elevationProfile: Array<{ distance, elevation }>` (downsampled to ~50–100 points)
  - `notableMoments: Array<{ kind: "fastest_km" | "hr_spike" | "biggest_climb", distance, label }>`
  - `tag: string` ("tempo" | "easy" | "long" | "race" | etc.)
- **Behavior:** renders the activity card. Map decoded from the polyline client-side via MapLibre.

### Activity-ID resolution

Fuzzy references ("my Tuesday run", "the long one") are resolved by the LLM, not the tool: it calls `get_recap` with an appropriate window, picks the matching activity's `id` from the output, then calls `analyze_activity({ activityId })`. Keeps the tool surface narrow.

### Caching

- `get_recap` cached per `(athlete, period)` for ~5 minutes.
- `analyze_activity` cached per `activityId` long-term (activities are immutable post-upload).
- Mitigates Strava rate limits (100 req / 15 min per app).
