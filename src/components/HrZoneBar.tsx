import type { HrZone } from "../lib/types.js";

const SEG_BG = ["bg-z1", "bg-z2", "bg-z3", "bg-z4", "bg-z5"] as const;
const DOT_BG = SEG_BG;

export function HrZoneBar({
  zones,
  compact = false,
}: {
  zones: HrZone[];
  compact?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div
        className={`flex rounded overflow-hidden ${compact ? "h-2" : "h-3.5"}`}
      >
        {zones.map((z) => (
          <div
            key={z.zone}
            className={`flex items-center justify-center text-[10px] font-semibold transition-[flex] duration-200 ${
              SEG_BG[z.zone - 1]
            } ${z.zone >= 4 ? "text-white" : "text-black/70"}`}
            style={{ flex: z.percent }}
            title={`Z${z.zone} · ${z.percent.toFixed(1)}%`}
          >
            {z.percent > 8 ? `${Math.round(z.percent)}%` : ""}
          </div>
        ))}
      </div>
      {!compact ? (
        <div className="flex flex-wrap gap-3.5 text-[11px] text-fg-soft">
          {zones.map((z) => (
            <div key={z.zone} className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${DOT_BG[z.zone - 1]}`}
              />
              <span className="font-semibold text-fg">Z{z.zone}</span>
              <span>{Math.round(z.percent)}%</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
