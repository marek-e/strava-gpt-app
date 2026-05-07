import "maplibre-gl/dist/maplibre-gl.css";

import maplibregl, { LngLatBounds, type StyleSpecification } from "maplibre-gl";
import { useEffect, useRef } from "react";

import { useHostTheme } from "../lib/use-host-theme.js";

interface RoutePreviewProps {
  polyline?: string;
  height?: number;
  /** Inline cards stay non-interactive so scroll doesn't hijack the chat. */
  interactive?: boolean;
}

export function RoutePreview({
  polyline,
  height = 180,
  interactive = false,
}: RoutePreviewProps) {
  const theme = useHostTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const coords = polyline ? decodePolyline(polyline) : [];
  const hasRoute = coords.length >= 2;

  useEffect(() => {
    if (!containerRef.current || !hasRoute) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildStyle(theme),
      interactive,
      attributionControl: { compact: true },
      // Bounds are set after first render; avoid a flash by starting near the route.
      center: [coords[0][1], coords[0][0]],
      zoom: 12,
    });
    mapRef.current = map;

    map.on("load", () => {
      addRouteLayers(map, coords);
      const bounds = coords.reduce(
        (b, [lat, lng]) => b.extend([lng, lat]),
        new LngLatBounds(
          [coords[0][1], coords[0][0]],
          [coords[0][1], coords[0][0]],
        ),
      );
      map.fitBounds(bounds, { padding: 24, duration: 0 });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // Re-init when theme/interactivity change. polyline string is the identity
    // of the route — same string ⇒ same coords ⇒ no remount needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, interactive, polyline]);

  if (!hasRoute) {
    return (
      <div
        className="w-full bg-surface-soft flex items-center justify-center text-fg-faint text-xs"
        style={{ height }}
      >
        Map preview unavailable
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full bg-surface-soft route-map"
      style={{ height }}
    />
  );
}

function addRouteLayers(map: maplibregl.Map, coords: Array<[number, number]>) {
  const lineGeoJson = {
    type: "Feature" as const,
    geometry: {
      type: "LineString" as const,
      coordinates: coords.map(([lat, lng]) => [lng, lat]),
    },
    properties: {},
  };

  map.addSource("route", { type: "geojson", data: lineGeoJson });

  // Soft outline for contrast against either basemap.
  map.addLayer({
    id: "route-outline",
    type: "line",
    source: "route",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": "rgba(0,0,0,0.35)",
      "line-width": 6,
    },
  });
  map.addLayer({
    id: "route-line",
    type: "line",
    source: "route",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": readCssVar("--color-accent", "#fc4c02"),
      "line-width": 3.5,
    },
  });

  const start = coords[0];
  const end = coords[coords.length - 1];
  map.addSource("endpoints", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { kind: "start" },
          geometry: { type: "Point", coordinates: [start[1], start[0]] },
        },
        {
          type: "Feature",
          properties: { kind: "end" },
          geometry: { type: "Point", coordinates: [end[1], end[0]] },
        },
      ],
    },
  });
  map.addLayer({
    id: "endpoint-halo",
    type: "circle",
    source: "endpoints",
    paint: {
      "circle-radius": 7,
      "circle-color": "#fff",
      "circle-stroke-color": "rgba(0,0,0,0.35)",
      "circle-stroke-width": 1,
    },
  });
  map.addLayer({
    id: "endpoint-dot",
    type: "circle",
    source: "endpoints",
    paint: {
      "circle-radius": 4,
      "circle-color": [
        "match",
        ["get", "kind"],
        "start",
        readCssVar("--color-accent", "#fc4c02"),
        readCssVar("--color-fg", "#111114"),
      ],
    },
  });
}

function buildStyle(theme: "light" | "dark"): StyleSpecification {
  const slug = theme === "dark" ? "dark_all" : "light_all";
  return {
    version: 8,
    sources: {
      carto: {
        type: "raster",
        tiles: ["a", "b", "c", "d"].map(
          (s) => `https://${s}.basemaps.cartocdn.com/${slug}/{z}/{x}/{y}.png`,
        ),
        tileSize: 256,
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>',
      },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#eee" } },
      { id: "carto", type: "raster", source: "carto" },
    ],
  };
}

function readCssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}

function decodePolyline(str: string): Array<[number, number]> {
  if (!str) return [];
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
  return out;
}
