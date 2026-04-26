"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Badge } from "@/components/ui/badge";
import type { AggregateRow, AggregateLevel, FacilityPoint } from "@/lib/types";

interface IndiaMapProps {
  aggregates: AggregateRow[];
  facilities?: FacilityPoint[];
  capability: string;
  level: AggregateLevel;
  onRegionClick: (name: string, level: AggregateLevel) => void;
  onCapabilityChange?: (cap: string) => void;
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

export function IndiaMap({
  aggregates,
  facilities = [],
  capability,
  level,
  onRegionClick,
  onCapabilityChange,
}: IndiaMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const facilitiesRef = useRef<FacilityPoint[]>(facilities);
  const [activeCap, setActiveCap] = useState(capability);
  const [overlay, setOverlay] = useState<{
    cities: Array<{ key: string; x: number; y: number; count: number; name: string }>;
    facilities: Array<{ key: string; x: number; y: number; color: string; id: string; name: string }>;
    zoom: number;
  }>({ cities: [], facilities: [], zoom: 4 });

  const handleCapChange = (cap: string) => {
    setActiveCap(cap);
    onCapabilityChange?.(cap);
  };

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
              color: ratioColor(ratio),
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
    const dots = currentFacilities.map((facility) => {
      const point = map.project([facility.lng, facility.lat]);
      return {
        key: facility.facility_id,
        x: point.x,
        y: point.y,
        color: bucketColor(facility.trust_bucket),
        id: facility.facility_id,
        name: facility.name,
      };
    });
    setOverlay({ cities, facilities: dots, zoom: map.getZoom() });
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
          // Fade out aggregate circles as user zooms in past 7
          "circle-opacity": [
            "interpolate", ["linear"], ["zoom"],
            3, 0.85,
            6.5, 0.85,
            8, 0.15,
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
            8, 0,
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
            3, 2.25,
            6, 3,
            8, 4,
            12, 6,
          ],
          "circle-color": ["get", "color"],
          // Fade in facility dots starting at zoom 5
          "circle-opacity": [
            "interpolate", ["linear"], ["zoom"],
            3, 0.45,
            5, 0.55,
            6, 0.72,
            10, 0.85,
          ],
          "circle-stroke-color": "#fff",
          "circle-stroke-width": [
            "interpolate", ["linear"], ["zoom"],
            5, 0,
            8, 0.5,
            12, 1,
          ],
        },
      });
    });

    const popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 10,
    });
    popupRef.current = popup;

    map.on("mouseenter", "state-circles", (e) => {
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
            `<span style="color:${p.color};font-weight:600">${pct}%</span> verified<br/>` +
            `${p.verified}/${p.claimed} facilities` +
            (p.per_100k > 0
              ? `<br/><span style="color:#6b7280">${Number(p.per_100k).toFixed(1)}/100k pop.</span>`
              : "") +
            `</div>`
        )
        .addTo(map);
    });

    map.on("mouseleave", "state-circles", () => {
      map.getCanvas().style.cursor = "";
      popup.remove();
    });

    map.on("click", "state-circles", (e) => {
      const f = e.features?.[0];
      if (f?.properties) {
        onRegionClick(
          f.properties.name as string,
          f.properties.level as AggregateLevel
        );
      }
    });

    map.on("mouseenter", "city-clusters", (e) => {
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
      popup.remove();
    });

    // --- Facility dot interactions ---
    map.on("mouseenter", "facility-dots", (e) => {
      map.getCanvas().style.cursor = "pointer";
      const f = e.features?.[0];
      if (!f || !f.properties) return;
      const p = f.properties;
      const score =
        p.trust_score != null ? Math.round(Number(p.trust_score)) : "N/A";
      popup
        .setLngLat(
          (f.geometry as GeoJSON.Point).coordinates as [number, number]
        )
        .setHTML(
          `<div style="font-family:system-ui;font-size:12px;line-height:1.5;min-width:140px">` +
            `<strong>${p.name}</strong><br/>` +
            `<span style="color:${p.color};font-weight:600">Trust ${score}</span>` +
            (p.city ? ` &middot; ${p.city}` : "") +
            (p.state ? `<br/><span style="color:#6b7280">${p.state}</span>` : "") +
            (p.type ? `<br/><span style="color:#6b7280;font-size:11px">${p.type}</span>` : "") +
            `</div>`
        )
        .addTo(map);
    });

    map.on("mouseleave", "facility-dots", () => {
      map.getCanvas().style.cursor = "";
      popup.remove();
    });

    map.on("click", "facility-dots", (e) => {
      const f = e.features?.[0];
      if (!f?.properties) return;
      const id = f.properties.facility_id;
      // Navigate to facility detail page
      window.open(`/facility/${id}`, "_blank");
    });

    return () => {
      resizeObserver.disconnect();
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
  }, [aggregates, buildGeoJSON]);

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
      {/* Capability pills */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-border shrink-0">
        <div className="flex flex-wrap gap-1.5 flex-1">
          {CAPABILITY_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => handleCapChange(opt.key)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                activeCap === opt.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-text-muted hover:border-text-muted/50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <LegendDot color="#10b981" label="≥70%" />
          <LegendDot color="#fbbf24" label="40–69%" />
          <LegendDot color="#ef4444" label="<40%" />
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border/50 shrink-0 bg-muted/30">
        <span className="text-xs text-text-muted">
          {aggregates.length} {level}s
        </span>
        <Badge variant="outline" className="text-xs font-mono h-5">
          {CAPABILITY_OPTIONS.find((o) => o.key === activeCap)?.label ??
            activeCap}
        </Badge>
        <span className="text-xs text-text-muted ml-auto font-mono tabular-nums">
          {totalVerified}/{totalClaimed} verified nationally
        </span>
      </div>

      {/* Map */}
      <div className="relative flex-1 min-h-[420px] overflow-hidden bg-map-water">
        <div ref={mapContainer} className="absolute inset-0 h-full w-full" />
        <div className="pointer-events-none absolute inset-0 z-10">
          {overlay.zoom < 7.5 && overlay.cities.map((city) => (
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
          {overlay.facilities.map((facility) => (
            <button
              key={facility.key}
              type="button"
              aria-label={facility.name}
              title={facility.name}
              onClick={() => window.open(`/facility/${facility.id}`, "_blank")}
              className="pointer-events-auto absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white shadow-sm transition-transform hover:scale-150"
              style={{ left: facility.x, top: facility.y, background: facility.color }}
            />
          ))}
        </div>
      </div>
    </div>
  );
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
