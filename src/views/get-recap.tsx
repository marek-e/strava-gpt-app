import "@/index.css";

import { useDisplayMode, useSendFollowUpMessage } from "skybridge/web";

import { useHostTheme } from "../lib/use-host-theme.js";
import { ActivityRow } from "../components/ActivityRow.js";
import { ActivityStrip } from "../components/ActivityStrip.js";
import { HrZoneBar } from "../components/HrZoneBar.js";
import { StatTile } from "../components/StatTile.js";
import {
  formatDistance,
  formatDuration,
  formatElevation,
  formatSignedDistance,
  formatSignedDuration,
} from "../lib/format.js";
import type { RecapOutput } from "../lib/types.js";
import { useToolInfo } from "../helpers.js";

export default function GetRecap() {
  useHostTheme();
  const { output, isPending } = useToolInfo<"get-recap">();
  const [displayMode, setDisplayMode] = useDisplayMode();
  const sendFollowUp = useSendFollowUpMessage();

  if (isPending || !output) {
    return (
      <Card>
        <div className="flex items-center gap-2.5 text-fg-soft">
          <span className="spinner" /> Loading recap…
        </div>
      </Card>
    );
  }

  const data = output as RecapOutput;
  const isExpanded = displayMode === "fullscreen";

  return (
    <Card expanded={isExpanded}>
      <header className="flex items-start justify-between gap-3">
        <div>
          <Eyebrow>Recap</Eyebrow>
          <h2 className="text-[19px] font-bold tracking-tight">
            {data.period.label}
          </h2>
          <div className="text-[13px] text-fg-soft mt-0.5">
            {data.totals.runs} runs ·{" "}
            {formatDistance(data.totals.distance, data.athlete.units)}
          </div>
        </div>
        <ToggleButton
          expanded={isExpanded}
          onClick={() => setDisplayMode(isExpanded ? "inline" : "fullscreen")}
        />
      </header>

      <div className="grid grid-cols-3 gap-2.5">
        <StatTile
          label="Distance"
          value={formatDistance(data.totals.distance, data.athlete.units)}
          hint={`${formatSignedDistance(
            data.comparison.delta.distance,
            data.athlete.units,
          )} vs prev`}
        />
        <StatTile
          label="Time"
          value={formatDuration(data.totals.movingTime, true)}
          hint={`${formatSignedDuration(data.comparison.delta.movingTime)} vs prev`}
        />
        <StatTile
          label="Elevation"
          value={formatElevation(data.totals.elevationGain, data.athlete.units)}
        />
      </div>

      <ActivityStrip activities={data.activities} />

      {data.highlight ? (
        <div className="flex items-center gap-2 text-[13px] text-fg-soft bg-accent-soft rounded-lg px-3 py-2.5">
          <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
          {data.highlight}
        </div>
      ) : null}

      {isExpanded ? (
        <>
          <Section title="Runs">
            <div className="flex flex-col border border-line rounded-lg overflow-hidden divide-y divide-line">
              {[...data.activities]
                .sort(
                  (a, b) =>
                    new Date(b.date).getTime() - new Date(a.date).getTime(),
                )
                .map((a) => (
                  <ActivityRow
                    key={a.id}
                    activity={a}
                    units={data.athlete.units}
                    onSelect={() =>
                      sendFollowUp(
                        `Analyze the run "${a.name}" from ${new Date(
                          a.date,
                        ).toLocaleDateString()} (activityId: ${a.id}).`,
                      )
                    }
                  />
                ))}
            </div>
          </Section>

          {data.hrZones.length ? (
            <Section title="Heart-rate zones">
              <HrZoneBar zones={data.hrZones} />
            </Section>
          ) : null}
        </>
      ) : null}
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
      className={`bg-surface border border-line rounded-[14px] shadow-card flex flex-col gap-4 mx-auto ${
        expanded ? "p-6 gap-6 max-w-[920px]" : "p-[18px] max-w-[720px]"
      }`}
    >
      {children}
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-faint mb-1">
      {children}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-fg-faint m-0">
        {title}
      </h3>
      {children}
    </section>
  );
}

function ToggleButton({
  expanded,
  onClick,
}: {
  expanded: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2.5 py-1.5 rounded-lg border border-line text-fg-soft text-xs font-medium transition-colors duration-100 hover:border-line-strong hover:text-fg"
    >
      {expanded ? "Collapse" : "Expand"}
    </button>
  );
}
