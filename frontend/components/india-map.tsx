"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { AggregateRow, AggregateLevel, FacilityPoint } from "@/lib/types";

interface IndiaMapProps {
  aggregates: AggregateRow[];
  facilities?: FacilityPoint[];
  capability: string;
  level: AggregateLevel;
  mode?: "coverage" | "deficit";
  onRegionClick: (name: string, level: AggregateLevel) => void;
}

const CAPABILITY_OPTIONS = [
  { key: "has_nicu", label: "NICU" },
  { key: "has_icu", label: "ICU" },
  { key: "has_dialysis", label: "Dialysis" },
  { key: "has_oncology", label: "Oncology" },
  { key: "has_emergency_surgery", label: "Emerg. Surgery" },
  { key: "has_blood_bank", label: "Blood Bank" },
  { key: "has_maternity", label: "Maternity" },
  { key: "has_24x7", label: "24×7" },
  { key: "has_trauma", label: "Trauma" },
  { key: "has_cardiac_cath_lab", label: "Cath Lab" },
];

const CITY_DOT_MAX_ZOOM = 7.2;

interface SelectedFacilityCard {
  facility_id: string;
  name: string;
  city: string;
  state: string;
  type: string;
  trust_score: number | null;
  color: string;
  coordinates: [number, number];
  point: { x: number; y: number };
}

const STATE_CENTROIDS: Record<string, [number, number]> = {
  "Andhra Pradesh": [79.74, 15.91],
  "Arunachal Pradesh": [94.73, 28.22],
  "Assam": [92.94, 26.2],
  "Bihar": [85.31, 25.1],
  "Chhattisgarh": [81.87, 21.28],
  "Goa": [74.12, 15.3],
  "Gujarat": [71.19, 22.26],
  "Haryana": [76.08, 29.06],
  "Himachal Pradesh": [77.17, 31.1],
  "Jharkhand": [85.28, 23.61],
  "Karnataka": [75.71, 15.32],
  "Kerala": [76.27, 10.85],
  "Madhya Pradesh": [78.66, 22.97],
  "Maharashtra": [75.71, 19.75],
  "Manipur": [93.91, 24.66],
  "Meghalaya": [91.37, 25.47],
  "Mizoram": [92.94, 23.16],
  "Nagaland": [94.56, 26.16],
  "Odisha": [85.09, 20.95],
  "Punjab": [75.86, 31.15],
  "Rajasthan": [74.22, 27.02],
  "Sikkim": [88.51, 27.53],
  "Tamil Nadu": [78.66, 11.13],
  "Telangana": [79.02, 18.11],
  "Tripura": [91.99, 23.94],
  "Uttar Pradesh": [80.95, 26.85],
  "Uttarakhand": [79.07, 30.07],
  "West Bengal": [87.86, 22.99],
  "Andaman And Nicobar Islands": [92.62, 11.74],
  "Chandigarh": [76.77, 30.73],
  "Dadra And Nagar Haveli And Daman And Diu": [73.01, 20.42],
  "Delhi": [77.1, 28.7],
  "Jammu And Kashmir": [74.8, 33.78],
  "Ladakh": [77.58, 34.15],
  "Lakshadweep": [72.63, 10.57],
  "Puducherry": [79.81, 11.94],
};

function bucketColor(bucket: string): string {
  if (bucket === "high") return "#10b981";
  if (bucket === "mid") return "#fbbf24";
  return "#ef4444";
}

function buildFacilityGeoJSON(
  pts: FacilityPoint[]
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: pts.map((p) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [p.lng, p.lat],
      },
      properties: {
        facility_id: p.facility_id,
        name: p.name,
        trust_score: p.trust_score,
        trust_bucket: p.trust_bucket ?? "unknown",
        type: p.type ?? "",
        state: p.state ?? "",
        city: p.city ?? "",
        color: bucketColor(p.trust_bucket),
      },
    })),
  };
}

function buildCityGeoJSON(pts: FacilityPoint[]): GeoJSON.FeatureCollection {
  const byCity = new Map<string, { lng: number; lat: number; count: number; city: string; state: string }>();
  for (const point of pts) {
    if (!point.city || !point.state) continue;
    const key = `${point.city}|${point.state}`;
    const entry = byCity.get(key) ?? { lng: 0, lat: 0, count: 0, city: point.city, state: point.state };
    entry.lng += point.lng;
    entry.lat += point.lat;
    entry.count += 1;
    byCity.set(key, entry);
  }
  return {
    type: "FeatureCollection",
    features: Array.from(byCity.values()).map((entry) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [entry.lng / entry.count, entry.lat / entry.count],
      },
      properties: {
        name: entry.city,
        state: entry.state,
        count: entry.count,
        radius: Math.max(5, Math.min(18, 4 + Math.sqrt(entry.count) * 3)),
      },
    })),
  };
}

