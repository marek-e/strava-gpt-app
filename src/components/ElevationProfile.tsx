import { formatDistance, formatElevation } from "../lib/format.js";
import type { Units } from "../lib/types.js";

export function ElevationProfile({
  points,
  units,
}: {
  points: Array<{ distance: number; elevation: number }>;
  units: Units;
}) {
  if (points.length < 2) return null;
  const W = 600;
  const H = 120;
  const maxD = points[points.length - 1].distance;
  const minE = Math.min(...points.map((p) => p.elevation));
  const maxE = Math.max(...points.map((p) => p.elevation));
  const eRange = Math.max(1, maxE - minE);

  const x = (d: number) => (d / maxD) * W;
  const y = (e: number) => H - ((e - minE) / eRange) * (H - 8) - 4;

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.distance).toFixed(1)} ${y(p.elevation).toFixed(1)}`)
    .join(" ");
  const fill = `${path} L ${W} ${H} L 0 ${H} Z`;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-baseline">
        <span className="text-xs font-semibold uppercase tracking-wider text-fg-faint">
          Elevation
        </span>
        <span className="text-xs text-fg-soft">
          {formatElevation(minE, units)} → {formatElevation(maxE, units)} ·{" "}
          {formatDistance(maxD, units)}
        </span>
      </div>
      <svg
        className="w-full h-[120px] block"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
      >
        <path d={fill} fill="var(--color-accent-soft)" />
        <path
          d={path}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="1.6"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
