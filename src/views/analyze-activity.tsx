import "@/index.css";

import { useDisplayMode } from "skybridge/web";

import { useHostTheme } from "../lib/use-host-theme.js";
import { ElevationProfile } from "../components/ElevationProfile.js";
import { HrZoneBar } from "../components/HrZoneBar.js";
import { RoutePreview } from "../components/RoutePreview.js";
import { SplitsChart } from "../components/SplitsChart.js";
import { StatTile } from "../components/StatTile.js";
import { Tag } from "../components/Tag.js";
import {
  formatDistance,
  formatDuration,
  formatElevation,
  formatPace,
  formatRelativeDate,
} from "../lib/format.js";
import type { AnalyzeActivityMeta, AnalyzeActivityOutput } from "../lib/types.js";
import { useToolInfo } from "../helpers.js";

const MOMENT_DOT: Record<string, string> = {
  fastest_km: "bg-accent",
  biggest_climb: "bg-[#4a63d6]",
  hr_spike: "bg-z5",
};

export default function AnalyzeActivity() {
  useHostTheme();
  const { output, responseMetadata, isPending } =
    useToolInfo<"analyze-activity">();
  const [displayMode, setDisplayMode] = useDisplayMode();

  if (isPending || !output) {
    return (
      <Card>
        <div className="flex items-center gap-2.5 text-fg-soft p-[18px]">
          <span className="spinner" /> Analyzing…
        </div>
      </Card>
    );
  }

  const data = output as AnalyzeActivityOutput;
  const meta = (responseMetadata ?? {}) as Partial<AnalyzeActivityMeta>;
  const isExpanded = displayMode === "fullscreen";
  const showElevation =
    data.activity.elevationGain > 100 && (meta.elevationProfile?.length ?? 0) > 0;

  return (
    <Card expanded={isExpanded}>
      <RoutePreview
        polyline={meta.polyline}
        height={isExpanded ? 320 : 160}
        interactive={isExpanded}
      />

      <div className={isExpanded ? "px-6 flex flex-col gap-6" : "px-[18px] flex flex-col gap-4"}>
        <header className="flex items-start justify-between gap-3 mt-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-faint mb-1">
              {formatRelativeDate(data.activity.date)} · Run
            </div>
            <h2 className="text-[19px] font-bold tracking-tight">
              {data.activity.name}
            </h2>
          </div>
          <div className="flex items-center gap-2.5">
            <Tag tag={data.tag} />
            <button
              type="button"
              onClick={() => setDisplayMode(isExpanded ? "inline" : "fullscreen")}
              className="px-2.5 py-1.5 rounded-lg border border-line text-fg-soft text-xs font-medium transition-colors duration-100 hover:border-line-strong hover:text-fg"
            >
              {isExpanded ? "Collapse" : "Expand"}
            </button>
          </div>
        </header>

        <div className="grid grid-cols-4 gap-2.5">
          <StatTile
            label="Distance"
            value={formatDistance(data.activity.distance, data.athlete.units)}
          />
          <StatTile
            label="Time"
            value={formatDuration(data.activity.movingTime)}
          />
          <StatTile
            label="Pace"
            value={formatPace(data.activity.avgPace, data.athlete.units)}
          />
          <StatTile
            label="Elev"
            value={formatElevation(data.activity.elevationGain, data.athlete.units)}
            hint={data.activity.avgHr ? `${data.activity.avgHr} bpm avg` : undefined}
          />
        </div>

        {data.notableMoments.length ? (
          <ul className="flex flex-col gap-1.5 list-none p-0 m-0">
            {data.notableMoments.map((m, i) => (
              <li
                key={i}
                className="relative text-[13px] text-fg-soft bg-surface-soft rounded-lg pl-7 pr-2.5 py-2"
              >
                <span
                  className={`absolute left-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full ${
                    MOMENT_DOT[m.kind] ?? "bg-accent"
                  }`}
                />
                {m.label}
              </li>
            ))}
          </ul>
        ) : null}

        {isExpanded ? (
          <>
            <SplitsChart splits={data.splits} units={data.athlete.units} />

            {data.hrZones.length ? (
              <section className="flex flex-col gap-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-fg-faint m-0">
                  Heart-rate zones
                </h3>
                <HrZoneBar zones={data.hrZones} />
              </section>
            ) : null}

            {showElevation ? (
              <ElevationProfile
                points={meta.elevationProfile!}
                units={data.athlete.units}
              />
            ) : null}
          </>
        ) : null}

        <div className="pb-[18px]" />
      </div>
    </Card>
  );
}

function Card({
  children,
  expanded,
}: {
  children: React.ReactNode;
  expanded?: boolean;
}) {
  return (
    <div
      className={`bg-surface border border-line rounded-[14px] shadow-card flex flex-col mx-auto overflow-hidden ${
        expanded ? "max-w-[920px]" : "max-w-[720px]"
      }`}
    >
      {children}
    </div>
  );
}
