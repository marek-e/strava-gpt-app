import {
  formatDistance,
  formatDuration,
  formatPace,
  formatRelativeDate,
} from "../lib/format.js";
import type { RecapActivity, Units } from "../lib/types.js";
import { Tag } from "./Tag.js";

export function ActivityRow({
  activity,
  units,
  onSelect,
}: {
  activity: RecapActivity;
  units: Units;
  onSelect?: () => void;
}) {
  const Wrapper = onSelect ? "button" : "div";
  return (
    <Wrapper
      type={onSelect ? "button" : undefined}
      onClick={onSelect}
      className={`grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_auto] items-center gap-3 w-full px-3.5 py-3 text-left bg-transparent transition-colors duration-100 ${
        onSelect ? "cursor-pointer hover:bg-surface-soft" : ""
      }`}
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-faint">
          {formatRelativeDate(activity.date)}
        </div>
        <div className="text-sm font-semibold text-fg whitespace-nowrap overflow-hidden text-ellipsis">
          {activity.name}
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-fg-soft whitespace-nowrap overflow-hidden">
        <span>{formatDistance(activity.distance, units)}</span>
        <span className="text-fg-faint">·</span>
        <span>{formatPace(activity.avgPace, units)}</span>
        <span className="text-fg-faint">·</span>
        <span>{formatDuration(activity.movingTime, true)}</span>
      </div>
      <Tag tag={activity.tag} />
    </Wrapper>
  );
}
