import { formatPace } from "../lib/format.js";
import type { Split, Units } from "../lib/types.js";

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

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-baseline">
        <span className="text-xs font-semibold uppercase tracking-wider text-fg-faint">
          Splits
        </span>
        <span className="text-xs text-fg-soft">avg {formatPace(avg, units)}</span>
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
              <div className="text-right tabular-nums">
                {s.hr ? `${s.hr} bpm` : "—"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