function verificationRatio(verified: number, claimed: number): number {
  return claimed > 0 ? verified / claimed : 0;
}

function ratioColor(ratio: number): string {
  if (ratio >= 0.7) return "#10b981";
  if (ratio >= 0.4) return "#fbbf24";
  return "#ef4444";
}

function deficitSeverity(verified: number, claimed: number): "critical" | "high" | "moderate" | "covered" {
  const rate = verificationRatio(verified, claimed);
  if (claimed === 0 || verified === 0) return "critical";
  if (rate < 0.2) return "high";
  if (rate < 0.5) return "moderate";
  return "covered";
}

function deficitColor(verified: number, claimed: number): string {
  const severity = deficitSeverity(verified, claimed);
  if (severity === "critical") return "#dc2626";
  if (severity === "high") return "#f97316";
  if (severity === "moderate") return "#fbbf24";
  return "#2f8f5b";
}

export function IndiaMap({
  aggregates,
  facilities = [],
  capability,
  level,
  mode = "coverage",
  onRegionClick,
}: IndiaMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const facilitiesRef = useRef<FacilityPoint[]>(facilities);
  const capabilityRef = useRef(capability);
  const modeRef = useRef(mode);
  const activeFacilityPopupRef = useRef<string | null>(null);
  const [selectedFacility, setSelectedFacility] = useState<SelectedFacilityCard | null>(null);
  const [overlay, setOverlay] = useState<{
    cities: Array<{ key: string; x: number; y: number; count: number; name: string }>;
    zoom: number;
  }>({ cities: [], zoom: 4 });

  const totalClaimed = aggregates.reduce((s, r) => s + r.claimed_count, 0);
  const totalVerified = aggregates.reduce((s, r) => s + r.verified_count, 0);

  const buildGeoJSON = useCallback(
    (data: AggregateRow[]): GeoJSON.FeatureCollection => ({
      type: "FeatureCollection",
      features: data
        .filter((row) => STATE_CENTROIDS[row.region_name])
        .map((row) => {
          const coords = STATE_CENTROIDS[row.region_name];
          const ratio = verificationRatio(
            row.verified_count,
            row.claimed_count
          );
          return {
            type: "Feature" as const,
            geometry: {
              type: "Point" as const,
              coordinates: coords,
            },
            properties: {
              name: row.region_name,
              claimed: row.claimed_count,
              verified: row.verified_count,
              ratio,
              color: modeRef.current === "deficit" ? deficitColor(row.verified_count, row.claimed_count) : ratioColor(ratio),
              severity: deficitSeverity(row.verified_count, row.claimed_count),
              radius: Math.max(8, Math.min(35, Math.sqrt(row.claimed_count) * 3)),
              per_100k: row.per_100k ?? 0,
              level: row.region_level,
            },
          };
        }),
    }),
    []
  );

  useEffect(() => {
    facilitiesRef.current = facilities;
  }, [facilities]);

  useEffect(() => {
    capabilityRef.current = capability;
  }, [capability]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const updateOverlay = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const currentFacilities = facilitiesRef.current;
    const cityFeatures = buildCityGeoJSON(currentFacilities).features;
    const cities = cityFeatures.map((feature) => {
      const coords = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
      const point = map.project(coords);
      return {
        key: `${feature.properties?.name}-${feature.properties?.state}`,
        x: point.x,
        y: point.y,
        count: Number(feature.properties?.count ?? 0),
        name: String(feature.properties?.name ?? ""),
      };
    });
    setOverlay({ cities, zoom: map.getZoom() });
  }, []);

  useEffect(() => {
    if (!mapContainer.current) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [80, 22],
      zoom: 4,
      minZoom: 3,
      maxZoom: 14,
      attributionControl: false,
    });
    mapRef.current = map;

    const resizeMap = () => {
      map.resize();
      updateOverlay();
    };

    map.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }),
      "top-right"
    );
    map.on("load", resizeMap);
    map.on("move", updateOverlay);
    map.on("zoom", updateOverlay);
    const resizeObserver = new ResizeObserver(resizeMap);
    resizeObserver.observe(mapContainer.current);
    window.setTimeout(resizeMap, 0);

    map.on("load", () => {
      map.addSource("states", {
        type: "geojson",
        data: buildGeoJSON(aggregates),
      });

      map.addLayer({
        id: "state-circles",
        type: "circle",
        source: "states",
        paint: {
          "circle-radius": ["get", "radius"],
          "circle-color": ["get", "color"],
          // Keep aggregate context visible while individual facility dots take over.
          "circle-opacity": [
            "interpolate", ["linear"], ["zoom"],
            3, 0.85,
            6.5, 0.85,
            8, 0.45,
            10, 0.22,
          ],
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 1.5,
        },
      });

      map.addLayer({
        id: "state-labels",
        type: "symbol",
        source: "states",
        layout: {
          "text-field": ["get", "name"],
          "text-size": 10,
          "text-offset": [0, -0.5],
          "text-anchor": "bottom",
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#374151",
          "text-halo-color": "#fff",
          "text-halo-width": 1.5,
          "text-opacity": [
            "interpolate", ["linear"], ["zoom"],
            3, 1,
            7, 1,
            9, 0,
          ],
        },
      });

      map.addSource("cities", {
        type: "geojson",
        data: buildCityGeoJSON(facilities),
      });

      map.addLayer({
        id: "city-clusters",
        type: "circle",
        source: "cities",
        paint: {
          "circle-radius": ["get", "radius"],
          "circle-color": "#0f5e5a",
          "circle-opacity": [
            "interpolate", ["linear"], ["zoom"],
            3, 0.72,
            6, 0.72,
            8, 0.55,
            10, 0.25,
          ],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.25,
        },
      });

      map.addLayer({
        id: "city-labels",
        type: "symbol",
        source: "cities",
        layout: {
          "text-field": ["get", "name"],
          "text-size": 10,
          "text-offset": [0, 1.1],
          "text-anchor": "top",
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#0f5e5a",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.4,
          "text-opacity": [
            "interpolate", ["linear"], ["zoom"],
            3, 0.9,
            6, 0.9,
            8, 0,
          ],
        },
      });

      // --- Facility dots layer ---
      map.addSource("facilities", {
        type: "geojson",
        data: buildFacilityGeoJSON(facilities),
      });

      map.addLayer({
        id: "facility-dots",
        type: "circle",
        source: "facilities",
        paint: {
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            3, 3,
            6, 3.5,
            8, 4.5,
            12, 6,
          ],
          "circle-color": ["get", "color"],
          // Facility dots should stay pinned and visible across zoom levels.
          "circle-opacity": [
            "interpolate", ["linear"], ["zoom"],
            3, 0.82,
            8, 0.86,
            14, 0.92,
          ],
          "circle-stroke-color": "#fff",
          "circle-stroke-width": [
            "interpolate", ["linear"], ["zoom"],
            3, 0.5,
            8, 0.5,
            12, 1,
          ],
        },
      });

      map.addLayer({
        id: "facility-hit-targets",
        type: "circle",
        source: "facilities",
        paint: {
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            3, 12,
            8, 14,
            12, 16,
          ],
          "circle-color": "#000000",
          "circle-opacity": 0.01,
        },
      });
    });

    const popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      className: "atlas-map-hover-popup",
      offset: 14,
      maxWidth: "280px",
    });
    popup.on("close", () => {
      activeFacilityPopupRef.current = null;
    });
    popupRef.current = popup;

    map.on("mouseenter", "state-circles", (e) => {
      if (activeFacilityPopupRef.current) return;
      map.getCanvas().style.cursor = "pointer";
      const f = e.features?.[0];
      if (!f || !f.properties) return;
      const p = f.properties;
      const pct = Math.round((p.ratio as number) * 100);
      popup
        .setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
        .setHTML(
          `<div style="font-family:system-ui;font-size:12px;line-height:1.5;min-width:120px">` +
            `<strong>${p.name}</strong><br/>` +
            (modeRef.current === "deficit"
              ? `<span style="color:${p.color};font-weight:600">${String(p.severity).replace(/^./, (c) => c.toUpperCase())}</span> deficit<br/>`
              : `<span style="color:${p.color};font-weight:600">${pct}%</span> verified<br/>`) +
            `${p.verified}/${p.claimed} verified` +
            (p.per_100k > 0
              ? `<br/><span style="color:#6b7280">${Number(p.per_100k).toFixed(1)}/100k pop.</span>`
              : "") +
            `</div>`
        )
        .addTo(map);
    });

    map.on("mouseleave", "state-circles", () => {
      map.getCanvas().style.cursor = "";
      if (!activeFacilityPopupRef.current) popup.remove();
    });

    map.on("click", "state-circles", (e) => {
      activeFacilityPopupRef.current = null;
      setSelectedFacility(null);
      popup.remove();
      const f = e.features?.[0];
      if (f?.properties) {
        onRegionClick(
          f.properties.name as string,
          f.properties.level as AggregateLevel
        );
      }
    });

    map.on("mouseenter", "city-clusters", (e) => {
      if (activeFacilityPopupRef.current) return;
      map.getCanvas().style.cursor = "pointer";
      const f = e.features?.[0];
      if (!f || !f.properties) return;
      const p = f.properties;
      popup
        .setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
        .setHTML(
          `<div style="font-family:system-ui;font-size:12px;line-height:1.5;min-width:120px">` +
            `<strong>${p.name}</strong><br/>` +
            `<span style="color:#0f5e5a;font-weight:600">${p.count}</span> facilities` +
            (p.state ? `<br/><span style="color:#6b7280">${p.state}</span>` : "") +
            `</div>`
        )
        .addTo(map);
    });

    map.on("mouseleave", "city-clusters", () => {
      map.getCanvas().style.cursor = "";
      if (!activeFacilityPopupRef.current) popup.remove();
    });

    // --- Facility dot interactions ---
    map.on("mouseenter", "facility-hit-targets", () => {
      map.getCanvas().style.cursor = "pointer";
      if (map.dragPan.isEnabled()) map.dragPan.disable();
    });

    map.on("mouseleave", "facility-hit-targets", () => {
      map.getCanvas().style.cursor = "";
      if (!map.dragPan.isEnabled()) map.dragPan.enable();
    });

    map.on("click", "facility-hit-targets", (e) => {
      e.preventDefault();
      const f = e.features?.[0];
      if (!f?.properties) return;
      const coordinates = (f.geometry as GeoJSON.Point).coordinates as [number, number];
      const p = f.properties;
      activeFacilityPopupRef.current = String(p.facility_id);
      popup.remove();
      setSelectedFacility(facilityCardFromProperties(p, coordinates, map.project(coordinates)));
    });

    map.on("move", () => {
      setSelectedFacility((current) => current ? {
        ...current,
        point: map.project(current.coordinates),
      } : current);
    });

    return () => {
      resizeObserver.disconnect();
      if (!map.dragPan.isEnabled()) map.dragPan.enable();
      popup.remove();
      map.remove();
      mapRef.current = null;
    };
    // Only init map once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update data when aggregates change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const updateSource = () => {
      const source = map.getSource("states") as mapboxgl.GeoJSONSource | undefined;
      if (source) {
        source.setData(buildGeoJSON(aggregates));
      }
    };

    if (map.isStyleLoaded()) {
      updateSource();
    } else {
      map.once("load", updateSource);
    }
  }, [aggregates, buildGeoJSON, mode]);

  // Update facility and city points when data arrives
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const updateFacilities = () => {
      const source = map.getSource("facilities") as mapboxgl.GeoJSONSource | undefined;
      if (source) {
        source.setData(buildFacilityGeoJSON(facilities));
      }
      const citySource = map.getSource("cities") as mapboxgl.GeoJSONSource | undefined;
      if (citySource) {
        citySource.setData(buildCityGeoJSON(facilities));
      }
      updateOverlay();
    };

    if (map.isStyleLoaded()) {
      updateFacilities();
    } else {
      map.once("load", updateFacilities);
    }
  }, [facilities, updateOverlay]);

  return (
    <div className="flex flex-col h-full">
      {/* Summary bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border/50 shrink-0 bg-muted/30">
        <span className="text-xs text-text-muted">
          {aggregates.length} {level}s
        </span>
        <span className="inline-flex h-5 items-center rounded-md border hairline bg-surface px-2 font-mono text-xs">
          {CAPABILITY_OPTIONS.find((o) => o.key === capability)?.label ?? capability}
        </span>
        {mode === "deficit" ? (
          <span className="flex items-center gap-3">
            <LegendDot color="#dc2626" label="Critical" />
            <LegendDot color="#f97316" label="High" />
            <LegendDot color="#fbbf24" label="Moderate" />
            <LegendDot color="#2f8f5b" label="Covered" />
          </span>
        ) : (
          <span className="flex items-center gap-3">
            <LegendDot color="#10b981" label="≥70%" />
            <LegendDot color="#fbbf24" label="40–69%" />
            <LegendDot color="#ef4444" label="<40%" />
          </span>
        )}
        <span className="text-xs text-text-muted ml-auto font-mono tabular-nums">
          {totalVerified}/{totalClaimed} verified nationally
        </span>
      </div>

      {/* Map */}
      <div className="relative flex-1 min-h-[420px] overflow-hidden bg-map-water">
        <div ref={mapContainer} className="absolute inset-0 h-full w-full" />
        <div className="pointer-events-none absolute inset-0 z-10">
          {overlay.zoom < CITY_DOT_MAX_ZOOM && overlay.cities.map((city) => (
            <div
              key={city.key}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: city.x, top: city.y }}
              title={`${city.name}: ${city.count} facilities`}
            >
              <span className="block rounded-full border border-white bg-primary shadow-sm" style={{ width: Math.max(9, Math.min(24, 8 + city.count * 2)), height: Math.max(9, Math.min(24, 8 + city.count * 2)) }} />
              <span className="absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap rounded bg-white/85 px-1 font-mono text-[9px] text-primary shadow-sm">
                {city.name}
              </span>
            </div>
          ))}
        </div>
        {selectedFacility && (
          <FacilityInfoCard
            facility={selectedFacility}
            capability={capability}
            onClose={() => {
              activeFacilityPopupRef.current = null;
              setSelectedFacility(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

function FacilityInfoCard({ facility, capability, onClose }: { facility: SelectedFacilityCard; capability: string; onClose: () => void }) {
  const capabilityLabel = CAPABILITY_OPTIONS.find((item) => item.key === capability)?.label ?? capability;
  const score = facility.trust_score != null ? Math.round(facility.trust_score) : "N/A";
  const location = [facility.city, facility.state].filter(Boolean).join(", ") || "Location unavailable";
  const top = Math.max(18, facility.point.y - 18);

  return (
    <div
      className="pointer-events-auto absolute z-30 w-[280px] origin-bottom rounded-lg border border-primary/20 bg-surface p-3 shadow-xl ring-1 ring-black/5 prompt-slide"
      style={{ left: `clamp(150px, ${facility.point.x}px, calc(100% - 150px))`, top, transform: "translate(-50%, -100%)" }}
    >
      <button
        type="button"
        aria-label="Close facility card"
        onClick={onClose}
        className="absolute right-2 top-2 rounded px-1.5 py-0.5 text-[12px] text-muted-foreground hover:bg-surface-muted hover:text-foreground"
      >
        x
      </button>
      <a href={`/facility/${encodeURIComponent(facility.facility_id)}`} className="mr-7 block text-[14px] font-semibold leading-snug text-primary underline underline-offset-2">
        {facility.name}
      </a>
      <div className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
        {location}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="rounded-full border border-primary/20 bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary-soft-foreground">{capabilityLabel}</span>
        {facility.type && <span className="rounded-full border hairline bg-surface-muted px-2 py-0.5 text-[11px] text-muted-foreground">{facility.type}</span>}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 border-t hairline pt-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Overall trust</div>
          <div className="mt-0.5 font-mono text-[16px] font-semibold" style={{ color: facility.color }}>{score}</div>
        </div>
        <a href={`/facility/${encodeURIComponent(facility.facility_id)}`} className="rounded-md border border-primary/25 bg-primary-soft px-2.5 py-1.5 text-[12px] font-medium text-primary hover:border-primary/45">
          View details
        </a>
      </div>
    </div>
  );
}

function facilityCardFromProperties(properties: mapboxgl.GeoJSONFeature["properties"], coordinates: [number, number], point: { x: number; y: number }): SelectedFacilityCard {
  return {
    facility_id: String(properties?.facility_id ?? ""),
    name: String(properties?.name ?? "Facility"),
    city: String(properties?.city ?? ""),
    state: String(properties?.state ?? ""),
    type: String(properties?.type ?? ""),
    trust_score: properties?.trust_score != null ? Number(properties.trust_score) : null,
    color: String(properties?.color ?? "#0f5e5a"),
    coordinates,
    point: { x: point.x, y: point.y },
  };
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <div
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: color }}
      />
      <span className="text-[10px] text-text-muted">{label}</span>
    </div>
  );
}
