import { formatPace } from "../lib/format.js";
import type { Split, Units } from "../lib/types.js";

const HR_INTENSITY_COLORS = [
  "bg-z1",
  "bg-z2",
  "bg-z3",
  "bg-z4",
  "bg-z5",
] as const;

export function SplitsChart({
  splits,
  units,
}: {
  splits: Split[];
  units: Units;
}) {
  if (!splits.length) return null;
  const fastest = Math.min(...splits.map((s) => s.pace));
  const slowest = Math.max(...splits.map((s) => s.pace));
  const range = Math.max(1, slowest - fastest);
  const avg = splits.reduce((acc, s) => acc + s.pace, 0) / splits.length;

  const hrValues = splits
    .map((s) => s.hr)
    .filter((hr): hr is number => hr != null);
  const minHr = hrValues.length ? Math.min(...hrValues) : 0;
  const maxHr = hrValues.length ? Math.max(...hrValues) : 0;
  const hrRange = Math.max(1, maxHr - minHr);
  const avgHr = hrValues.length
    ? hrValues.reduce((a, b) => a + b, 0) / hrValues.length
    : 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-baseline">
        <span className="text-xs font-semibold uppercase tracking-wider text-fg-faint">
          Splits
        </span>
        <span className="text-xs text-fg-soft tabular-nums">
          avg {formatPace(avg, units)}
          {avgHr ? ` · ${Math.round(avgHr)} bpm` : ""}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {splits.map((s) => {
          const widthPct = 16 + ((slowest - s.pace) / range) * 84;
          const isBest = s.pace === fastest;
          const fasterThanAvg = s.pace < avg;
          return (
            <div
              key={s.km}
              className="grid grid-cols-[24px_1fr_80px_64px] gap-2.5 items-center text-xs text-fg-soft"
            >
              <div className="font-bold text-fg-faint">{s.km}</div>
              <div className="bg-surface-soft rounded h-5 overflow-hidden">
                <div
                  className={`h-full transition-[width] duration-200 ${
                    isBest
                      ? "bg-linear-to-r from-accent to-[#ff7e3c]"
                      : fasterThanAvg
                        ? "bg-accent"
                        : "bg-[#b8b9c0]"
                  }`}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
              <div className="font-semibold text-fg tabular-nums">
                {formatPace(s.pace, units)}
              </div>
              <div className="flex items-center justify-end gap-1.5 tabular-nums">
                {s.hr ? (
                  <>
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        HR_INTENSITY_COLORS[
                          Math.min(
                            4,
                            Math.floor(((s.hr - minHr) / hrRange) * 5),
                          )
                        ]
                      }`}
                      aria-hidden
                    />
                    <span className="text-fg">{s.hr}</span>
                    <span className="text-fg-faint">bpm</span>
                  </>
                ) : (
                  <span className="text-fg-faint">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
