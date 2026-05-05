export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="bg-surface-soft border border-line rounded-lg px-3.5 py-3 flex flex-col gap-0.5 min-w-0">
      <div className="text-[18px] font-bold tracking-tight text-fg whitespace-nowrap overflow-hidden text-ellipsis">
        {value}
      </div>
      <div className="text-[11px] font-medium uppercase tracking-wider text-fg-faint">
        {label}
      </div>
      {hint ? (
        <div className="text-[11px] text-fg-soft mt-0.5">{hint}</div>
      ) : null}
    </div>
  );
}
