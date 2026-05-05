import type { Units } from "./types.js";

export function formatDistance(meters: number, units: Units): string {
  if (units === "imperial") {
    const miles = meters / 1609.344;
    return `${miles.toFixed(miles >= 10 ? 1 : 2)} mi`;
  }
  const km = meters / 1000;
  return `${km.toFixed(km >= 10 ? 1 : 2)} km`;
}

export function formatDuration(seconds: number, compact = false): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return compact ? `${h}h ${m}m` : `${h}:${pad(m)}:${pad(s)}`;
  if (compact) return `${m}m`;
  return `${m}:${pad(s)}`;
}

export function formatPace(secondsPerKm: number, units: Units): string {
  const sec = units === "imperial" ? secondsPerKm * 1.609344 : secondsPerKm;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${pad(s)} /${units === "imperial" ? "mi" : "km"}`;
}

export function formatElevation(meters: number, units: Units): string {
  if (units === "imperial") {
    const ft = Math.round(meters * 3.28084);
    return `${ft.toLocaleString()} ft`;
  }
  return `${Math.round(meters).toLocaleString()} m`;
}

export function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) {
    return d.toLocaleDateString(undefined, { weekday: "long" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatSignedDistance(meters: number, units: Units): string {
  const formatted = formatDistance(Math.abs(meters), units);
  return meters >= 0 ? `+${formatted}` : `−${formatted}`;
}

export function formatSignedDuration(seconds: number): string {
  const formatted = formatDuration(Math.abs(seconds), true);
  return seconds >= 0 ? `+${formatted}` : `−${formatted}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}
