export function RoutePreview({
  polyline,
  height = 180,
}: {
  polyline?: string;
  height?: number;
}) {
  const coords = polyline ? decodePolyline(polyline) : [];
  if (coords.length < 2) {
    return (
      <div
        className="w-full bg-surface-soft flex items-center justify-center text-fg-faint text-xs"
        style={{ height }}
      >
        Map preview unavailable
      </div>
    );
  }

  const W = 600;
  const H = height;
  const lats = coords.map((c) => c[0]);
  const lngs = coords.map((c) => c[1]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latRange = Math.max(1e-6, maxLat - minLat);
  const lngRange = Math.max(1e-6, maxLng - minLng);

  const pad = 12;
  const sx = (lng: number) =>
    pad + ((lng - minLng) / lngRange) * (W - pad * 2);
  const sy = (lat: number) =>
    H - pad - ((lat - minLat) / latRange) * (H - pad * 2);

  const d = coords
    .map(
      (c, i) =>
        `${i === 0 ? "M" : "L"} ${sx(c[1]).toFixed(1)} ${sy(c[0]).toFixed(1)}`,
    )
    .join(" ");

  return (
    <div className="w-full bg-surface-soft relative" style={{ height }}>
      <svg
        className="w-full h-full block"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
      >
        <path
          d={d}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle
          cx={sx(coords[0][1])}
          cy={sy(coords[0][0])}
          r={5}
          fill="var(--color-accent)"
        />
        <circle
          cx={sx(coords[coords.length - 1][1])}
          cy={sy(coords[coords.length - 1][0])}
          r={5}
          fill="var(--color-fg)"
        />
      </svg>
    </div>
  );
}

function decodePolyline(str: string): Array<[number, number]> {
  if (!str) return DEMO_ROUTE;
  let index = 0;
  let lat = 0;
  let lng = 0;
  const out: Array<[number, number]> = [];
  while (index < str.length) {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    result = 0;
    shift = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    out.push([lat / 1e5, lng / 1e5]);
  }
  return out.length > 1 ? out : DEMO_ROUTE;
}

const DEMO_ROUTE: Array<[number, number]> = (() => {
  const pts: Array<[number, number]> = [];
  const cx = 48.8566;
  const cy = 2.3522;
  for (let i = 0; i < 64; i++) {
    const t = (i / 63) * Math.PI * 2;
    const wobble = 0.004 + 0.001 * Math.sin(t * 3);
    pts.push([cx + Math.sin(t) * wobble, cy + Math.cos(t * 1.3) * wobble * 1.4]);
  }
  return pts;
})();
