import type { Tag as TagType } from "../lib/types.js";

const STYLE: Record<TagType, { label: string; cls: string }> = {
  easy: {
    label: "Easy",
    cls: "text-[#2f9e44] bg-[rgba(47,158,68,0.1)] border-[rgba(47,158,68,0.2)]",
  },
  tempo: {
    label: "Tempo",
    cls: "text-accent bg-accent-soft border-accent-soft",
  },
  long: {
    label: "Long",
    cls: "text-[#4a63d6] bg-[rgba(74,99,214,0.1)] border-[rgba(74,99,214,0.2)]",
  },
  interval: {
    label: "Intervals",
    cls: "text-[#c46b1c] bg-[rgba(196,107,28,0.1)] border-[rgba(196,107,28,0.2)]",
  },
  race: {
    label: "Race",
    cls: "text-bad bg-[rgba(201,42,42,0.1)] border-[rgba(201,42,42,0.2)]",
  },
  recovery: {
    label: "Recovery",
    cls: "text-[#1971c2] bg-[rgba(25,113,194,0.1)] border-[rgba(25,113,194,0.2)]",
  },
  progression: {
    label: "Progression",
    cls: "text-[#b37606] bg-[rgba(179,118,6,0.1)] border-[rgba(179,118,6,0.2)]",
  },
};

export function Tag({ tag }: { tag: TagType }) {
  const { label, cls } = STYLE[tag];
  return (
    <span
      className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border whitespace-nowrap ${cls}`}
    >
      {label}
    </span>
  );
}
