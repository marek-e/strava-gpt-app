import type { RecapActivity, Tag } from "../lib/types.js";

const BAR_COLOR: Record<Tag, string> = {
  easy: "bg-z2",
  tempo: "bg-accent",
  long: "bg-[#6c8cff]",
  interval: "bg-z4",
  race: "bg-z5",
  recovery: "bg-z1",
  progression: "bg-z3",
};

export function ActivityStrip({ activities }: { activities: RecapActivity[] }) {
  if (!activities.length) return null;
  const max = Math.max(...activities.map((a) => a.distance));
  const sorted = [...activities].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  return (
    <div className="flex items-end gap-1.5 h-[76px] pt-2">
      {sorted.map((a) => {
        const heightPct = Math.max(12, (a.distance / max) * 100);
        return (
          <div
            key={a.id}
            title={a.name}
            className="flex-1 flex flex-col items-center gap-1.5 min-w-0"
          >
            <div className="flex-1 w-full flex items-end justify-center">
              <div
                className={`${BAR_COLOR[a.tag]} w-full max-w-[22px] rounded-t opacity-85`}
                style={{ height: `${heightPct}%` }}
              />
            </div>
            <div className="text-[10px] font-semibold text-fg-faint">
              {shortDay(a.date)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function shortDay(iso: string) {
  return new Date(iso)
    .toLocaleDateString(undefined, { weekday: "short" })
    .slice(0, 1);
}
